import { test, expect, type Page } from '@playwright/test';
import { ownerUserId } from '../lib/supabase';

// All authentication and data requests are intercepted. Never use live credentials.
async function mockWorkspace(page: Page) {
  let cards: Record<string, unknown>[] = [];
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
        cards = cards.map(c => ({ ...c, ...req.postDataJSON() })); data = cards[0];
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

const themeSelect = (page: Page) => page.getByRole('combobox', { name: 'Color theme' });
const expectTheme = (page: Page, theme: string) => expect(page.locator('html')).toHaveAttribute('data-theme', theme);

test.beforeEach(async ({ page }) => { await mockWorkspace(page); });

test.afterEach(async ({ page }) => {
  // Each test also checks that the theme never creates horizontal page overflow.
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

async function expectReadable(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    const ratios = await page.locator(selector).evaluateAll(elements => {
      const rgb = (color: string) => (color.match(/[\d.]+/g) || []).map(Number);
      const luminance = (color: number[]) => color.slice(0, 3).reduce((sum, channel, index) => {
        const c = channel / 255;
        return sum + (c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][index];
      }, 0);
      return elements.filter(el => el.getBoundingClientRect().width > 0).map(el => {
        const text = rgb(getComputedStyle(el).color);
        let parent: Element | null = el;
        let background = [255, 255, 255];
        while (parent) {
          const color = rgb(getComputedStyle(parent).backgroundColor);
          if (color.length === 3 || color[3] === 1) { background = color; break; }
          parent = parent.parentElement;
        }
        const a = luminance(text), b = luminance(background);
        return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      });
    });
    for (const ratio of ratios) expect(ratio, `${selector} text contrast`).toBeGreaterThanOrEqual(4.5);
  }
}

test('defaults to system, follows live changes, and keeps an explicit override', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(themeSelect(page)).toHaveValue('system');
  await expectTheme(page, 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expectTheme(page, 'light');
  await themeSelect(page).selectOption('dark');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await expectTheme(page, 'dark');
  await themeSelect(page).selectOption('system');
  await expectTheme(page, 'light');
});

test('persists a manual choice across reloads and other tabs without navigation', async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await themeSelect(page).selectOption('dark');
  await page.getByLabel('Email address').fill('unsaved@example.test');
  await themeSelect(page).selectOption('light');
  await expect(page.getByLabel('Email address')).toHaveValue('unsaved@example.test');
  await themeSelect(page).selectOption('dark');
  await page.reload();
  await expect(themeSelect(page)).toHaveValue('dark');
  await expectTheme(page, 'dark');
  const other = await context.newPage();
  await mockWorkspace(other);
  await other.goto('/');
  await themeSelect(other).selectOption('light');
  await expectTheme(page, 'light');
  await expect(themeSelect(page)).toHaveValue('light');
});

for (const theme of ['light', 'dark']) {
  test(`${theme}: login, dialogs, card create/edit/archive, and sign-out work`, async ({ page }) => {
    await page.goto('/');
    await themeSelect(page).selectOption(theme);
    if (theme === 'dark') await expectReadable(page, ['.login-panel h2', '.login-panel > p', '.login-panel label', '.login-story > p', '.eyebrow']);
    await page.screenshot({ path: test.info().outputPath(`login-${theme}.png`), fullPage: true });
    await login(page);
    await expectTheme(page, theme);
    await expect(themeSelect(page)).toHaveValue(theme);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'New card', exact: true }).click();
    await page.getByLabel('Card title').fill('A readable card');
    await page.getByLabel('Description', { exact: true }).fill('Theme changes must preserve this draft.');
    // Change the theme programmatically through the other tab; draft stays mounted.
    const other = await page.context().newPage();
    await mockWorkspace(other); await other.goto('/');
    await themeSelect(other).selectOption(theme === 'dark' ? 'light' : 'dark');
    await expect(page.getByLabel('Card title')).toHaveValue('A readable card');
    await themeSelect(other).selectOption(theme); await other.close();
    await page.getByLabel('Due date', { exact: true }).fill('2027-01-15');
    await page.getByLabel('Labels', { exact: true }).fill('Design, Personal, Review');
    await page.screenshot({ path: test.info().outputPath(`card-dialog-${theme}.png`), fullPage: true });
    if (theme === 'dark') await expectReadable(page, ['.modal h2', '.modal label', '.modal input', '.modal textarea']);
    await page.getByRole('button', { name: 'Save card' }).click();
    await expect(page.getByRole('heading', { name: 'A readable card' })).toBeVisible();
    if (theme === 'dark') await expectReadable(page, ['.card-body h3', '.card-body p', '.tag', '.priority', '.column-head h2', '.page-heading p']);
    await page.screenshot({ path: test.info().outputPath(`dashboard-${theme}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Edit A readable card' }).click();
    await page.getByLabel('Status', { exact: true }).selectOption('done');
    await page.getByRole('button', { name: 'Save card' }).click();
    await expect(page.locator('.column').filter({ has: page.getByRole('heading', { name: 'Done', exact: true }) }).getByRole('heading', { name: 'A readable card' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit A readable card' }).click();
    await page.getByRole('button', { name: 'Archive', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'A readable card' })).toHaveCount(0);
    if (test.info().project.name === 'mobile') await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('button', { name: 'Create a board', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Room for something new.' })).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.keyboard.press('Escape');
    if (test.info().project.name === 'mobile') await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    await expectTheme(page, theme);
  });
}

test('uses system theme if browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, 'getItem', { value: () => { throw new DOMException('Storage blocked', 'SecurityError'); } });
    Object.defineProperty(Storage.prototype, 'setItem', { value: () => { throw new DOMException('Storage blocked', 'SecurityError'); } });
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(themeSelect(page)).toHaveValue('system');
  await expectTheme(page, 'dark');
  await themeSelect(page).selectOption('light');
  await expectTheme(page, 'light');
});


test('sets the saved theme before hydration JavaScript can load', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => localStorage.setItem('orbit-theme', 'dark'));
  await page.route('**/_next/**/*.js*', route => route.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expectTheme(page, 'dark');
  await expect(page.locator('.boot')).toBeVisible();
  const background = await page.locator('.boot').evaluate(el => getComputedStyle(el).backgroundColor);
  expect(background).not.toBe('rgb(246, 248, 240)');
});

test('native theme selector is usable from the keyboard', async ({ page }) => {
  await page.goto('/');
  const selector = themeSelect(page);
  await selector.focus();
  await expect(selector).toBeFocused();
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(selector).toHaveValue('light');
  await expectTheme(page, 'light');
});
