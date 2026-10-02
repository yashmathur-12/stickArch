import type { GameMode } from '../data/GameData';
import { loadNumber, saveNumber } from '../../utils/storage';

export type DefeatCause = 'overrun' | 'castle' | 'archer';

export interface RunResult {
  mode: GameMode;
  cause: DefeatCause;
  score: number;
  highScore: number;
  kills: number;
  survivalTime: number;
  /** Days survived (battle mode; 1 = still on the first day). */
  days: number;
  isNewHighScore: boolean;
}

/** Tracks score, kills, survival time and the persisted per-mode high score. */
export class ScoreSystem {
  score = 0;
  kills = 0;
  survivalTime = 0;
  highScore: number;

  private readonly previousHighScore: number;

  constructor(private readonly storageKey: string) {
    this.highScore = loadNumber(storageKey, 0);
    this.previousHighScore = this.highScore;
  }

  addKill(points: number): void {
    this.kills += 1;
    this.score += points;
    // Live high score so the HUD shows it moving as you beat it.
    if (this.score > this.highScore) this.highScore = this.score;
  }

  update(dt: number): void {
    this.survivalTime += dt;
  }

  /** Persist the high score (if beaten) and return the final summary. */
  finish(): Omit<RunResult, 'mode' | 'cause' | 'days'> {
    const isNewHighScore = this.score > this.previousHighScore;
    if (isNewHighScore) saveNumber(this.storageKey, this.score);
    return {
      score: this.score,
      highScore: Math.max(this.score, this.previousHighScore),
      kills: this.kills,
      survivalTime: this.survivalTime,
      isNewHighScore,
    };
  }
}
