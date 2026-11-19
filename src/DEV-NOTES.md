# Phantom Photon (GDevelop 5 prototype)

A neon puzzle-action game. You are a small photon of light that can only move along walls.

Open `project/game.json` in GDevelop 5. Scenes: **Menu** -> **LevelSelect** -> **Game**. Playable web build: `html5/` (serve it with any static server, e.g. `cd html5 && python3 -m http.server`).

URL options:
- `?unlock` (debug) unlocks every chapter and level.
- `?select` (optionally with `&ch=2`) opens level select directly.
- `?level=3` opens level 3 of chapter 1; `?ch=2&level=4` opens The Abyss level 4.

Progress (cleared levels and best shard count) is saved in `localStorage` (`phantomPhoton.progress.v1`). Clearing every Awakening level unlocks The Abyss.

## Menu, level select, chapters
- **Menu:** photons in six neon colors stream in from random edges. A black hole (accretion disk, swirl, lensing on the grid) bends them: some slingshot, some are swallowed with a small implode flash. The logo flickers and pulses.
  - The **PLAY** button breathes, grows on hover, and squashes when pressed.
  - On release it pops with overshoot: a glow flare, a spark burst, ripple rings, screen shake, and a light pool cast on the scene plus a glossy reflection.
  - Buttons enter in a staggered bounce. PLAY zooms the camera into the black hole and flashes white into level select.
- **Level select:** one chapter card per chapter. Switch by swiping, with the arrow buttons, PageUp/PageDown, or Q/E. Level nodes show locked (lock), open (pulsing number) or completed (check plus collected shards); an animated link lights up between cleared nodes. A locked node wiggles and shows a toast. Keyboard: arrows move focus across nodes and chapters, Enter plays, Esc/Backspace goes back.
- **In game:** the back button (top left, or Esc) returns to level select; the restart button (top right, or R). After a clear, a panel offers **NEXT** (or **NEXT CHAPTER**) and **LEVELS**.

## Chapter 2: The Abyss (dark)
A GDevelop lighting layer makes the level dark. Your photon carries its own light. Its trail leaves light that fades slowly, and walls you have passed stay faintly lit. The exit, stars, shards, pads and platforms emit light of their own, and the exit's outline always shows faintly.
| # | Name | Introduces | Solution |
|---|------|------------|----------|
| 2-1 | Reflections | **mirrors**: silver blocks bounce you back (you can't stick to them); thin diagonal mirrors turn you 90 degrees; every bounce flashes light | L U L D L D R |
| 2-2 | Drift | **moving platforms** (mint, on a dashed track): stick to one, ride it, and launch at the right moment | R L U R D, ride, R |
| 2-3 | Solar Flare | **stars**: touching one burns you up (respawn at the last wall); strong pulsing light | U L D L U L U R |
| 2-4 | Murk | **gas clouds**: don't block movement but swallow light and cast shadows; your light dims inside; a faint dotted rim marks them | D L U L D R U |
| 2-5 | Event Horizon | combo: black hole, ramp, pad, mirrors, star, gas cloud | U R D L R L U TAP |
| 2-6 | Singularity | combo: ride a platform into a diagonal mirror past a star, under a cloud | R L U R D, ride, R |

Moving platforms are deterministic (period 4 s), and the solver samples their phase every 0.25 s. Each platform launch window is about 0.75 s per cycle.

## Controls
- **Phone:** swipe (fires as soon as your finger has moved 22 CSS px; the longer axis wins). **Tap** = launch-pad kick. The round arrow (top right) restarts the level.
- **Desktop:** arrow keys / WASD to move, **Space / Enter** to kick off a pad, **R** to restart.
- A swipe made mid-flight is remembered for 0.22 s and runs as soon as you land.

## Movement rules (as implemented in `src/sim.js`)
1. The orb always sits in a tile next to at least one wall. A swipe is **legal only if it runs parallel to a wall face the orb is touching** (wall above/below -> left/right; wall left/right -> up/down; an inner corner allows both axes).
2. Swiping **into** a wall or **away** from it (with no parallel wall) is rejected. The orb wiggles and tints pink instead of moving.
3. A legal swipe launches the orb with a quick ease-in (260 -> 960 px/s, about 0.1 s). It slides along the wall, and **if the wall ends it keeps flying straight** (ice-slide style) until something blocks it head-on. Then it sticks to that wall, with a squash, sparks, a shock ring and a little screen shake.
4. **Ramps (violet, 45 degrees):** flying into the slanted face mirrors the flight 90 degrees and it keeps going. You can't stick to the slanted face. The two flat back sides act like normal walls.
5. **Launch pads (pink, pulsing, with chevrons):** while stuck to one, a **TAP / Space** shoots the orb straight away from the pad (perpendicular to it, at a faster 620 px/s start). Normal swipes along the pad still work.
6. **Black holes:** only pull while you're flying (strength 3e7, range 3.6 tiles, fading to 0 at the edge). Gravity changes your **direction, not your speed**. If a path passes 1 lane from the core it gets slung around, 2 lanes bends it noticeably, and 3 lanes barely bends it. Coming within 0.42 tiles means you're **swallowed**: the orb spirals in and implodes, then respawns at the **last wall it was stuck to**. A stuck orb is always safe.
   A curved flight that hits a wall at a shallow angle grazes and slides along it. When it lands, it snaps to the nearest free tile next to the wall it hit, so you're always back on the grid.
7. Passing over the **exit portal** (green) clears the level, even mid-flight. Shards (gold) are optional pickups. A flight that never lands within 5 s counts as lost and respawns you.

The simulation runs in fixed 600 Hz sub-steps, so the game and the Node solver produce identical paths.

## Chapter 1: Awakening (`src/chapters.json`, checked by `node src/solve.js`)
| # | Name | Teaches | Par solution |
|---|------|---------|-------------|
| 1 | First Light | sliding, flying off the end of a wall, rejected moves | U R U |
| 2 | Angles | ramps (two mirrors chain into an exit pocket) | L D |
| 3 | Kick | launch pad (start on a floor pad, exit hovers above) | TAP (long way: L U R D) |
| 4 | Event Horizon | black hole: straight lines through it kill, a 1-lane pass slings you into the exit | D R D L |
| 5 | Phantom Run | combo: ramp, then the hole slings you onto a wall pad, then kick into the exit | R U L U R D TAP |

The solver BFS-es every resting spot with the real sim. It reports the shortest solution, dead-end spots (none in any level), reachable shards and deaths.
Level 5 was found by `src/gen_combo.js`, a random search. It only keeps layouts where the pad, a ramp and the black-hole bend are all **required**.

## How it's built
- `src/gen_art.py`: all art, made procedurally with PIL + numpy at 2x and shown at 0.5 scale. Neon tube walls with layered blurred glow, wall bodies with hatching, magenta pads, violet ramps, black hole (accretion disk, spiral arms, dashed range ring, dark core), portal rings, shards, orb, halo, trail, sparks, the Monoton title and the restart icon.
- `src/build_project.py`: writes `project/game.json` with objects, layers and effects, plus one JavaScript event that contains `sim.js` and `game_logic.js`.
  - Layers: `Bg` (grid tile, nebula, drifting motes, plus a **BulgePinch** "Lens" effect that bends the grid around a black hole), base (walls/orb/etc., **AdvancedBloom**), `UI` (AdvancedBloom).
  - Glow sprites use additive blending.
- `src/game_logic.js`: input, level loading, juice (trail, squash and stretch, sparks, shake, flashes), the camera fitting the level in portrait or landscape, render resolution (capped about 2.2 MP) and the HUD.
- `src/rebuild.sh [--art]`: checks levels, regenerates, exports to `html5/` (gdexporter v5.6.285) and runs `patch_html.py` (touch-action none, no overscroll or zoom, favicon).
- `src/lib.js` (shared: progress, buttons, particles, transitions), `src/menu_logic.js`, `src/select_logic.js`.
- Tests: `src/test_flow.js <url> desktop|phone|landscape <outdir>` covers menu -> select -> chapters -> locks -> playing Abyss levels -> saving -> `?unlock`. `src/test_e2e.js` plays all 5 Awakening levels in headless Chrome, using keyboard on desktop and touch swipes/taps on phone, and checks every rule. Also `src/make_gif.js` + `src/make_gif.py`.
- Fonts: Monoton (title, baked into PNGs) and Rajdhani Bold (UI), both SIL Open Font License (Google Fonts).

## Tuning
The top of `src/sim.js` has the speeds (`V0`, `VMAX`, `ACC`, `PAD_V0`), black-hole `G`, `G_RANGE`, `KILL`, and the pickup radii.
If you change gravity, run `node src/solve.js` to re-check that levels 4 and 5 are still solvable.
