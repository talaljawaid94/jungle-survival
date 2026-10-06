# Jungle Survival (Three.js)

A helicopter crashes over a jungle island. You are the survivor: find supplies, water and shelter, hunt, craft, and live through the nights.

## Run
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Controls
| Key | Action |
|---|---|
| WASD / Mouse | Move / look |
| Shift, Space | Sprint, jump |
| E (hold) | Interact: pick up, chop, drink, open, butcher, cook |
| Click | Attack (spear also spears fish at the shoreline) |
| 1-9, F, Q | Select hotbar slot, use item, drop item |
| Tab / C / M | Backpack / crafting / map |
| Z | Sleep (needs a lit campfire or a shelter nearby) |
| K | Mute / unmute sound (also in Settings and the speaker button) |
| H | Show / hide control hints |
| Space (intro) | Skip the crash cinematic |

## What is in the game
- Procedural island (seeded), freshwater lakes and salt sea, ~1,600 trees, palms, fruit trees, bushes, rocks, grass
- Crash intro cinematic, wreck with smoke and supply crates
- Health, hunger, thirst, energy. Dirty water, raw meat and bad berries can make you sick
- Inventory (24 slots), crafting (bandage, torch, stone axe, spear, campfire, shelter)
- Day/night cycle (10 real minutes per day), stars, moon, fog, firelight
- Animals: rabbit, deer, boar, jaguar (hunts at night, fears fire and flares), ambient birds
- Fully synthesised audio (no files): day birds, night crickets/owls/frogs, waves, wind, footsteps per surface, fire, heartbeat, helicopter
- Minimap, fog-of-war map, objectives, autosave (localStorage), death and retry

## Look and feel (v0.2)
- Leaf-card foliage, bark, ferns and broad tropical leaves with soft canopy lighting and wind sway; sun-dappled forest floor
- Sky-based image lighting (PMREM), bloom and cinematic grading, depth-tinted water with shoreline foam
- Quality tiers in Settings: Low / High / Ultra, plus automatic dynamic resolution
- Redesigned UI: compass, vitals with damage trails, world-anchored interaction ring, item feed, drag-and-drop bag with detail card, crafting with progress, settings, menu, death screen
- Interaction feedback: wood chips, felling trees that fall and leave stumps, hit impacts, camera shake, water ripples/splashes, fireflies at night, damage direction arcs
- Hero rebuilt with blended pose animation (walk/run/limp/swim/crouch/attack per tool), head look-at, slope adaptation
- Animals rebuilt with fur, jointed legs, antlers/tusks/rosettes and gait animation

## Code map (`src/`)
`main.js` loop and state, `world.js` terrain/water/vegetation placement, `vegetation.js` + `textures.js` foliage/bark/rock geometry and painted textures, `sky.js` day/night + IBL, `post.js` bloom/grade, `hero.js` player character, `animalModels.js` animals, `effects.js` particles/ripples/falling trees,
`player.js` movement/camera, `gameplay.js` interactions/crafting/sleep/objectives, `animals.js` AI, `structures.js`,
`intro.js` + `helicopter.js`, `audio.js`, `ui.js` + `icons.js` + `style.css`, `map.js`, `items.js`, `stats.js`, `inventory.js`, `save.js`.

## Swapping in a better character
`createCharacter()` in `hero.js` returns `{ group, update(dt, state), setTool(name), attack(), tools }`.
Replace it with a GLB loaded via `GLTFLoader` + `AnimationMixer` that implements the same interface.

Debug: `window.game` exposes the systems; `game.advance(seconds)` steps the simulation manually.

## Deploying
- `npm run build` writes a static site to `dist/`; upload the whole folder to any static host (Netlify, GitHub Pages, S3, itch.io). Paths are relative, so sub-folders work.
- Serve with gzip or brotli: the models total about 14 MB (survivor.glb is 8.4 MB) and the JS bundle is about 240 KB gzipped.
- Debug handle `window.game` only exists in dev or with `?debug` in the URL.
- Saves live in the player's browser (`localStorage`, key `jungle-survival-save-v1`).
