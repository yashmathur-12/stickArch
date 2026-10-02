import Phaser from 'phaser';
import { GAME_CONFIG, GAME_WIDTH } from '../data/GameData';
import { Arrow, NORMAL_SPEC, type ArrowSpec } from '../entities/Arrow';
import type { EffectsSystem } from './EffectsSystem';
import type { PowerUpSystem } from './PowerUpSystem';
import type { Shot } from './AimSystem';
import { acquire, prewarm } from '../../utils/pool';

const P = GAME_CONFIG.powerUps;

/** Scratch spec objects, mutated per shot (no per-shot allocation). */
const SPEC: ArrowSpec = { ...NORMAL_SPEC };
const CHILD_SPEC: ArrowSpec = { ...NORMAL_SPEC, style: 'multi' };

/**
 * Owns the arrow pool: fires shots (applying power-up modifiers), steps all
 * live arrows, spawns the extra arrows of a split shot, and culls strays.
 */
export class ArrowLauncher {
  readonly group: Phaser.GameObjects.Group;

  constructor(
    scene: Phaser.Scene,
    private readonly effects: EffectsSystem,
    private readonly powerUps: PowerUpSystem | null,
  ) {
    this.group = scene.add.group({ classType: Arrow, maxSize: GAME_CONFIG.arrow.poolSize, runChildUpdate: false });
    prewarm<Arrow>(this.group, GAME_CONFIG.arrow.poolSize);
    this.group.getChildren().forEach((a) => (a as Arrow).setDepth(20));
  }

  /** Speed multiplier from active power-ups (read by the aim preview too). */
  get speedMultiplier(): number {
    return this.powerUps?.isActive('swift') ? P.swift.speedMultiplier : 1;
  }

  /** Fire one shot; returns false if the pool is exhausted. */
  fire(shot: Shot): boolean {
    const arrow = acquire<Arrow>(this.group);
    if (!arrow) return false;

    Object.assign(SPEC, NORMAL_SPEC);
    const pu = this.powerUps;
    if (pu) {
      if (pu.isActive('swift')) SPEC.style = 'swift';
      if (pu.isActive('multishot')) {
        SPEC.style = 'multi';
        SPEC.splitAfter = P.multishot.splitAfter;
      }
      if (pu.isActive('giant')) {
        SPEC.style = 'giant';
        SPEC.size = P.giant.size;
        SPEC.pierce = P.giant.pierce;
        SPEC.damage = P.giant.damage;
      }
    }
    arrow.fire(shot.x, shot.y, shot.vx, shot.vy, SPEC);
    return true;
  }

  /** Advance every arrow, handle splits, ground impacts and off-screen arrows. */
  step(dt: number): void {
    const arrows = this.group.getChildren() as Arrow[];
    for (let i = 0; i < arrows.length; i++) {
      const arrow = arrows[i];
      if (!arrow.active) continue;
      arrow.step(dt);
      if (!arrow.active) continue;
      if (arrow.landedThisStep) this.effects.groundImpact(arrow.x, arrow.y);
      if (arrow.splitReady) {
        arrow.splitReady = false;
        this.split(arrow);
      }
      if (arrow.isFlying && (arrow.x > GAME_WIDTH + 120 || arrow.x < -120 || arrow.y < -1800)) arrow.kill();
    }
  }

  /** Fan extra arrows out of `parent` around its current heading. */
  private split(parent: Arrow): void {
    const { arrows, spreadDeg } = P.multishot;
    const speed = Math.hypot(parent.vx, parent.vy);
    const heading = Math.atan2(parent.vy, parent.vx);
    const half = (arrows - 1) / 2;
    CHILD_SPEC.damage = parent.damage;

    for (let k = 0; k < arrows; k++) {
      const offset = k - half;
      if (offset === 0) continue; // the parent keeps flying as the centre arrow
      const child = acquire<Arrow>(this.group);
      if (!child) break;
      const a = heading + offset * spreadDeg * (Math.PI / 180);
      child.fire(parent.x, parent.y, Math.cos(a) * speed, Math.sin(a) * speed, CHILD_SPEC);
    }
    this.effects.splitBurst(parent.x, parent.y);
  }
}
