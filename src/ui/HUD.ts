import Phaser from 'phaser';
import {
  COLORS,
  FONT_FAMILY,
  GAME_WIDTH,
  POWERUP_ORDER,
  POWERUP_TYPES,
  type PowerUpType,
} from '../game/data/GameData';
import { padScore } from '../utils/math';
import { drawPowerUpIcon } from './PowerUpIcons';

const MARGIN = 28;
const CHIP_W = 126;
const CHIP_GAP = 8;

export interface HudData {
  score: number;
  highScore: number;
  wave: number;
  waveProgress: number;
  /** Battle-only extras (omit in practice mode). */
  battle?: {
    day: number;
    phaseLabel: string;
    fortHealth: number;
    fortMax: number;
    archerHealth: number;
    archerMax: number;
  };
  /** Active power-ups in display order. */
  powerUps: ReadonlyArray<{ type: PowerUpType; timeLeft: number; fraction: number }>;
}

interface Chip {
  type: PowerUpType;
  root: Phaser.GameObjects.Container;
  bar: Phaser.GameObjects.Graphics;
  time: Phaser.GameObjects.Text;
  shownSeconds: number;
  shownPercent: number;
}

/** Minimal heads-up display: score, castle, hearts, wave, power-ups and pause. */
export class HUD {
  private readonly scene: Phaser.Scene;
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly highText: Phaser.GameObjects.Text;
  private readonly waveText: Phaser.GameObjects.Text;
  private readonly dayText: Phaser.GameObjects.Text;
  private readonly waveBar: Phaser.GameObjects.Graphics;
  private readonly castleBar: Phaser.GameObjects.Graphics;
  private readonly hearts: Phaser.GameObjects.Graphics;
  private readonly chips: Chip[] = [];

  private shownScore = -1;
  private shownHigh = -1;
  private shownWave = -1;
  private shownProgress = -1;
  private shownDay = '';
  private shownFort = -1;
  private shownHearts = -1;

  constructor(scene: Phaser.Scene, battle: boolean, onPause: () => void) {
    this.scene = scene;
    const style = (size: number, color: string): Phaser.Types.GameObjects.Text.TextStyle => ({
      fontFamily: FONT_FAMILY,
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color,
      stroke: '#07080c',
      strokeThickness: 4,
    });
    const text = (x: number, y: number, size: number, color: string): Phaser.GameObjects.Text =>
      scene.add.text(x, y, '', style(size, color)).setDepth(100).setResolution(2);

    this.scoreText = text(MARGIN, 22, 34, COLORS.text);
    this.highText = text(MARGIN, 64, 20, COLORS.textDim);
    this.waveText = text(GAME_WIDTH - 96, 24, 26, COLORS.textAccent).setOrigin(1, 0);
    this.dayText = text(GAME_WIDTH - 96, 82, 18, COLORS.textDim).setOrigin(1, 0);
    this.waveBar = scene.add.graphics().setDepth(100);

    text(MARGIN, 96, 16, COLORS.textDim).setText('Castle').setVisible(battle);
    this.castleBar = scene.add.graphics().setDepth(100).setVisible(battle);
    this.hearts = scene.add.graphics({ x: MARGIN, y: 128 }).setDepth(100).setVisible(battle);

    this.createPauseButton(onPause);
    if (battle) this.createChips();
  }

  update(d: HudData): void {
    if (d.score !== this.shownScore) {
      this.shownScore = d.score;
      this.scoreText.setText(`Score: ${padScore(d.score)}`);
    }
    if (d.highScore !== this.shownHigh) {
      this.shownHigh = d.highScore;
      this.highText.setText(`High Score: ${padScore(d.highScore)}`);
    }
    if (d.wave !== this.shownWave) {
      this.shownWave = d.wave;
      this.waveText.setText(`Wave ${d.wave}`);
    }
    // Redraw the bar only when it visibly changes (~1% steps).
    const p = Math.round(d.waveProgress * 100);
    if (p !== this.shownProgress) {
      this.shownProgress = p;
      const w = 150;
      const x = GAME_WIDTH - 96 - w;
      const y = 62;
      this.waveBar.clear();
      this.waveBar.fillStyle(0xffffff, 0.15);
      this.waveBar.fillRoundedRect(x, y, w, 7, 3.5);
      this.waveBar.fillStyle(COLORS.accent, 0.95);
      this.waveBar.fillRoundedRect(x, y, Math.max(7, (w * p) / 100), 7, 3.5);
    }

    if (d.battle) {
      const label = `Day ${d.battle.day} · ${d.battle.phaseLabel}`;
      if (label !== this.shownDay) {
        this.shownDay = label;
        this.dayText.setText(label);
      }
      this.updateCastle(d.battle.fortHealth, d.battle.fortMax);
      this.updateHearts(d.battle.archerHealth, d.battle.archerMax);
      this.updateChips(d.powerUps);
    }
  }

  /** Quick scale pop when the score changes. */
  pulseScore(): void {
    this.scene.tweens.killTweensOf(this.scoreText);
    this.scoreText.setScale(1.18);
    this.scene.tweens.add({ targets: this.scoreText, scale: 1, duration: 160, ease: 'Quad.easeOut' });
  }

  // ---------------------------------------------------------------- pieces

  private createPauseButton(onPause: () => void): void {
    const size = 46;
    const g = this.scene.add.graphics();
    const paint = (hover: boolean): void => {
      g.clear();
      g.fillStyle(0x000000, hover ? 0.55 : 0.38);
      g.fillRoundedRect(-size / 2, -size / 2, size, size, 12);
      g.lineStyle(2, 0xffffff, hover ? 0.8 : 0.45);
      g.strokeRoundedRect(-size / 2, -size / 2, size, size, 12);
      g.fillStyle(0xffffff, 0.95);
      g.fillRoundedRect(-9, -11, 6, 22, 2);
      g.fillRoundedRect(3, -11, 6, 22, 2);
    };
    paint(false);
    const button = this.scene.add.container(GAME_WIDTH - 52, 46, [g]).setDepth(100);
    button.setSize(size + 10, size + 10);
    button.setInteractive({ useHandCursor: true });
    button.on('pointerover', () => paint(true));
    button.on('pointerout', () => paint(false));
    button.on('pointerup', onPause);
  }

  private createChips(): void {
    for (const type of POWERUP_ORDER) {
      const def = POWERUP_TYPES[type];
      const bg = this.scene.add.graphics();
      bg.fillStyle(0x000000, 0.5);
      bg.fillRoundedRect(-CHIP_W / 2, -26, CHIP_W, 52, 12);
      bg.lineStyle(2, def.color, 0.9);
      bg.strokeRoundedRect(-CHIP_W / 2, -26, CHIP_W, 52, 12);

      const icon = this.scene.add.graphics({ x: -CHIP_W / 2 + 22, y: -2 });
      drawPowerUpIcon(icon, type, 11, def.color);

      const name = this.scene.add
        .text(-CHIP_W / 2 + 42, -20, def.name, {
          fontFamily: FONT_FAMILY,
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#e8ecff',
        })
        .setResolution(2);
      const time = this.scene.add
        .text(CHIP_W / 2 - 10, 4, '', {
          fontFamily: FONT_FAMILY,
          fontSize: '17px',
          fontStyle: 'bold',
          color: '#ffffff',
        })
        .setOrigin(1, 0.5)
        .setResolution(2);
      const bar = this.scene.add.graphics();

      const root = this.scene.add.container(0, 0, [bg, icon, name, time, bar]).setDepth(100).setVisible(false);
      this.chips.push({ type, root, bar, time, shownSeconds: -1, shownPercent: -1 });
    }
  }

  private updateCastle(health: number, max: number): void {
    if (health === this.shownFort) return;
    this.shownFort = health;
    const w = 170;
    const x = MARGIN + 66;
    const y = 100;
    const r = health / max;
    const color = r > 0.55 ? 0x5be37d : r > 0.28 ? 0xffc857 : 0xff4d5a;
    const g = this.castleBar;
    g.clear();
    g.fillStyle(0x000000, 0.5);
    g.fillRoundedRect(x - 2, y - 2, w + 4, 14, 7);
    g.fillStyle(color, 1);
    if (health > 0) g.fillRoundedRect(x, y, Math.max(8, w * r), 10, 5);
  }

  private updateHearts(health: number, max: number): void {
    if (health === this.shownHearts) return;
    this.shownHearts = health;
    const g = this.hearts;
    g.clear();
    for (let i = 0; i < max; i++) {
      const x = i * 32 + 12;
      const full = i < health;
      if (full) g.fillStyle(0xff4d5a, 1);
      else g.fillStyle(0x000000, 0.45);
      g.fillCircle(x - 6, 6, 7);
      g.fillCircle(x + 6, 6, 7);
      g.fillTriangle(x - 13, 8, x + 13, 8, x, 24);
      g.lineStyle(2, 0xffffff, full ? 0.7 : 0.3);
      g.strokeCircle(x - 6, 6, 7);
      g.strokeCircle(x + 6, 6, 7);
    }
  }

  private updateChips(active: HudData['powerUps']): void {
    for (const chip of this.chips) chip.root.setVisible(false);
    const n = active.length;
    for (let i = 0; i < n; i++) {
      const a = active[i];
      const chip = this.chips.find((c) => c.type === a.type);
      if (!chip) continue;
      const x = GAME_WIDTH / 2 + (i - (n - 1) / 2) * (CHIP_W + CHIP_GAP);
      chip.root.setPosition(x, 42).setVisible(true);

      const secs = Math.ceil(a.timeLeft);
      if (secs !== chip.shownSeconds) {
        chip.shownSeconds = secs;
        chip.time.setText(`${secs}s`);
      }
      const pct = Math.round(a.fraction * 100);
      if (pct !== chip.shownPercent) {
        chip.shownPercent = pct;
        const color = POWERUP_TYPES[chip.type].color;
        const w = CHIP_W - 22;
        const lowTime = a.timeLeft < 5;
        chip.bar.clear();
        chip.bar.fillStyle(0xffffff, 0.15);
        chip.bar.fillRoundedRect(-w / 2, 14, w, 6, 3);
        chip.bar.fillStyle(lowTime ? 0xff4d5a : color, 1);
        chip.bar.fillRoundedRect(-w / 2, 14, Math.max(4, (w * pct) / 100), 6, 3);
      }
    }
  }
}
