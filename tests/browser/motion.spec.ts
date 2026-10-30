import { test, expect } from '@playwright/test';
const base = process.env.TEST_BASE || '/';
const url = (path = '') => base + path;

test('hero scenes switch by button and keyboard while project links remain usable', async ({ page }) => {
  await page.goto(url());
  const stage = page.locator('[data-motion-stage]');
  await expect(stage).toHaveAttribute('data-render', 'canvas');
  await page.getByRole('button', { name: '预测曲面', exact: true }).click();
  await expect(stage).toHaveAttribute('data-scene', 'energy');
  await expect(page.locator('[data-scene-caption]')).toContainText('预测');
  await page.getByRole('button', { name: '连接网络', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(stage).toHaveAttribute('data-scene', 'wiring');
  await page.locator('.node-cad').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/projects\/dwg-agent\/$/);
  await expect(page.getByRole('button', { name: '校验并继续', exact: true })).toBeVisible();
});

test('drag rotation responds without swallowing vertical touch scrolling', async ({ page }) => {
  await page.goto(url());
  const canvas = page.locator('[data-stage-canvas]');
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * .4, box.y + box.height * .5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .7, box.y + box.height * .6, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('[data-motion-stage]')).toHaveAttribute('data-interacted', 'true');
  await expect(canvas).toHaveCSS('touch-action', 'pan-y');
});

test('reduced motion updates scenes instantly and stops continuous canvas frames', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url());
  const stage = page.locator('[data-motion-stage]');
  await expect(stage).toHaveAttribute('data-playing', 'false');
  await page.getByRole('button', { name: '预测曲面', exact: true }).click();
  await expect(stage).toHaveAttribute('data-scene', 'energy');
  await expect(stage).toHaveAttribute('data-playing', 'false');
  await expect(page.locator('h1')).toHaveText('Ranxin');
});

test('canvas failure preserves the SVG fallback, project links and readable identity', async ({ page }) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext; });
  await page.goto(url());
  await expect(page.locator('[data-stage-fallback]')).toBeVisible();
  await expect(page.locator('[data-stage-canvas]')).not.toBeVisible();
  await expect(page.locator('.stage-drag-hint')).toContainText('静态');
  await expect(page.locator('h1')).toHaveText('Ranxin');
  await page.locator('.node-cad').click();
  await expect(page).toHaveURL(/projects\/dwg-agent\/$/);
});

test('stage pauses outside the viewport and mobile layout keeps real project controls', async ({ page }) => {
  await page.goto(url());
  await page.locator('#contact').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-motion-stage]')).toHaveAttribute('data-playing', 'false');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url());
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  await page.getByRole('button', { name: '连接网络', exact: true }).click();
  await expect(page.locator('[data-motion-stage]')).toHaveAttribute('data-scene', 'wiring');
});

test('canvas context loss cannot restart a hidden animation when preferences change', async ({ page }) => {
  await page.goto(url());
  const stage = page.locator('[data-motion-stage]');
  await expect(stage).toHaveAttribute('data-render', 'canvas');
  await page.getByRole('button', { name: '预测曲面', exact: true }).click();
  await page.locator('[data-stage-canvas]').dispatchEvent('contextlost');
  await page.locator('[data-theme-toggle]').click();
  await expect(stage).toHaveAttribute('data-render', 'fallback');
  await expect(stage).toHaveAttribute('data-scene', 'cad');
  await expect(stage).toHaveAttribute('data-playing', 'false');
  await expect(page.locator('[data-stage-canvas]')).not.toBeVisible();
  await expect(page.locator('.stage-drag-hint')).toContainText('静态');
});

test('system color changes redraw the canvas with the matching dark palette', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(url());
  await expect(page.locator('[data-motion-stage]')).toHaveAttribute('data-render', 'canvas');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => page.locator('[data-stage-canvas]').evaluate(canvas => (canvas as HTMLCanvasElement).getContext('2d')?.strokeStyle)).toMatch(/140,\s*174,\s*255/);
});

test('reading progress resynchronizes after a suspended page resumes', async ({ page }) => {
  await page.goto(url());
  await page.evaluate(() => {
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    window.scrollTo(0, 1000);
  });
  await expect.poll(() => page.locator('.reading-progress').evaluate(element => new DOMMatrix(getComputedStyle(element).transform).a)).toBeGreaterThan(0);
});
