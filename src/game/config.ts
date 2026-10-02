import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './data/GameData';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { IntroScene } from './scenes/IntroScene';
import { GameScene } from './scenes/GameScene';
import { PauseScene } from './scenes/PauseScene';
import { GameOverScene } from './scenes/GameOverScene';

export function createGameConfig(parent: string): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#05070d',
    scale: {
      // Keep the 16:9 logical resolution and letterbox to fit any window.
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: {
      // Capture touches so the page never scrolls / zooms while playing.
      touch: { capture: true },
      mouse: { preventDefaultDown: true, preventDefaultUp: true, preventDefaultMove: true },
      activePointers: 2,
    },
    disableContextMenu: true,
    render: { antialias: true, powerPreference: 'high-performance' },
    scene: [BootScene, MenuScene, IntroScene, GameScene, PauseScene, GameOverScene],
  };
}
