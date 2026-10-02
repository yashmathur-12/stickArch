import type Phaser from 'phaser';
import type { WeaponKind } from '../data/GameData';

const WOOD = 0x6b4a2b;
const STEEL = 0xdfe6f2;
const IRON = 0x8e98ad;
const WHITE = 0xffffff;

/**
 * Draws an enemy weapon held at (hx, hy) pointing toward -x (the archer).
 * `shoulderX/Y` is used by shield-carrying types. When `flash` is set
 * everything is drawn white (hit flash).
 */
export function drawWeapon(
  g: Phaser.GameObjects.Graphics,
  kind: WeaponKind,
  hx: number,
  hy: number,
  shoulderX: number,
  shoulderY: number,
  flash: boolean,
): void {
  const wood = flash ? WHITE : WOOD;
  const steel = flash ? WHITE : STEEL;
  const iron = flash ? WHITE : IRON;

  switch (kind) {
    case 'club': {
      g.lineStyle(5, wood, 1);
      g.beginPath();
      g.moveTo(hx + 4, hy + 3);
      g.lineTo(hx - 14, hy - 22);
      g.strokePath();
      g.fillStyle(wood, 1);
      g.fillCircle(hx - 15, hy - 24, 7);
      break;
    }
    case 'dagger': {
      g.lineStyle(3, steel, 1);
      g.beginPath();
      g.moveTo(hx, hy);
      g.lineTo(hx - 20, hy - 7);
      g.strokePath();
      g.lineStyle(3, wood, 1);
      g.beginPath();
      g.moveTo(hx - 3, hy - 6);
      g.lineTo(hx - 1, hy + 4);
      g.strokePath();
      break;
    }
    case 'spear': {
      g.lineStyle(3.5, wood, 1);
      g.beginPath();
      g.moveTo(hx + 22, hy + 6);
      g.lineTo(hx - 90, hy - 10);
      g.strokePath();
      g.fillStyle(steel, 1);
      g.fillTriangle(hx - 112, hy - 13, hx - 88, hy - 19, hx - 88, hy - 5);
      break;
    }
    case 'sword': {
      // Blade.
      g.lineStyle(4.5, steel, 1);
      g.beginPath();
      g.moveTo(hx, hy);
      g.lineTo(hx - 34, hy - 30);
      g.strokePath();
      // Cross-guard.
      g.lineStyle(4, wood, 1);
      g.beginPath();
      g.moveTo(hx - 3, hy - 8);
      g.lineTo(hx + 9, hy - 2);
      g.strokePath();
      // Round shield on the off arm.
      g.fillStyle(flash ? WHITE : 0x56627f, 1);
      g.fillCircle(shoulderX - 22, shoulderY + 22, 19);
      g.lineStyle(3, flash ? WHITE : 0xaab6d6, 1);
      g.strokeCircle(shoulderX - 22, shoulderY + 22, 19);
      g.fillStyle(iron, 1);
      g.fillCircle(shoulderX - 22, shoulderY + 22, 5);
      break;
    }
    case 'axe': {
      g.lineStyle(5, wood, 1);
      g.beginPath();
      g.moveTo(hx + 12, hy + 8);
      g.lineTo(hx - 30, hy - 44);
      g.strokePath();
      g.fillStyle(iron, 1);
      g.fillTriangle(hx - 28, hy - 56, hx - 62, hy - 40, hx - 30, hy - 28);
      g.lineStyle(2, steel, 1);
      g.beginPath();
      g.moveTo(hx - 62, hy - 40);
      g.lineTo(hx - 30, hy - 56);
      g.strokePath();
      break;
    }
  }
}
