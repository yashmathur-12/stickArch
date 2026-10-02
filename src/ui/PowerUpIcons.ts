import type Phaser from 'phaser';
import type { PowerUpType } from '../game/data/GameData';

/**
 * Draws a power-up glyph centred on (0, 0) inside a ~±r box.
 * Used for the falling orbs and the HUD chips.
 */
export function drawPowerUpIcon(g: Phaser.GameObjects.Graphics, type: PowerUpType, r: number, color: number): void {
  g.lineStyle(Math.max(2, r * 0.17), color, 1);
  g.fillStyle(color, 1);

  switch (type) {
    case 'multishot': {
      // Three arrows fanning out from one point.
      g.beginPath();
      for (const a of [-0.62, 0, 0.62]) {
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        g.moveTo(-r * 0.75, 0);
        g.lineTo(x, y);
      }
      g.strokePath();
      for (const a of [-0.62, 0, 0.62]) {
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        const hx = Math.cos(a + Math.PI) ;
        const hy = Math.sin(a + Math.PI);
        const px = -hy;
        const py = hx;
        g.fillTriangle(
          x + Math.cos(a) * r * 0.2,
          y + Math.sin(a) * r * 0.2,
          x + hx * r * 0.35 + px * r * 0.22,
          y + hy * r * 0.35 + py * r * 0.22,
          x + hx * r * 0.35 - px * r * 0.22,
          y + hy * r * 0.35 - py * r * 0.22,
        );
      }
      break;
    }
    case 'swift': {
      // Lightning bolt.
      g.beginPath();
      g.moveTo(r * 0.15, -r);
      g.lineTo(-r * 0.6, r * 0.1);
      g.lineTo(-r * 0.05, r * 0.1);
      g.lineTo(-r * 0.25, r);
      g.lineTo(r * 0.65, -r * 0.2);
      g.lineTo(r * 0.08, -r * 0.2);
      g.closePath();
      g.fillPath();
      break;
    }
    case 'giant': {
      // One big arrow pointing right.
      g.beginPath();
      g.moveTo(-r, 0);
      g.lineTo(r * 0.45, 0);
      g.strokePath();
      g.fillTriangle(r, 0, r * 0.3, -r * 0.55, r * 0.3, r * 0.55);
      g.beginPath();
      g.moveTo(-r, 0);
      g.lineTo(-r * 0.6, -r * 0.45);
      g.moveTo(-r, 0);
      g.lineTo(-r * 0.6, r * 0.45);
      g.moveTo(-r * 0.7, 0);
      g.lineTo(-r * 0.35, -r * 0.4);
      g.moveTo(-r * 0.7, 0);
      g.lineTo(-r * 0.35, r * 0.4);
      g.strokePath();
      break;
    }
    case 'shield': {
      g.beginPath();
      g.moveTo(-r * 0.8, -r * 0.75);
      g.lineTo(0, -r);
      g.lineTo(r * 0.8, -r * 0.75);
      g.lineTo(r * 0.75, r * 0.1);
      g.lineTo(0, r);
      g.lineTo(-r * 0.75, r * 0.1);
      g.closePath();
      g.strokePath();
      g.fillStyle(color, 0.35);
      g.fillPath();
      break;
    }
  }
}
