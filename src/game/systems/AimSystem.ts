import Phaser from 'phaser';
import type { Archer, LaunchPoint } from '../entities/Archer';
import type { AimGuide } from '../../ui/AimGuide';
import type { InputController } from './InputController';
import { GAME_CONFIG } from '../data/GameData';
import { DEG2RAD, clamp, lerp } from '../../utils/math';

const AIM = GAME_CONFIG.aim;
const KB = GAME_CONFIG.keyboard;
const MIN_ANGLE = AIM.minAngleDeg * DEG2RAD;
const MAX_ANGLE = AIM.maxAngleDeg * DEG2RAD;
const MIN_POWER = AIM.minDrawDistance / AIM.maxDrawDistance;
/** How long the keyboard aim line stays visible after adjusting it. */
const AIM_LINE_TIME = 1.6;

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export type FireHandler = (shot: Shot) => void;

export interface AimDeps {
  archer: Archer;
  guide: AimGuide;
  input: InputController;
  onFire: FireHandler;
  /** Extra launch-speed factor (power-ups). */
  speedMultiplier: () => number;
}

/**
 * Turns input into shots. Two ways to shoot, usable at the same time:
 *
 *  - Pointer (mouse / touch): slingshot drag. Press anywhere, drag AWAY from the
 *    target, release. The arrow flies opposite to the pull; pull length is power.
 *  - Keyboard: W/S (or Up/Down) set the angle, hold Space to charge, release to fire.
 */
export class AimSystem {
  enabled = true;

  private pointer: Phaser.Input.Pointer | null = null;
  private anchorX = 0;
  private anchorY = 0;
  private readonly launch: LaunchPoint = { x: 0, y: 0 };
  private readonly shot: Shot = { x: 0, y: 0, vx: 0, vy: 0 };

  // Latest computed aim.
  private angle = 0;
  private power = 0;
  private valid = false;

  // Keyboard state.
  private kbAngle = KB.startAngleDeg * DEG2RAD;
  private charge = 0;
  private charging = false;
  private aimLineTimer = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly deps: AimDeps,
  ) {
    const input = scene.input;
    input.on(Phaser.Input.Events.POINTER_DOWN, this.handleDown, this);
    input.on(Phaser.Input.Events.POINTER_UP, this.handleUp, this);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handleUp, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    deps.archer.setRestAngle(this.kbAngle);
  }

  get isAiming(): boolean {
    return this.pointer !== null || this.charging;
  }

  /** Per-frame: read input, update the archer's bow and redraw the guides. */
  update(dt: number): void {
    const { archer, guide, input } = this.deps;

    // Keyboard angle adjustment works any time (also while charging).
    const aimAxis = input.aimAxis;
    if (aimAxis !== 0 && this.enabled) {
      this.kbAngle = clamp(this.kbAngle - aimAxis * KB.aimSpeedDeg * DEG2RAD * dt, MIN_ANGLE, MAX_ANGLE);
      this.aimLineTimer = AIM_LINE_TIME;
    }
    if (this.aimLineTimer > 0) this.aimLineTimer -= dt;

    if (!this.enabled) {
      if (this.pointer || this.charging) this.cancel();
      return;
    }

    if (this.pointer) {
      this.updatePointer();
      return;
    }

    if (input.drawHeld) {
      this.updateCharge(dt);
      return;
    }

    // Space released: fire if the charge was meaningful.
    if (this.charging) {
      if (this.charge >= MIN_POWER) {
        this.power = this.charge;
        this.angle = this.kbAngle;
        this.fire();
      } else {
        archer.cancelAim();
      }
      this.charging = false;
      this.charge = 0;
    }

    // Idle: the bow rests at the keyboard angle; show a brief aim line after adjusting.
    archer.setRestAngle(this.kbAngle);
    guide.clear();
    if (this.aimLineTimer > 0) guide.drawAimLine(archer.pivotX, archer.pivotY, this.kbAngle, this.aimLineTimer / AIM_LINE_TIME);
  }

  cancel(): void {
    this.pointer = null;
    this.charging = false;
    this.charge = 0;
    this.deps.guide.clear();
    this.deps.archer.cancelAim();
  }

  private updatePointer(): void {
    const { archer, guide } = this.deps;
    const pointer = this.pointer as Phaser.Input.Pointer;
    this.computePointerAim(pointer);

    guide.clear();
    const maxD = AIM.maxDrawDistance;
    const dx = pointer.x - this.anchorX;
    const dy = pointer.y - this.anchorY;
    const len = Math.hypot(dx, dy);
    const k = len > maxD ? maxD / len : 1;
    guide.drawPull(this.anchorX, this.anchorY, this.anchorX + dx * k, this.anchorY + dy * k, this.power, this.valid);

    if (this.valid) {
      archer.setAim(this.angle, this.power);
      this.buildShot();
      guide.drawTrajectory(this.shot.x, this.shot.y, this.shot.vx, this.shot.vy);
    } else {
      archer.cancelAim();
    }
  }

  private updateCharge(dt: number): void {
    const { archer, guide } = this.deps;
    this.charging = true;
    this.charge = Math.min(1, this.charge + dt / KB.chargeTime);
    this.power = this.charge;
    this.angle = this.kbAngle;
    this.valid = this.power >= MIN_POWER;

    guide.clear();
    guide.drawChargeBar(archer.pivotX, this.power);
    if (this.valid) {
      archer.setAim(this.angle, this.power);
      this.buildShot();
      guide.drawTrajectory(this.shot.x, this.shot.y, this.shot.vx, this.shot.vy);
    } else {
      archer.cancelAim();
    }
  }

  private handleDown(pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (!this.enabled || this.pointer || this.charging || !pointer.leftButtonDown()) return;
    // Presses on UI (e.g. the pause button) must not start an aim.
    if (over && over.length > 0) return;
    this.pointer = pointer;
    this.anchorX = pointer.x;
    this.anchorY = pointer.y;
    this.computePointerAim(pointer);
  }

  private handleUp(pointer: Phaser.Input.Pointer): void {
    if (this.pointer !== pointer) return;
    this.computePointerAim(pointer);
    if (this.enabled && this.valid) {
      // Keyboard rests where the mouse left off.
      this.kbAngle = this.angle;
      this.fire();
    } else {
      this.deps.archer.cancelAim();
    }
    this.pointer = null;
    this.deps.guide.clear();
  }

  private fire(): void {
    this.buildShot();
    this.deps.archer.release();
    this.deps.archer.setRestAngle(this.kbAngle);
    this.deps.onFire(this.shot);
  }

  /** Pull vector = anchor - pointer; the arrow goes the way the pull points. */
  private computePointerAim(pointer: Phaser.Input.Pointer): void {
    const px = this.anchorX - pointer.x;
    const py = this.anchorY - pointer.y;
    const dist = Math.hypot(px, py);
    this.valid = dist >= AIM.minDrawDistance;
    this.power = clamp(dist / AIM.maxDrawDistance, 0, 1);
    this.angle = clamp(Math.atan2(py, px), MIN_ANGLE, MAX_ANGLE);
  }

  private buildShot(): void {
    const arrow = GAME_CONFIG.arrow;
    const speed = arrow.maxSpeed * lerp(arrow.minSpeedFactor, 1, this.power) * this.deps.speedMultiplier();
    this.deps.archer.getLaunchPoint(this.angle, this.power, this.launch);
    this.shot.x = this.launch.x;
    this.shot.y = this.launch.y;
    this.shot.vx = Math.cos(this.angle) * speed;
    this.shot.vy = Math.sin(this.angle) * speed;
  }

  private destroy(): void {
    const input = this.scene.input;
    input.off(Phaser.Input.Events.POINTER_DOWN, this.handleDown, this);
    input.off(Phaser.Input.Events.POINTER_UP, this.handleUp, this);
    input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handleUp, this);
    this.pointer = null;
  }
}
