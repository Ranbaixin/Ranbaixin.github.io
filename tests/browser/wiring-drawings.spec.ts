import { test, expect } from '@playwright/test';
const base = process.env.TEST_BASE || '/';
const url = () => base + 'projects/electrical-drawings/';

test('engineering sheet switches between feeder symbols and a terminal table', async ({ page }) => {
  await page.goto(url());
  const root = page.locator('[data-experience="wiring-query"]');
  await expect(root).toHaveAttribute('data-active-sheet', 'P01');
  await expect(root.locator('svg[data-drawing-page="P01"]')).toContainText('Q01');
  await root.locator('[data-sheet-button="P02"]').click();
  await expect(root.locator('svg[data-drawing-page="P02"]')).toBeVisible();
  await expect(root.locator('svg[data-drawing-page="P02"]')).toContainText('XT01 / 馈线端子排');
  await expect(root.locator('[data-page-status]')).toContainText('P02');
});

test('reciprocal evidence navigates to both sheets and leaves private fields undisclosed', async ({ page }) => {
  await page.goto(url());
  const root = page.locator('[data-experience="wiring-query"]');
  await root.locator('[data-trace-start]').click();
  await expect(root).toHaveAttribute('data-active-sheet', 'P02');
  await expect(root.locator('[data-trace-summary]')).toContainText('Q01:2 → XT01:21');
  await expect(root.locator('[data-evidence]')).toContainText('截面积未公开');
  await expect(root.locator('[data-evidence]')).toContainText('材质、颜色未核验');
  await root.locator('.evidence-navigation button').filter({ hasText: 'P01' }).click();
  await expect(root).toHaveAttribute('data-active-sheet', 'P01');
  await expect(root.locator('svg[data-drawing-page="P01"] [data-evidence-focus]')).toHaveAttribute('visibility', 'visible');
  await root.locator('.evidence-navigation button').filter({ hasText: 'P02' }).click();
  await expect(root).toHaveAttribute('data-active-sheet', 'P02');
  await expect(root.locator('[data-page-status]')).not.toContainText('100%');
});

test('same-network evidence remains different from a physical trace and device crossing', async ({ page }) => {
  await page.goto(url());
  const root = page.locator('[data-experience="wiring-query"]');
  await root.locator('[data-trace-source]').selectOption('p15');
  await root.getByRole('button', { name: '已确认网络', exact: true }).click();
  await expect(root.locator('[data-wiring-results]')).toContainText('Q02:95');
  await root.locator('[data-trace-target]').selectOption('p16');
  await root.locator('[data-trace-start]').click();
  await expect(root.locator('[data-trace-summary]')).toContainText('同网成员');
  await expect(root.locator('[data-edge-id].traced')).toHaveCount(0);
  await root.locator('[data-trace-source]').selectOption('p1');
  await root.locator('[data-trace-target]').selectOption('p5');
  await root.locator('[data-trace-start]').click();
  await expect(root.locator('[data-trace-summary]')).toContainText('器件内部');
  await expect(root.locator('[data-edge-id].traced')).toHaveCount(0);
});

test('drawing zoom, pointer drag and keyboard pan stay inside the sheet', async ({ page }) => {
  await page.goto(url());
  const root = page.locator('[data-experience="wiring-query"]');
  await root.getByRole('button', { name: '放大图纸', exact: true }).click();
  const canvas = root.locator('svg[data-drawing-page="P01"]');
  await canvas.scrollIntoViewIfNeeded();
  const before = await canvas.getAttribute('viewBox');
  const rect = (await canvas.boundingBox())!;
  await page.mouse.move(rect.x + rect.width * .92, rect.y + rect.height * .85);
  await page.mouse.down(); await page.mouse.move(rect.x + rect.width * .92 - 60, rect.y + rect.height * .85 - 30, { steps: 8 }); await page.mouse.up();
  expect(await canvas.getAttribute('viewBox')).not.toBe(before);
  const dragged = await canvas.getAttribute('viewBox');
  await canvas.focus(); await page.keyboard.press('ArrowLeft');
  expect(await canvas.getAttribute('viewBox')).not.toBe(dragged);
  const bounds = (await canvas.getAttribute('viewBox'))!.split(' ').map(Number);
  expect(bounds[0] >= 0 && bounds[1] >= 0 && bounds[0] + bounds[2] <= 1000 && bounds[1] + bounds[3] <= 640).toBe(true);
  await root.getByRole('button', { name: '显示整页', exact: true }).click();
  await expect(canvas).toHaveAttribute('viewBox', '0 0 1000 640');
});

test('search editing, body copying and keyboard port selection remain usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(url());
  const search = page.getByLabel('搜索端口');
  await expect(page.locator('[data-port-id="p20"]')).toHaveAttribute('tabindex', '-1');
  await search.fill('Q02:2'); await search.press('Control+A');
  expect(await search.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([0, 5]);
  await expect(search).not.toHaveCSS('caret-color', 'rgba(0, 0, 0, 0)');
  await page.getByRole('button', { name: '选择端口 Q02:2', exact: true }).click();
  await expect(page.locator('[data-wiring-selection]')).toContainText('Q02:2');
  const graphic = page.getByRole('button', { name: '图中端口 Q02:2', exact: true });
  await graphic.focus(); await page.keyboard.press('Enter'); await expect(graphic).toBeFocused();
  const body = page.locator('.case-invitation');
  await body.dblclick({ position: { x: 8, y: 10 } });
  expect(await body.evaluate(el => !!getSelection()?.toString() && el.contains(getSelection()?.anchorNode ?? null))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('[data-trace-source]').selectOption('p20');
  await expect(page.locator('[data-port-id="p20"]')).toHaveAttribute('tabindex', '0');
});

test('static and printed output retain both engineering pages', async ({ browser, page }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await context.newPage();
  await staticPage.goto(new URL(url(), process.env.TEST_URL || 'http://127.0.0.1:4321').toString());
  for (const id of ['P01', 'P02']) await expect(staticPage.locator(`svg[data-drawing-page="${id}"]`)).toBeVisible();
  await expect(staticPage.locator('[data-drawing-toolbar]')).not.toBeVisible();
  await context.close();
  await page.goto(url());
  await page.locator('[data-trace-start]').click();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('[data-page-status]')).not.toBeVisible();
  for (const id of ['P01', 'P02']) { await expect(page.locator(`svg[data-drawing-page="${id}"]`)).toBeVisible(); await expect(page.locator(`svg[data-drawing-page="${id}"]`)).toHaveAttribute('viewBox', '0 0 1000 640'); }
});
