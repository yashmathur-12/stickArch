import Phaser from 'phaser';
import { COLORS, FONT_FAMILY } from '../game/data/GameData';

export interface ButtonOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  /** Seconds to ignore input after creation (prevents carry-over clicks). */
  inputDelay?: number;
  /** 'secondary' is a quiet dark button for less important actions. */
  variant?: 'primary' | 'secondary';
  /** Gently pulse the label (default true for primary). */
  pulse?: boolean;
}

/** Rounded text button that fires on pointer release over it. */
export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  options: ButtonOptions = {},
): Phaser.GameObjects.Container {
  const w = options.width ?? 260;
  const h = options.height ?? 72;
  const secondary = options.variant === 'secondary';
  const baseFill = secondary ? 0x1c2338 : COLORS.accent;
  const hoverFill = secondary ? 0x2b3552 : 0xffd98a;
  const edge = secondary ? 0x8d98bd : 0xffffff;

  const bg = scene.add.graphics();
  const text = scene.add
    .text(0, -1, label, {
      fontFamily: FONT_FAMILY,
      fontSize: `${options.fontSize ?? 32}px`,
      fontStyle: 'bold',
      color: secondary ? '#e8ecff' : '#07080c',
    })
    .setOrigin(0.5)
    .setResolution(2);

  const paint = (fill: number): void => {
    bg.clear();
    bg.fillStyle(0x000000, 0.35);
    bg.fillRoundedRect(-w / 2, -h / 2 + 5, w, h, 16);
    bg.fillStyle(fill, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
    bg.lineStyle(3, edge, 0.9);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
  };
  paint(baseFill);

  const button = scene.add.container(x, y, [bg, text]);
  button.setSize(w, h);
  button.setInteractive({ useHandCursor: true });

  const armedAt = scene.time.now + (options.inputDelay ?? 0) * 1000;
  let pressed = false;

  button.on('pointerover', () => paint(hoverFill));
  button.on('pointerout', () => {
    pressed = false;
    button.setScale(1);
    paint(baseFill);
  });
  button.on('pointerdown', () => {
    if (scene.time.now < armedAt) return;
    pressed = true;
    button.setScale(0.96);
  });
  button.on('pointerup', () => {
    button.setScale(1);
    if (pressed && scene.time.now >= armedAt) onClick();
    pressed = false;
  });

  // Gentle idle pulse draws the eye to the primary action.
  if (options.pulse ?? !secondary) {
    scene.tweens.add({
      targets: text,
      scale: { from: 1, to: 1.06 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  return button;
}
