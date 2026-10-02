export const DEG2RAD = Math.PI / 180;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Frame-rate independent exponential smoothing factor. */
export function damp(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

export function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function padScore(value: number, digits = 4): string {
  return Math.floor(value).toString().padStart(digits, '0');
}

/** m:ss formatting for survival time. */
export function formatTime(seconds: number): string {
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Segment (x0,y0)->(x1,y1) vs axis-aligned box using the slab method.
 * Returns the entry fraction t in [0,1] along the segment, or -1 for no hit.
 */
export function segmentVsBox(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let tMin = 0;
  let tMax = 1;

  if (Math.abs(dx) < 1e-9) {
    if (x0 < left || x0 > right) return -1;
  } else {
    let t1 = (left - x0) / dx;
    let t2 = (right - x0) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return -1;
  }

  if (Math.abs(dy) < 1e-9) {
    if (y0 < top || y0 > bottom) return -1;
  } else {
    let t1 = (top - y0) / dy;
    let t2 = (bottom - y0) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return -1;
  }
  return tMin;
}

/** Height of a constant-gravity projectile after t seconds (y grows downward). */
export function projectileY(y0: number, vy0: number, gravity: number, t: number): number {
  return y0 + vy0 * t + 0.5 * gravity * t * t;
}
