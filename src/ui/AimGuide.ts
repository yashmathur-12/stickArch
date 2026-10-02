import Phaser from 'phaser';
import { GAME_CONFIG, GAME_WIDTH } from '../game/data/GameData';
import { lerp, projectileY } from '../utils/math';

const AIM = GAME_CONFIG.aim;
const SIM_STEP = 1 / 120;

/** Draws the drag handle, charge bar and dotted trajectory preview while aiming. */
export class AimGuide {
  private readonly g: Phaser.GameObjects.Graphics;
  /** Guide ink: white at night, dark navy by day so it stays readable. */
  private ink = 0xffffff;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(25);
  }

  /** 0 = day, 1 = night. */
  setNightness(n: number): void {
    this.ink = mixRgb(0x0b1022, 0xffffff, n);
  }

  clear(): void {
    this.g.clear();
  }

  /** Drag handle: anchor ring, rubber-band line and the (clamped) grip point. */
  drawPull(anchorX: number, anchorY: number, handleX: number, handleY: number, power: number, valid: boolean): void {
    const g = this.g;
    const color = valid ? mixToAccent(power, this.ink) : this.ink;
    const alpha = valid ? 0.55 : 0.28;

    g.lineStyle(2, this.ink, 0.1);
    g.strokeCircle(anchorX, anchorY, AIM.maxDrawDistance);

    g.lineStyle(2, color, alpha * 0.8);
    g.beginPath();
    g.moveTo(anchorX, anchorY);
    g.lineTo(handleX, handleY);
    g.strokePath();

    g.lineStyle(2, this.ink, 0.45);
    g.strokeCircle(anchorX, anchorY, 9);
    g.fillStyle(color, alpha);
    g.fillCircle(handleX, handleY, 8 + power * 3);
  }

  /** Power bar under the archer while charging with the keyboard. */
  drawChargeBar(x: number, power: number): void {
    const g = this.g;
    const w = 84;
    const y = GAME_CONFIG.groundY + 34;
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(x - w / 2 - 2, y - 2, w + 4, 12, 6);
    g.fillStyle(mixToAccent(power, 0xffffff), 0.95);
    g.fillRoundedRect(x - w / 2, y, Math.max(6, w * power), 8, 4);
  }

  /** Short faint line along the keyboard aim direction. */
  drawAimLine(px: number, py: number, angle: number, strength: number): void {
    const g = this.g;
    const len = 150;
    g.lineStyle(2, this.ink, 0.28 * Math.min(1, strength * 1.5));
    g.beginPath();
    g.moveTo(px + Math.cos(angle) * 70, py + Math.sin(angle) * 70);
    g.lineTo(px + Math.cos(angle) * len, py + Math.sin(angle) * len);
    g.strokePath();
  }

  /** Dotted arc following exactly the same physics as a real arrow. */
  drawTrajectory(x0: number, y0: number, vx: number, vy: number): void {
    const g = this.g;
    const total = AIM.previewDuration;
    let lastX = x0;
    let lastY = y0;
    let dist = AIM.previewDotSpacing * 0.5;

    for (let t = SIM_STEP; t <= total; t += SIM_STEP) {
      const x = x0 + vx * t;
      const y = projectileY(y0, vy, GAME_CONFIG.arrow.gravity, t);

      if (y >= GAME_CONFIG.groundY) {
        // Landing marker.
        const f = (GAME_CONFIG.groundY - lastY) / Math.max(1e-6, y - lastY);
        const lx = lerp(lastX, x, f);
        g.lineStyle(2, this.ink, 0.4 * (1 - t / total));
        g.strokeEllipse(lx, GAME_CONFIG.groundY, 22, 7);
        return;
      }
      if (x > GAME_WIDTH + 40) return;

      dist += Math.hypot(x - lastX, y - lastY);
      lastX = x;
      lastY = y;
      if (dist >= AIM.previewDotSpacing) {
        dist = 0;
        const k = t / total;
        g.fillStyle(this.ink, 0.75 * (1 - k) * (1 - k) + 0.08);
        g.fillCircle(x, y, 3.2 - k * 1.4);
      }
    }
  }
}

function mixRgb(a: number, b: number, t: number): number {
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t));
  const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t));
  const bl = Math.round(lerp(a & 255, b & 255, t));
  return (r << 16) | (g << 8) | bl;
}

/** Ink colour shifting toward gold as power rises. */
function mixToAccent(power: number, ink: number): number {
  return mixRgb(ink, 0xffb21e, power);
}
