import type Phaser from 'phaser';
import type { Arrow } from '../entities/Arrow';
import type { Enemy } from '../entities/Enemy';
import { segmentVsBox } from '../../utils/math';

export interface HitInfo {
  arrow: Arrow;
  enemy: Enemy;
  /** Impact point in world space. */
  x: number;
  y: number;
}

export type HitHandler = (hit: HitInfo) => void;

const hit: HitInfo = { arrow: null as unknown as Arrow, enemy: null as unknown as Enemy, x: 0, y: 0 };

/**
 * Swept arrow-vs-enemy collision. The arrow's per-frame movement segment is
 * tested against each enemy's box (inflated by the arrow's thickness), so fast
 * arrows never tunnel through. Piercing arrows can hit several enemies per
 * frame, nearest first, and never the same enemy twice.
 */
export class CollisionSystem {
  constructor(
    private readonly arrows: Phaser.GameObjects.Group,
    private readonly enemies: Phaser.GameObjects.Group,
    private readonly onHit: HitHandler,
  ) {}

  update(): void {
    const arrows = this.arrows.getChildren() as Arrow[];
    const enemies = this.enemies.getChildren() as Enemy[];

    for (let i = 0; i < arrows.length; i++) {
      const arrow = arrows[i];
      if (!arrow.active || !(arrow.isFlying || arrow.landedThisStep)) continue;

      // Keep resolving hits along this frame's path until nothing new is struck
      // or the arrow is spent.
      while (arrow.active) {
        let bestT = Infinity;
        let best: Enemy | null = null;
        const r = arrow.radius;
        for (let j = 0; j < enemies.length; j++) {
          const enemy = enemies[j];
          if (!enemy.active || !enemy.isAlive || arrow.hasHit(enemy)) continue;
          const t = segmentVsBox(
            arrow.prevX,
            arrow.prevY,
            arrow.x,
            arrow.y,
            enemy.hitLeft - r,
            enemy.hitTop - r,
            enemy.hitRight + r,
            enemy.hitBottom + r,
          );
          if (t >= 0 && t < bestT) {
            bestT = t;
            best = enemy;
          }
        }
        if (!best) break;

        arrow.markHit(best);
        hit.arrow = arrow;
        hit.enemy = best;
        hit.x = arrow.prevX + (arrow.x - arrow.prevX) * bestT;
        hit.y = arrow.prevY + (arrow.y - arrow.prevY) * bestT;
        this.onHit(hit);
      }
    }
  }
}
