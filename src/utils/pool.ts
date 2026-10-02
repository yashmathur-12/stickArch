import Phaser from 'phaser';

/** Anything that can live in a Phaser group pool. */
export interface Poolable extends Phaser.GameObjects.GameObject {
  /** Return the object to the idle state (inactive + invisible). */
  deactivate(): void;
}

/** Typed `group.get()` that returns null when the pool is exhausted. */
export function acquire<T extends Poolable>(group: Phaser.GameObjects.Group): T | null {
  const obj = group.get() as T | null;
  return obj ?? null;
}

/** Create `count` pooled objects up front so no allocation happens mid-game. */
export function prewarm<T extends Poolable>(group: Phaser.GameObjects.Group, count: number): void {
  const made: T[] = [];
  for (let i = 0; i < count; i++) {
    const obj = acquire<T>(group);
    if (obj) made.push(obj);
  }
  for (const obj of made) obj.deactivate();
}
