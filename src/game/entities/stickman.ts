import type Phaser from 'phaser';

/** Shared proportions for every stickman (feet at y = 0, y grows downward). */
export const BODY = {
  thigh: 21,
  shin: 21,
  hipY: -42,
  shoulderY: -80,
  headRadius: 12,
  headY: -94,
  lineWidth: 5,
} as const;

export interface BodyPose {
  /** Walk-cycle phase in radians. */
  phase: number;
  /** Leg swing amplitude in radians (0 = standing still). */
  stride: number;
  /** Horizontal torso lean in px at the shoulders (+ = toward facing dir). */
  lean: number;
  /** +1 faces right, -1 faces left. */
  dir: 1 | -1;
  /** Bounce the body while walking (default true). */
  bob?: boolean;
}

/** Shoulder position of the last body drawn (reused to avoid allocations). */
export const shoulder = { x: 0, y: 0 };

/**
 * Draw legs, torso and head. Feet rest on (0, 0).
 * Writes the resulting shoulder point into {@link shoulder}.
 */
export function drawStickBody(
  g: Phaser.GameObjects.Graphics,
  color: number,
  pose: BodyPose,
  width: number = BODY.lineWidth,
): void {
  const { dir, phase, stride, lean } = pose;
  const bob = stride > 0 && pose.bob !== false ? Math.abs(Math.sin(phase)) * -2.5 : 0;
  const hipY = BODY.hipY + bob;
  const hipX = 0;

  g.lineStyle(width, color, 1);

  // Legs: thigh swings, shin folds back as the leg moves forward.
  for (let i = 0; i < 2; i++) {
    const p = phase + i * Math.PI;
    const theta = Math.sin(p) * stride;
    const fold = Math.max(0, Math.cos(p)) * stride * 1.1;
    const kneeX = hipX + Math.sin(theta) * BODY.thigh * dir;
    const kneeY = hipY + Math.cos(theta) * BODY.thigh;
    const phi = theta - fold;
    const footX = kneeX + Math.sin(phi) * BODY.shin * dir;
    const footY = kneeY + Math.cos(phi) * BODY.shin;
    g.beginPath();
    g.moveTo(hipX, hipY);
    g.lineTo(kneeX, kneeY);
    g.lineTo(footX, Math.min(footY, 0));
    g.strokePath();
  }

  // Torso.
  const shX = hipX + lean * dir;
  const shY = BODY.shoulderY + bob;
  g.beginPath();
  g.moveTo(hipX, hipY);
  g.lineTo(shX, shY);
  g.strokePath();

  // Head (solid) with a short neck.
  const headX = shX + lean * 0.35 * dir;
  const headY = BODY.headY + bob;
  g.beginPath();
  g.moveTo(shX, shY);
  g.lineTo(headX, headY + BODY.headRadius * 0.6);
  g.strokePath();
  g.fillStyle(color, 1);
  g.fillCircle(headX, headY, BODY.headRadius);

  shoulder.x = shX;
  shoulder.y = shY;
}
