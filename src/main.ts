import './style.css';
import type Phaser from 'phaser';
import { createGame } from './game/Game';

const game = createGame('game');

// Dev-only handle for poking at the running game from the console.
if (import.meta.env.DEV) {
  (window as Window & { __game?: Phaser.Game }).__game = game;
}
