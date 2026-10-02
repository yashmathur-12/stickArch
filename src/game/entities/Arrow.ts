import Phaser from 'phaser';
import { COLORS, GAME_CONFIG } from '../data/GameData';
import { clamp, projectileY } from '../../utils/math';
import type { Poolable } from '../../utils/pool';
import type { Enemy } from './Enemy';

export type ArrowState = 'idle' | 'flying' | 'stuck';
export type ArrowStyle = 'normal' | 'swift' | 'multi' | 'giant';

/** Per-shot modifiers (set by power-ups). */
export interface ArrowSpec {
  damage: number;
  /** How many enemies the arrow can pass through before it is spent. */
  pierce: number;
  /** Visual / hit-box scale. */
  size: number;
  style: ArrowStyle;
  /** Seconds after launch at which the arrow splits (0 = never). */
  splitAfter: number;
}

export const NORMAL_SPEC: ArrowSpec = {
  damage: GAME_CONFIG.arrow.damage,
  pierce: 1,
  size: 1,
  style: 'normal',
  splitAfter: 0,
};

const A = GAME_CONFIG.arrow;
const MAX_TRACKED_HITS = 12;

const STYLE_COLORS: Record<ArrowStyle, { head: number; fletch: number; shaft: number }> = {
  normal: { head: COLORS.arrowHead, fletch: COLORS.fletching, shaft: COLORS.arrowShaft },
  swift: { head: 0xb8ecff, fletch: 0x4cc9ff, shaft: 0x15151c },
  multi: { head: 0xc9ffd6, fletch: 0x5be37d, shaft: 0x15151c },
  giant: { head: 0xffe39a, fletch: 0xffc857, shaft: 0x3a2a12 },
};

/**
 * A pooled projectile. Its position is the arrow TIP; the shaft trails behind.
 *
 * Motion is the closed-form constant-gravity solution
 *   p(t) = p0 + v0 t + 1/2 g t^2,  v(t) = v0 + g t
 * which is frame-rate independent and bit-for-bit what the aim preview draws.
 */
export class Arrow extends Phaser.GameObjects.Graphics implements Poolable {
  mode: ArrowState = 'idle';
  /** Current velocity (px/s). */
  vx = 0;
  vy = 0;
  /** Tip position at the start of the latest step (for swept collision). */
  prevX = 0;
  prevY = 0;
  damage: number = A.damage;
  /** Collision half-thickness in px. */
  radius: number = A.radius;
  /** True only on the step in which the arrow reached the ground. */
  landedThisStep = false;
  /** Set once when a split-arrow reaches its split time; the launcher clears it. */
  splitReady = false;

  private originX = 0;
  private originY = 0;
  private vy0 = 0;
  private age = 0;
  private stuckTimer = 0;
  private pierceLeft = 1;
  private splitAt = 0;
  private style: ArrowStyle | null = null;
  private readonly hitList: Array<Enemy | null> = new Array<Enemy | null>(MAX_TRACKED_HITS).fill(null);
  private hitCount = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, { x, y });
    this.deactivate();
  }

  get isFlying(): boolean {
    return this.mode === 'flying';
  }

  fire(x: number, y: number, vx: number, vy: number, spec: ArrowSpec = NORMAL_SPEC): void {
    this.setPosition(x, y);
    this.originX = x;
    this.originY = y;
    this.prevX = x;
    this.prevY = y;
    this.vx = vx;
    this.vy = vy;
    this.vy0 = vy;
    this.age = 0;
    this.stuckTimer = 0;
    this.landedThisStep = false;
    this.splitReady = false;
    this.damage = spec.damage;
    this.pierceLeft = spec.pierce;
    this.splitAt = spec.splitAfter;
    this.radius = A.radius * spec.size;
    this.hitCount = 0;
    this.hitList.fill(null);
    this.setScale(spec.size);
    if (this.style !== spec.style) {
      this.style = spec.style;
      this.drawShape(spec.style);
    }
    this.mode = 'flying';
    this.rotation = Math.atan2(vy, vx);
    this.setAlpha(1);
    this.setActive(true).setVisible(true);
  }

  deactivate(): void {
    this.mode = 'idle';
    this.landedThisStep = false;
    this.splitReady = false;
    this.setActive(false).setVisible(false);
  }

  /** Remove immediately (spent, left the screen, timed out). */
  kill(): void {
    this.deactivate();
  }

  hasHit(enemy: Enemy): boolean {
    for (let i = 0; i < this.hitCount; i++) if (this.hitList[i] === enemy) return true;
    return false;
  }

  /** Remember this enemy so a piercing arrow never hits it twice. */
  markHit(enemy: Enemy): void {
    if (this.hitCount < MAX_TRACKED_HITS) this.hitList[this.hitCount++] = enemy;
  }

  /** Spend one pierce. Returns true when the arrow is used up. */
  registerHit(): boolean {
    this.pierceLeft -= 1;
    return this.pierceLeft <= 0;
  }

  /** Advance the arrow by dt seconds. */
  step(dt: number): void {
    this.landedThisStep = false;

    if (this.mode === 'stuck') {
      this.stuckTimer += dt;
      const t = this.stuckTimer / A.stuckFadeTime;
      if (t >= 1) this.deactivate();
      else this.setAlpha(1 - t * t);
      return;
    }
    if (this.mode !== 'flying') return;

    this.age += dt;
    if (this.age > A.maxLifetime) {
      this.kill();
      return;
    }
    if (this.splitAt > 0 && this.age >= this.splitAt) {
      this.splitAt = 0;
      this.splitReady = true;
    }

    this.prevX = this.x;
    this.prevY = this.y;

    const t = this.age;
    const x = this.originX + this.vx * t;
    const y = projectileY(this.originY, this.vy0, A.gravity, t);
    this.vy = this.vy0 + A.gravity * t;
    this.setPosition(x, y);
    this.rotation = Math.atan2(this.vy, this.vx);

    if (y >= GAME_CONFIG.groundY) {
      // Plant the arrow in the ground where it crossed the line.
      const f = (GAME_CONFIG.groundY - this.prevY) / Math.max(1e-6, y - this.prevY);
      this.x = this.prevX + (x - this.prevX) * clamp(f, 0, 1);
      this.y = GAME_CONFIG.groundY;
      this.mode = 'stuck';
      this.landedThisStep = true;
      this.stuckTimer = 0;
    }
  }

  private drawShape(style: ArrowStyle): void {
    const L = A.length;
    const c = STYLE_COLORS[style];
    this.clear();

    if (style === 'swift') {
      // Speed streaks.
      this.lineStyle(2, c.fletch, 0.45);
      this.beginPath();
      this.moveTo(-L - 4, -4);
      this.lineTo(-L - 26, -4);
      this.moveTo(-L - 4, 4);
      this.lineTo(-L - 20, 4);
      this.strokePath();
    }
    if (style === 'giant') {
      this.fillStyle(c.fletch, 0.18);
      this.fillCircle(-L * 0.45, 0, L * 0.7);
    }

    this.lineStyle(3, c.shaft, 1);
    this.beginPath();
    this.moveTo(-L, 0);
    this.lineTo(-6, 0);
    this.strokePath();

    // Head.
    this.fillStyle(c.head, 1);
    this.fillTriangle(2, 0, -11, -5.5, -11, 5.5);

    // Fletching.
    this.lineStyle(2.5, c.fletch, 1);
    this.beginPath();
    this.moveTo(-L + 12, 0);
    this.lineTo(-L - 1, -6);
    this.moveTo(-L + 12, 0);
    this.lineTo(-L - 1, 6);
    this.moveTo(-L + 6, 0);
    this.lineTo(-L - 5, -6);
    this.moveTo(-L + 6, 0);
    this.lineTo(-L - 5, 6);
    this.strokePath();
  }
}
