/**
 * Launch angle (radians, negative = upward) that sends a projectile from
 * (x0, y0) through (tx, ty) at the given speed under constant downward gravity.
 * Returns the flat (low) arc, or null if the target is out of range.
 */
export function solveLaunchAngle(
  x0: number,
  y0: number,
  tx: number,
  ty: number,
  speed: number,
  gravity: number,
): number | null {
  const x = tx - x0;
  const h = y0 - ty; // height of target above the launch point
  if (x <= 0) return null;
  const v2 = speed * speed;
  const disc = v2 * v2 - gravity * (gravity * x * x + 2 * h * v2);
  if (disc < 0) return null;
  return -Math.atan((v2 - Math.sqrt(disc)) / (gravity * x));
}
