import Phaser from 'phaser';
import { SceneKeys } from '../data/GameData';
import type { RunResult } from '../systems/ScoreSystem';
import { GameOverUI } from '../../ui/GameOverUI';

/** Overlay shown on top of the (paused) game scene. */
export class GameOverScene extends Phaser.Scene {
  private result!: RunResult;

  constructor() {
    super(SceneKeys.GameOver);
  }

  init(data: RunResult): void {
    this.result = data;
  }

  create(): void {
    new GameOverUI(
      this,
      this.result,
      () => this.restart(),
      () => this.menu(),
    );

    // Short delay so the click that killed us (or a held key) cannot trigger instantly.
    this.time.delayedCall(350, () => {
      this.input.keyboard?.once('keydown-SPACE', () => this.restart());
      this.input.keyboard?.once('keydown-ENTER', () => this.restart());
      this.input.keyboard?.once('keydown-M', () => this.menu());
    });
  }

  private restart(): void {
    // Tear down the paused game scene and start a fresh one in a single step.
    this.scene.stop(SceneKeys.Game);
    this.scene.start(SceneKeys.Game, { mode: this.result.mode });
  }

  private menu(): void {
    this.scene.stop(SceneKeys.Game);
    this.scene.start(SceneKeys.Menu);
  }
}
