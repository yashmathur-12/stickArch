import { GAME_CONFIG } from '../data/GameData';
import { clamp } from '../../utils/math';

const D = GAME_CONFIG.difficulty;

/**
 * Turns elapsed time + kills into a smoothly rising difficulty "level" and
 * derives every scaled gameplay parameter from it. Other systems only read
 * the getters, so retuning the curve never touches them.
 */
export class DifficultySystem {
  private elapsed = 0;
  private kills = 0;

  reset(): void {
    this.elapsed = 0;
    this.kills = 0;
  }

  update(dt: number, kills: number): void {
    this.elapsed += dt;
    this.kills = kills;
  }

  /** Continuous difficulty, 0 at the start of a run. */
  get level(): number {
    return this.elapsed / D.secondsPerLevel + this.kills / D.killsPerLevel;
  }

  /** 1-based wave number shown in the HUD. */
  get wave(): number {
    return Math.floor(this.level) + 1;
  }

  /** 0..1 progress toward the next wave (for the HUD indicator). */
  get waveProgress(): number {
    return this.level - Math.floor(this.level);
  }

  /** Seconds between enemy spawns. */
  get spawnInterval(): number {
    return Math.max(D.spawnIntervalMin, D.spawnIntervalStart * Math.pow(D.spawnIntervalDecay, this.level));
  }

  /** Base enemy walk speed in px/s. */
  get enemySpeed(): number {
    return clamp(D.enemySpeedStart + D.enemySpeedPerLevel * this.level, 0, D.enemySpeedMax);
  }

  get maxEnemies(): number {
    return Math.floor(
      clamp(D.maxEnemiesStart + D.maxEnemiesPerLevel * this.level, D.maxEnemiesStart, D.maxEnemiesMax),
    );
  }

  /** Extra health added on top of an enemy type's base health. */
  get enemyHealthBonus(): number {
    return D.levelsPerExtraHealth > 0 ? Math.floor(this.level / D.levelsPerExtraHealth) : 0;
  }
}
