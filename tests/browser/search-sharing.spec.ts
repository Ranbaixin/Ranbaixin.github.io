import { test, expect } from '@playwright/test';
const base = process.env.TEST_BASE || '/';
const url = (path = '') => base + path;
const routes = ['', 'resume/', 'projects/dwg-agent/', 'projects/renewable-forecasting/', 'projects/electrical-drawings/'];

test('all public pages have a reachable image card and both favicon formats', async ({ page, request }) => {
  let imagePath = '';
  for (const path of routes) {
    await page.goto(url(path));
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    const image = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(image).toMatch(/^https:\/\//);
    expect(new URL(image!).origin).toBe(new URL(canonical!).origin);
    expect(new URL(image!).pathname).toBe(url('social/ranxin-card.png'));
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630');
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute('content', /Ranxin/);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', image!);
    await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute('href', url('favicon.svg'));
    await expect(page.locator('link[rel="icon"][type="image/x-icon"]')).toHaveAttribute('href', url('favicon.ico'));
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
    imagePath = new URL(image!).pathname;
  }
  const response = await request.get(imagePath);
  expect(response.status()).toBe(200);
  const png = await response.body();
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  const ico = await request.get(url('favicon.ico'));
  expect(ico.status()).toBe(200);
  expect((await ico.body()).subarray(0, 4)).toEqual(Buffer.from([0, 0, 1, 0]));
});

test('robots and both sitemap entrypoints expose exactly the five public pages', async ({ page, request }) => {
  await page.goto(url());
  const canonical = new URL((await page.locator('link[rel="canonical"]').getAttribute('href'))!);
  const origin = canonical.origin;
  const robots = await request.get(url('robots.txt'));
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain(`Sitemap: ${origin}${url('sitemap-index.xml')}`);
  const index = await request.get(url('sitemap-index.xml'));
  const alias = await request.get(url('sitemap.xml'));
  expect(index.status()).toBe(200); expect(alias.status()).toBe(200);
  expect(await alias.text()).toBe(await index.text());
  const sitemap = await request.get(url('sitemap-0.xml'));
  expect(sitemap.status()).toBe(200);
  const locations = await page.evaluate(xml => [...new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagName('loc')].map(el => el.textContent), await sitemap.text());
  expect(locations.sort()).toEqual(routes.map(path => `${origin}${url(path)}`).sort());
  await page.goto(url('404.html'));
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
});

test('public identity and structured data consistently use the two nicknames', async ({ page }) => {
  await page.goto(url());
  const person = await page.locator('script[type="application/ld+json"]').evaluate(el => JSON.parse(el.textContent || '{}'));
  expect(person['@type']).toBe('Person');
  expect(person.name).toBe('Ranxin'); expect(person.alternateName).toBe('然鑫');
  expect(person.affiliation.name).toBe('郑州大学');
  expect(person.knowsAbout).toEqual(expect.arrayContaining(['数据科学', '机器学习']));
  expect(person.sameAs).toEqual(['https://github.com/Ranbaixin']);
  expect(person.email).toBeUndefined(); expect(person.alumniOf).toBeUndefined();
  await page.getByRole('button', { name: '个人资料', exact: true }).first().click();
  await expect(page.locator('#profile-title')).toHaveText('Ranxin');
  await expect(page.locator('.profile-facts')).toContainText('信息与计算科学');
  await expect(page.locator('.profile-facts')).not.toContainText(/\d{4}\s*(?:级|年毕业)/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#contact a[href="https://github.com/Ranbaixin"]')).toBeVisible();
  await page.goto(url('resume/'));
  await expect(page.locator('.resume-heading h1')).toHaveText('Ranxin');
  await expect(page.locator('.resume-sheet')).not.toContainText(/\d{4}\s*(?:级|年毕业)/);
  await expect(page.locator('a[download]').first()).toHaveAttribute('download', 'Ranxin_公开简历.pdf');
});

test('drawing instructions follow pointer capabilities on desktop and touch devices', async ({ browser, page }) => {
  await page.goto(url('projects/electrical-drawings/'));
  await expect(page.locator('[data-input-hint="pointer"]')).toBeVisible();
  await expect(page.locator('[data-input-hint="touch"]')).toBeHidden();
  const touch = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  const mobile = await touch.newPage();
  await mobile.goto(new URL(url('projects/electrical-drawings/'), process.env.TEST_URL || 'http://127.0.0.1:4321').href);
  await expect(mobile.locator('[data-input-hint="touch"]')).toBeVisible();
  await expect(mobile.locator('[data-input-hint="pointer"]')).toBeHidden();
  expect(await mobile.locator('.drawing-instruction').innerText()).not.toContain('方向键');
  await mobile.goto(new URL(url(), process.env.TEST_URL || 'http://127.0.0.1:4321').href);
  await mobile.getByRole('tab', { name: '跨页追线' }).click();
  await expect(mobile.locator('[data-home-panel]:not([hidden]) [data-input-hint="touch"]')).toBeVisible();
  await touch.close();
});

test('without scripts drawing instructions remain neutral and contact still works', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, hasTouch: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(new URL(url('projects/electrical-drawings/'), process.env.TEST_URL || 'http://127.0.0.1:4321').href);
  await expect(page.locator('[data-input-hint="generic"]')).toBeVisible();
  expect(await page.locator('.drawing-instruction').innerText()).not.toMatch(/查看依据|缩放按钮|选择端口/);
  expect(await page.locator('.drawing-instruction').innerText()).not.toContain('方向键');
  await page.goto(new URL(url(), process.env.TEST_URL || 'http://127.0.0.1:4321').href);
  await expect(page.locator('#contact a[href="https://github.com/Ranbaixin"]')).toBeVisible();
  await context.close();
});
