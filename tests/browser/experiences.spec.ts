import { test, expect } from '@playwright/test';
const base = process.env.TEST_BASE || '/';
const url = (path = '') => base + path;

test('nickname is the first impression and profile disclosure restores focus', async ({ page }) => {
  await page.goto(url());
  await expect(page.locator('h1')).toHaveText('Ranxin');
  await expect(page.locator('.nickname-zh')).toHaveText('然鑫');
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Ranxin/);
  await expect(page.locator('meta[name="description"]')).not.toHaveAttribute('content', /肖逸辰/);
  await expect(page.getByText('肖逸辰', { exact: true })).not.toBeVisible();
  const opener = page.getByRole('button', { name: '个人资料', exact: true }).first();
  await opener.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('肖逸辰');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(opener).toBeFocused();
});

test('CAD fixes missing fields, blocks duplicates, advances handoff and manages inventory', async ({ page }) => {
  await page.goto(url('projects/dwg-agent/'));
  await page.getByLabel('图纸场景').selectOption('missing');
  await page.getByRole('button', { name: '校验并继续', exact: true }).click();
  await expect(page.locator('[data-cad-status]')).toContainText('2 项');
  await page.getByRole('button', { name: '补入示例字段' }).click();
  await page.getByRole('button', { name: '校验并继续', exact: true }).click();
  await expect(page.locator('[data-cad-status]')).toContainText('字段校验通过');
  await page.getByRole('button', { name: '转换数据', exact: true }).click();
  await expect(page.locator('[data-handoff]')).toContainText('thicknessMm');
  await page.getByRole('button', { name: '确认交接', exact: true }).click();
  await page.getByRole('button', { name: '登记入库', exact: true }).click();
  await expect(page.locator('[data-cad-status]')).toContainText('3 条');
  await expect(page.locator('[data-cad-form] button[type="submit"]')).toBeDisabled();
  await expect(page.locator('[data-cad-form] button[type="submit"]')).toHaveAccessibleName('字段已锁定，重置后可编辑');
  await expect(page.getByLabel('对象材料')).toBeDisabled();
  const first = page.locator('[data-stock-id="stock-a"]');
  await first.getByRole('button', { name: '预留' }).click();
  await expect(first).toContainText('已预留');
  await first.getByRole('button', { name: '释放' }).click();
  await first.getByRole('button', { name: '预留' }).click();
  await first.getByRole('button', { name: '领用' }).click();
  await expect(first).toContainText('已使用');
  await page.getByLabel('材料筛选').selectOption('Q355B');
  await page.getByLabel('厚度筛选').selectOption('12');
  await expect(page.locator('[data-stock-id]')).toHaveCount(2);
  await page.getByRole('button', { name: '重置体验' }).click();
  await page.getByLabel('图纸场景').selectOption('duplicate');
  await page.getByRole('button', { name: '校验并继续', exact: true }).click();
  await expect(page.locator('[data-cad-status]')).toContainText('重复');
  await page.getByRole('button', { name: '移除重复记录' }).click();
  await page.getByRole('button', { name: '校验并继续', exact: true }).click();
  await expect(page.locator('[data-cad-status]')).toContainText('字段校验通过');
});

test('forecast controls change real metrics and time selection is keyboard accessible', async ({ page }) => {
  await page.goto(url('projects/renewable-forecasting/'));
  const first = await page.locator('[data-metric="mae"]').textContent();
  await page.getByLabel('预测方案').selectOption('persistence');
  const baseline = await page.locator('[data-metric="mae"]').textContent();
  expect(baseline).not.toBe(first);
  await page.getByLabel('评价窗口').selectOption('4');
  await expect(page.locator('[data-forecast-point]')).toHaveCount(4);
  await expect(page.locator('[data-metric="mae"]')).not.toHaveText(baseline!);
  await page.getByLabel('时间点').fill('3');
  await expect(page.locator('[data-point-hour]')).toHaveText('T+3 h');
  await page.locator('[data-forecast-point="4"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-point-hour]')).toHaveText('T+4 h');
  await page.getByRole('button', { name: '重置体验' }).click();
  await expect(page.getByLabel('评价窗口')).toHaveValue('24');
  await expect(page.getByLabel('预测方案')).toHaveValue('sample');
});

test('wiring views separate direct, confirmed, pending and conflicting relationships', async ({ page }) => {
  await page.goto(url('projects/electrical-drawings/'));
  await page.getByRole('button', { name: '已确认网络', exact: true }).click();
  await expect(page.locator('[data-wiring-results]')).toContainText('B:1');
  await expect(page.locator('[data-wiring-results]')).not.toContainText('B:2');
  await expect(page.locator('[data-wiring-results]')).not.toContainText('C:1');
  await page.getByLabel('搜索端口').fill('A:3');
  await page.getByRole('button', { name: '选择端口 A:3', exact: true }).click();
  await page.getByRole('button', { name: '待核信息', exact: true }).click();
  await expect(page.locator('[data-wiring-results]')).toContainText('待核');
  await page.getByRole('button', { name: /查看依据/ }).first().click();
  await expect(page.locator('[data-evidence]')).toContainText('样例页');
  await page.getByLabel('搜索端口').fill('A:2');
  await page.getByRole('button', { name: '选择端口 A:2', exact: true }).click();
  await expect(page.locator('[data-wiring-results]')).toContainText('冲突');
  await page.getByRole('button', { name: '重置体验' }).click();
  await expect(page.getByLabel('搜索端口')).toHaveValue('');
  await page.getByLabel('搜索端口').fill('不存在');
  await expect(page.locator('[data-port-list]')).toContainText('未找到');
});

test('project tabs support arrow keys and each mobile experience fits the viewport', async ({ page }) => {
  for (const slug of ['dwg-agent', 'renewable-forecasting', 'electrical-drawings']) {
    await page.goto(url(`projects/${slug}/`));
    await page.getByRole('tab', { name: /交互体验/ }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('heading', { name: '我负责的部分' })).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('heading', { name: '成果与收获', exact: true })).toBeVisible();
    await page.keyboard.press('Home');
    await expect(page.locator('[data-experience]')).toBeVisible();
    for (const width of [360, 390, 768]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
      await expect(page.locator('[data-demo-reset]')).toBeVisible();
    }
  }
});

test('every experience has useful static output without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const slug of ['dwg-agent', 'renewable-forecasting', 'electrical-drawings']) {
    await page.goto(new URL(url(`projects/${slug}/`), process.env.TEST_URL || 'http://127.0.0.1:4321').toString());
    await expect(page.locator('[data-experience] svg')).toBeVisible();
    await expect(page.locator('[data-demo-controls]')).not.toBeVisible();
    await expect(page.getByRole('heading', { name: '我负责的部分' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '团队的阶段产出' })).toBeVisible();
    await expect(page.getByText(/当前显示静态样例与结果/)).toBeVisible();
  }
  await context.close();
});

test('interactive routes work with all other origins blocked and reset on refresh', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === new URL(process.env.TEST_URL || 'http://127.0.0.1:4321').origin ? route.continue() : route.abort());
  await page.goto(url('projects/renewable-forecasting/'));
  await page.getByLabel('生成场景').selectOption('volatile');
  await page.getByLabel('预测方案').selectOption('persistence');
  await page.reload();
  await expect(page.getByLabel('生成场景')).toHaveValue('ramp');
  await expect(page.getByLabel('预测方案')).toHaveValue('sample');
  await page.goto(url('projects/dwg-agent/'));
  await expect(page.getByRole('button', { name: '校验并继续', exact: true })).toBeVisible();
  await page.goto(url('projects/electrical-drawings/'));
  await page.getByRole('button', { name: '已确认网络', exact: true }).click();
  await expect(page.locator('[data-wiring-results]')).toContainText('B:1');
  expect(errors).toEqual([]);
});

test('404 branding and project printing preserve identity and project boundaries', async ({ page }) => {
  await page.goto(url('404.html'));
  await expect(page).toHaveTitle(/Ranxin/);
  await expect(page.locator('meta[property="og:title"]')).not.toHaveAttribute('content', /肖逸辰/);
  await page.goto(url('projects/renewable-forecasting/'));
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('heading', { name: '我负责的部分' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '团队的阶段产出' })).toBeVisible();
  await expect(page.getByText(/已有山西电价研究结果不作为河南场站出力精度/)).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
  await expect(page.getByRole('heading', { name: '我负责的部分' })).not.toBeVisible();
});

test('dark project accents print in readable ink on white paper', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('xyc-theme', 'dark'));
  await page.goto(url('projects/renewable-forecasting/'));
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('[data-metric="mae"]')).toHaveCSS('color', 'rgb(35, 128, 120)');
  await page.goto(url('projects/electrical-drawings/'));
  await expect(page.locator('.connection-results .state-chip').first()).toHaveCSS('color', 'rgb(81, 76, 145)');
});
