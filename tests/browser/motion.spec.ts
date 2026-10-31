import { test, expect } from '@playwright/test';
const base = process.env.TEST_BASE || '/';
const url = (path = '') => base + path;

test('home tabs support arrows and native links enter the real project', async ({ page }) => {
  await page.goto(url());
  await page.getByRole('tab', { name: '拆板工作台' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: '气象与出力' })).toBeFocused();
  await expect(page.locator('[data-home-panel="energy"]')).toBeVisible();
  await page.keyboard.press('End');
  await expect(page.locator('[data-home-panel="wiring"]')).toBeVisible();
  await page.keyboard.press('Home');
  await page.locator('.node-cad').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/projects\/dwg-agent\/$/);
  await expect(page.getByRole('button', { name: '展平', exact: true })).toBeVisible();
});

test('reduced motion reaches final geometry immediately and performs no continuing animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url());
  const cad = page.locator('[data-experience="plate-split"]');
  await cad.getByRole('button', { name: '展平', exact: true }).click();
  await expect(cad.locator('[data-split-scene-step]')).toHaveText('03 / 展平');
  const before = await cad.locator('.plate-front').evaluateAll(nodes => nodes.map(el => el.getAttribute('points')));
  await page.waitForTimeout(150);
  expect(await cad.locator('.plate-front').evaluateAll(nodes => nodes.map(el => el.getAttribute('points')))).toEqual(before);
  expect(await cad.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
});

test('inactive project panels and offscreen workbenches pause their animations', async ({ page }) => {
  await page.goto(url());
  const cad = page.locator('[data-experience="plate-split"]');
  await expect(cad).toHaveAttribute('data-paused', 'false');
  await cad.getByRole('button', { name: '拆开', exact: true }).click();
  await page.getByRole('tab', { name: '跨页追线' }).click();
  await expect(cad).toHaveAttribute('data-paused', 'true');
  await page.locator('[data-trace-start]').click();
  await page.locator('#contact').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-experience="wiring-query"]')).toHaveAttribute('data-paused', 'true');
});

test('without scripts all three home workbenches show meaningful static drawings', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(new URL(url(), process.env.TEST_URL || 'http://127.0.0.1:4321').toString());
  await expect(page.locator('[data-home-panel]')).toHaveCount(3);
  for (const key of ['cad', 'energy', 'wiring']) await expect(page.locator(`[data-home-panel="${key}"] svg`).first()).toBeVisible();
  await expect(page.locator('[data-motion-ribbon]')).not.toBeVisible();
  await expect(page.locator('[data-demo-controls]:visible')).toHaveCount(0);
  await context.close();
});

test('system color changes update diagram colors and keep dark artwork backgrounds subdued', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(url());
  const initial = await page.locator('.plate-top .plate-front').first().evaluate(el => getComputedStyle(el).stroke);
  await page.emulateMedia({ colorScheme: 'dark' });
  const dark = await page.locator('.plate-top .plate-front').first().evaluate(el => getComputedStyle(el).stroke);
  expect(dark).not.toBe(initial);
  await expect(page.locator('.art-energy')).toHaveCSS('--art-accent', '#72cec1');
  await expect(page.locator('.motion-cursor')).toHaveCount(0);
});

test('mobile touch controls, project spacing and resumed reading progress remain usable', async ({ browser, page }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobile = await context.newPage();
  await mobile.goto(new URL(url(), process.env.TEST_URL || 'http://127.0.0.1:4321').toString());
  await mobile.getByRole('button', { name: '拆开', exact: true }).tap();
  await expect(mobile.locator('[data-split-phase]')).toHaveValue('50');
  await mobile.getByRole('tab', { name: '气象与出力' }).tap();
  await mobile.getByLabel('时间点', { exact: true }).fill('3');
  await expect(mobile.locator('[data-time-caption]')).toHaveText('T+3 h');
  await mobile.getByRole('tab', { name: '跨页追线' }).tap();
  await mobile.locator('[data-trace-source]').selectOption('p1');
  await mobile.locator('[data-trace-start]').tap();
  await expect(mobile.locator('[data-trace-summary]')).toContainText('B:1');
  await expect(mobile.locator('.wire-port.connected .port-hit').first()).toHaveCSS('stroke', 'none');
  expect(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.close();
  await page.goto(url());
  const distance = await page.evaluate(() => document.querySelector('.project-row .project-visual-link')!.getBoundingClientRect().top - document.querySelector('[data-motion-ribbon]')!.getBoundingClientRect().bottom);
  expect(distance).toBeLessThanOrEqual(300);
  await page.evaluate(() => { dispatchEvent(new PageTransitionEvent('pagehide')); scrollTo(0, 500); dispatchEvent(new PageTransitionEvent('pageshow')); });
  await expect.poll(() => page.locator('.reading-progress').evaluate(el => getComputedStyle(el).transform)).not.toBe('matrix(0, 0, 0, 1, 0, 0)');
});
