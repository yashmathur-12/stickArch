import Phaser from 'phaser';
import {
  COLORS,
  FONT_FAMILY,
  GAME_CONFIG,
  GAME_WIDTH,
  MODES,
  POWERUP_ORDER,
  POWERUP_TYPES,
  SceneKeys,
  type GameMode,
  type ModeDefinition,
  type PowerUpType,
} from '../data/GameData';
import { Archer } from '../entities/Archer';
import { Enemy } from '../entities/Enemy';
import { Fort } from '../entities/Fort';
import { AimSystem, type Shot } from '../systems/AimSystem';
import { ArrowLauncher } from '../systems/ArrowLauncher';
import { CollisionSystem, type HitInfo } from '../systems/CollisionSystem';
import { ContactSystem } from '../systems/ContactSystem';
import { DifficultySystem } from '../systems/DifficultySystem';
import { EffectsSystem } from '../systems/EffectsSystem';
import { InputController } from '../systems/InputController';
import { PowerUpSystem } from '../systems/PowerUpSystem';
import { ScoreSystem, type DefeatCause, type RunResult } from '../systems/ScoreSystem';
import { SpawnSystem, type SpawnRequest } from '../systems/SpawnSystem';
import { AimGuide } from '../../ui/AimGuide';
import { HUD, type HudData } from '../../ui/HUD';
import { Sky, type SkyPhase } from '../../ui/Sky';
import { acquire, prewarm } from '../../utils/pool';

type RunState = 'playing' | 'dying' | 'over';

const MAX_DT = 1 / 20; // clamp long frames (tab switches, hitches)
const DEATH_DELAY = 1.0; // seconds between death and the Game Over screen
const INTRO_TIME = 8000; // ms the briefing text stays up

const PHASE_LABEL: Record<SkyPhase, string> = { day: 'Day', dusk: 'Dusk', night: 'Night', dawn: 'Dawn' };

/**
 * Thin orchestrator: owns the entities and systems, wires them together and
 * runs them in a fixed order each frame. Game rules live in the systems.
 */
export class GameScene extends Phaser.Scene {
  private mode: GameMode = 'battle';
  private def: ModeDefinition = MODES.battle;
  private state: RunState = 'playing';
  private deathTimer = 0;
  private lastWave = 1;
  private result: RunResult | null = null;

  private enemies!: Phaser.GameObjects.Group;
  private sky!: Sky;
  private fort: Fort | null = null;
  private archer!: Archer;
  private controls!: InputController;
  private guide!: AimGuide;
  private aim!: AimSystem;
  private launcher!: ArrowLauncher;
  private powerUps: PowerUpSystem | null = null;
  private collisions!: CollisionSystem;
  private contacts!: ContactSystem;
  private difficulty!: DifficultySystem;
  private spawner!: SpawnSystem;
  private scoring!: ScoreSystem;
  private effects!: EffectsSystem;
  private hud!: HUD;
  private intro: Phaser.GameObjects.Text[] = [];

  private readonly laneRight: number[] = new Array<number>(GAME_CONFIG.enemy.laneCount).fill(-Infinity);
  private readonly hudData: HudData = {
    score: 0,
    highScore: 0,
    wave: 1,
    waveProgress: 0,
    battle: undefined,
    powerUps: [],
  };
  private readonly hudBattle = {
    day: 1,
    phaseLabel: 'Day',
    fortHealth: 0,
    fortMax: 0,
    archerHealth: 0,
    archerMax: 0,
  };
  private readonly hudPowerUps: Array<{ type: PowerUpType; timeLeft: number; fraction: number }> = [];

  constructor() {
    super(SceneKeys.Game);
  }

  init(data: { mode?: GameMode }): void {
    this.mode = data?.mode ?? 'battle';
    this.def = MODES[this.mode];
  }

  create(): void {
    const def = this.def;
    this.state = 'playing';
    this.deathTimer = 0;
    this.lastWave = 1;
    this.result = null;
    this.intro = [];
    this.cameras.main.resetFX();

    this.sky = new Sky(this, {
      cycle: def.dayNight,
      onPhase: (phase, day) => this.onSkyPhase(phase, day),
    });
    this.fort = def.fort ? new Fort(this, def.fortHealth) : null;

    this.enemies = this.add.group({
      classType: Enemy,
      maxSize: GAME_CONFIG.enemy.poolSize,
      runChildUpdate: false,
    });
    prewarm<Enemy>(this.enemies, GAME_CONFIG.enemy.poolSize);

    this.effects = new EffectsSystem(this);
    this.powerUps = def.powerUps
      ? new PowerUpSystem(this, { onCollect: (type, x, y) => this.onPowerUpCollected(type, x, y) })
      : null;
    this.launcher = new ArrowLauncher(this, this.effects, this.powerUps);

    this.archer = new Archer(this);
    this.archer.setHealth(def.archerHealth);
    this.controls = new InputController(this);
    this.guide = new AimGuide(this);
    this.aim = new AimSystem(this, {
      archer: this.archer,
      guide: this.guide,
      input: this.controls,
      onFire: (shot) => this.fireArrow(shot),
      speedMultiplier: () => this.launcher.speedMultiplier,
    });

    this.scoring = new ScoreSystem(def.storageKey);
    this.difficulty = new DifficultySystem();
    this.spawner = new SpawnSystem(
      this.difficulty,
      {
        activeCount: () => this.countActiveEnemies(),
        rightmostX: () => this.rightmostEnemyX(),
        spawn: (request) => this.spawnEnemy(request),
      },
      def.enemyTypes,
    );
    this.collisions = new CollisionSystem(this.launcher.group, this.enemies, (hit) => this.onArrowHit(hit));
    this.contacts = new ContactSystem(this.enemies, this.archer, this.fort, {
      onFortBreach: (e) => this.onFortBreach(e),
      onArcherTouched: () => this.onArcherTouched(),
      onShieldKill: (e) => this.onShieldKill(e),
    });
    this.hud = new HUD(this, def.fort, () => this.pauseGame());

    this.createIntro();
    this.syncHud();

    // Pause handling. Keys use a plain DOM listener so a paused scene still
    // receives them (and nothing is replayed when the scene resumes).
    window.addEventListener('keydown', this.onKeyDown);
    this.game.events.on(Phaser.Core.Events.BLUR, this.pauseGame, this);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.pauseGame, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.on(Phaser.Scenes.Events.RESUME, this.onResume, this);
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, MAX_DT);

    this.sky.update(dt);
    this.effects.update(dt);
    if (this.fort) {
      this.fort.setNightness(this.sky.nightness);
      this.fort.update(dt);
    }

    if (this.state === 'playing') {
      this.updatePlaying(dt);
    } else if (this.state === 'dying') {
      this.updateDying(dt);
    }
  }

  // ------------------------------------------------------------------ pause

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    if (e.code !== 'KeyP' && e.code !== 'Escape') return;
    if (this.state !== 'playing') return;
    if (this.scene.isPaused()) this.resumeGame();
    else this.pauseGame();
  };

  pauseGame(): void {
    if (this.state !== 'playing' || this.scene.isPaused()) return;
    this.aim.cancel();
    this.scene.launch(SceneKeys.Pause, { mode: this.mode });
    this.scene.pause();
  }

  private resumeGame(): void {
    this.scene.stop(SceneKeys.Pause);
    this.scene.resume();
  }

  private onResume(): void {
    this.aim.cancel();
  }

  private cleanup(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.game.events.off(Phaser.Core.Events.BLUR, this.pauseGame, this);
    this.game.events.off(Phaser.Core.Events.HIDDEN, this.pauseGame, this);
    this.events.off(Phaser.Scenes.Events.RESUME, this.onResume, this);
  }

  // ---------------------------------------------------------------- playing

  private updatePlaying(dt: number): void {
    this.guide.setNightness(this.sky.nightness);
    this.aim.update(dt);
    this.archer.update(dt, this.controls.moveAxis);

    this.scoring.update(dt);
    this.difficulty.update(dt, this.scoring.kills);
    this.spawner.update(dt);

    if (this.powerUps) {
      this.powerUps.update(dt, this.archer, this.scoring.score);
      this.archer.setShield(this.powerUps.timeLeft('shield'));
    }

    this.launcher.step(dt);
    this.stepEnemies(dt);
    this.collisions.update();
    this.contacts.update();

    this.checkWaveChange();
    this.syncHud();
  }

  private stepEnemies(dt: number): void {
    const enemies = this.enemies.getChildren() as Enemy[];
    const gap = GAME_CONFIG.enemy.separation;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.active) continue;
      e.step(dt);
      if (!e.isAlive) continue;
      // Queue behind the nearest living enemy ahead in the same lane.
      for (let j = 0; j < enemies.length; j++) {
        const o = enemies[j];
        if (o === e || !o.active || !o.isAlive || o.lane !== e.lane || o.x > e.x) continue;
        if (e.x - o.x < gap) e.x = o.x + gap;
      }
    }
  }

  private fireArrow(shot: Shot): void {
    if (!this.launcher.fire(shot)) return;
    this.dismissIntro();
  }

  private onArrowHit(hit: HitInfo): void {
    const { arrow, enemy } = hit;
    const killed = enemy.takeDamage(arrow.damage);
    if (arrow.registerHit()) arrow.kill();

    if (killed) {
      this.awardKill(enemy, hit.x, hit.y);
    } else {
      this.effects.enemyHit(hit.x, hit.y, enemy.y);
    }
  }

  private awardKill(enemy: Enemy, x: number, y: number): void {
    this.scoring.addKill(enemy.def.score);
    this.effects.enemyKilled(x, y, enemy.def.score, enemy.y);
    this.hud.pulseScore();
  }

  // ------------------------------------------------------- castle & archer

  private onFortBreach(enemy: Enemy): void {
    const fort = this.fort;
    if (!fort) return;
    fort.damage(enemy.def.fortDamage);
    enemy.die();
    this.effects.fortHit(fort.right, enemy.y - 50);
    if (fort.isDestroyed) this.endRun('castle');
  }

  private onArcherTouched(): void {
    const dead = this.archer.hurt();
    if (dead) {
      this.endRun(this.def.fort ? 'archer' : 'overrun');
      return;
    }
    this.archer.knockBack(-GAME_CONFIG.archer.knockback);
    this.effects.archerHurt(this.archer.x, this.archer.pivotY);
  }

  private onShieldKill(enemy: Enemy): void {
    enemy.die();
    this.awardKill(enemy, enemy.x, enemy.y - 60);
  }

  private onPowerUpCollected(type: PowerUpType, x: number, y: number): void {
    this.effects.powerUpCollected(x, y, POWERUP_TYPES[type].name);
  }

  // ----------------------------------------------------------------- waves

  private checkWaveChange(): void {
    const wave = this.difficulty.wave;
    if (wave === this.lastWave) return;
    this.lastWave = wave;
    this.effects.banner(GAME_WIDTH / 2, 190, `Wave ${wave}`);
  }

  private onSkyPhase(phase: SkyPhase, day: number): void {
    if (this.state !== 'playing' || !this.def.dayNight) return;
    const text: Record<SkyPhase, string> = {
      day: `Day ${day} - the castle still stands`,
      dusk: 'Dusk falls...',
      night: 'Night - hold the walls!',
      dawn: 'Dawn approaches',
    };
    this.effects.banner(GAME_WIDTH / 2, 150, text[phase]);
  }

  // ----------------------------------------------------------------- spawn

  private spawnEnemy(request: SpawnRequest): void {
    const enemy = acquire<Enemy>(this.enemies);
    if (!enemy) return;
    // Use the emptiest lane so arrivals spread across the depth rows.
    this.computeLaneRight();
    let lane = 0;
    for (let i = 1; i < this.laneRight.length; i++) if (this.laneRight[i] < this.laneRight[lane]) lane = i;
    enemy.spawn(request.def, request.x, request.speed, request.health, lane);
  }

  private countActiveEnemies(): number {
    let n = 0;
    const enemies = this.enemies.getChildren() as Enemy[];
    for (let i = 0; i < enemies.length; i++) if (enemies[i].active && enemies[i].isAlive) n++;
    return n;
  }

  private computeLaneRight(): void {
    this.laneRight.fill(-Infinity);
    const enemies = this.enemies.getChildren() as Enemy[];
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.active && e.isAlive && e.x > this.laneRight[e.lane]) this.laneRight[e.lane] = e.x;
    }
  }

  /** Right-most enemy of the emptiest lane: a spawn only needs one free lane. */
  private rightmostEnemyX(): number {
    this.computeLaneRight();
    let min = Infinity;
    for (let i = 0; i < this.laneRight.length; i++) if (this.laneRight[i] < min) min = this.laneRight[i];
    return min;
  }

  // ------------------------------------------------------------ run ending

  private endRun(cause: DefeatCause): void {
    if (this.state !== 'playing') return;
    this.state = 'dying';
    this.deathTimer = 0;
    this.aim.enabled = false;
    this.aim.cancel();
    this.archer.die();
    this.powerUps?.clearEffects();
    this.dismissIntro();
    this.effects.archerDeath(this.archer.x, this.archer.pivotY);
    this.result = {
      ...this.scoring.finish(), // persists the high score immediately
      mode: this.mode,
      cause,
      days: this.sky.day,
    };
  }

  private updateDying(dt: number): void {
    this.deathTimer += dt;
    this.archer.update(dt);
    // Let in-flight arrows and the dying animations finish naturally.
    this.launcher.step(dt);
    const enemies = this.enemies.getChildren() as Enemy[];
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.active && e.mode === 'dying') e.step(dt);
    }

    if (this.deathTimer >= DEATH_DELAY && this.result) {
      this.state = 'over';
      this.scene.launch(SceneKeys.GameOver, this.result);
      this.scene.pause();
    }
  }

  // ----------------------------------------------------------------- intro

  private createIntro(): void {
    const story = this.add
      .text(GAME_WIDTH / 2, 118, this.def.story.join('\n'), {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        color: '#ffffff',
        align: 'center',
        stroke: '#07080c',
        strokeThickness: 5,
        lineSpacing: 6,
        wordWrap: { width: 900 },
      })
      .setOrigin(0.5, 0)
      .setDepth(90)
      .setResolution(2);
    const controls = this.add
      .text(
        GAME_WIDTH / 2,
        story.y + story.height + 14,
        'A / D move  ·  W / S aim  ·  hold Space, release to fire  ·  or drag with the mouse',
        {
          fontFamily: FONT_FAMILY,
          fontSize: '19px',
          color: COLORS.textAccent,
          stroke: '#07080c',
          strokeThickness: 4,
        },
      )
      .setOrigin(0.5, 0)
      .setDepth(90)
      .setResolution(2);
    this.intro = [story, controls];
    this.time.delayedCall(INTRO_TIME, () => this.dismissIntro());
  }

  private dismissIntro(): void {
    const items = this.intro;
    if (items.length === 0) return;
    this.intro = [];
    for (const t of items) {
      this.tweens.add({ targets: t, alpha: 0, duration: 500, onComplete: () => t.destroy() });
    }
  }

  // ------------------------------------------------------------------- HUD

  private syncHud(): void {
    const d = this.hudData;
    d.score = this.scoring.score;
    d.highScore = this.scoring.highScore;
    d.wave = this.difficulty.wave;
    d.waveProgress = this.difficulty.waveProgress;

    if (this.def.fort && this.fort) {
      const b = this.hudBattle;
      b.day = this.sky.day;
      b.phaseLabel = PHASE_LABEL[this.sky.phase];
      b.fortHealth = this.fort.health;
      b.fortMax = this.fort.maxHealth;
      b.archerHealth = this.archer.health;
      b.archerMax = this.archer.maxHealth;
      d.battle = b;

      const list = this.hudPowerUps;
      list.length = 0;
      if (this.powerUps) {
        for (const type of POWERUP_ORDER) {
          if (this.powerUps.isActive(type)) {
            list.push({ type, timeLeft: this.powerUps.timeLeft(type), fraction: this.powerUps.fraction(type) });
          }
        }
      }
      d.powerUps = list;
    }
    this.hud.update(d);
  }
}
