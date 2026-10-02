import type Phaser from 'phaser';
import { GAME_CONFIG } from '../data/GameData';
import type { Archer } from '../entities/Archer';
import type { Enemy } from '../entities/Enemy';
import type { Fort } from '../entities/Fort';

const A = GAME_CONFIG.archer;

export interface ContactHooks {
  /** An enemy reached the castle wall. */
  onFortBreach(enemy: Enemy): void;
  /** An enemy touched the unprotected archer. */
  onArcherTouched(enemy: Enemy): void;
  /** An enemy ran into the archer's shield. */
  onShieldKill(enemy: Enemy): void;
}

/** Enemy-vs-castle and enemy-vs-archer contact rules. */
export class ContactSystem {
  constructor(
    private readonly enemies: Phaser.GameObjects.Group,
    private readonly archer: Archer,
    private readonly fort: Fort | null,
    private readonly hooks: ContactHooks,
  ) {}

  update(): void {
    const enemies = this.enemies.getChildren() as Enemy[];
    const archer = this.archer;
    const aLeft = archer.x - A.halfWidth;
    const aRight = archer.x + A.halfWidth;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.active || !e.isAlive) continue;

      if (this.fort && e.reachLeft <= this.fort.right) {
        this.hooks.onFortBreach(e);
        continue;
      }

      if (archer.isDead) continue;
      if (e.reachLeft <= aRight && e.hitRight >= aLeft) {
        if (archer.hasShield) this.hooks.onShieldKill(e);
        else if (!archer.isInvulnerable) this.hooks.onArcherTouched(e);
      }
    }
  }
}
