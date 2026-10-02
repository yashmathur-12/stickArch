import Phaser from 'phaser';
import { GAME_CONFIG, POWERUP_TYPES, type PowerUpType } from '../data/GameData';
import { drawPowerUpIcon } from '../../ui/PowerUpIcons';
import type { Poolable } from '../../utils/pool';

const P = GAME_CONFIG.powerUps;
const RADIUS = 22;

type PickupMode = 'idle' | 'falling' | 'hover';

/**
 * A glowing orb that drifts down from the sky and then hovers just above the
 * ground. The archer collects it by walking into it (or letting it land on him).
 */
export class PowerUpPickup extends Phaser.GameObjects.Graphics implements Poolable {
  mode: PickupMode = 'idle';
  kind: PowerUpType = 'multishot';
  private time = 0;
  private life = 0;
  private baseY = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, { x, y });
    this.deactivate();
  }

  get isCollectable(): boolean {
    return this.mode !== 'idle';
  }

  get radius(): number {
    return P.pickupRadius;
  }

  spawn(kind: PowerUpType, x: number): void {
    this.kind = kind;
    this.time = 0;
    this.life = P.groundLife;
    this.baseY = GAME_CONFIG.groundY - P.hoverHeight;
    this.mode = 'falling';
    this.setPosition(x, -40);
    this.setAlpha(1).setScale(1);
    this.setActive(true).setVisible(true);
    this.paint();
  }

  deactivate(): void {
    this.mode = 'idle';
    this.setActive(false).setVisible(false);
  }

  step(dt: number): void {
    if (this.mode === 'idle') return;
    this.time += dt;

    if (this.mode === 'falling') {
      this.y += P.fallSpeed * dt;
      this.x += Math.sin(this.time * 2.2) * 18 * dt;
      if (this.y >= this.baseY) {
        this.y = this.baseY;
        this.mode = 'hover';
      }
    } else {
      this.life -= dt;
      this.y = this.baseY + Math.sin(this.time * 3) * 5;
      if (this.life <= 0) {
        this.deactivate();
        return;
      }
      // Blink when about to vanish.
      this.setAlpha(this.life < 3 ? (Math.sin(this.time * 18) > 0 ? 1 : 0.25) : 1);
    }
    this.setScale(1 + Math.sin(this.time * 5) * 0.05);
  }

  private paint(): void {
    const color = POWERUP_TYPES[this.kind].color;
    this.clear();
    this.fillStyle(color, 0.14);
    this.fillCircle(0, 0, RADIUS + 14);
    this.fillStyle(color, 0.22);
    this.fillCircle(0, 0, RADIUS + 7);
    this.fillStyle(0x0b1022, 0.88);
    this.fillCircle(0, 0, RADIUS);
    this.lineStyle(3, color, 1);
    this.strokeCircle(0, 0, RADIUS);
    drawPowerUpIcon(this, this.kind, RADIUS * 0.58, color);
  }
}
