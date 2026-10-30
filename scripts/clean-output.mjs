import { lstat, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';

// Use the literal filesystem path: a workspace '#' must not become a URL fragment.
const project = resolve(fileURLToPath(new URL('../', import.meta.url)));
const output = resolve(project, 'dist');
if (relative(project, output) !== 'dist') throw new Error('Unexpected build output location');
let state;
try { state = await lstat(output); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (state) {
  if (state.isSymbolicLink() || !state.isDirectory()) throw new Error('Build output must be a regular project directory');
  await rm(output, { recursive: true, force: false, maxRetries: 3 });
}
