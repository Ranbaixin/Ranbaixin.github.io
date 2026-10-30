import test from 'node:test';
import assert from 'node:assert/strict';
import { withBase, validateContent, selectProjects } from '../src/lib/model.mjs';

test('root and project-site navigation resolve pages, files, and fragments', () => {
  assert.equal(withBase('/', 'projects/cad/'), '/projects/cad/');
  assert.equal(withBase('/personal-portfolio/', '/resume/'), '/personal-portfolio/resume/');
  assert.equal(withBase('/personal-portfolio', '#projects'), '/personal-portfolio/#projects');
  assert.equal(withBase('/personal-portfolio/', 'resume.pdf'), '/personal-portfolio/resume.pdf');
});

test('path helper rejects traversal and external destinations', () => {
  for (const path of ['../private', '//example.org', 'https://example.org', 'a/../../private']) {
    assert.throws(() => withBase('/', path), /local path/);
  }
});

const valid = () => ({
  profile: { name: 'Example', email: 'example@example.org', intro: 'Public introduction' },
  education: { school: 'Example University', major: 'Computing', enrolled: 2025, expectedGraduation: 2029 },
  projects: [{ slug: 'example', title: 'Example', category: 'engineering', start: '2026-05', role: 'Member', summary: 'Public summary', responsibilities: ['Work'], background: 'Problem', outcomes: ['Team output'], methods: ['Method'], verification: 'Partial validation', reflection: 'Reflection' }],
  honors: [{ title: 'Competition', year: 2025, level: 'Third prize' }]
});

test('publication validation accepts public content and rejects missing facts', () => {
  assert.deepEqual(validateContent(valid()), []);
  const data = valid();
  data.profile.email = '';
  assert.match(validateContent(data).join(';'), /email/);
});

test('duplicate project routes, incomplete project text, and local source paths cannot publish', () => {
  const duplicate = valid();
  duplicate.projects.push({ ...duplicate.projects[0] });
  assert.match(validateContent(duplicate).join(';'), /duplicate/);
  const incomplete = valid();
  incomplete.projects[0].verification = '';
  assert.match(validateContent(incomplete).join(';'), /verification/);
  const privateSource = valid();
  privateSource.projects[0].sourcePath = 'C:/private/input.dwg';
  assert.match(validateContent(privateSource).join(';'), /sourcePath|private/);
});

test('filters distinguish all projects, each category, and an empty result', () => {
  const projects = [{ category: 'engineering', slug: 'cad' }, { category: 'data', slug: 'energy' }];
  assert.equal(selectProjects(projects, 'all').length, 2);
  assert.deepEqual(selectProjects(projects, 'data').map(p => p.slug), ['energy']);
  assert.equal(selectProjects(projects, 'unknown').length, 0);
});

test('private root fields and incomplete honors are rejected before publication', () => {
  const privateRoot = valid();
  privateRoot.server = { host: 'private-host' };
  assert.match(validateContent(privateRoot).join(';'), /private|unsupported/);
  const honor = valid();
  honor.honors[0].level = '';
  assert.match(validateContent(honor).join(';'), /honor.*level/);
});
