import { test, expect } from '@playwright/test';
const base = process.env.TEST_BASE || '/';
const url = (path = '') => base + path;

test('home workbench opens with real BH plates and preserves each project state', async ({ page }) => {
  await page.goto(url());
  const home = page.locator('[data-home-workbench]');
  await expect(home).toBeVisible({ timeout: 1500 });
  const cad = home.locator('[data-experience="plate-split"]');
  await expect(cad).toHaveAttribute('data-enhanced', 'true');
  await cad.locator('[data-split-kind]').selectOption('box');
  await cad.getByRole('button', { name: '展平', exact: true }).click();
  await expect(cad.locator('[data-split-part]')).toHaveCount(4);
  await home.getByRole('tab', { name: '气象与出力' }).click();
  const energy = home.locator('[data-experience="output-forecast"]');
  await expect(energy).toHaveAttribute('data-enhanced', 'true');
  await energy.locator('[data-energy-kind]').selectOption('solar');
  await home.getByRole('tab', { name: '拆板工作台' }).click();
  await expect(cad.locator('[data-split-kind]')).toHaveValue('box');
  await home.getByRole('tab', { name: '气象与出力' }).click();
  await expect(energy.locator('[data-energy-kind]')).toHaveValue('solar');
  await page.reload();
  await expect(page.locator('[data-split-kind]').first()).toHaveValue('bh');
});

test('split selection links geometry, flat view and comparison while incomplete samples stay blocked', async ({ page }) => {
  await page.goto(url('projects/dwg-agent/'));
  const cad = page.locator('[data-experience="plate-split"]');
  await expect(cad).toHaveAttribute('data-enhanced', 'true');
  await cad.locator('[data-split-kind]').selectOption('box');
  await cad.getByRole('button', { name: '右腹板', exact: true }).click();
  await expect(cad.locator('[data-split-selection]')).toContainText('右腹板');
  const ratio = await cad.locator('.compare-normal').evaluate(el => Number(el.getAttribute('width')) / Number(el.getAttribute('height')));
  expect(Math.abs(ratio - 1200 / 376)).toBeLessThan(1e-10);
  await expect(cad.locator('[data-split-geometry] [data-plate-id="right"]')).toHaveAttribute('aria-pressed', 'true');
  await cad.getByRole('button', { name: '展平', exact: true }).click();
  await expect(cad.locator('[data-split-phase]')).toHaveValue('100');
  const holes = await cad.locator('[data-compare-hole]').evaluateAll(nodes => nodes.map(el => [el.getAttribute('cx'), el.getAttribute('cy'), el.getAttribute('r')]));
  for (const perEnd of [10, 20, 0]) {
    await cad.getByLabel('每端演示余量', { exact: true }).fill(String(perEnd));
    await expect(cad.locator('[data-split-dimensions]')).toContainText(`余量长度 ${1200 + 2 * perEnd} mm`);
    await expect(cad.locator('[data-split-dimensions]')).toContainText(`两端各 ${perEnd} mm`);
    const extension = await cad.locator('[data-compare-geometry]').evaluate(el => {
      const normal = el.querySelector('.compare-normal')!, allowance = el.querySelector('.compare-allowance')!;
      const x = (node: Element) => Number(node.getAttribute('x'));
      const width = (node: Element) => Number(node.getAttribute('width'));
      return { left: x(normal) - x(allowance), right: x(allowance) + width(allowance) - x(normal) - width(normal), scale: width(normal) / 1200 };
    });
    expect(Math.abs(extension.left - perEnd * extension.scale)).toBeLessThan(1e-10);
    expect(Math.abs(extension.right - perEnd * extension.scale)).toBeLessThan(1e-10);
    expect(await cad.locator('[data-compare-hole]').evaluateAll(nodes => nodes.map(el => [el.getAttribute('cx'), el.getAttribute('cy'), el.getAttribute('r')]))).toEqual(holes);
  }
  await cad.locator('[data-split-generate]').click();
  await expect(cad.locator('[data-split-output]')).toContainText('4 块');
  await cad.locator('[data-split-kind]').selectOption('incomplete');
  await expect(cad.locator('[data-split-status]')).toContainText('待核');
  await expect(cad.locator('[data-split-generate]')).toBeDisabled();
  await expect(cad.locator('[data-split-output]')).not.toContainText('4 块');
});

test('weather input changes forecast and metrics while generated references stay fixed', async ({ page }) => {
  await page.goto(url('projects/renewable-forecasting/'));
  const energy = page.locator('[data-experience="output-forecast"]');
  await expect(energy).toHaveAttribute('data-enhanced', 'true');
  const reference = await energy.locator('[data-forecast-reference]').getAttribute('d');
  const prediction = await energy.locator('[data-forecast-prediction]').getAttribute('d');
  const mae = await energy.locator('[data-metric="mae"]').textContent();
  await energy.locator('[data-weather-wind]').fill('2');
  await energy.locator('[data-weather-wind]').dispatchEvent('input');
  await expect(energy.locator('[data-forecast-reference]')).toHaveAttribute('d', reference!);
  expect(await energy.locator('[data-forecast-prediction]').getAttribute('d')).not.toBe(prediction);
  expect(await energy.locator('[data-metric="mae"]').textContent()).not.toBe(mae);
  await energy.locator('[data-energy-kind]').selectOption('solar');
  await expect(energy.locator('[data-point-weather]')).toContainText('W/m²');
  await expect(energy.locator('[data-weather-temperature]')).toBeVisible();
  await energy.locator('[data-forecast-horizon]').selectOption('4');
  await expect(energy.locator('[data-forecast-point]')).toHaveCount(4);
  await expect(energy.locator('.weather-canvas')).toContainText('T+1 → T+4 h');
});

test('cross-page trace highlights ordered evidence and stops at device interiors', async ({ page }) => {
  await page.goto(url('projects/electrical-drawings/'));
  const wiring = page.locator('[data-experience="wiring-query"]');
  await expect(wiring).toHaveAttribute('data-enhanced', 'true');
  await wiring.locator('[data-trace-target]').selectOption('p4');
  await wiring.locator('[data-trace-start]').click();
  await expect(wiring.locator('[data-trace-summary]')).toContainText('A:1 → A:2 → A:3 → B:1');
  await expect(wiring.locator('[data-edge-id].traced')).toHaveCount(3);
  await wiring.locator('[data-trace-target]').selectOption('p5');
  await wiring.locator('[data-trace-start]').click();
  await expect(wiring.locator('[data-trace-summary]')).toContainText('未找到已确认路径');
  await expect(wiring.locator('[data-edge-id].traced')).toHaveCount(0);
  await wiring.getByRole('button', { name: '图中端口 A:3', exact: true }).click();
  await wiring.getByRole('button', { name: '待核信息', exact: true }).click();
  await wiring.getByRole('button', { name: '查看依据：A:3 与 C:1' }).click();
  await expect(wiring.locator('[data-evidence]')).toContainText('样例页 01');
  await expect(wiring.locator('[data-evidence-focus]')).toBeVisible();
});

test('looping ribbon has no empty edge on ultrawide, reverse scroll and resize', async ({ page }) => {
  for (const width of [390, 768, 1440, 1920, 2560, 3440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(url());
    await expect(page.locator('.kinetic-ribbon-group').first().locator('span')).toHaveText(['SPLIT', 'FORECAST', 'TRACE']);
    for (const offset of [10, -10]) {
      await page.locator('[data-motion-ribbon]').evaluate((el, offset) => scrollTo(0, el.getBoundingClientRect().top + scrollY + offset), offset);
      await page.waitForTimeout(80);
      const coverage = await page.locator('[data-motion-ribbon]').evaluate(el => {
        const track = el.querySelector('.kinetic-ribbon-track')!.getBoundingClientRect();
        const box = el.getBoundingClientRect();
        return { left: track.left <= box.left + 1, right: track.right >= box.right - 1, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      expect(coverage).toEqual({ left: true, right: true, overflow: false });
    }
  }
});

test('system pointer and updated award stay consistent without changing enrollment', async ({ page }) => {
  await page.goto(url());
  await expect(page.locator('.motion-cursor')).toHaveCount(0);
  await expect(page.locator('#honors')).toContainText('2026 年大学生电子设计大赛');
  await page.goto(url('resume/'));
  await expect(page.locator('main')).toContainText('2026 年大学生电子设计大赛');
  await expect(page.locator('main')).toContainText('2025');
});
