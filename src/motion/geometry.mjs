/** Original normalized geometry, independent of any engineering source files. */
export function createScenes(count = 180) {
  if (!Number.isInteger(count) || count < 32 || count > 1000) throw new Error('Invalid point budget');
  const outline = [[-1, -.8], [.95, -.8], [.95, -.12], [.2, -.12], [.2, .9], [-1, .9]];
  const ringSize = Math.ceil(count / 2);
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const cad = [], energy = [], wiring = [];
  for (let i = 0; i < count; i++) {
    const segment = (i % ringSize) / ringSize * outline.length;
    const a = outline[Math.floor(segment)], b = outline[(Math.floor(segment) + 1) % outline.length];
    const mix = segment % 1;
    cad.push([a[0] + (b[0] - a[0]) * mix, a[1] + (b[1] - a[1]) * mix, i < ringSize ? -.22 : .22]);
    const u = i % columns / (columns - 1) * 2 - 1;
    const v = Math.floor(i / columns) / (rows - 1) * 2 - 1;
    energy.push([u * 1.15, -.35 * Math.sin(u * 3.2) - .25 * Math.cos(v * 3) - u * .2, v]);
    const vertical = 1 - (i + .5) / count * 2;
    const radius = Math.sqrt(1 - vertical ** 2);
    const angle = i * Math.PI * (3 - Math.sqrt(5));
    wiring.push([Math.cos(angle) * radius, vertical, Math.sin(angle) * radius]);
  }
  return { cad, energy, wiring };
}

/** @param {number[]} from @param {number[]} to @param {number} progress */
export function interpolatePoint(from, to, progress) {
  const t = Math.max(0, Math.min(1, progress));
  return from.map((value, axis) => value + (to[axis] - value) * t);
}

/** @param {number[]} point */
export function projectPoint(point, rotationX, rotationY, width, height) {
  const x = point[0] * Math.cos(rotationY) + point[2] * Math.sin(rotationY);
  const z = -point[0] * Math.sin(rotationY) + point[2] * Math.cos(rotationY);
  const y = point[1] * Math.cos(rotationX) - z * Math.sin(rotationX);
  const depth = Math.max(1.2, 4.2 + point[1] * Math.sin(rotationX) + z * Math.cos(rotationX));
  const scale = Math.min(width, height) * .31 * 4.2 / depth;
  return { x: width / 2 + x * scale, y: height / 2 + y * scale, depth };
}

export function shouldAnimate({ visible, pageVisible, reduced, saveData }) {
  return visible && pageVisible && !reduced && !saveData;
}

/** @param {'cad'|'energy'|'wiring'} scene @param {number[][]} points */
export function createEdges(scene, points) {
  const count = points.length, edges = [];
  if (scene === 'cad') {
    const ringSize = Math.ceil(count / 2);
    for (let i = 0; i < count; i++) {
      const ring = i < ringSize ? 0 : ringSize;
      const length = Math.min(ringSize, count - ring);
      edges.push([i, ring + (i - ring + 1) % length]);
      if (i < ringSize && i % 5 === 0 && i + ringSize < count) edges.push([i, i + ringSize]);
    }
  } else if (scene === 'energy') {
    const columns = Math.ceil(Math.sqrt(count));
    for (let i = 0; i < count; i++) {
      if (i % columns < columns - 1 && i + 1 < count) edges.push([i, i + 1]);
      if (i + columns < count) edges.push([i, i + columns]);
    }
  } else {
    for (let i = 0; i < count; i++) {
      const nearest = points.map((point, j) => ({ j, distance: point.reduce((sum, value, axis) => sum + (value - points[i][axis]) ** 2, 0) }))
        .filter(item => item.j !== i).sort((a, b) => a.distance - b.distance).slice(0, 4);
      for (const item of nearest) if (item.j > i) edges.push([i, item.j]);
    }
  }
  return edges;
}
