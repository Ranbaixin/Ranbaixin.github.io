import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateContent } from '../src/lib/model.mjs';
const bytes = await readFile(new URL('../src/data/content.json', import.meta.url));
const errors = validateContent(JSON.parse(bytes));
const digest = createHash('sha256').update(bytes).digest('hex');
try {
  const pdf = await readFile(new URL('../public/resume.pdf', import.meta.url));
  if (!pdf.includes(Buffer.from(`content-sha256:${digest}`))) errors.push('Public PDF does not match current content; regenerate it before publishing.');
} catch { errors.push('Public resume PDF is missing.'); }
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Public content and resume verified (${digest.slice(0, 12)}).`);
