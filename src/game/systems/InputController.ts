import Phaser from 'phaser';

const KC = Phaser.Input.Keyboard.KeyCodes;

/**
 * Keyboard state for the archer:
 *   A / D or Left / Right  - walk
 *   W / S or Up / Down     - raise / lower the aim
 *   Space                  - hold to draw the bow, release to fire
 * Browser-default behaviour (page scroll, etc.) is suppressed for these keys.
 */
export class InputController {
  private readonly left: Phaser.Input.Keyboard.Key[];
  private readonly right: Phaser.Input.Keyboard.Key[];
  private readonly up: Phaser.Input.Keyboard.Key[];
  private readonly down: Phaser.Input.Keyboard.Key[];
  private readonly draw: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) throw new Error('Keyboard input is not available');
    this.left = [kb.addKey(KC.A), kb.addKey(KC.LEFT)];
    this.right = [kb.addKey(KC.D), kb.addKey(KC.RIGHT)];
    this.up = [kb.addKey(KC.W), kb.addKey(KC.UP)];
    this.down = [kb.addKey(KC.S), kb.addKey(KC.DOWN)];
    this.draw = kb.addKey(KC.SPACE);
  }

  /** -1 = left, +1 = right. */
  get moveAxis(): number {
    return (anyDown(this.right) ? 1 : 0) - (anyDown(this.left) ? 1 : 0);
  }

  /** +1 = raise the aim, -1 = lower it. */
  get aimAxis(): number {
    return (anyDown(this.up) ? 1 : 0) - (anyDown(this.down) ? 1 : 0);
  }

  /** Space held: the bow is being drawn. */
  get drawHeld(): boolean {
    return this.draw.isDown;
  }
}

function anyDown(keys: Phaser.Input.Keyboard.Key[]): boolean {
  for (let i = 0; i < keys.length; i++) if (keys[i].isDown) return true;
  return false;
}
