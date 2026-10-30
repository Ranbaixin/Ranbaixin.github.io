import { test, expect } from '@playwright/test';
const base = process.env.TEST_BASE || '/';
const url = (path = '') => base + path;

test('public content, exact role attribution, and project filtering', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url());
  await expect(page.getByRole('heading', { name: '肖逸辰.', exact: true })).toBeVisible();
  await expect(page.locator('[data-project-category]:visible')).toHaveCount(3);
  await page.getByRole('button', { name: '数据科学 01' }).click();
  await expect(page.locator('[data-project-category]:visible')).toHaveCount(1);
  await expect(page.locator('[data-project-category]:visible')).toContainText('新能源出力预测');
  await page.getByRole('button', { name: '工程自动化 02' }).click();
  await expect(page.locator('[data-project-category]:visible')).toHaveCount(2);
  await page.getByRole('button', { name: '全部项目 03' }).click();
  await expect(page.locator('[data-project-category]:visible')).toHaveCount(3);
  await page.locator('#journey details').first().locator('summary').click();
  await expect(page.locator('#journey details').first()).toHaveAttribute('open', '');
  expect(errors).toEqual([]);
});

test('each detail route survives refresh and assets stay on the current origin', async ({ page, request }) => {
  for (const slug of ['dwg-agent', 'renewable-forecasting', 'electrical-drawings']) {
    const response = await page.goto(url(`projects/${slug}/`));
    expect(response?.status()).toBe(200);
    await page.reload();
    await expect(page.getByRole('heading', { name: '我负责的部分' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '团队的阶段产出' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '做到哪里，如何看待结果' })).toBeVisible();
    await page.getByRole('link', { name: '返回项目列表' }).click();
    await expect(page).toHaveURL(new RegExp(`${base.replaceAll('/', '\\/')}#projects$`));
  }
  const pdf = await request.get(url('resume.pdf'));
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');
  const release = await request.get(url('release.json'));
  expect((await release.json()).contentSha256).toMatch(/^[a-f0-9]{64}$/);
  const missing = await request.get(url('not-a-real-page/'));
  expect(missing.status()).toBe(404);
});

test('theme, reduced motion, storage failure, and manual clipboard fallback', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
    Object.defineProperty(navigator, 'clipboard', { value: undefined });
  });
  await page.goto(url());
  await page.locator('[data-theme-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', /light|dark/);
  await page.locator('[data-motion-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
  await page.locator('[data-copy-email]').click();
  await expect(page.locator('[data-copy-status]')).toContainText('手动复制');
});

test('mobile layout and system reduced motion preserve readable content', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [360, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url());
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
    await expect(page.locator('#about h2')).toBeVisible();
  }
  await expect(page.locator('.graph-path')).toHaveCSS('animation-name', 'none');
});

test('without JavaScript the resume, full project list, navigation and email remain usable', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(new URL(url(), process.env.TEST_URL || 'http://127.0.0.1:4321').toString());
  await expect(page.locator('[data-project-category]')).toHaveCount(3);
  await expect(page.locator('#about')).toContainText('马跃');
  await expect(page.getByRole('link', { name: /b1861479356@163.com/ })).toBeVisible();
  await page.goto(new URL(url('resume/'), process.env.TEST_URL || 'http://127.0.0.1:4321').toString());
  await expect(page.locator('.resume-sheet')).toContainText('2029');
  await expect(page.locator('.resume-project')).toHaveCount(3);
  await context.close();
});

test('backup pages make no external requests for their core content', async ({ page }) => {
  const external: string[] = [];
  await page.route('**/*', route => {
    const target = new URL(route.request().url());
    if (target.origin !== new URL(process.env.TEST_URL || 'http://127.0.0.1:4321').origin) { external.push(target.origin); return route.abort(); }
    return route.continue();
  });
  await page.goto(url());
  await page.getByRole('button', { name: '数据科学 01' }).click();
  await expect(page.locator('[data-project-category]:visible')).toHaveCount(1);
  await page.goto(url('resume/'));
  await expect(page.locator('.resume-sheet')).toContainText('省级三等奖');
  expect(external).toEqual([]);
});

test('keyboard reaches project nodes and opens native experience details', async ({ page }) => {
  await page.goto(url());
  const project = page.locator('.node-cad');
  await project.focus();
  await expect(project).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp('projects/dwg-agent/$'));
  await page.goto(url('#journey'));
  const summary = page.locator('#journey summary').first();
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#journey details').first()).toHaveAttribute('open', '');
});

test('a dark screen theme prints the resume with readable dark ink', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('xyc-theme', 'dark'));
  await page.goto(url('resume/'));
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.resume-sheet section > h2').first()).toHaveCSS('color', 'rgb(39, 95, 231)');
  await expect(page.locator('.resume-heading address')).toHaveCSS('color', 'rgb(97, 114, 141)');
});
