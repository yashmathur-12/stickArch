# Stick Archer 1.1

An endless stickman archer game built with **TypeScript + Phaser 4 + Vite**. No backend, no external assets (everything is drawn with Phaser graphics), high scores stored in `localStorage`.

## Run it

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build locally
```

## Missions

| Mode | What it is |
| --- | --- |
| **Battle** (Defend the Castle) | The Dark Horde marches on the castle where the king waits. Five enemy types, castle health, archer lives, power-ups and a day/night cycle. Ends when the castle falls or the archer falls. |
| **Practice** | The original free-play game: endless grunts, no castle, no power-ups, one touch ends the run. |

Each mode keeps its own high score. (Practice uses the same storage key as 1.0, so old scores carry over.)

## The story

Picking **Battle** opens with a short cinematic: Aldermere at peace, the Dark Horde burning the borders, the King, the Queen and the people behind the walls, and one archer left standing. *Blood is better than tears* - the soil drinks the blood of the enemy and the title lands: **The Master Archer**. Click or press any key to skip. Practice skips straight to the game, and restarting never replays the intro.

Blood is thick and it stays: kills spray heavy droplets and leave stains on the soil that build up over the run. Your final score earns a rank: Squire, Marksman, Ranger, Captain of the Bow, Hero of the Realm and, at 22,000 points, **The Master Archer**.

## Controls

| Action | Keyboard | Mouse / touch |
| --- | --- | --- |
| Walk | `A` / `D` or `←` / `→` | - |
| Aim up / down | `W` / `S` or `↑` / `↓` | - |
| Draw & fire | Hold `Space` (power charges), release to fire | Press, drag **back**, release |
| Pause / resume | `P` or `Esc` (or the pause button) | pause button |
| Menu shortcuts | `1` Battle, `2` Practice | click a mission card |

Keyboard and mouse work at the same time; the dotted line previews the exact arrow path. The game also pauses automatically when the window loses focus.

## Battle mode

- **Castle:** every enemy that reaches the wall damages it (bigger enemies hit harder). Watch the Castle bar.
- **Archer:** 3 hearts. Touching an enemy costs a heart and knocks you back; you flash and are briefly invulnerable.
- **Enemies** (unlock as difficulty rises):

| Enemy | Weapon | HP | Speed | Notes |
| --- | --- | --- | --- | --- |
| Grunt | club | 1 | normal | |
| Spearman | spear | 2 | slightly slow | long reach |
| Raider | dagger | 1 | very fast | small |
| Knight | sword + shield | 4 | slow | |
| Brute | great axe | 9 | very slow | huge, wrecks the wall |

- **Power-ups** fall from the sky as glowing orbs. Walk into one (or let it land on you) to grab it. Effects last **30 s**, plus **2 s per 1000 points** (capped at 60 s). Different power-ups stack; re-grabbing one refreshes it.

| Power-up | Effect |
| --- | --- |
| Split Shot | each arrow splits into a fan of 5 mid-air |
| Swift Arrow | arrows fly 1.5x faster and flatter |
| Giant Arrow | huge arrow that pierces up to 10 enemies |
| Aegis | shield: immune to damage, enemies that touch you die |

- **Day / night:** the sky cycles day -> dusk -> night -> dawn on a timer, with sun, moon, stars and clouds. The days survived are counted in the HUD.

## Architecture

```
src/
├── main.ts
├── game/
│   ├── config.ts               Phaser config (FIT scaling, input, scenes)
│   ├── data/GameData.ts        ALL tunables, mode / enemy / power-up definitions
│   ├── scenes/                 Boot, Menu, Intro (cinematic), Game, Pause (overlay), GameOver (overlay)
│   ├── entities/               Archer, Arrow, Enemy, Fort, PowerUpPickup (+ stickman, weapons drawing)
│   └── systems/
│       ├── InputController     keyboard state (move / aim / draw)
│       ├── AimSystem           keyboard + pointer aiming -> shots
│       ├── ArrowLauncher       arrow pool, power-up modifiers, split shots
│       ├── CollisionSystem     swept arrow-vs-enemy hits (piercing aware)
│       ├── ContactSystem       enemy vs castle / archer / shield
│       ├── SpawnSystem, DifficultySystem, ScoreSystem
│       ├── PowerUpSystem       orb drops, pickup, timers
│       └── EffectsSystem       particles, popups, shake
├── ui/                         HUD, Sky (day/night), AimGuide, Button, GameOverUI, PowerUpIcons
└── utils/                      math, storage, pool
```

- **Modes are data.** `MODES` in `GameData.ts` lists which enemy types, castle, power-ups and day/night each mission uses. `GameScene` builds only what the mode asks for, so a new mission is mostly a new entry.
- **Enemies are data.** `ENEMY_TYPES` holds health, speed multiplier, score, castle damage, weapon, reach, size, colour, spawn weight and unlock level. Weapons are drawn in `entities/weapons.ts`.
- **Arrows** use closed-form projectile motion, so the preview and the real arrow are identical at any frame rate. Power-ups only change a per-shot `ArrowSpec` (damage, pierce, size, split time).
- **Lanes:** enemies walk in three depth rows and queue only behind enemies in their own row, so fast ones can overtake slow ones.
- **Pooling:** arrows, enemies, power-up orbs, particles, popups and markers are all pooled; nothing is allocated per frame.
- **Pause:** `Esc`/`P` are handled with a plain DOM listener so a paused scene still hears them; the Pause scene is an overlay over the paused game scene.

## Tunable constants (`src/game/data/GameData.ts`)

| Area | Keys |
| --- | --- |
| Archer | `archer.moveSpeed`, `minX`, `maxX`, `invulnerableTime`, `knockback` |
| Keyboard | `keyboard.chargeTime`, `aimSpeedDeg`, `startAngleDeg` |
| Arrow / aim | `arrow.gravity`, `maxSpeed`, `minSpeedFactor`, `aim.maxDrawDistance`, `minDrawDistance`, angle limits |
| Modes | `MODES.battle.fortHealth`, `archerHealth`, `enemyTypes` |
| Enemies | `ENEMY_TYPES.*` (`health`, `speedMultiplier`, `score`, `fortDamage`, `reach`, `scale`, `spawnWeight`, `minLevel`), `enemy.separation`, `laneCount` |
| Power-ups | `powerUps.baseDuration`, `bonusPerStep`, `scoreStep`, `maxDuration`, `intervalMin/Max`, `fallSpeed`, `multishot.*`, `swift.*`, `giant.*` |
| Day / night | `sky.dayDuration`, `nightDuration`, `transitionDuration` |
| Difficulty | `difficulty.secondsPerLevel`, `killsPerLevel`, `spawnInterval*`, `enemySpeed*`, `maxEnemies*` |
| Effects | `effects.screenShake*`, particle counts (blood droplets: `killParticles`) |
| Ranks | `RANKS` (score thresholds and titles) |

A "wave" is `floor(level) + 1`, where `level = seconds / secondsPerLevel + kills / killsPerLevel`.

## Notes

- Logical resolution is 1280x720, scaled with `Phaser.Scale.FIT`; a hint suggests rotating a phone to landscape.
- In dev mode the game instance is exposed as `window.__game` for console debugging.
