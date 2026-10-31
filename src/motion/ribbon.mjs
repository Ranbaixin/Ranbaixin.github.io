export function ribbonCopies(viewport, period) {
  if (!(viewport >= 0) || !Number.isFinite(viewport) || !(period > 0) || !Number.isFinite(period)) return 1;
  return Math.ceil(viewport / period) + 2;
}
export function ribbonOffset(distance, period) {
  if (!Number.isFinite(distance) || !(period > 0) || !Number.isFinite(period)) return 0;
  return -((distance % period + period) % period);
}
