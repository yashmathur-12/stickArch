import Phaser from 'phaser';
import { GAME_CONFIG } from '../data/GameData';
import { lerp } from '../../utils/math';

const F = GAME_CONFIG.fort;
const GROUND = GAME_CONFIG.groundY;
const W = F.right;
const H = F.height;

function mixRgb(a: number, b: number, t: number): number {
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t));
  const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t));
  const bl = Math.round(lerp(a & 255, b & 255, t));
  return (r << 16) | (g << 8) | bl;
}

/**
 * The castle wall the archer is defending, with the king on the ramparts.
 * The body is only repainted when something visible changes (health, hit
 * flash, time of day); the banner is a tiny separate graphic animated each frame.
 */
export class Fort {
  readonly right: number = F.right;
  health: number;
  readonly maxHealth: number;

  private readonly body: Phaser.GameObjects.Graphics;
  private readonly flag: Phaser.GameObjects.Graphics;
  private flash = 0;
  private shake = 0;
  private nightKey = -1;
  private dirty = true;
  private time = 0;
  private nightness = 0;
  private lastHealth: number;

  constructor(scene: Phaser.Scene, maxHealth: number) {
    this.health = maxHealth;
    this.maxHealth = maxHealth;
    this.lastHealth = maxHealth;
    this.body = scene.add.graphics({ x: 0, y: GROUND }).setDepth(8);
    this.flag = scene.add.graphics({ x: 0, y: GROUND }).setDepth(9);
    this.repaint();
  }

  get isDestroyed(): boolean {
    return this.health <= 0;
  }

  /** Position of the king's head (for effects). */
  get kingX(): number {
    return 52;
  }
  get topY(): number {
    return GROUND - H;
  }

  damage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    this.flash = 1;
    this.shake = 1;
    this.dirty = true;
  }

  setNightness(n: number): void {
    const key = Math.round(n * 16);
    if (key !== this.nightKey) {
      this.nightKey = key;
      this.nightness = n;
      this.dirty = true;
    }
  }

  update(dt: number): void {
    this.time += dt;
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 4);
      this.dirty = true;
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 5);
      this.body.setX(Math.sin(this.time * 90) * this.shake * 4);
    } else if (this.body.x !== 0) {
      this.body.setX(0);
    }
    if (this.dirty || this.lastHealth !== this.health) {
      this.lastHealth = this.health;
      this.repaint();
    }
    this.paintFlag();
  }

  private repaint(): void {
    this.dirty = false;
    const g = this.body;
    const n = this.nightness;
    const stone = mixRgb(0xb8b2a6, 0x4c5473, n);
    const stoneDark = mixRgb(0x8f897e, 0x363c58, n);
    const stoneLight = mixRgb(0xd8d2c4, 0x646d90, n);
    const wood = mixRgb(0x7a5230, 0x3a2a24, n);
    const ratio = this.health / this.maxHealth;

    g.clear();

    // Main wall.
    g.fillStyle(stone, 1);
    g.fillRect(0, -H, W, H);
    // Brick courses.
    g.lineStyle(1.5, stoneDark, 0.9);
    g.beginPath();
    for (let y = -H + 22; y < 0; y += 22) {
      g.moveTo(0, y);
      g.lineTo(W, y);
      const off = ((y / 22) | 0) % 2 === 0 ? 0 : 18;
      for (let x = 18 + off; x < W; x += 36) {
        g.moveTo(x, y);
        g.lineTo(x, y + 22);
      }
    }
    g.strokePath();

    // Crenellations.
    g.fillStyle(stone, 1);
    for (let x = 0; x < W; x += 28) {
      g.fillRect(x, -H - 18, 18, 18);
    }
    g.fillStyle(stoneLight, 1);
    g.fillRect(0, -H, W, 5);

    // Tower on the far left (taller).
    g.fillStyle(stoneDark, 1);
    g.fillRect(0, -H - 64, 40, 64);
    g.fillStyle(stone, 1);
    for (let x = 0; x < 40; x += 14) g.fillRect(x, -H - 80, 9, 16);
    g.fillStyle(0x10131f, 0.9);
    g.fillRect(14, -H - 46, 10, 22); // arrow slit

    // Gate.
    g.fillStyle(wood, 1);
    g.fillRect(W - 62, -92, 46, 92);
    g.fillCircle(W - 39, -92, 23);
    g.lineStyle(3, 0x1b1410, 0.8);
    g.beginPath();
    g.moveTo(W - 39, -115);
    g.lineTo(W - 39, 0);
    g.strokePath();

    // Window glow at night.
    g.fillStyle(0xffd27a, 0.25 + 0.7 * n);
    g.fillRect(24, -H + 52, 12, 22);
    g.fillRect(70, -H + 52, 12, 22);

    // The royal family on the rampart, with villagers sheltering beside them.
    this.paintRoyals(g, -H - 18, n);

    // Cracks as the wall weakens.
    g.lineStyle(2.5, 0x1b1d27, 0.85);
    g.beginPath();
    if (ratio < 0.75) {
      g.moveTo(88, -H + 30);
      g.lineTo(80, -H + 70);
      g.lineTo(92, -H + 96);
      g.lineTo(84, -H + 124);
    }
    if (ratio < 0.5) {
      g.moveTo(46, -80);
      g.lineTo(58, -118);
      g.lineTo(50, -140);
      g.moveTo(100, -60);
      g.lineTo(92, -30);
    }
    if (ratio < 0.25) {
      g.moveTo(20, -H + 90);
      g.lineTo(34, -H + 130);
      g.lineTo(26, -20);
      g.moveTo(70, -150);
      g.lineTo(62, -110);
      g.lineTo(76, -70);
    }
    g.strokePath();

    if (this.flash > 0) {
      g.fillStyle(0xffffff, 0.55 * this.flash);
      g.fillRect(0, -H, W, H);
    }
  }

  private paintRoyals(g: Phaser.GameObjects.Graphics, y: number, night: number): void {
    const gold = 0xffd34d;
    const skin = 0xf2d3b0;
    const kingRobe = mixRgb(0xc43a4a, 0x7a2432, night);
    const queenRobe = mixRgb(0x6a49c9, 0x3e2b78, night);
    const cloth = mixRgb(0x8aa0b8, 0x4a5772, night);

    // Villagers (small, huddled behind the king and queen).
    for (const vx of [104, 114]) {
      g.fillStyle(cloth, 1);
      g.fillRect(vx - 4, y - 14, 8, 14);
      g.fillStyle(skin, 1);
      g.fillCircle(vx, y - 19, 4.5);
    }

    // King.
    const kx = 56;
    g.fillStyle(kingRobe, 1);
    g.fillTriangle(kx, y - 34, kx - 15, y, kx + 15, y);
    g.fillStyle(skin, 1);
    g.fillCircle(kx, y - 42, 9);
    g.fillStyle(gold, 1);
    g.fillRect(kx - 9, y - 55, 18, 6);
    g.fillTriangle(kx - 9, y - 55, kx - 5, y - 55, kx - 7, y - 63);
    g.fillTriangle(kx - 2, y - 55, kx + 2, y - 55, kx, y - 65);
    g.fillTriangle(kx + 5, y - 55, kx + 9, y - 55, kx + 7, y - 63);
    g.lineStyle(3, kingRobe, 1);
    g.beginPath();
    g.moveTo(kx + 6, y - 26);
    g.lineTo(kx + 18, y - 38);
    g.strokePath();

    // Queen.
    const qx = 84;
    g.fillStyle(queenRobe, 1);
    g.fillTriangle(qx, y - 32, qx - 13, y, qx + 13, y);
    g.fillStyle(skin, 1);
    g.fillCircle(qx, y - 40, 8);
    g.fillStyle(0x2a1a14, 1);
    g.fillRect(qx - 9, y - 42, 4, 20); // long hair
    g.fillStyle(gold, 1);
    g.fillRect(qx - 7, y - 52, 14, 4);
    g.fillTriangle(qx - 7, y - 52, qx - 3, y - 52, qx - 5, y - 58);
    g.fillTriangle(qx + 3, y - 52, qx + 7, y - 52, qx + 5, y - 58);
  }

  private paintFlag(): void {
    const g = this.flag;
    g.clear();
    const px = 36;
    const top = -H - 80;
    g.lineStyle(3, 0x2b2118, 1);
    g.beginPath();
    g.moveTo(px, top);
    g.lineTo(px, top - 52);
    g.strokePath();
    const wave = Math.sin(this.time * 5) * 4;
    g.fillStyle(0xe03a4e, 1);
    g.beginPath();
    g.moveTo(px, top - 52);
    g.lineTo(px + 26, top - 46 + wave);
    g.lineTo(px + 44, top - 40 - wave * 0.6);
    g.lineTo(px + 26, top - 34 + wave);
    g.lineTo(px, top - 28);
    g.closePath();
    g.fillPath();
  }
}
