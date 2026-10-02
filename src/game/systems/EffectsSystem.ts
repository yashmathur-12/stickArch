import Phaser from 'phaser';
import { COLORS, FONT_FAMILY, GAME_CONFIG, GAME_WIDTH } from '../data/GameData';

export const PARTICLE_TEXTURE = 'particle-dot';
export const BLOOD_TEXTURE = 'blood-splat';

/** Dark, thick reds for blood. */
const BLOOD_TINTS = [0x7d0a14, 0xa3121f, 0xc4202e, 0x5c0710];
const STAIN_POOL = 150;

const FX = GAME_CONFIG.effects;
const POPUP_POOL = 8;
const MARKER_POOL = 6;
const POPUP_LIFE = 0.8;
const MARKER_LIFE = 0.22;

interface Timed {
  life: number;
}
interface Popup extends Timed {
  text: Phaser.GameObjects.Text;
}
interface Marker extends Timed {
  gfx: Phaser.GameObjects.Graphics;
}

/**
 * All the juice: pooled particle emitters, floating score text, hit markers
 * and camera shake. Gameplay code calls intent-level methods only.
 */
export class EffectsSystem {
  private readonly blood: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly popups: Popup[] = [];
  private readonly markers: Marker[] = [];
  /** Ring buffer of ground stains: the soil slowly fills with blood. */
  private readonly stains: Phaser.GameObjects.Image[] = [];
  private stainIndex = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.blood = scene.add
      .particles(0, 0, PARTICLE_TEXTURE, {
        emitting: false,
        speed: { min: 110, max: 470 },
        angle: { min: -205, max: 25 },
        gravityY: 1250,
        lifespan: { min: 380, max: 900 },
        // Fat droplets that barely shrink: blood is thick.
        scale: { start: 1.05, end: 0.35 },
        alpha: { start: 1, end: 0.7 },
        tint: BLOOD_TINTS,
        deathCallback: (p: Phaser.GameObjects.Particles.Particle): void => this.onDropletLanded(p.x),
      })
      .setDepth(30);

    this.sparks = scene.add
      .particles(0, 0, PARTICLE_TEXTURE, {
        emitting: false,
        speed: { min: 120, max: 320 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 120, max: 260 },
        scale: { start: 0.45, end: 0 },
        tint: [0xffffff, COLORS.accent],
      })
      .setDepth(31);

    this.dust = scene.add
      .particles(0, 0, PARTICLE_TEXTURE, {
        emitting: false,
        speed: { min: 40, max: 160 },
        angle: { min: -160, max: -20 },
        gravityY: 500,
        lifespan: { min: 250, max: 520 },
        scale: { start: 0.55, end: 0 },
        alpha: { start: 0.7, end: 0 },
        tint: 0x8d98bd,
      })
      .setDepth(14);

    for (let i = 0; i < STAIN_POOL; i++) {
      this.stains.push(scene.add.image(0, 0, BLOOD_TEXTURE).setDepth(5).setVisible(false));
    }

    for (let i = 0; i < POPUP_POOL; i++) {
      const text = scene.add
        .text(0, 0, '', {
          fontFamily: FONT_FAMILY,
          fontSize: '30px',
          fontStyle: 'bold',
          color: COLORS.textAccent,
          stroke: '#07080c',
          strokeThickness: 5,
        })
        .setOrigin(0.5)
        .setDepth(40)
        .setResolution(2)
        .setVisible(false);
      this.popups.push({ text, life: 0 });
    }

    for (let i = 0; i < MARKER_POOL; i++) {
      const gfx = scene.add.graphics().setDepth(35).setVisible(false);
      gfx.lineStyle(3.5, 0xffffff, 1);
      gfx.beginPath();
      gfx.moveTo(-11, -11);
      gfx.lineTo(-4, -4);
      gfx.moveTo(11, -11);
      gfx.lineTo(4, -4);
      gfx.moveTo(-11, 11);
      gfx.lineTo(-4, 4);
      gfx.moveTo(11, 11);
      gfx.lineTo(4, 4);
      gfx.strokePath();
      this.markers.push({ gfx, life: 0 });
    }
  }

  /** Non-lethal arrow hit. */
  enemyHit(x: number, y: number, groundY: number = GAME_CONFIG.groundY): void {
    this.sparks.explode(FX.hitParticles, x, y);
    this.blood.explode(Math.ceil(FX.hitParticles * 1.5), x, y);
    this.stain(x + Phaser.Math.Between(-20, 20), groundY, 0.35 + Math.random() * 0.25);
    this.showMarker(x, y);
  }

  /** Enemy killed: burst, popup, small shake. */
  enemyKilled(x: number, y: number, points: number, groundY: number = GAME_CONFIG.groundY): void {
    this.blood.explode(FX.killParticles, x, y);
    this.bloodPool(x, groundY, 1);
    this.sparks.explode(FX.hitParticles, x, y);
    this.showMarker(x, y);
    if (points > 0) this.showPopup(x, y - 28, `+${points}`);
    this.scene.cameras.main.shake(FX.screenShakeKill.duration, FX.screenShakeKill.intensity);
  }

  /** Arrow struck the ground. */
  groundImpact(x: number, y: number): void {
    this.dust.explode(FX.dustParticles, x, y);
  }

  /** A split-shot arrow fans out. */
  splitBurst(x: number, y: number): void {
    this.sparks.explode(10, x, y);
  }

  /** A power-up orb was collected. */
  powerUpCollected(x: number, y: number, label: string): void {
    this.sparks.explode(18, x, y);
    this.showPopup(x, y - 40, label);
  }

  /** An enemy smashed into the castle wall. */
  fortHit(x: number, y: number): void {
    this.dust.explode(FX.killParticles, x, y);
    this.sparks.explode(FX.hitParticles, x, y);
    this.scene.cameras.main.shake(FX.screenShakeBreach.duration, FX.screenShakeBreach.intensity);
  }

  /** The archer took a hit but survived. */
  archerHurt(x: number, y: number): void {
    this.blood.explode(FX.hitParticles * 2, x, y);
    this.stain(x, GAME_CONFIG.groundY, 0.5);
    this.scene.cameras.main.shake(FX.screenShakeBreach.duration, FX.screenShakeBreach.intensity);
    this.scene.cameras.main.flash(120, 255, 80, 90, false);
  }

  /** The archer was reached: big shake and burst. */
  archerDeath(x: number, y: number): void {
    this.blood.explode(FX.killParticles * 2, x, y);
    this.bloodPool(x, GAME_CONFIG.groundY, 1.3);
    this.scene.cameras.main.shake(FX.screenShakeDeath.duration, FX.screenShakeDeath.intensity);
    this.scene.cameras.main.flash(180, 255, 80, 90, false);
  }

  /** Short floating banner text (used for wave changes). */
  banner(x: number, y: number, message: string): void {
    this.showPopup(x, y, message);
  }

  /** A pool of blood around a kill: one big puddle plus scattered spatter. */
  bloodPool(x: number, groundY: number, scale: number): void {
    this.stain(x, groundY + 2, 1.15 * scale);
    for (let i = 0; i < 6; i++) {
      this.stain(x + Phaser.Math.Between(-80, 80), groundY + Phaser.Math.Between(-2, 30), (0.25 + Math.random() * 0.45) * scale);
    }
  }

  /** A droplet hit the ground: sometimes it leaves a small stain. */
  private onDropletLanded(x: number): void {
    if (Math.random() < 0.3) {
      this.stain(x, GAME_CONFIG.groundY + Phaser.Math.Between(0, 40), 0.2 + Math.random() * 0.25);
    }
  }

  /** Paint one flattened blood stain on the soil (recycles the oldest). */
  private stain(x: number, groundY: number, size: number): void {
    const img = this.stains[this.stainIndex];
    this.stainIndex = (this.stainIndex + 1) % STAIN_POOL;
    img
      .setPosition(x, groundY + 4 + Math.random() * 6)
      .setScale(size * (0.9 + Math.random() * 0.4), size * 0.3)
      .setRotation((Math.random() - 0.5) * 0.3)
      .setTint(BLOOD_TINTS[Math.floor(Math.random() * BLOOD_TINTS.length)])
      .setAlpha(0.8 + Math.random() * 0.2)
      .setVisible(true);
  }

  update(dt: number): void {
    for (const p of this.popups) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.text.setVisible(false);
        continue;
      }
      const t = 1 - p.life / POPUP_LIFE;
      p.text.y -= 46 * (1 - t) * dt;
      p.text.setAlpha(t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4);
      p.text.setScale(t < 0.15 ? 0.7 + (t / 0.15) * 0.5 : 1.2 - Math.min(0.2, (t - 0.15) * 0.4));
    }
    for (const m of this.markers) {
      if (m.life <= 0) continue;
      m.life -= dt;
      if (m.life <= 0) {
        m.gfx.setVisible(false);
        continue;
      }
      const t = 1 - m.life / MARKER_LIFE;
      m.gfx.setAlpha(1 - t);
      m.gfx.setScale(0.8 + t * 0.7);
    }
  }

  private showPopup(x: number, y: number, message: string): void {
    const p = this.popups.find((e) => e.life <= 0) ?? this.popups[0];
    p.life = POPUP_LIFE;
    p.text.setText(message).setPosition(Math.min(Math.max(x, 70), GAME_WIDTH - 70), y).setAlpha(1).setScale(0.7).setVisible(true);
  }

  private showMarker(x: number, y: number): void {
    const m = this.markers.find((e) => e.life <= 0) ?? this.markers[0];
    m.life = MARKER_LIFE;
    m.gfx.setPosition(x, y).setAlpha(1).setScale(0.8).setVisible(true);
  }
}
