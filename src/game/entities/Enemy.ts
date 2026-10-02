import Phaser from 'phaser';
import { BODY, drawStickBody, shoulder } from './stickman';
import { drawWeapon } from './weapons';
import { COLORS, ENEMY_TYPES, GAME_CONFIG, type EnemyDefinition } from '../data/GameData';
import type { Poolable } from '../../utils/pool';

export type EnemyState = 'idle' | 'walking' | 'dying';

const E = GAME_CONFIG.enemy;

/**
 * A pooled walking enemy. All type-specific behaviour comes from its
 * {@link EnemyDefinition}, so new enemy types are data (plus, later, a
 * movement strategy) rather than new classes.
 */
export class Enemy extends Phaser.GameObjects.Graphics implements Poolable {
  mode: EnemyState = 'idle';
  def: EnemyDefinition = ENEMY_TYPES.grunt;
  health = 1;
  maxHealth = 1;
  speed = 0;
  /** Depth lane (0 = front-most ground line). */
  lane = 0;
  private phase = 0;
  private flashTimer = 0;
  private deathTimer = 0;
  /** Brief backward lean after being hit; decays quickly. */
  private recoil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, { x, y });
    this.deactivate();
  }

  get isAlive(): boolean {
    return this.mode === 'walking';
  }

  get hitLeft(): number {
    return this.x - (this.def.hitWidth * this.def.scale) / 2;
  }
  get hitRight(): number {
    return this.x + (this.def.hitWidth * this.def.scale) / 2;
  }
  get hitTop(): number {
    return this.y - this.def.hitHeight * this.def.scale;
  }
  get hitBottom(): number {
    return this.y;
  }
  /** Left-most point of the body or weapon that can touch targets. */
  get reachLeft(): number {
    return this.hitLeft - this.def.reach * this.def.scale;
  }

  spawn(def: EnemyDefinition, x: number, speed: number, health: number, lane: number): void {
    this.def = def;
    this.health = health;
    this.maxHealth = health;
    this.speed = speed;
    this.lane = lane;
    this.phase = Math.random() * Math.PI * 2;
    this.flashTimer = 0;
    this.deathTimer = 0;
    this.recoil = 0;
    this.mode = 'walking';
    this.setPosition(x, GAME_CONFIG.groundY + lane * E.laneSpacing);
    this.setDepth(10 + lane);
    this.setScale(def.scale);
    this.setRotation(0);
    this.setAlpha(1);
    this.setActive(true).setVisible(true);
    this.redraw();
  }

  deactivate(): void {
    this.mode = 'idle';
    this.setActive(false).setVisible(false);
  }

  /** Apply damage; returns true if this hit killed the enemy. */
  takeDamage(amount: number): boolean {
    if (this.mode !== 'walking') return false;
    this.health -= amount;
    this.flashTimer = E.hitFlashDuration;
    this.recoil = 1;
    if (this.health <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  /** Start the death animation (no score; used when an enemy breaches the wall). */
  die(): void {
    if (this.mode !== 'walking') return;
    this.mode = 'dying';
    this.deathTimer = 0;
  }

  step(dt: number): void {
    if (this.mode === 'walking') {
      this.x -= this.speed * dt;
      // Stride cadence follows speed so fast enemies visibly run.
      this.phase += (this.speed * dt) / (14 * this.def.scale);
      if (this.flashTimer > 0) this.flashTimer -= dt;
      if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 6);
    } else if (this.mode === 'dying') {
      this.deathTimer += dt;
      const t = Math.min(1, this.deathTimer / E.deathDuration);
      const ease = 1 - (1 - t) * (1 - t);
      this.rotation = ease * 1.45;
      this.x += (1 - t) * 90 * dt;
      this.setAlpha(t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45);
      if (t >= 1) {
        this.deactivate();
        return;
      }
    }
    this.redraw();
  }

  private redraw(): void {
    const dying = this.mode === 'dying';
    const flashing = this.flashTimer > 0 || (dying && this.deathTimer < 0.08);
    const color = flashing ? COLORS.flash : this.def.color;

    this.clear();
    drawStickBody(this, color, {
      phase: this.phase,
      stride: dying ? 0 : 0.7,
      lean: -5 + this.recoil * 6,
      dir: -1,
    });

    // Arms reach out toward the archer (to the left), swaying with the stride.
    const sway = Math.sin(this.phase * 0.5) * 4;
    const sx = shoulder.x;
    const sy = shoulder.y;
    const handX = sx - 34;
    const handY = sy - 2 + sway;
    this.lineStyle(BODY.lineWidth - 1, color, 1);
    this.beginPath();
    this.moveTo(sx, sy);
    this.lineTo(sx - 22, sy + 4 + sway);
    this.lineTo(handX, handY);
    this.moveTo(sx, sy);
    this.lineTo(sx - 16, sy + 12 - sway);
    this.lineTo(sx - 28, sy + 8 - sway);
    this.strokePath();

    drawWeapon(this, this.def.weapon, handX, handY, sx, sy, flashing);

    // Health pips for anything tougher than a single hit.
    if (this.maxHealth > 1 && !dying) {
      const w = 40;
      const x = -w / 2 - 4;
      const y = -this.def.hitHeight - 12;
      this.fillStyle(0x000000, 0.55);
      this.fillRect(x - 1, y - 1, w + 2, 7);
      this.fillStyle(0xff4d5a, 1);
      this.fillRect(x, y, (w * Math.max(0, this.health)) / this.maxHealth, 5);
    }
  }
}
