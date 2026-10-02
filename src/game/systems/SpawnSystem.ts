import { ENEMY_TYPES, GAME_CONFIG, GAME_WIDTH, type EnemyDefinition, type EnemyTypeId } from '../data/GameData';
import { randRange } from '../../utils/math';
import type { DifficultySystem } from './DifficultySystem';

export interface SpawnRequest {
  def: EnemyDefinition;
  x: number;
  speed: number;
  health: number;
}

/**
 * What the spawner needs to know about the world. Implemented by the scene,
 * so this system never touches Enemy objects directly.
 */
export interface SpawnWorld {
  /** Number of enemies currently walking. */
  activeCount(): number;
  /**
   * X of the right-most living enemy in the emptiest lane
   * (-Infinity when there is room anywhere).
   */
  rightmostX(): number;
  spawn(request: SpawnRequest): void;
}

const S = GAME_CONFIG.spawn;

/** Decides when, where and what to spawn. Independent of the Enemy class. */
export class SpawnSystem {
  private timer: number = S.firstSpawnDelay;
  private readonly pool: EnemyDefinition[];

  constructor(
    private readonly difficulty: DifficultySystem,
    private readonly world: SpawnWorld,
    enemyTypes: EnemyTypeId[],
  ) {
    this.pool = enemyTypes.map((id) => ENEMY_TYPES[id]);
  }

  reset(): void {
    this.timer = S.firstSpawnDelay;
  }

  update(dt: number): void {
    this.timer -= dt;
    if (this.timer > 0) return;

    if (this.world.activeCount() >= this.difficulty.maxEnemies) {
      this.timer = S.blockedRetry;
      return;
    }

    const x = GAME_WIDTH + GAME_CONFIG.enemy.spawnMargin + Math.random() * S.jitterX;
    // Do not stack a new enemy on top of one that has barely entered the screen.
    if (this.world.rightmostX() > x - S.minGap) {
      this.timer = S.blockedRetry;
      return;
    }

    const def = this.pickType();
    const [lo, hi] = GAME_CONFIG.difficulty.enemySpeedJitter;
    this.world.spawn({
      def,
      x,
      speed: this.difficulty.enemySpeed * def.speedMultiplier * randRange(lo, hi),
      health: def.health + this.difficulty.enemyHealthBonus,
    });
    this.timer = this.difficulty.spawnInterval;
  }

  /** Weighted pick among the types unlocked at the current difficulty. */
  private pickType(): EnemyDefinition {
    const level = this.difficulty.level;
    let total = 0;
    for (const def of this.pool) {
      if (level >= def.minLevel) total += def.spawnWeight;
    }
    let roll = Math.random() * total;
    for (const def of this.pool) {
      if (level < def.minLevel) continue;
      roll -= def.spawnWeight;
      if (roll <= 0) return def;
    }
    return this.pool[0];
  }
}
