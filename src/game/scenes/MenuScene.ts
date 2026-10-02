import Phaser from 'phaser';
import {
  COLORS,
  FONT_FAMILY,
  GAME_HEIGHT,
  GAME_WIDTH,
  MODES,
  SceneKeys,
  type GameMode,
} from '../data/GameData';
import { Archer } from '../entities/Archer';
import { Sky } from '../../ui/Sky';
import { loadNumber } from '../../utils/storage';
import { padScore } from '../../utils/math';

const CARD_W = 520;
const CARD_H = 270;
const CARD_Y = 322;

/** Battle opens with the story cinematic; practice jumps straight in. */
function launch(scene: Phaser.Scene, mode: GameMode): void {
  scene.scene.start(mode === 'battle' ? SceneKeys.Intro : SceneKeys.Game, { mode });
}

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    // The menu backdrop drifts through day and night on a fast ambient cycle.
    const sky = new Sky(this, { cycle: true, speed: 4 });

    const label = (
      y: number,
      text: string,
      size: number,
      color: string,
      bold = true,
    ): Phaser.GameObjects.Text =>
      this.add
        .text(cx, y, text, {
          fontFamily: FONT_FAMILY,
          fontSize: `${size}px`,
          fontStyle: bold ? 'bold' : 'normal',
          color,
          stroke: '#07080c',
          strokeThickness: size > 40 ? 8 : 4,
        })
        .setOrigin(0.5)
        .setDepth(20)
        .setResolution(2);

    const title = label(78, 'STICK ARCHER', 88, COLORS.text);
    this.tweens.add({ targets: title, y: title.y + 6, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    label(144, 'Rise, Master Archer. Choose your mission.', 26, COLORS.textDim, false);

    this.createCard(cx - 300, 'battle', '1');
    this.createCard(cx + 300, 'practice', '2');

    label(GAME_HEIGHT - 82, 'Move: A / D     Aim: W / S     Hold Space to draw, release to fire     P: pause', 19, COLORS.text, false);
    label(GAME_HEIGHT - 54, 'Mouse / touch: press, drag back, release', 19, COLORS.textDim, false);

    const start = (mode: GameMode): void => launch(this, mode);
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === '1' || e.key === 'Enter' || e.key.toLowerCase() === 'b') start('battle');
      else if (e.key === '2' || e.key.toLowerCase() === 'p') start('practice');
    };
    this.input.keyboard?.on('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown', onKey));

    // Decorative archer that keeps drawing and loosing its bow.
    const archer = new Archer(this);
    let drawing = false;
    this.time.addEvent({
      delay: 1100,
      loop: true,
      callback: () => {
        drawing = !drawing;
        if (drawing) archer.setAim(-0.42, 0.85);
        else archer.release();
      },
    });
    const tick = (_t: number, delta: number): void => {
      archer.update(delta / 1000);
      sky.update(delta / 1000);
    };
    this.events.on(Phaser.Scenes.Events.UPDATE, tick);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.UPDATE, tick));
  }

  private createCard(x: number, mode: GameMode, keyHint: string): void {
    const def = MODES[mode];
    const bg = this.add.graphics();
    const paint = (hover: boolean): void => {
      bg.clear();
      bg.fillStyle(0x000000, 0.35);
      bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2 + 6, CARD_W, CARD_H, 22);
      bg.fillStyle(hover ? 0x1d2640 : 0x121829, 0.92);
      bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 22);
      bg.lineStyle(hover ? 4 : 2, hover ? COLORS.accent : 0x8d98bd, hover ? 1 : 0.55);
      bg.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 22);
    };
    paint(false);

    const text = (
      tx: number,
      ty: number,
      content: string,
      size: number,
      color: string,
      bold = true,
      width?: number,
    ): Phaser.GameObjects.Text =>
      this.add
        .text(tx, ty, content, {
          fontFamily: FONT_FAMILY,
          fontSize: `${size}px`,
          fontStyle: bold ? 'bold' : 'normal',
          color,
          wordWrap: width ? { width } : undefined,
          align: 'center',
          lineSpacing: 4,
        })
        .setOrigin(0.5, 0)
        .setResolution(2);

    const best = loadNumber(def.storageKey, 0);
    const items = [
      bg,
      text(0, -CARD_H / 2 + 22, def.name, 44, COLORS.text),
      text(0, -CARD_H / 2 + 78, def.tagline, 22, COLORS.textAccent),
      text(0, -CARD_H / 2 + 118, def.story.join('\n'), 19, '#c9d1ee', false, CARD_W - 60),
      text(0, CARD_H / 2 - 40, `Best: ${padScore(best)}`, 24, COLORS.textAccent),
      text(CARD_W / 2 - 26, -CARD_H / 2 + 14, keyHint, 16, COLORS.textDim, false).setOrigin(0.5, 0),
    ];
    const card = this.add.container(x, CARD_Y, items).setDepth(20);
    card.setSize(CARD_W, CARD_H);
    card.setInteractive({ useHandCursor: true });
    card.on('pointerover', () => {
      paint(true);
      card.setScale(1.02);
    });
    card.on('pointerout', () => {
      paint(false);
      card.setScale(1);
    });
    let pressed = false;
    card.on('pointerdown', () => (pressed = true));
    card.on('pointerup', () => {
      if (pressed) launch(this, mode);
    });
  }
}
