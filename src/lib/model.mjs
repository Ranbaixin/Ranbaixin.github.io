export function withBase(base = '/', path = '') {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(path) || path.split(/[/?#]/).includes('..') || path.includes('\\')) {
    throw new Error('Expected a local path');
  }
  const prefix = `/${base.replace(/^\/+|\/+$/g, '')}`.replace(/\/$/, '') + '/';
  return prefix + path.replace(/^\/+/, '');
}

export function validateContent(data) {
  const errors = [];
  const publicRootFields = new Set(['profile', 'education', 'projects', 'honors']);
  for (const key of Object.keys(data || {})) if (!publicRootFields.has(key)) errors.push(`private or unsupported root field: ${key}`);
  const required = (object, fields, label) => fields.forEach(key => {
    if (typeof object?.[key] !== 'string' || !object[key].trim()) errors.push(`${label}.${key} is required`);
  });
  required(data?.profile, ['name', 'nicknameEn', 'nicknameZh', 'email', 'intro'], 'profile');
  if (data?.profile?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.profile.email)) errors.push('profile.email is invalid');
  required(data?.education, ['school', 'major'], 'education');
  if (!(data?.education?.expectedGraduation > data?.education?.enrolled)) errors.push('education years are invalid');
  const slugs = new Set();
  if (!Array.isArray(data?.projects) || !data.projects.length) errors.push('projects are required');
  for (const project of data?.projects || []) {
    required(project, ['slug', 'title', 'category', 'start', 'role', 'summary', 'background', 'verification', 'reflection'], 'project');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.slug || '')) errors.push('invalid project slug');
    if (slugs.has(project.slug)) errors.push('duplicate project slug');
    slugs.add(project.slug);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(project.start || '')) errors.push('invalid project start');
    for (const key of ['responsibilities', 'outcomes', 'methods']) {
      if (!Array.isArray(project[key]) || !project[key].length || project[key].some(v => typeof v !== 'string' || !v.trim())) errors.push(`project.${key} is required`);
    }
    const approvedSamples = { 'cad-flow': 'cad-v1', 'output-forecast': 'energy-v1', 'wiring-query': 'wiring-v1' };
    if (!project.demo || approvedSamples[project.demo.type] !== project.demo.sample || !project.demo.sample || Object.keys(project.demo).some(key => !['type', 'sample'].includes(key))) errors.push('project.demo must reference an approved public sample');
    const allowed = new Set(['slug', 'title', 'shortTitle', 'category', 'categoryLabel', 'start', 'period', 'role', 'summary', 'background', 'responsibilities', 'outcomes', 'methods', 'verification', 'reflection', 'number', 'theme', 'demo']);
    for (const key of Object.keys(project)) if (!allowed.has(key)) errors.push(`private or unsupported project field: ${key}`);
  }
  if (/[A-Z]:[\\/]|\/opt\/|\/etc\/|-----BEGIN .*PRIVATE KEY|(?:token|password)\s*[:=]/i.test(JSON.stringify(data))) errors.push('private material cannot publish');
  if (!Array.isArray(data?.honors) || !data.honors.length) errors.push('honors are required');
  for (const honor of data?.honors || []) {
    required(honor, ['title', 'level'], 'honor');
    if (!Number.isInteger(honor.year) || honor.year < 1900) errors.push('honor.year is invalid');
  }
  return errors;
}

export function selectProjects(projects, category) {
  return category === 'all' ? projects : projects.filter(project => project.category === category);
}
