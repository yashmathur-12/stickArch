import Phaser from 'phaser';
import { createGameConfig } from './config';

export function createGame(parent = 'game'): Phaser.Game {
  return new Phaser.Game(createGameConfig(parent));
}
