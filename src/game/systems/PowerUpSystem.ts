import Phaser from 'phaser';
import { GAME_CONFIG, POWERUP_ORDER, type PowerUpType } from '../data/GameData';
import { PowerUpPickup } from '../entities/PowerUpPickup';
import type { Archer } from '../entities/Archer';
import { randRange } from '../../utils/math';
import { acquire, prewarm } from '../../utils/pool';

const P = GAME_CONFIG.powerUps;
const A = GAME_CONFIG.archer;

export interface PowerUpHooks {
  /** An orb was picked up (position is where it was collected). */
  onCollect(type: PowerUpType, x: number, y: number, duration: number): void;
}

/**
 * Drops power-up orbs on a timer, lets the archer collect them and tracks the
 * countdown of every active effect. Effects of different types stack; picking
 * up the same type again simply refreshes its timer.
 */
export class PowerUpSystem {
  private readonly pickups: Phaser.GameObjects.Group;
  private readonly remaining: Record<PowerUpType, number> = { multishot: 0, swift: 0, giant: 0, shield: 0 };
  private readonly total: Record<PowerUpType, number> = { multishot: 1, swift: 1, giant: 1, shield: 1 };
  private spawnTimer: number = P.firstDelay;
  private lastType: PowerUpType | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly hooks: PowerUpHooks,
  ) {
    this.pickups = scene.add.group({ classType: PowerUpPickup, maxSize: 3, runChildUpdate: false });
    prewarm<PowerUpPickup>(this.pickups, 3);
    this.pickups.getChildren().forEach((p) => (p as PowerUpPickup).setDepth(18));
  }

  isActive(type: PowerUpType): boolean {
    return this.remaining[type] > 0;
  }

  timeLeft(type: PowerUpType): number {
    return this.remaining[type];
  }

  fraction(type: PowerUpType): number {
    return this.remaining[type] / this.total[type];
  }

  /** Effect length for the current score: 30s, +2s for every 1000 points. */
  durationFor(score: number): number {
    const bonus = Math.floor(score / P.scoreStep) * P.bonusPerStep;
    return Math.min(P.maxDuration, P.baseDuration + bonus);
  }

  update(dt: number, archer: Archer, score: number): void {
    for (const type of POWERUP_ORDER) {
      if (this.remaining[type] > 0) this.remaining[type] = Math.max(0, this.remaining[type] - dt);
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && !this.anyOrbOnField()) {
      this.spawnOrb(archer);
      this.spawnTimer = randRange(P.intervalMin, P.intervalMax);
    }

    const pickups = this.pickups.getChildren() as PowerUpPickup[];
    for (let i = 0; i < pickups.length; i++) {
      const p = pickups[i];
      if (!p.active) continue;
      p.step(dt);
      if (p.active && p.isCollectable && this.touchesArcher(p, archer)) {
        const duration = this.durationFor(score);
        this.remaining[p.kind] = duration;
        this.total[p.kind] = duration;
        const { x, y, kind: type } = p;
        p.deactivate();
        this.hooks.onCollect(type, x, y, duration);
      }
    }
  }

  /** Cancel everything (e.g. when the run ends). */
  clearEffects(): void {
    for (const type of POWERUP_ORDER) this.remaining[type] = 0;
  }

  private anyOrbOnField(): boolean {
    const pickups = this.pickups.getChildren() as PowerUpPickup[];
    return pickups.some((p) => p.active);
  }

  private spawnOrb(archer: Archer): void {
    const orb = acquire<PowerUpPickup>(this.pickups);
    if (!orb) return;
    // Avoid giving the same power-up twice in a row.
    const options = POWERUP_ORDER.filter((t) => t !== this.lastType);
    const type = options[Math.floor(Math.random() * options.length)];
    this.lastType = type;
    // Land somewhere the archer can reach, biased away from where he stands now.
    let x = randRange(A.minX + 20, A.maxX + 40);
    if (Math.abs(x - archer.x) < 90) x = x < archer.x ? x - 120 : x + 120;
    orb.spawn(type, Math.min(Math.max(x, A.minX), A.maxX + 80));
  }

  /** Circle (orb) vs archer body box. */
  private touchesArcher(p: PowerUpPickup, archer: Archer): boolean {
    const left = archer.x - A.halfWidth;
    const right = archer.x + A.halfWidth;
    const bottom = GAME_CONFIG.groundY;
    const top = bottom - A.height;
    const cx = Math.min(Math.max(p.x, left), right);
    const cy = Math.min(Math.max(p.y, top), bottom);
    const dx = p.x - cx;
    const dy = p.y - cy;
    return dx * dx + dy * dy <= p.radius * p.radius;
  }
}
