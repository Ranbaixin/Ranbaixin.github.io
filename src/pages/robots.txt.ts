import type { APIRoute } from 'astro';
import { withBase } from '../lib/model.mjs';

export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL(withBase(import.meta.env.BASE_URL, 'sitemap-index.xml'), site);
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap.href}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
};
