# Phantom Photon

A neon wall-sliding puzzle game made in GDevelop.

**Play:** https://quinnlanvos.github.io/phantom-photon/

You play a photon of light that can only move along walls. Swipe along a wall to slide along it. When the wall ends you keep flying until you hit the next one.

## Chapters
- **1 · Awakening** (tutorial): sliding, violet ramps, pink launch pads, black holes.
- **2 · The Abyss** (dark): your light and its lingering trail show the way.
  - It adds mirrors, moving platforms, burning stars and light-swallowing gas clouds, one at a time, then combines them.
  - It unlocks when you finish Awakening. Add `?unlock` to the URL to unlock everything for testing.
  - Add `?lite` to the URL to turn off glow, lens and darkness effects on weak devices (also automatic when WebGL is unavailable).

Progress is saved in your browser (localStorage).

## Controls
- **Phone:** swipe to move. Tap to launch off a pink pad. On-screen back and restart buttons.
- **Desktop:** arrow keys or WASD to move. Space or Enter to launch. R restarts. Esc goes back. Mouse drag also works.
- **Menu and level select:** tap or click. Swipe or use the arrows to change chapters. Arrow keys and Enter work too.

## Source
- `project/` holds the GDevelop 5 project (open `project/game.json`). It has the scenes Menu, LevelSelect and Game.
- `src/` holds the generators, the movement sim, the level solver and the headless tests (see `src/DEV-NOTES.md`).
- The repo root is the exported HTML5 build.

Fonts: Monoton and Rajdhani, both under the SIL Open Font License (see FONTS-OFL.txt).
