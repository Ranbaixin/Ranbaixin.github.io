import { defineConfig } from 'astro/config';
const base = process.env.SITE_BASE || '/';
const site = process.env.SITE_URL || 'https://ranbaixin.github.io';
export default defineConfig({
  site, base, output: 'static', trailingSlash: 'always',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
  vite: { build: { assetsInlineLimit: 0 } }
});
