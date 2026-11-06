import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
const base = process.env.SITE_BASE || '/';
const site = process.env.SITE_URL || 'https://ranbaixin.github.io';
export default defineConfig({
  site, base, output: 'static', trailingSlash: 'always',
  integrations: [sitemap({ filter: page => new URL(page).pathname.endsWith('/') && !new URL(page).pathname.endsWith('/404/') })],
  build: { format: 'directory' },
  devToolbar: { enabled: false },
  vite: { build: { assetsInlineLimit: 0 } }
});
