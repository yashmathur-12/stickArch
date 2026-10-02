import Phaser from 'phaser';
import { SceneKeys } from '../data/GameData';
import { BLOOD_TEXTURE, PARTICLE_TEXTURE } from '../systems/EffectsSystem';
import { generateSkyTextures } from '../../ui/Sky';

/** Generates every texture procedurally (no external assets), then opens the menu. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  create(): void {
    const dot = this.make.graphics({ x: 0, y: 0 }, false);
    dot.fillStyle(0xffffff, 1);
    dot.fillCircle(8, 8, 8);
    dot.generateTexture(PARTICLE_TEXTURE, 16, 16);
    dot.destroy();

    // Blobby splat used for ground stains (flattened and tinted at runtime).
    const splat = this.make.graphics({ x: 0, y: 0 }, false);
    splat.fillStyle(0xffffff, 1);
    splat.fillCircle(48, 32, 22);
    for (const [x, y, r] of [[26, 30, 12], [70, 34, 14], [44, 18, 10], [56, 46, 11], [36, 44, 9], [84, 30, 6], [12, 34, 6]]) {
      splat.fillCircle(x, y, r);
    }
    splat.generateTexture(BLOOD_TEXTURE, 96, 64);
    splat.destroy();

    generateSkyTextures(this);

    this.scene.start(SceneKeys.Menu);
  }
}
