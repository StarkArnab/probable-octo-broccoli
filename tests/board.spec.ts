import { test, expect, type Page } from '@playwright/test';
import { ownerUserId } from '../lib/supabase';

// All authentication and data requests are intercepted. Never use live credentials.
async function mockWorkspace(page: Page, duplicatePositions = false, longTodo = false) {
  let cards: Record<string, unknown>[] = Array.from({ length: 45 }, (_, i) => ({
    id: `card-${i}`, board_id: 'test-board', user_id: ownerUserId, title: `Task ${i}`,
    description: 'Drag regression card', status: i < 36 ? (longTodo ? 'todo' : 'backlog') : (longTodo ? 'progress' : 'todo'), priority: 'medium',
    due_date: null, labels: [], position: duplicatePositions ? 0 : i * 1024, archived: false, created_at: '2026-10-30T00:00:00Z',
  }));
  const board = { id: 'test-board', user_id: ownerUserId, name: 'Theme review', description: 'A private test board', created_at: '2026-10-30T00:00:00Z' };
  const user = { id: ownerUserId, email: 'owner@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: board.created_at };
  const payload = Buffer.from(JSON.stringify({ sub: ownerUserId, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url');
  await page.route('https://orbit-test.supabase.co/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    let data: unknown;
    if (url.pathname.endsWith('/token')) data = { access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.local-test`, refresh_token: 'local-test', token_type: 'bearer', expires_in: 3600, user };
    else if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, headers });
    else if (url.pathname.endsWith('/user')) data = user;
    else if (url.pathname.endsWith('/boards')) data = req.method() === 'POST' ? { ...board, ...req.postDataJSON() } : [board];
    else if (url.pathname.endsWith('/cards')) {
      if (req.method() === 'POST') {
        const card = { id: 'test-card', archived: false, created_at: board.created_at, ...req.postDataJSON() };
        cards.push(card); data = card;
      } else if (req.method() === 'PATCH') {
        const id = url.searchParams.get('id')?.replace('eq.', '');
        cards = cards.map(c => c.id === id ? { ...c, ...req.postDataJSON() } : c); data = cards.find(c => c.id === id);
      } else if (req.method() === 'DELETE') { cards = []; return route.fulfill({ status: 204, headers }); }
      else data = [...cards].sort((a, b) => Number(a.position) - Number(b.position));
    } else throw new Error(`Unexpected API request: ${req.method()} ${url.pathname}`);
    await route.fulfill({ status: 200, contentType: 'application/json', headers, body: JSON.stringify(data) });
  });
}

async function login(page: Page) {
  await page.getByLabel('Email address').fill('owner@example.test');
  await page.getByLabel('Password', { exact: true }).fill('local-test-only');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Theme review.' })).toBeVisible();
}

const column = (page: Page, name: string) => page.locator('.column').filter({ has: page.getByRole('heading', { name, exact: true }) });

test.beforeEach(async ({ page }, info) => { await mockWorkspace(page, info.title.includes('duplicate positions'), info.title.includes('pointer moves long-list')); await page.goto('/'); await login(page); });

test('long columns scroll independently within a bounded drop surface', async ({ page }) => {
  const source = column(page, 'Backlog');
  const target = column(page, 'To do');
  await expect.poll(() => source.evaluate(el => { const stack = el.querySelector('.card-stack')!; return stack.scrollHeight > stack.clientHeight; })).toBe(true);
  await source.locator('.card-stack').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect(source.getByRole('heading', { name: 'Task 35', exact: true })).toBeVisible();
  expect(await target.locator('.card-stack').evaluate(el => el.scrollTop)).toBe(0);
  const heights = await page.locator('.column').evaluateAll(els => els.map(el => el.getBoundingClientRect().height));
  expect(new Set(heights).size).toBe(1);
  await page.screenshot({ path: test.info().outputPath('long-board.png'), fullPage: true });
});

async function keyboardMove(page: Page, title: string, keys: string[]) {
  await page.getByRole('button', { name: `Move ${title}`, exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.drag-preview')).toBeVisible();
  for (const key of keys) { await page.keyboard.press(key); await expect(page.getByRole('status')).toContainText(key === 'ArrowDown' ? 'over droppable area card-1.' : 'over droppable area card-36.'); }
  await page.keyboard.press('Space');
  await expect(page.locator('.drag-preview')).toHaveCount(0);
}

test('reorders and persists a card in the same column', async ({ page }) => {
  await keyboardMove(page, 'Task 0', ['ArrowDown']);
  await expect(column(page, 'Backlog').locator('h3').first()).toHaveText('Task 1');
  await page.reload();
  await expect(column(page, 'Backlog').locator('h3').first()).toHaveText('Task 1');
  await expect(page.locator('.task-card')).toHaveCount(45);
});

test('moves between statuses and persists through reload without losing cards', async ({ page }) => {
  await keyboardMove(page, 'Task 0', ['ArrowRight']);
  await expect(column(page, 'To do').getByRole('heading', { name: 'Task 0', exact: true })).toBeVisible();
  await page.reload();
  await expect(column(page, 'To do').getByRole('heading', { name: 'Task 0', exact: true })).toBeVisible();
  await expect(page.locator('.task-card')).toHaveCount(45);
});

for (const index of [0, 18, 35]) {
  test(`pointer moves long-list card ${index} from To do to In progress`, async ({ page }) => {
    await column(page, 'To do').evaluate(el => { el.parentElement!.scrollLeft = (el as HTMLElement).offsetLeft - el.parentElement!.offsetLeft; });
    const handle = page.getByRole('button', { name: `Move Task ${index}`, exact: true });
    await handle.scrollIntoViewIfNeeded();
    const start = await handle.boundingBox();
    const target = await column(page, 'In progress').locator('.card-stack').boundingBox();
    if (!start || !target) throw new Error('Missing drag geometry');
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(start.x + start.width / 2 + 8, start.y + start.height / 2, { steps: 3 });
    await page.mouse.move(target.x + 25, target.y + 25, { steps: 15 });
    await page.mouse.up();
    await expect(column(page, 'In progress').getByRole('heading', { name: `Task ${index}`, exact: true })).toBeVisible();
    await page.reload();
    await expect(column(page, 'In progress').getByRole('heading', { name: `Task ${index}`, exact: true })).toBeVisible();
    await expect(page.locator('.task-card')).toHaveCount(45);
  });
}

test('touch handle moves a card while the card body still allows scrolling', async ({ page, context }) => {
  test.skip(test.info().project.name !== 'mobile');
  const handle = page.getByRole('button', { name: 'Move Task 0', exact: true });
  const start = await handle.boundingBox();
  const target = await column(page, 'To do').locator('.card-stack').boundingBox();
  if (!start || !target) throw new Error('Missing touch geometry');
  const client = await context.newCDPSession(page);
  const x = start.x + start.width / 2, y = start.y + start.height / 2;
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let step = 1; step <= 12; step++) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (target.x + 25 - x) * step / 12, y: y + (target.y + 25 - y) * step / 12 }] });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(column(page, 'To do').getByRole('heading', { name: 'Task 0', exact: true })).toBeVisible();
  await page.reload();
  await expect(column(page, 'To do').getByRole('heading', { name: 'Task 0', exact: true })).toBeVisible();
  const stack = column(page, 'Backlog').locator('.card-stack');
  const scroll = await stack.boundingBox();
  if (!scroll) throw new Error('Missing scroll geometry');
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: scroll.x + 50, y: scroll.y + scroll.height - 30 }] });
  for (let step = 1; step <= 12; step++) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: scroll.x + 50, y: scroll.y + scroll.height - 30 - step * 15 }] });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => stack.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
});

test('pointer inserts a card directly after its neighbor instead of appending', async ({ page }) => {
  const handle = page.getByRole('button', { name: 'Move Task 0', exact: true });
  const start = await handle.boundingBox();
  const target = await page.locator('.task-card').filter({ has: page.getByRole('heading', { name: 'Task 1', exact: true }) }).boundingBox();
  if (!start || !target) throw new Error('Missing drag geometry');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + 8, start.y + 8, { steps: 3 });
  await page.mouse.move(target.x + 40, target.y + target.height / 2, { steps: 15 });
  await page.mouse.up();
  await expect(column(page, 'Backlog').locator('h3').nth(0)).toHaveText('Task 1');
  await expect(column(page, 'Backlog').locator('h3').nth(1)).toHaveText('Task 0');
  await expect(column(page, 'Backlog').locator('h3').nth(2)).toHaveText('Task 2');
});

test('a rejected save keeps the original column and shows the error', async ({ page }) => {
  await page.route('https://orbit-test.supabase.co/rest/v1/cards*', async route => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    await route.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ message: 'Unable to save this move' }) });
  });
  await keyboardMove(page, 'Task 0', ['ArrowRight']);
  await expect(page.locator('.notice[role=alert]')).toContainText('Unable to save this move');
  await expect(column(page, 'Backlog').getByRole('heading', { name: 'Task 0', exact: true })).toBeVisible();
  await expect(page.locator('.task-card')).toHaveCount(45);
});

test('duplicate positions fail safely instead of persisting an incorrect order', async ({ page }) => {
  await keyboardMove(page, 'Task 0', ['ArrowDown']);
  await expect(page.locator('.notice[role=alert]')).toContainText('no space between their saved positions');
  await expect(column(page, 'Backlog').locator('h3').first()).toHaveText('Task 0');
  await expect(page.locator('.task-card')).toHaveCount(45);
});

test('moves through empty In progress and Done columns', async ({ page }) => {
  await keyboardMove(page, 'Task 0', ['ArrowRight']);
  for (const [id, name] of [['progress', 'In progress'], ['done', 'Done']]) {
    await page.getByRole('button', { name: 'Move Task 0', exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(page.locator('.drag-preview')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('status')).toContainText(`over droppable area ${id}.`);
    await page.keyboard.press('Space');
    await expect(column(page, name).getByRole('heading', { name: 'Task 0', exact: true })).toBeVisible();
    await expect(page.locator('.drag-preview')).toHaveCount(0);
  }
  await page.reload();
  await expect(column(page, 'Done').getByRole('heading', { name: 'Task 0', exact: true })).toBeVisible();
  await expect(page.locator('.task-card')).toHaveCount(45);
});

test('dragging near the bottom edge scrolls the column without losing the drag', async ({ page }) => {
  const handle = page.getByRole('button', { name: 'Move Task 0', exact: true });
  const start = await handle.boundingBox();
  const stack = column(page, 'Backlog').locator('.card-stack');
  const surface = await stack.boundingBox();
  if (!start || !surface) throw new Error('Missing drag geometry');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(surface.x + 60, surface.y + surface.height - 5, { steps: 20 });
  await expect(page.locator('.drag-preview')).toBeVisible();
  await expect.poll(() => stack.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  const target = await column(page, 'To do').locator('.card-stack').boundingBox();
  if (!target) throw new Error('Missing target');
  await page.mouse.move(target.x + 25, target.y + 25, { steps: 15 });
  await page.mouse.up();
  await expect(column(page, 'To do').getByRole('heading', { name: 'Task 0', exact: true })).toBeVisible();
  await expect(page.locator('.task-card')).toHaveCount(45);
});

for (const zone of ['gap', 'top padding'] as const) {
  test(`cross-column pointer drop in ${zone} persists the indicated insertion`, async ({ page }) => {
    const handle = page.getByRole('button', { name: 'Move Task 0', exact: true });
    const start = await handle.boundingBox();
    const stack = column(page, 'To do').locator('.card-stack');
    const surface = await stack.boundingBox();
    const first = await stack.locator('.task-card').nth(0).boundingBox();
    const second = await stack.locator('.task-card').nth(1).boundingBox();
    if (!start || !surface || !first || !second) throw new Error('Missing insertion geometry');
    const y = zone === 'gap' ? (first.y + first.height + second.y) / 2 : surface.y + 1;
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(start.x + start.width / 2 + 8, start.y + start.height / 2, { steps: 3 });
    await page.mouse.move(surface.x + 25, y, { steps: 15 });
    await page.mouse.up();
    const expected = zone === 'gap' ? ['Task 36', 'Task 0', 'Task 37'] : ['Task 0', 'Task 36', 'Task 37'];
    await expect(stack.locator('h3').filter({ hasText: /^Task (0|36|37)$/ })).toHaveText(expected);
    await page.reload();
    await expect(column(page, 'To do').locator('h3').filter({ hasText: /^Task (0|36|37)$/ })).toHaveText(expected);
    await expect(page.locator('.task-card')).toHaveCount(45);
  });
}

for (const direction of ['down', 'up'] as const) {
  test(`same-column pointer insertion ${direction} has no index offset`, async ({ page }) => {
    const source = direction === 'down' ? 0 : 1;
    const handle = page.getByRole('button', { name: `Move Task ${source}`, exact: true });
    const start = await handle.boundingBox();
    const stack = column(page, 'Backlog').locator('.card-stack');
    const surface = await stack.boundingBox();
    const neighbor = await stack.locator('.task-card').nth(direction === 'down' ? 1 : 0).boundingBox();
    if (!start || !surface || !neighbor) throw new Error('Missing reorder geometry');
    const y = direction === 'down' ? neighbor.y + neighbor.height + 5 : surface.y + 1;
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(start.x + start.width / 2 + 8, start.y + start.height / 2, { steps: 3 });
    await page.mouse.move(surface.x + 25, y, { steps: 15 });
    await page.mouse.up();
    await expect(stack.locator('h3').nth(0)).toHaveText('Task 1');
    await expect(stack.locator('h3').nth(1)).toHaveText('Task 0');
    await expect(stack.locator('h3').nth(2)).toHaveText('Task 2');
    await page.reload();
    await expect(column(page, 'Backlog').locator('h3').nth(0)).toHaveText('Task 1');
    await expect(column(page, 'Backlog').locator('h3').nth(1)).toHaveText('Task 0');
    await expect(page.locator('.task-card')).toHaveCount(45);
  });
}
