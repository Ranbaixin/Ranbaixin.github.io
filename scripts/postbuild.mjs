import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const data = await readFile(new URL('../src/data/content.json', import.meta.url));
let revision = 'local';
try { revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* Local previews may precede repository initialization. */ }
await writeFile(new URL('../dist/release.json', import.meta.url), JSON.stringify({
  version: '2.1.0', revision, contentSha256: createHash('sha256').update(data).digest('hex'),
  base: process.env.SITE_BASE || '/', builtAt: new Date().toISOString()
}, null, 2));
await writeFile(new URL('../dist/.nojekyll', import.meta.url), '');
