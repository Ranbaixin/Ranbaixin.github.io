/** Public, independently constructed straight members. No CAD parser or business rules. */
export function createSplitSample(kind = 'bh') {
  if (!['bh', 'box', 'incomplete'].includes(kind)) throw new Error('Unknown public member');
  return { kind: kind === 'box' ? 'box' : 'bh', id: `DEMO-${kind.toUpperCase()}`, length: kind === 'incomplete' ? null : 1200, height: 400, width: kind === 'box' ? 300 : 200, webThickness: 8, flangeThickness: 12 };
}

export function splitPlates(sample, allowance = 0) {
  if (!Number.isFinite(allowance) || allowance < 0 || allowance > 20) throw new Error('Demonstration allowance must be 0–20 mm');
  const fields = ['length', 'height', 'width', 'webThickness', 'flangeThickness'];
  const issues = fields.filter(key => !Number.isFinite(sample[key]) || sample[key] <= 0).map(key => `尺寸 ${key} 缺失或无效`);
  if (!['bh', 'box'].includes(sample.kind)) issues.push('构件类型不在公开样例中');
  if (sample.height <= sample.flangeThickness * 2 || sample.width <= sample.webThickness * (sample.kind === 'box' ? 2 : 1) || sample.width <= sample.flangeThickness) issues.push('截面尺寸相互冲突');
  if (sample.length <= 200) issues.push('样例长度不足以保留孔边距');
  if (issues.length) return { status: 'review', issues, plates: [] };
  const definitions = [
    { id: 'top', label: '上翼缘板', role: 'flange', width: sample.width, thickness: sample.flangeThickness },
    { id: 'bottom', label: '下翼缘板', role: 'flange', width: sample.width, thickness: sample.flangeThickness },
    ...(sample.kind === 'bh' ? [{ id: 'web', label: '腹板', role: 'web', width: sample.height - 2 * sample.flangeThickness, thickness: sample.webThickness }] : [
      { id: 'left', label: '左腹板', role: 'web', width: sample.height - 2 * sample.flangeThickness, thickness: sample.webThickness },
      { id: 'right', label: '右腹板', role: 'web', width: sample.height - 2 * sample.flangeThickness, thickness: sample.webThickness },
    ]),
  ];
  const plates = definitions.map(plate => ({ ...plate, length: sample.length + allowance, normalLength: sample.length, holes: [80, sample.length - 80].flatMap(x => [.32, .68].map(fraction => ({ x, y: plate.width * fraction, r: 9 }))) }));
  return { status: 'accepted', issues: [], plates };
}

const lerp = (a, b, t) => a + (b - a) * t;
const project = ([x, y, z]) => [360 + .36 * (.78 * x + .65 * z), 210 + .36 * (.18 * x - .88 * y - .35 * z)];

/** Smoothly project one identity-preserving assembly into separated and flat plates. */
export function projectSplit(sample, phase = 0) {
  const result = splitPlates(sample);
  const progress = Math.max(0, Math.min(1, phase));
  const explode = Math.min(1, progress * 2);
  const flatten = Math.max(0, progress * 2 - 1);
  return result.plates.map((plate, index) => {
    const top = plate.id === 'top', bottom = plate.id === 'bottom';
    const y0 = top ? sample.height / 2 : bottom ? -sample.height / 2 : 0;
    const z0 = plate.id === 'left' ? -sample.width / 2 : plate.id === 'right' ? sample.width / 2 : 0;
    const dy = (top ? 170 : bottom ? -170 : 0) * explode;
    const dz = (plate.id === 'left' ? -170 : plate.id === 'right' ? 170 : plate.id === 'web' ? 110 : 0) * explode;
    const flatScale = sample.kind === 'bh' ? Math.min(500 / sample.length, 272 / result.plates.reduce((sum, p) => sum + p.width, 0)) : Math.min(270 / sample.length, 110 / Math.max(...result.plates.map(p => p.width)));
    const flatLeft = sample.kind === 'bh' ? (720 - sample.length * flatScale) / 2 : 65 + (index % 2) * 320;
    const flatTop = sample.kind === 'bh' ? 50 + result.plates.slice(0, index).reduce((sum, p) => sum + p.width * flatScale + 24, 0) : 85 + Math.floor(index / 2) * 165;
    const point = (u, v) => {
      const world = plate.role === 'flange' ? [u - sample.length / 2, y0 + dy, v - plate.width / 2 + dz] : [u - sample.length / 2, v - plate.width / 2 + dy, z0 + dz];
      const [x, y] = project(world);
      return [lerp(x, flatLeft + u * flatScale, flatten), lerp(y, flatTop + v * flatScale, flatten)];
    };
    const front = [[0, 0], [sample.length, 0], [sample.length, plate.width], [0, plate.width]].map(([u, v]) => point(u, v));
    const depth = (1 - flatten) * 5;
    return { id: plate.id, label: plate.label, front, side: [front[1], front[2], [front[2][0] + depth, front[2][1] + depth], [front[1][0] + depth, front[1][1] + depth]], holes: plate.holes.map(hole => ({ ...hole, point: point(hole.x, hole.y) })), labelPoint: point(sample.length / 2, plate.width / 2), depth: y0 + dy - z0 - dz };
  }).sort((a, b) => a.depth - b.depth);
}
