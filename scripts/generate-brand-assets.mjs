import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const render = async (path, width, height) => {
    await page.setViewportSize({ width, height });
    const svg = await readFile(new URL(path, import.meta.url), 'utf8');
    await page.setContent(`<style>html,body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
    await page.evaluate(() => document.fonts.ready);
    return page.screenshot({ type: 'png' });
  };
  await writeFile(new URL('../public/social/ranxin-card.png', import.meta.url), await render('../public/social/ranxin-card.svg', 1200, 630));
  const icon = await render('../public/favicon.svg', 32, 32);
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  header[6] = 32; header[7] = 32; header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
  header.writeUInt32LE(icon.length, 14); header.writeUInt32LE(22, 18);
  await writeFile(new URL('../public/favicon.ico', import.meta.url), Buffer.concat([header, icon]));
  console.log('Generated the 1200x630 share image and 32x32 fallback icon.');
} finally {
  await browser.close();
}
