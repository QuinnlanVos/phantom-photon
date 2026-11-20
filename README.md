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
- **3 · Solar Winds:** solar winds, curved boost walls, gravity wells and stardust, with a follow camera on big levels.
- **4 · Rocks from Space:** a pitch-dark starfield with drifting asteroids, spinning rings of space dust and timed cosmic hail. Use `?unlock&select&ch=4` to jump to it, or `?ch=4&level=N` for a level.
- **5 · Song of Rainbows:** a cheerful pastel sky. Touch a rainbow while moving along it and you snap on, ride it to the end and launch off tangentially. Prisms tint your light, and coloured glass gates only let the matching colour through. Rain clouds burst when you fly through them, and the rain reveals hidden rainbows. Use `?unlock&select&ch=5` to jump to it, or `?ch=5&level=N` for a level.
- **6 · Frozen Light:** an ice world under an aurora. Fly past a lantern to light it and melt its matching ice. Sunlight shining through the ice makes the photon big, and big light smashes glaciers; waterfalls make it small, and only small light slips through cracks. Use `?unlock&select&ch=6` to jump to it, or `?ch=6&level=N` for a level.

- **Longer levels and grand finales:** chapters 2-6 each end with three new long, multi-section levels that scroll with a follow camera. The last level of each chapter is a **grand finale**, marked with a crown and a FINALE badge on level select.
  - In a finale you get exactly 3 lives, shown as photons under the level name. A death costs one life and you respawn where you last rested.
  - Lose all three and the OUT OF LIGHT panel offers RETRY (a fresh run with 3 lives) or LEVELS. Normal levels keep unlimited retries.
  - Song of Rainbows adds friendly storm lightning: a lane darkens and sparkles, then bolts strike it. Cross while the sky is calm.
  - Frozen Light adds falling icicles: they shiver on the ceiling, then drop down their lane.

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
