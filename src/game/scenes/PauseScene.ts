import Phaser from 'phaser';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, MODES, SceneKeys, type GameMode } from '../data/GameData';
import { createButton } from '../../ui/Button';

const CX = GAME_WIDTH / 2;

/** Overlay shown on top of the paused game scene. */
export class PauseScene extends Phaser.Scene {
  private mode: GameMode = 'battle';

  constructor() {
    super(SceneKeys.Pause);
  }

  init(data: { mode: GameMode }): void {
    this.mode = data.mode;
  }

  create(): void {
    this.add.rectangle(CX, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070d, 0.72).setDepth(0);

    const label = (y: number, text: string, size: number, color: string, bold = true): Phaser.GameObjects.Text =>
      this.add
        .text(CX, y, text, {
          fontFamily: FONT_FAMILY,
          fontSize: `${size}px`,
          fontStyle: bold ? 'bold' : 'normal',
          color,
        })
        .setOrigin(0.5)
        .setResolution(2);

    label(120, 'Paused', 78, COLORS.text);
    label(184, `${MODES[this.mode].name} · ${MODES[this.mode].tagline}`, 22, COLORS.textDim, false);

    createButton(this, CX, 290, 'Resume', () => this.resume(), { width: 300, height: 76, fontSize: 36 });
    createButton(this, CX, 382, 'Restart', () => this.restart(), {
      width: 300,
      height: 60,
      fontSize: 26,
      variant: 'secondary',
    });
    createButton(this, CX, 458, 'Menu', () => this.menu(), {
      width: 300,
      height: 60,
      fontSize: 26,
      variant: 'secondary',
    });

    label(
      560,
      'Move: A / D or ← →      Aim: W / S or ↑ ↓      Hold Space to draw, release to fire',
      20,
      COLORS.textDim,
      false,
    );
    label(592, 'Mouse / touch: press, drag back, release      P or Esc: pause / resume', 20, COLORS.textDim, false);

    this.input.keyboard?.on('keydown-ENTER', () => this.resume());
  }

  private resume(): void {
    this.scene.stop();
    this.scene.resume(SceneKeys.Game);
  }

  private restart(): void {
    this.scene.stop(SceneKeys.Game);
    this.scene.start(SceneKeys.Game, { mode: this.mode });
  }

  private menu(): void {
    this.scene.stop(SceneKeys.Game);
    this.scene.start(SceneKeys.Menu);
  }
}
