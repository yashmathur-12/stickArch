import Phaser from 'phaser';
import { GAME_CONFIG, GAME_HEIGHT, GAME_WIDTH } from '../game/data/GameData';
import { clamp, lerp } from '../utils/math';

const T_STARS = 'sky-stars';
const T_SUN = 'sky-sun';
const T_MOON = 'sky-moon';
const T_CLOUD = 'sky-cloud';
const T_RIDGE_FAR = 'sky-ridge-far';
const T_RIDGE_NEAR = 'sky-ridge-near';

const GROUND = GAME_CONFIG.groundY;
const SKY = GAME_CONFIG.sky;

export type SkyPhase = 'day' | 'dusk' | 'night' | 'dawn';

interface Palette {
  top: number;
  horizon: number;
  ridgeFar: number;
  ridgeNear: number;
  ground: number;
  line: number;
}

/** Ridges are baked with the DAY colours and darkened with tints (multiply). */
const DAY: Palette = {
  top: 0x4d93da,
  horizon: 0xc6e6ff,
  ridgeFar: 0x9fc3b4,
  ridgeNear: 0x6e9c6a,
  ground: 0x3b4a2e,
  line: 0xc9dca0,
};
const DUSK: Palette = {
  top: 0x3c2d63,
  horizon: 0xff8f5f,
  ridgeFar: 0x8c5a78,
  ridgeNear: 0x4d3350,
  ground: 0x2a2230,
  line: 0xc97b5a,
};
const NIGHT: Palette = {
  top: 0x0b0f1e,
  horizon: 0x55669a,
  ridgeFar: 0x3b4a78,
  ridgeNear: 0x232d52,
  ground: 0x090b12,
  line: 0x5e6c93,
};
const DAWN: Palette = {
  top: 0x2f3f7a,
  horizon: 0xffb585,
  ridgeFar: 0x96788c,
  ridgeNear: 0x5f5564,
  ground: 0x2a2c38,
  line: 0xe0a070,
};

function mixRgb(a: number, b: number, t: number): number {
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t));
  const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t));
  const bl = Math.round(lerp(a & 255, b & 255, t));
  return (r << 16) | (g << 8) | bl;
}

/** Tint (multiply) that turns a baked colour into a target colour. */
function tintFor(target: number, baked: number): number {
  const ch = (shift: number): number => {
    const t = (target >> shift) & 255;
    const b = Math.max(1, (baked >> shift) & 255);
    return Math.round(clamp(t / b, 0, 1) * 255);
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

function smooth(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function ridge(
  g: Phaser.GameObjects.Graphics,
  color: number,
  baseY: number,
  amp: number,
  freq: number,
  phase: number,
): void {
  g.fillStyle(color, 1);
  g.beginPath();
  g.moveTo(0, GROUND + 1);
  for (let x = 0; x <= GAME_WIDTH; x += 16) {
    const y =
      baseY - amp * (0.55 + 0.45 * Math.sin(x * freq + phase)) - amp * 0.35 * Math.sin(x * freq * 2.3 + phase * 1.7);
    g.lineTo(x, y);
  }
  g.lineTo(GAME_WIDTH, GROUND + 1);
  g.closePath();
  g.fillPath();
}

/** Builds the reusable scenery textures once (called from the boot scene). */
export function generateSkyTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(T_STARS)) return;
  const make = (): Phaser.GameObjects.Graphics => scene.make.graphics({ x: 0, y: 0 }, false);

  // Stars.
  let g = make();
  const rand = seeded(7);
  for (let i = 0; i < 110; i++) {
    const y = rand() * GROUND * 0.62;
    g.fillStyle(0xffffff, 0.25 + rand() * 0.65 * (1 - y / (GROUND * 0.62)));
    g.fillCircle(rand() * GAME_WIDTH, y, 0.6 + rand() * 1.3);
  }
  g.generateTexture(T_STARS, GAME_WIDTH, GROUND);
  g.destroy();

  // Sun.
  g = make();
  g.fillStyle(0xffffff, 0.1);
  g.fillCircle(100, 100, 100);
  g.fillStyle(0xffffff, 0.2);
  g.fillCircle(100, 100, 70);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(100, 100, 44);
  g.generateTexture(T_SUN, 200, 200);
  g.destroy();

  // Moon.
  g = make();
  g.fillStyle(0xdfe6ff, 0.06);
  g.fillCircle(100, 100, 92);
  g.fillStyle(0xdfe6ff, 0.1);
  g.fillCircle(100, 100, 66);
  g.fillStyle(0xeef1ff, 0.95);
  g.fillCircle(100, 100, 42);
  g.fillStyle(0xc4cbe6, 0.55);
  g.fillCircle(88, 92, 8);
  g.fillCircle(112, 112, 6);
  g.fillCircle(104, 84, 4);
  g.generateTexture(T_MOON, 200, 200);
  g.destroy();

  // Cloud.
  g = make();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(50, 50, 26);
  g.fillCircle(84, 38, 32);
  g.fillCircle(124, 48, 28);
  g.fillCircle(150, 56, 20);
  g.fillRoundedRect(30, 50, 140, 28, 14);
  g.generateTexture(T_CLOUD, 180, 100);
  g.destroy();

  // Ridges (day colours; darkened with tints at runtime).
  g = make();
  ridge(g, 0xffffff, GROUND - 20, 90, 0.0065, 1.2);
  g.generateTexture(T_RIDGE_FAR, GAME_WIDTH, GROUND + 2);
  g.destroy();
  g = make();
  ridge(g, 0xffffff, GROUND - 8, 70, 0.011, 4.1);
  g.generateTexture(T_RIDGE_NEAR, GAME_WIDTH, GROUND + 2);
  g.destroy();
}

interface CloudSprite {
  img: Phaser.GameObjects.Image;
  speed: number;
}

export interface SkyOptions {
  /** Run the day/night cycle (otherwise the sky is frozen at night). */
  cycle: boolean;
  /** Speed multiplier for the clock (menu uses a faster ambient cycle). */
  speed?: number;
  /** Called when the phase changes (day, dusk, night, dawn). */
  onPhase?: (phase: SkyPhase, day: number) => void;
}

/**
 * Procedural background with a Chrome-dino style day/night cycle:
 * a sky gradient, stars, sun & moon on arcs, clouds and tinted hills.
 */
export class Sky {
  /** 0 = full daylight, 1 = full night. */
  nightness = 1;
  phase: SkyPhase = 'night';
  /** 1-based day counter (increments every dawn). */
  day = 1;

  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly stars: Phaser.GameObjects.Image;
  private readonly sun: Phaser.GameObjects.Image;
  private readonly moon: Phaser.GameObjects.Image;
  private readonly ridgeFar: Phaser.GameObjects.Image;
  private readonly ridgeNear: Phaser.GameObjects.Image;
  private readonly clouds: CloudSprite[] = [];

  private readonly cycleLength: number;
  private clock = 0;
  private lastDrawn = -1;
  private readonly opts: SkyOptions;

  // Reused palette scratch object (no per-frame allocation).
  private readonly cur: Palette = { ...NIGHT };

  constructor(scene: Phaser.Scene, opts: SkyOptions) {
    this.opts = opts;
    this.cycleLength = SKY.dayDuration + SKY.nightDuration + SKY.transitionDuration * 2;
    // Cycle starts in full daylight; the static sky is a deep night.
    this.clock = opts.cycle ? 0 : SKY.dayDuration + SKY.transitionDuration + SKY.nightDuration * 0.5;

    this.gfx = scene.add.graphics().setDepth(-10);
    this.stars = scene.add.image(0, 0, T_STARS).setOrigin(0, 0).setDepth(-9);
    this.sun = scene.add.image(0, 0, T_SUN).setDepth(-8);
    this.moon = scene.add.image(0, 0, T_MOON).setDepth(-8);

    for (let i = 0; i < 4; i++) {
      const img = scene.add
        .image(Math.random() * GAME_WIDTH, 70 + Math.random() * 190, T_CLOUD)
        .setDepth(-7)
        .setScale(0.7 + Math.random() * 0.8);
      this.clouds.push({ img, speed: 6 + Math.random() * 10 });
    }

    this.ridgeFar = scene.add.image(0, 0, T_RIDGE_FAR).setOrigin(0, 0).setDepth(-6);
    this.ridgeNear = scene.add.image(0, 0, T_RIDGE_NEAR).setOrigin(0, 0).setDepth(-5);

    this.apply();
    this.phase = this.computePhase();
  }

  update(dt: number): void {
    if (this.opts.cycle) {
      const prevDay = this.day;
      const prevPhase = this.phase;
      this.clock += dt * (this.opts.speed ?? 1);
      if (this.clock >= this.cycleLength) {
        this.clock -= this.cycleLength;
      }
      const phase = this.computePhase();
      if (phase !== prevPhase) {
        this.phase = phase;
        // A new day begins when dawn turns into full daylight.
        if (phase === 'day') this.day = prevDay + 1;
        this.opts.onPhase?.(phase, this.day);
      }
      for (const c of this.clouds) {
        c.img.x += c.speed * dt;
        if (c.img.x > GAME_WIDTH + 120) c.img.x = -140;
      }
    }
    this.apply();
  }

  private computePhase(): SkyPhase {
    const D = SKY.dayDuration;
    const T = SKY.transitionDuration;
    const N = SKY.nightDuration;
    const t = this.clock;
    if (t < D) return 'day';
    if (t < D + T) return 'dusk';
    if (t < D + T + N) return 'night';
    return 'dawn';
  }

  /** Recompute blended colours and positions for the current clock. */
  private apply(): void {
    const D = SKY.dayDuration;
    const T = SKY.transitionDuration;
    const N = SKY.nightDuration;
    const C = this.cycleLength;
    const t = this.clock;

    let a: Palette = NIGHT;
    let b: Palette = NIGHT;
    let c: Palette = NIGHT;
    let f = 0;
    if (t < D) {
      a = b = c = DAY;
      this.nightness = 0;
    } else if (t < D + T) {
      a = DAY;
      b = DUSK;
      c = NIGHT;
      f = (t - D) / T;
      this.nightness = smooth(f);
    } else if (t < D + T + N) {
      a = b = c = NIGHT;
      this.nightness = 1;
    } else {
      a = NIGHT;
      b = DAWN;
      c = DAY;
      f = (t - D - T - N) / T;
      this.nightness = 1 - smooth(f);
    }

    const cur = this.cur;
    const blend = (k: keyof Palette): number =>
      f < 0.5 ? mixRgb(a[k], b[k], f * 2) : mixRgb(b[k], c[k], (f - 0.5) * 2);
    cur.top = blend('top');
    cur.horizon = blend('horizon');
    cur.ridgeFar = blend('ridgeFar');
    cur.ridgeNear = blend('ridgeNear');
    cur.ground = blend('ground');
    cur.line = blend('line');

    this.ridgeFar.setTint(tintFor(cur.ridgeFar, 0xffffff));
    this.ridgeNear.setTint(tintFor(cur.ridgeNear, 0xffffff));

    this.stars.setAlpha(this.nightness * 0.95);
    const cloudAlpha = (1 - this.nightness) * 0.9;
    const cloudTint = mixRgb(0xffffff, cur.horizon, 0.45);
    for (const cl of this.clouds) cl.img.setAlpha(cloudAlpha).setTint(cloudTint);

    // Sun spans the day (and half of each transition); the moon spans the night.
    let tt = t;
    if (tt >= C - T / 2) tt -= C;
    const sp = (tt + T / 2) / (D + T);
    if (sp >= 0 && sp <= 1) {
      this.sun.setVisible(true);
      this.sun.setPosition(100 + sp * (GAME_WIDTH - 200), GROUND - 30 - Math.sin(sp * Math.PI) * 400);
      this.sun.setTint(mixRgb(0xff8a4a, 0xfff3b0, Math.sin(sp * Math.PI)));
    } else {
      this.sun.setVisible(false);
    }
    const mp = (t - (D + T / 2)) / (N + T);
    if (mp >= 0 && mp <= 1) {
      this.moon.setVisible(true);
      this.moon.setPosition(100 + mp * (GAME_WIDTH - 200), GROUND - 30 - Math.sin(mp * Math.PI) * 400);
    } else {
      this.moon.setVisible(false);
    }

    // The gradient only needs repainting when colours visibly change.
    if (Math.abs(this.clock - this.lastDrawn) > 0.12 || this.lastDrawn < 0) {
      this.lastDrawn = this.clock;
      this.paintSky();
    }
  }

  private paintSky(): void {
    const g = this.gfx;
    const cur = this.cur;
    g.clear();
    const bands = 40;
    const bandH = GROUND / bands;
    for (let i = 0; i < bands; i++) {
      const k = Math.pow(i / (bands - 1), 1.6);
      g.fillStyle(mixRgb(cur.top, cur.horizon, k), 1);
      g.fillRect(0, bandH * i, GAME_WIDTH, bandH + 1);
    }
    g.fillStyle(cur.ground, 1);
    g.fillRect(0, GROUND, GAME_WIDTH, GAME_HEIGHT - GROUND);
    g.fillStyle(cur.line, 1);
    g.fillRect(0, GROUND, GAME_WIDTH, 3);
    g.fillStyle(0xffffff, 0.05);
    g.fillRect(0, GROUND + 3, GAME_WIDTH, 14);
  }
}
