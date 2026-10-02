/**
 * Central place for every tunable gameplay value.
 * Tweak numbers here to rebalance the game; nothing else needs to change.
 */

export const SceneKeys = {
  Boot: 'Boot',
  Menu: 'Menu',
  Intro: 'Intro',
  Game: 'Game',
  Pause: 'Pause',
  GameOver: 'GameOver',
} as const;

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const GAME_CONFIG = {
  /** Y coordinate of the ground line (feet of lane 0 rest here). */
  groundY: 620,

  archer: {
    /** Starting x. */
    x: 210,
    /** Walkable range (left edge keeps clear of the castle wall). */
    minX: 175,
    maxX: 600,
    /** px / s */
    moveSpeed: 270,
    /** Distance from the pivot to the bow grip along the aim direction. */
    gripDistance: 26,
    /** How far the string is pulled back (px) at full power. */
    maxPull: 30,
    /** Body box used for pickups and enemy contact. */
    halfWidth: 22,
    height: 112,
    /** Seconds of invulnerability after taking a hit (battle). */
    invulnerableTime: 1.4,
    /** Push-back (px) when hit. */
    knockback: 70,
  },

  arrow: {
    /** px / s² */
    gravity: 1500,
    /** px / s at full draw. */
    maxSpeed: 1450,
    /** Fraction of maxSpeed used at the minimum accepted draw. */
    minSpeedFactor: 0.28,
    damage: 1,
    /** Seconds before a stray arrow is recycled. */
    maxLifetime: 5,
    /** Visual shaft length in px (the tip is the arrow's position). */
    length: 50,
    /** Half-thickness used to inflate enemy hit boxes (px, scales with arrow size). */
    radius: 3,
    /** How long a ground-stuck arrow lingers while fading. */
    stuckFadeTime: 0.8,
    /** Max number of simultaneously live arrows (pool size). */
    poolSize: 56,
  },

  aim: {
    /** Pull distance (px, in game space) that gives 100% power. */
    maxDrawDistance: 190,
    /** Pull shorter than this cancels the shot. */
    minDrawDistance: 22,
    /** Allowed launch angle range in degrees (negative = upward). */
    minAngleDeg: -86,
    maxAngleDeg: 24,
    /** Trajectory preview: how long it looks ahead. */
    previewDuration: 2.2,
    /** Distance in px between trajectory dots. */
    previewDotSpacing: 26,
  },

  /** Keyboard controls (W/S/arrows aim, hold Space to draw). */
  keyboard: {
    /** Seconds of holding Space to reach full power. */
    chargeTime: 0.85,
    /** Degrees per second the aim moves with W/S or Up/Down. */
    aimSpeedDeg: 70,
    /** Aim angle the bow rests at (degrees, negative = upward). */
    startAngleDeg: -24,
  },

  enemy: {
    spawnMargin: 60,
    /** Practice mode: enemy touching the archer ends the run. */
    deathDuration: 0.55,
    hitFlashDuration: 0.09,
    poolSize: 24,
    /** Minimum horizontal spacing between walking enemies in the same lane. */
    separation: 54,
    /** Enemies walk in several depth lanes so they can overtake each other. */
    laneCount: 3,
    laneSpacing: 14,
  },

  fort: {
    /** Right edge of the castle wall (enemies breach here). */
    right: 122,
    height: 214,
  },

  score: {
    killPoints: 100,
  },

  spawn: {
    firstSpawnDelay: 1.2,
    /** Minimum horizontal gap between a new spawn and the nearest enemy. */
    minGap: 90,
    /** Retry delay if the spawn point is blocked. */
    blockedRetry: 0.2,
    /** Random extra spawn offset (px) so enemies do not arrive in a perfect line. */
    jitterX: 50,
  },

  difficulty: {
    /** Seconds of survival that equal one difficulty level. */
    secondsPerLevel: 45,
    /** Kills that equal one difficulty level. */
    killsPerLevel: 25,

    /** Seconds between spawns: start * decay^level, never below min. */
    spawnIntervalStart: 2.8,
    spawnIntervalDecay: 0.88,
    spawnIntervalMin: 0.65,

    /** Enemy walk speed (px/s): start + perLevel * level, capped. */
    enemySpeedStart: 50,
    enemySpeedPerLevel: 9,
    enemySpeedMax: 175,
    /** Per-enemy speed randomisation. */
    enemySpeedJitter: [0.9, 1.15] as const,

    /** Concurrent enemy cap: start + perLevel * level, capped. */
    maxEnemiesStart: 4,
    maxEnemiesPerLevel: 1,
    maxEnemiesMax: 12,

    /** Extra enemy health gained per this many levels (0 = disabled). */
    levelsPerExtraHealth: 0,
  },

  powerUps: {
    /** Seconds until the first orb and the range between later ones. */
    firstDelay: 10,
    intervalMin: 16,
    intervalMax: 24,
    /** Orb fall speed (px/s), hover height above ground, and rest time. */
    fallSpeed: 115,
    hoverHeight: 58,
    groundLife: 12,
    pickupRadius: 26,
    /** Effect length: base + bonusPerStep for every scoreStep points, capped. */
    baseDuration: 30,
    bonusPerStep: 2,
    scoreStep: 1000,
    maxDuration: 60,

    multishot: { arrows: 5, spreadDeg: 8, splitAfter: 0.32 },
    swift: { speedMultiplier: 1.5 },
    giant: { size: 2.3, pierce: 10, damage: 6 },
  },

  /** Day / night cycle (battle). Durations in seconds. */
  sky: {
    dayDuration: 55,
    nightDuration: 50,
    transitionDuration: 14,
  },

  effects: {
    screenShakeKill: { duration: 70, intensity: 0.0025 },
    screenShakeDeath: { duration: 350, intensity: 0.012 },
    screenShakeBreach: { duration: 220, intensity: 0.01 },
    killParticles: 28,
    hitParticles: 7,
    dustParticles: 5,
  },
} as const;

/** Colours used across the game (hex numbers for Phaser graphics). */
export const COLORS = {
  stickman: 0x07080c,
  enemy: 0xff4d5a,
  enemyDark: 0xb3202e,
  flash: 0xffffff,
  bow: 0x2a1c12,
  bowString: 0xe9e9ef,
  arrowShaft: 0x15151c,
  arrowHead: 0xeef2ff,
  fletching: 0xff4d5a,
  trajectory: 0xffffff,
  accent: 0xffc857,
  text: '#f4f6ff',
  textDim: '#8d98bd',
  textAccent: '#ffc857',
} as const;

export const FONT_FAMILY = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

// ---------------------------------------------------------------------------
// Modes (missions)
// ---------------------------------------------------------------------------

export type GameMode = 'battle' | 'practice';

export interface ModeDefinition {
  id: GameMode;
  name: string;
  tagline: string;
  /** Short story / briefing lines. */
  story: string[];
  /** Enemy types that may spawn in this mode. */
  enemyTypes: EnemyTypeId[];
  /** Castle + king to defend (adds castle health and archer lives). */
  fort: boolean;
  powerUps: boolean;
  dayNight: boolean;
  fortHealth: number;
  archerHealth: number;
  /** localStorage key for this mode's high score. */
  storageKey: string;
}

export const MODES: Record<GameMode, ModeDefinition> = {
  battle: {
    id: 'battle',
    name: 'Battle',
    tagline: 'Defend the Castle',
    story: [
      'The Dark Horde has come for Aldermere.',
      'Guard the King, the Queen and the people. Let the soil drink the blood of your enemies.',
    ],
    enemyTypes: ['grunt', 'spearman', 'raider', 'knight', 'brute'],
    fort: true,
    powerUps: true,
    dayNight: true,
    fortHealth: 12,
    archerHealth: 3,
    storageKey: 'highScoreBattle',
  },
  practice: {
    id: 'practice',
    name: 'Practice',
    tagline: 'Target Range',
    story: ['Sharpen your aim on endless waves of grunts.', 'No castle, no power-ups: one touch and it is over.'],
    enemyTypes: ['grunt'],
    fort: false,
    powerUps: false,
    dayNight: false,
    fortHealth: 0,
    archerHealth: 1,
    // Same key the original free-play mode used, so old high scores carry over.
    storageKey: 'highScore',
  },
};

// ---------------------------------------------------------------------------
// Enemy definitions
// ---------------------------------------------------------------------------

export type EnemyTypeId = 'grunt' | 'raider' | 'spearman' | 'knight' | 'brute';
export type WeaponKind = 'club' | 'dagger' | 'spear' | 'sword' | 'axe';

export interface EnemyDefinition {
  id: EnemyTypeId;
  name: string;
  weapon: WeaponKind;
  health: number;
  /** Multiplier on the difficulty-driven base walk speed. */
  speedMultiplier: number;
  /** Points awarded when killed. */
  score: number;
  /** Damage dealt to the castle when it breaches the wall. */
  fortDamage: number;
  /** Extra reach (px) of the weapon beyond the body when touching targets. */
  reach: number;
  /** Overall scale of the stickman drawing. */
  scale: number;
  /** Hit box in px at scale 1 (centred horizontally, standing on y). */
  hitWidth: number;
  hitHeight: number;
  color: number;
  /** Relative weight in the spawn table. */
  spawnWeight: number;
  /** Difficulty level at which this type may start spawning. */
  minLevel: number;
}

export const ENEMY_TYPES: Record<EnemyTypeId, EnemyDefinition> = {
  grunt: {
    id: 'grunt',
    name: 'Grunt',
    weapon: 'club',
    health: 1,
    speedMultiplier: 1,
    score: GAME_CONFIG.score.killPoints,
    fortDamage: 1,
    reach: 6,
    scale: 1,
    hitWidth: 46,
    hitHeight: 108,
    color: COLORS.enemy,
    spawnWeight: 10,
    minLevel: 0,
  },
  spearman: {
    id: 'spearman',
    name: 'Spearman',
    weapon: 'spear',
    health: 2,
    speedMultiplier: 0.9,
    score: 150,
    fortDamage: 1,
    reach: 72,
    scale: 1.05,
    hitWidth: 46,
    hitHeight: 108,
    color: 0xb86bff,
    spawnWeight: 6,
    minLevel: 0.7,
  },
  raider: {
    id: 'raider',
    name: 'Raider',
    weapon: 'dagger',
    health: 1,
    speedMultiplier: 1.7,
    score: 150,
    fortDamage: 1,
    reach: 2,
    scale: 0.86,
    hitWidth: 44,
    hitHeight: 108,
    color: 0xffa23c,
    spawnWeight: 5,
    minLevel: 1.2,
  },
  knight: {
    id: 'knight',
    name: 'Knight',
    weapon: 'sword',
    health: 4,
    speedMultiplier: 0.72,
    score: 250,
    fortDamage: 2,
    reach: 18,
    scale: 1.15,
    hitWidth: 50,
    hitHeight: 108,
    color: 0x2fc4a8,
    spawnWeight: 4,
    minLevel: 1.8,
  },
  brute: {
    id: 'brute',
    name: 'Brute',
    weapon: 'axe',
    health: 9,
    speedMultiplier: 0.5,
    score: 500,
    fortDamage: 4,
    reach: 34,
    scale: 1.55,
    hitWidth: 54,
    hitHeight: 108,
    color: 0xd62f6a,
    spawnWeight: 2,
    minLevel: 2.8,
  },
};

// ---------------------------------------------------------------------------
// Power-ups
// ---------------------------------------------------------------------------

export type PowerUpType = 'multishot' | 'swift' | 'giant' | 'shield';

export interface PowerUpDefinition {
  id: PowerUpType;
  name: string;
  description: string;
  color: number;
}

export const POWERUP_TYPES: Record<PowerUpType, PowerUpDefinition> = {
  multishot: {
    id: 'multishot',
    name: 'Split Shot',
    description: 'Arrows split into a fan mid-air',
    color: 0x5be37d,
  },
  swift: {
    id: 'swift',
    name: 'Swift Arrow',
    description: 'Faster, flatter arrows',
    color: 0x4cc9ff,
  },
  giant: {
    id: 'giant',
    name: 'Giant Arrow',
    description: 'Huge arrow pierces up to 10 foes',
    color: 0xffc857,
  },
  shield: {
    id: 'shield',
    name: 'Aegis',
    description: 'Immune to harm; foes that touch you fall',
    color: 0xb48cff,
  },
};

export const POWERUP_ORDER: PowerUpType[] = ['multishot', 'swift', 'giant', 'shield'];

// ---------------------------------------------------------------------------
// Ranks (shown on the game-over screen)
// ---------------------------------------------------------------------------

export const RANKS: ReadonlyArray<{ min: number; title: string }> = [
  { min: 0, title: 'Squire' },
  { min: 1500, title: 'Marksman' },
  { min: 4000, title: 'Ranger' },
  { min: 8000, title: 'Captain of the Bow' },
  { min: 14000, title: 'Hero of the Realm' },
  { min: 22000, title: 'The Master Archer' },
];

export function rankFor(score: number): string {
  let title = RANKS[0].title;
  for (const r of RANKS) if (score >= r.min) title = r.title;
  return title;
}
