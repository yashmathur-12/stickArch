import Phaser from 'phaser';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, rankFor } from '../game/data/GameData';
import type { RunResult } from '../game/systems/ScoreSystem';
import { formatTime, padScore } from '../utils/math';
import { createButton } from './Button';

const CX = GAME_WIDTH / 2;

const TITLES: Record<RunResult['cause'], string> = {
  overrun: 'Game Over',
  castle: 'The Castle Has Fallen',
  archer: 'The Archer Has Fallen',
};

/** Builds the game-over panel into a scene. */
export class GameOverUI {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly result: RunResult,
    private readonly onRestart: () => void,
    private readonly onMenu: () => void,
  ) {
    this.build();
  }

  private text(
    y: number,
    content: string,
    size: number,
    color: string,
    bold = true,
  ): Phaser.GameObjects.Text {
    return this.scene.add
      .text(CX, y, content, {
        fontFamily: FONT_FAMILY,
        fontSize: `${size}px`,
        fontStyle: bold ? 'bold' : 'normal',
        color,
      })
      .setOrigin(0.5)
      .setResolution(2);
  }

  private build(): void {
    const { scene, result } = this;
    const battle = result.mode === 'battle';

    const dim = scene.add.rectangle(CX, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070d, 0).setDepth(200);
    scene.tweens.add({ targets: dim, fillAlpha: 0.7, duration: 280 });

    const items: Array<Phaser.GameObjects.Text | Phaser.GameObjects.Container> = [];
    const title = this.text(130, TITLES[result.cause], battle ? 64 : 78, '#ff4d5a');
    const sub = this.text(
      battle ? 190 : 186,
      battle ? 'Battle · Defend the Castle' : 'Practice',
      22,
      COLORS.textDim,
      false,
    );
    const score = this.text(260, `Score  ${padScore(result.score)}`, 48, COLORS.text);
    const best = this.text(
      316,
      result.isNewHighScore ? 'NEW HIGH SCORE!' : `High Score  ${padScore(result.highScore)}`,
      result.isNewHighScore ? 34 : 28,
      result.isNewHighScore ? COLORS.textAccent : COLORS.textDim,
    );
    const stats = this.text(
      374,
      battle
        ? `Foes slain  ${result.kills}      Survived  ${formatTime(result.survivalTime)}      Days  ${result.days}`
        : `Enemies killed  ${result.kills}      Survived  ${formatTime(result.survivalTime)}`,
      26,
      COLORS.textDim,
      false,
    );
    const rank = battle
      ? this.text(418, `Rank: ${rankFor(result.score)}`, 28, COLORS.textAccent)
      : this.text(418, '', 1, COLORS.textAccent);
    const restart = createButton(scene, CX, 492, 'Restart', this.onRestart, {
      width: 300,
      height: 80,
      fontSize: 36,
      inputDelay: 0.35,
    });
    const menu = createButton(scene, CX, 584, 'Menu', this.onMenu, {
      width: 200,
      height: 56,
      fontSize: 24,
      variant: 'secondary',
      inputDelay: 0.35,
    });
    const hint = this.text(GAME_HEIGHT - 40, 'Space / Enter: restart     M: menu', 18, COLORS.textDim, false);
    items.push(title, sub, score, best, stats, rank, restart, menu, hint);

    items.forEach((item, i) => {
      item.setDepth(210).setAlpha(0);
      scene.tweens.add({ targets: item, alpha: 1, duration: 260, delay: 80 + i * 60 });
    });
    scene.tweens.add({ targets: title, scale: { from: 1.25, to: 1 }, duration: 320, ease: 'Back.easeOut' });

    if (result.isNewHighScore) {
      scene.tweens.add({
        targets: best,
        scale: { from: 1, to: 1.1 },
        yoyo: true,
        repeat: -1,
        duration: 520,
        ease: 'Sine.easeInOut',
      });
    }
  }
}
