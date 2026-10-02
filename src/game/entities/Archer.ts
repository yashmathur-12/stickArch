import Phaser from 'phaser';
import { BODY, drawStickBody, shoulder } from './stickman';
import { COLORS, GAME_CONFIG } from '../data/GameData';
import { clamp, damp, lerp } from '../../utils/math';

const AR = GAME_CONFIG.archer;
const BOW_HALF_HEIGHT = 46;
const BOW_BULGE = 14;
const DEG = Math.PI / 180;

export interface LaunchPoint {
  x: number;
  y: number;
}

/**
 * The player's stickman. Owns three Graphics objects: the body (anchored at
 * the feet), the bow (anchored at the shoulder, rotated toward the aim) and
 * the shield aura.
 */
export class Archer {
  x: number = AR.x;
  readonly pivotY: number = GAME_CONFIG.groundY + BODY.shoulderY;

  health = 1;
  maxHealth = 1;

  private readonly body: Phaser.GameObjects.Graphics;
  private readonly bow: Phaser.GameObjects.Graphics;
  private readonly aura: Phaser.GameObjects.Graphics;

  private aimAngle = GAME_CONFIG.keyboard.startAngleDeg * DEG;
  private restAngle = GAME_CONFIG.keyboard.startAngleDeg * DEG;
  private targetPower = 0;
  private draw = 0; // current string pull in px (smoothed)
  private aiming = false;
  private wobble = 0; // string vibration after release
  private wobbleTime = 0;
  private hurtFlash = 0;
  private invulnerable = 0;
  private dead = false;
  private deathTime = 0;
  private walkPhase = 0;
  private moving = false;
  private shieldLeft = 0;
  private time = 0;

  constructor(scene: Phaser.Scene) {
    this.body = scene.add.graphics({ x: this.x, y: GAME_CONFIG.groundY }).setDepth(15);
    this.bow = scene.add.graphics({ x: this.x, y: this.pivotY }).setDepth(16);
    this.aura = scene.add.graphics({ x: this.x, y: GAME_CONFIG.groundY - 58 }).setDepth(17);
    this.redraw();
  }

  get pivotX(): number {
    return this.x;
  }

  /** Show / hide the whole archer (used by the intro cinematic). */
  setVisible(visible: boolean): void {
    this.body.setVisible(visible);
    this.bow.setVisible(visible && !this.dead);
    if (!visible) this.aura.setVisible(false);
  }

  get isDead(): boolean {
    return this.dead;
  }

  get isInvulnerable(): boolean {
    return this.invulnerable > 0 || this.shieldLeft > 0;
  }

  get hasShield(): boolean {
    return this.shieldLeft > 0;
  }

  setHealth(max: number): void {
    this.health = max;
    this.maxHealth = max;
  }

  /** Begin / update drawing the bow. `power` is 0..1. */
  setAim(angle: number, power: number): void {
    if (this.dead) return;
    this.aiming = true;
    this.aimAngle = angle;
    this.targetPower = power;
  }

  /** The angle the bow rests at while not drawing (keyboard aim). */
  setRestAngle(angle: number): void {
    this.restAngle = angle;
  }

  /** Where the arrow TIP starts for a given aim (matches the nocked arrow). */
  getLaunchPoint(angle: number, power: number, out: LaunchPoint): LaunchPoint {
    const reach = AR.gripDistance - power * AR.maxPull + GAME_CONFIG.arrow.length;
    out.x = this.pivotX + Math.cos(angle) * reach;
    out.y = this.pivotY + Math.sin(angle) * reach;
    return out;
  }

  /** Release the string: the bow snaps back and the string vibrates. */
  release(): void {
    this.aiming = false;
    this.targetPower = 0;
    this.wobble = 1;
    this.wobbleTime = 0;
  }

  /** Abort aiming without firing. */
  cancelAim(): void {
    this.aiming = false;
    this.targetPower = 0;
  }

  /** Take one point of damage; returns true if the archer is now dead. */
  hurt(): boolean {
    this.health = Math.max(0, this.health - 1);
    this.hurtFlash = 1;
    this.invulnerable = AR.invulnerableTime;
    return this.health <= 0;
  }

  /** Shove the archer sideways (clamped to the walkable range). */
  knockBack(dx: number): void {
    this.x = clamp(this.x + dx, AR.minX, AR.maxX);
  }

  /** Remaining shield time in seconds (0 removes the shield). */
  setShield(seconds: number): void {
    this.shieldLeft = Math.max(0, seconds);
  }

  die(): void {
    this.dead = true;
    this.aiming = false;
    this.deathTime = 0;
    this.hurtFlash = 1;
    this.shieldLeft = 0;
    this.bow.setVisible(false);
    this.aura.setVisible(false);
  }

  /** `axis` is -1 (left), 0 or +1 (right). */
  update(dt: number, axis = 0): void {
    this.time += dt;
    if (this.dead) {
      this.deathTime += dt;
      const t = Math.min(1, this.deathTime / 0.45);
      this.body.setRotation(-t * (2 - t) * 1.5);
      this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2);
      this.redraw();
      return;
    }

    this.moving = axis !== 0;
    if (this.moving) {
      this.x = clamp(this.x + axis * AR.moveSpeed * dt, AR.minX, AR.maxX);
      this.walkPhase += dt * 12;
    }
    this.body.setX(this.x);
    this.bow.setX(this.x);
    this.aura.setX(this.x);

    const targetDraw = this.targetPower * AR.maxPull;
    // Pulling feels firm; releasing snaps back almost instantly.
    this.draw = lerp(this.draw, targetDraw, damp(this.aiming ? 30 : 60, dt));
    if (!this.aiming) {
      this.aimAngle = lerp(this.aimAngle, this.restAngle, damp(18, dt));
    }
    if (this.wobble > 0) {
      this.wobbleTime += dt;
      this.wobble = Math.max(0, this.wobble - dt * 6);
    }
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3);
    if (this.invulnerable > 0) this.invulnerable = Math.max(0, this.invulnerable - dt);

    this.redraw();
    this.drawAura();
  }

  private redraw(): void {
    const g = this.body;
    const dir = Math.cos(this.aimAngle);
    const dy = Math.sin(this.aimAngle);
    const color = this.hurtFlash > 0 ? mix(COLORS.stickman, COLORS.enemy, this.hurtFlash) : COLORS.stickman;

    // Blink while recovering from a hit.
    const blink = this.invulnerable > 0 && this.shieldLeft <= 0 && Math.sin(this.time * 40) > 0;
    g.setAlpha(blink ? 0.35 : 1);
    this.bow.setAlpha(blink ? 0.35 : 1);

    g.clear();
    if (this.moving) {
      drawStickBody(g, color, { phase: this.walkPhase, stride: 0.5, lean: 0, dir: 1, bob: false });
    } else {
      drawStickBody(g, color, { phase: Math.PI / 2, stride: 0.25, lean: 0, dir: 1, bob: false });
    }

    if (this.dead) return;

    const sx = shoulder.x;
    const sy = shoulder.y;
    const gripX = sx + dir * AR.gripDistance;
    const gripY = sy + dy * AR.gripDistance;

    // Front (bow) arm: shoulder -> grip.
    g.lineStyle(BODY.lineWidth - 1, color, 1);
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(gripX, gripY);
    g.strokePath();

    // Back (string) arm: shoulder -> elbow -> nock.
    const pull = this.draw;
    const wob = Math.sin(this.wobbleTime * 70) * this.wobble * 3;
    const handX = sx + dir * (AR.gripDistance - pull) - dy * wob;
    const handY = sy + dy * (AR.gripDistance - pull) + dir * wob;
    g.beginPath();
    g.moveTo(sx, sy);
    if (this.aiming || this.draw > 0.5) {
      const ex = sx - dir * (10 + pull * 0.35);
      const ey = sy - dy * (10 + pull * 0.35) + 6;
      g.lineTo(ex, ey);
      g.lineTo(handX, handY);
    } else {
      g.lineTo(sx - 6, sy + 22);
      g.lineTo(sx + 2, sy + 40);
    }
    g.strokePath();

    this.drawBow(wob);
  }

  private drawBow(wobbleY: number): void {
    const b = this.bow;
    const pull = this.draw;
    const flex = pull * 0.3;
    const grip = AR.gripDistance;

    b.clear();
    b.setRotation(this.aimAngle);

    // Limbs.
    b.lineStyle(5, COLORS.bow, 1);
    b.beginPath();
    const N = 12;
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * 2 - 1;
      const x = grip + BOW_BULGE * (1 - t * t) - flex * t * t;
      const y = BOW_HALF_HEIGHT * t;
      if (i === 0) b.moveTo(x, y);
      else b.lineTo(x, y);
    }
    b.strokePath();

    // String.
    const tipX = grip - flex;
    const nockX = grip - pull;
    b.lineStyle(1.6, COLORS.bowString, 0.95);
    b.beginPath();
    b.moveTo(tipX, -BOW_HALF_HEIGHT);
    b.lineTo(nockX, wobbleY);
    b.lineTo(tipX, BOW_HALF_HEIGHT);
    b.strokePath();

    // Nocked arrow while drawing.
    if (this.aiming) {
      const L = GAME_CONFIG.arrow.length;
      b.lineStyle(3, COLORS.arrowShaft, 1);
      b.beginPath();
      b.moveTo(nockX, 0);
      b.lineTo(nockX + L - 6, 0);
      b.strokePath();
      b.fillStyle(COLORS.arrowHead, 1);
      b.fillTriangle(nockX + L + 2, 0, nockX + L - 11, -5.5, nockX + L - 11, 5.5);
      b.lineStyle(2.5, COLORS.fletching, 1);
      b.beginPath();
      b.moveTo(nockX + 12, 0);
      b.lineTo(nockX - 1, -6);
      b.moveTo(nockX + 12, 0);
      b.lineTo(nockX - 1, 6);
      b.strokePath();
    }
  }

  private drawAura(): void {
    const a = this.aura;
    a.clear();
    if (this.shieldLeft <= 0) return;
    // Fast flicker for the last three seconds warns the effect is ending.
    const ending = this.shieldLeft < 3;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * (ending ? 22 : 4));
    const alpha = ending ? 0.35 + 0.65 * (pulse > 0.5 ? 1 : 0.2) : 1;
    const r = 74 + pulse * 3;
    a.fillStyle(0xb48cff, 0.12 * alpha);
    a.fillCircle(0, 0, r);
    a.lineStyle(3, 0xd9c6ff, 0.85 * alpha);
    a.strokeCircle(0, 0, r);
    a.lineStyle(2, 0xb48cff, 0.4 * alpha);
    a.strokeCircle(0, 0, r - 8);
  }
}

function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  return (
    (Math.round(lerp(ar, br, t)) << 16) | (Math.round(lerp(ag, bg, t)) << 8) | Math.round(lerp(ab, bb, t))
  );
}
