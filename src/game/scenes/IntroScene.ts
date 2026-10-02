import Phaser from 'phaser';
import { ENEMY_TYPES, GAME_CONFIG, GAME_HEIGHT, GAME_WIDTH, SceneKeys, type EnemyTypeId, type GameMode } from '../data/GameData';
import { Archer } from '../entities/Archer';
import { Enemy } from '../entities/Enemy';
import { Fort } from '../entities/Fort';
import { ArrowLauncher } from '../systems/ArrowLauncher';
import { CollisionSystem, type HitInfo } from '../systems/CollisionSystem';
import { EffectsSystem, PARTICLE_TEXTURE } from '../systems/EffectsSystem';
import { Sky } from '../../ui/Sky';
import { solveLaunchAngle } from '../../utils/ballistics';
import { acquire } from '../../utils/pool';

const SERIF = 'Georgia, "Times New Roman", serif';
const CX = GAME_WIDTH / 2;
const BAR_H = 80;
const GROUND = GAME_CONFIG.groundY;
/** Ignore input right after the scene opens (the click that opened it). */
const INPUT_GRACE_MS = 600;

const HORDE: EnemyTypeId[] = ['brute', 'knight', 'spearman', 'grunt', 'raider', 'grunt', 'spearman', 'grunt', 'knight'];

/**
 * The opening cinematic for Battle mode: the kingdom, the Horde, the people,
 * and the lone Master Archer. Fully scripted with timers; any key or click skips.
 */
export class IntroScene extends Phaser.Scene {
  private mode: GameMode = 'battle';
  private finishing = false;
  private openedAt = 0;

  private fort!: Fort;
  private archer!: Archer;
  private effects!: EffectsSystem;
  private launcher!: ArrowLauncher;
  private collisions!: CollisionSystem;
  private enemies!: Phaser.GameObjects.Group;
  private glow!: Phaser.GameObjects.Graphics;
  private embers!: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly civilians: Phaser.GameObjects.Graphics[] = [];
  private glowLevel = 0;
  private time2 = 0;

  constructor() {
    super(SceneKeys.Intro);
  }

  init(data: { mode?: GameMode }): void {
    this.mode = data?.mode ?? 'battle';
  }

  create(): void {
    this.finishing = false;
    this.openedAt = this.time.now;
    this.glowLevel = 0;
    this.time2 = 0;
    this.civilians.length = 0;

    new Sky(this, { cycle: false });
    this.glow = this.add.graphics().setDepth(-4);
    this.fort = new Fort(this, 1);
    this.fort.setNightness(1);
    this.fort.update(0);

    this.effects = new EffectsSystem(this);
    this.enemies = this.add.group({ classType: Enemy, maxSize: 16, runChildUpdate: false });
    this.launcher = new ArrowLauncher(this, this.effects, null);
    this.collisions = new CollisionSystem(this.launcher.group, this.enemies, (hit) => this.onHit(hit));

    this.archer = new Archer(this);
    this.archer.setVisible(false);

    this.createCivilians();
    this.embers = this.add
      .particles(0, 0, PARTICLE_TEXTURE, {
        emitting: false,
        x: { min: 500, max: GAME_WIDTH + 40 },
        y: { min: 380, max: 650 },
        speedX: { min: -45, max: 10 },
        speedY: { min: -90, max: -25 },
        lifespan: { min: 2200, max: 4200 },
        scale: { start: 0.28, end: 0 },
        alpha: { start: 0.95, end: 0 },
        frequency: 70,
        tint: [0xff7a2e, 0xffb347, 0xff4d2e],
      })
      .setDepth(40);

    // Cinematic bars.
    const top = this.add.rectangle(CX, 0, GAME_WIDTH, BAR_H, 0x000000).setOrigin(0.5, 1).setDepth(110);
    const bottom = this.add.rectangle(CX, GAME_HEIGHT, GAME_WIDTH, BAR_H, 0x000000).setOrigin(0.5, 0).setDepth(110);
    this.tweens.add({ targets: top, y: BAR_H, duration: 900, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: bottom, y: GAME_HEIGHT - BAR_H, duration: 900, ease: 'Sine.easeOut' });

    this.add
      .text(GAME_WIDTH - 24, BAR_H - 22, 'Click or press any key to skip', {
        fontFamily: SERIF,
        fontSize: '15px',
        color: '#8d98bd',
      })
      .setOrigin(1, 0.5)
      .setDepth(125)
      .setResolution(2);

    this.cameras.main.fadeIn(900, 0, 0, 0);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.skip, this);
    this.input.keyboard?.on('keydown', this.skip, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off(Phaser.Input.Events.POINTER_DOWN, this.skip, this);
      this.input.keyboard?.off('keydown', this.skip, this);
    });

    this.script();
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 1 / 20);
    this.time2 += dt;

    this.fort.update(dt);
    this.effects.update(dt);
    this.archer.update(dt);
    this.launcher.step(dt);

    const enemies = this.enemies.getChildren() as Enemy[];
    for (let i = 0; i < enemies.length; i++) if (enemies[i].active) enemies[i].step(dt);
    this.collisions.update();

    this.paintGlow();
    for (let i = 0; i < this.civilians.length; i++) {
      this.civilians[i].setRotation(Math.sin(this.time2 * 15 + i * 1.7) * 0.035);
    }
  }

  // --------------------------------------------------------------- script

  private script(): void {
    const at = (ms: number, fn: () => void): void => {
      this.time.delayedCall(ms, fn);
    };

    // 1. Peace.
    at(500, () => this.say('For a thousand years, the kingdom of Aldermere knew only peace.', 3800));

    // 2. The Horde.
    at(4700, () => {
      this.say('Then the Dark Horde came... and the borders burned.', 3800);
      this.tweens.add({ targets: this, glowLevel: 1, duration: 3200, ease: 'Sine.easeIn' });
      this.embers.start();
      this.spawnHorde();
      this.cameras.main.shake(500, 0.004);
    });

    // 3. The people.
    at(9300, () => {
      this.say('Behind these walls: the King. The Queen. The people.', 4000);
      for (const c of this.civilians) {
        c.setAlpha(0);
        this.tweens.add({ targets: c, alpha: 1, duration: 900, delay: Math.random() * 900 });
      }
    });

    // 4. The lone archer.
    at(13900, () => {
      this.say('Every soldier fell. Only one archer remained.', 3600);
      this.archer.setVisible(true);
      this.cameras.main.flash(500, 255, 235, 200, false);
    });

    // 5. Blood is thicker than tears.
    at(17800, () => {
      this.say('Blood is better than tears.', 3300, { size: 58, color: '#ff4d5a', y: 270, bold: true });
      this.aimAtNearest(0.8);
    });

    // 6. The soil drinks.
    at(21300, () => {
      this.say('Let the soil drink the blood of the enemy.', 3400, { size: 44, color: '#ff7a6a', y: 270, bold: true });
      this.volley(3, 650);
    });

    // 7. The title.
    at(24700, () => this.titleSlam());
    at(25100, () => this.volley(2, 600));

    at(30200, () => this.finish(false));
  }

  private say(
    text: string,
    hold: number,
    o: { size?: number; color?: string; y?: number; bold?: boolean } = {},
  ): void {
    const t = this.add
      .text(CX, o.y ?? GAME_HEIGHT - BAR_H / 2, text, {
        fontFamily: SERIF,
        fontSize: `${o.size ?? 30}px`,
        fontStyle: o.bold ? 'bold italic' : 'italic',
        color: o.color ?? '#f1ead8',
        align: 'center',
        stroke: '#000000',
        strokeThickness: o.size && o.size > 40 ? 7 : 4,
        wordWrap: { width: 1080 },
      })
      .setOrigin(0.5)
      .setDepth(120)
      .setAlpha(0)
      .setResolution(2);
    this.tweens.add({ targets: t, alpha: 1, duration: 550, ease: 'Sine.easeOut' });
    this.time.delayedCall(hold, () => {
      this.tweens.add({ targets: t, alpha: 0, duration: 500, onComplete: () => t.destroy() });
    });
  }

  private titleSlam(): void {
    const title = this.add
      .text(CX, 292, 'THE MASTER ARCHER', {
        fontFamily: SERIF,
        fontSize: '86px',
        fontStyle: 'bold',
        color: '#ffd34d',
        stroke: '#2a0a0a',
        strokeThickness: 12,
      })
      .setOrigin(0.5)
      .setDepth(130)
      .setResolution(2)
      .setAlpha(0)
      .setScale(2.8);
    this.tweens.add({ targets: title, alpha: 1, scale: 1, duration: 420, ease: 'Expo.easeOut' });
    this.cameras.main.shake(380, 0.02);
    this.cameras.main.flash(260, 255, 60, 60, false);

    const sub = this.add
      .text(CX, 384, 'Let the nation know its hero.', {
        fontFamily: SERIF,
        fontSize: '34px',
        fontStyle: 'italic',
        color: '#f1ead8',
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(130)
      .setResolution(2)
      .setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 1, duration: 900, delay: 900 });
  }

  // ------------------------------------------------------------- spectacle

  private spawnHorde(): void {
    HORDE.forEach((id, i) => {
      const enemy = acquire<Enemy>(this.enemies);
      if (!enemy) return;
      // One hit kills everything in the cinematic.
      enemy.spawn(ENEMY_TYPES[id], 1330 + i * 85, 30 + Math.random() * 10, 1, i % GAME_CONFIG.enemy.laneCount);
    });
  }

  /** Loose `count` arrows, one every `gap` ms, each at the nearest standing enemy. */
  private volley(count: number, gap: number): void {
    for (let i = 0; i < count; i++) {
      this.time.delayedCall(i * gap, () => this.aimAtNearest(0.55, true));
    }
  }

  /** Draw the bow toward the nearest enemy; optionally release a moment later. */
  private aimAtNearest(power: number, fire = false): void {
    const target = this.nearestEnemy();
    if (!target) return;
    const speed = GAME_CONFIG.arrow.maxSpeed;
    const origin = { x: 0, y: 0 };
    // Estimate with full power first, then use the real launch point.
    this.archer.getLaunchPoint(-0.3, 1, origin);
    const angle = solveLaunchAngle(origin.x, origin.y, target.x, target.y - 55, speed, GAME_CONFIG.arrow.gravity);
    if (angle === null) return;
    this.archer.setAim(angle, power);
    if (!fire) return;

    this.time.delayedCall(320, () => {
      const t = this.nearestEnemy();
      if (!t) {
        this.archer.cancelAim();
        return;
      }
      this.archer.getLaunchPoint(angle, 1, origin);
      // Re-solve against the target's current position (it keeps walking).
      const a = solveLaunchAngle(origin.x, origin.y, t.x - t.speed * 0.45, t.y - 55, speed, GAME_CONFIG.arrow.gravity) ?? angle;
      this.archer.setAim(a, 1);
      this.archer.getLaunchPoint(a, 1, origin);
      this.archer.release();
      this.launcher.fire({ x: origin.x, y: origin.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed });
    });
  }

  private nearestEnemy(): Enemy | null {
    let best: Enemy | null = null;
    const enemies = this.enemies.getChildren() as Enemy[];
    for (const e of enemies) {
      if (!e.active || !e.isAlive || e.x > GAME_WIDTH - 20) continue;
      if (!best || e.x < best.x) best = e;
    }
    return best;
  }

  private onHit(hit: HitInfo): void {
    const { arrow, enemy } = hit;
    enemy.takeDamage(arrow.damage);
    arrow.kill();
    this.effects.enemyKilled(hit.x, hit.y, 0, enemy.y);
  }

  private createCivilians(): void {
    const spots = [150, 172, 196, 218, 240, 262, 284];
    spots.forEach((x, i) => {
      const g = this.add.graphics({ x, y: GROUND + (i % 3) * 9 }).setDepth(12 + (i % 3)).setScale(0.74);
      const col = i % 2 === 0 ? 0xcfd6ee : 0xe6cfa8;
      g.lineStyle(5, col, 1);
      g.beginPath();
      g.moveTo(0, -42);
      g.lineTo(-9, 0);
      g.moveTo(0, -42);
      g.lineTo(9, 0);
      g.moveTo(0, -42);
      g.lineTo(0, -80);
      // Arms raised in fear.
      g.moveTo(0, -76);
      g.lineTo(-16, -96);
      g.moveTo(0, -76);
      g.lineTo(16, -96);
      g.strokePath();
      if (i % 2 === 1) g.fillTriangle(0, -66, -18, -22, 18, -22);
      g.fillStyle(col, 1);
      g.fillCircle(0, -94, 11);
      g.setAlpha(0);
      this.civilians.push(g);
    });
  }

  private paintGlow(): void {
    const g = this.glow;
    g.clear();
    if (this.glowLevel <= 0.01) return;
    const flicker = 0.85 + Math.sin(this.time2 * 9) * 0.07 + Math.sin(this.time2 * 23) * 0.05;
    const top = 250;
    const bands = 56;
    const h = (GROUND - top) / bands;
    for (let i = 0; i < bands; i++) {
      const k = (i + 1) / bands;
      g.fillStyle(0xff3b1f, 0.5 * this.glowLevel * flicker * Math.pow(k, 1.8));
      g.fillRect(0, top + i * h, GAME_WIDTH, h + 1);
    }
  }

  // ---------------------------------------------------------------- finish

  private skip = (): void => {
    if (this.time.now - this.openedAt < INPUT_GRACE_MS) return;
    this.finish(true);
  };

  private finish(fast: boolean): void {
    if (this.finishing) return;
    this.finishing = true;
    const cam = this.cameras.main;
    cam.fadeOut(fast ? 250 : 800, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SceneKeys.Game, { mode: this.mode });
    });
  }
}
