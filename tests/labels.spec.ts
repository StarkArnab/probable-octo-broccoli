import { test, expect, type Page } from '@playwright/test';
import { ownerUserId } from '../lib/supabase';

// All authentication and data requests are intercepted. Never use live credentials.
async function mockWorkspace(page: Page) {
  let cards: Record<string, unknown>[] = [{ id: 'legacy-card', board_id: 'test-board', user_id: ownerUserId, title: 'Legacy card', description: '', status: 'todo', priority: 'medium', due_date: null, labels: ['Personal'], position: 0, archived: false }];
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
      if (['POST', 'PATCH'].includes(req.method()) && ((req.postDataJSON().labels?.length ?? 0) > 8 || req.postDataJSON().title === 'Database rejection')) return route.fulfill({ status: 400, contentType: 'application/json', headers, body: JSON.stringify({ message: 'new row violates check constraint cards_labels_check', code: '23514' }) });
      if (req.method() === 'POST') {
        const card = { id: 'test-card', archived: false, created_at: board.created_at, ...req.postDataJSON() };
        cards.push(card); data = card;
      } else if (req.method() === 'PATCH') {
        const id = url.searchParams.get('id')?.replace('eq.', ''); cards = cards.map(c => c.id === id ? { ...c, ...req.postDataJSON() } : c); data = cards.find(c => c.id === id);
      } else if (req.method() === 'DELETE') { cards = []; return route.fulfill({ status: 204, headers }); }
      else data = cards;
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

test.beforeEach(async ({ page }) => { await mockWorkspace(page); await page.goto('/'); await login(page); });

test('adds, searches, deduplicates and persists independent labels', async ({ page }) => {
  await page.getByRole('button', { name: 'New card', exact: true }).click();
  await page.getByLabel('Card title').fill('Multiple labels');
  const input = page.getByRole('combobox', { name: 'Labels', exact: true });
  await input.fill('pers');
  await page.getByRole('option', { name: 'Personal', exact: true }).click();
  await input.fill('Research notes');
  await input.press('Enter');
  await input.fill('research NOTES');
  await input.press('Enter');
  await expect(page.getByRole('button', { name: 'Remove Research notes', exact: true })).toHaveCount(1);
  await input.fill('Work');
  await page.getByRole('button', { name: 'Add label', exact: true }).click();
  await page.getByRole('button', { name: 'Remove Personal', exact: true }).click();
  await page.getByRole('button', { name: 'Save card' }).click();
  const card = page.locator('.task-card').filter({ has: page.getByRole('heading', { name: 'Multiple labels', exact: true }) });
  await expect(card.locator('.tag')).toHaveText(['Research notes', 'Work']);
  await page.reload();
  await page.getByRole('button', { name: 'Edit Multiple labels', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove Research notes', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove Work', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove Personal', exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('preserves existing labels and enforces the eight-label database limit', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Legacy card', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove Personal', exact: true })).toBeVisible();
  const input = page.getByRole('combobox', { name: 'Labels', exact: true });
  for (let n = 1; n <= 7; n++) { await input.fill(`Label ${n}`); await input.press('Enter'); }
  await input.fill('Ninth label');
  await input.press('Enter');
  await expect(page.getByRole('button', { name: 'Remove Ninth label', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add label', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Save card' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('8 labels');
  await input.fill('');
  await page.getByRole('button', { name: 'Save card' }).click();
  await expect(page.locator('.task-card .tag')).toHaveCount(8);
  await page.reload();
  await expect(page.locator('.task-card .tag')).toHaveCount(8);
});

test('keeps labels editable after a database constraint rejection', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Legacy card', exact: true }).click();
  await page.getByLabel('Card title').fill('Database rejection');
  const input = page.getByRole('combobox', { name: 'Labels', exact: true });
  await input.fill('Pending label');
  await page.getByRole('button', { name: 'Save card' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('check constraint');
  await expect(page.getByRole('button', { name: 'Remove Personal', exact: true })).toBeVisible();
  await expect(input).toHaveValue('Pending label');
  await page.getByLabel('Card title').fill('Recovered card');
  await page.getByRole('button', { name: 'Save card' }).click();
  await expect(page.locator('.task-card .tag')).toHaveText(['Personal', 'Pending label']);
});

test('supports keyboard reuse, blank labels, and responsive long chips', async ({ page }) => {
  await page.getByRole('button', { name: 'New card', exact: true }).click();
  const input = page.getByRole('combobox', { name: 'Labels', exact: true });
  await input.fill('   ');
  await input.press('Enter');
  await expect(page.getByRole('list', { name: 'Selected labels' })).toHaveCount(0);
  await input.fill('pers');
  await input.press('ArrowDown');
  await expect(page.getByRole('option', { name: 'Personal', exact: true })).toHaveAttribute('aria-selected', 'true');
  await input.press('Enter');
  await expect(page.getByRole('button', { name: 'Remove Personal', exact: true })).toBeVisible();
  await input.fill('A long custom label with spaces that should wrap within the editor and card');
  await input.press('Enter');
  await page.getByLabel('Card title').fill('Wrapped labels');
  await page.screenshot({ path: test.info().outputPath('label-picker.png'), fullPage: true });
  const picker = page.locator('.label-picker');
  expect(await picker.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.getByRole('button', { name: 'Save card' }).click();
  await expect(page.locator('.task-card').filter({ has: page.getByRole('heading', { name: 'Wrapped labels' }) }).locator('.tag')).toHaveCount(2);
  await page.getByRole('button', { name: 'New card', exact: true }).click();
  await input.focus();
  await input.press('ArrowUp');
  await expect(page.getByRole('option').last()).toHaveAttribute('aria-selected', 'true');
  await input.press('Enter');
  await expect(page.getByRole('button', { name: 'Remove A long custom label with spaces that should wrap within the editor and card', exact: true })).toBeVisible();
});

test('keeps keyboard suggestions visible inside the scrolling list', async ({ page }) => {
  await page.route('https://orbit-test.supabase.co/rest/v1/cards?**', route => route.fulfill({
    status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(Array.from({ length: 24 }, (_, index) => ({
      id: `label-source-${index}`, board_id: 'test-board', user_id: ownerUserId,
      title: `Source ${index}`, description: '', status: 'todo', priority: 'medium', due_date: null,
      labels: [`Reusable label ${String(index + 1).padStart(2, '0')}`], position: index, archived: false,
    }))),
  }));
  await page.reload();
  await page.getByRole('button', { name: 'New card', exact: true }).click();
  const input = page.getByRole('combobox', { name: 'Labels', exact: true });
  await input.focus();
  const list = page.getByRole('listbox', { name: 'Existing labels' });
  await list.scrollIntoViewIfNeeded();
  const outerScroll = () => page.evaluate(() => ({ page: window.scrollY, modal: document.querySelector('.modal')!.scrollTop }));
  const before = await outerScroll();
  for (let index = 0; index < 20; index++) await input.press('ArrowDown');
  const active = list.getByRole('option', { selected: true });
  await expect(active).toHaveText('Reusable label 20');
  const activeInsideList = () => active.evaluate(element => {
    const option = element.getBoundingClientRect();
    const list = element.parentElement!;
    const top = list.getBoundingClientRect().top + list.clientTop;
    return option.top >= top && option.bottom <= top + list.clientHeight;
  });
  await expect.poll(activeInsideList).toBe(true);
  expect(await outerScroll()).toEqual(before);
  // Wrapping back to the start must also reveal the newly active option.
  for (let index = 0; index < 5; index++) await input.press('ArrowDown');
  await expect(active).toHaveText('Reusable label 01');
  await expect.poll(activeInsideList).toBe(true);
  expect(await outerScroll()).toEqual(before);
});
