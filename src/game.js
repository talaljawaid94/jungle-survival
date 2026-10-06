// Shared game singleton so modules can talk without circular imports.
export const G = {
  state: 'menu',      // menu | intro | play | dead
  time: 15.5,         // hours (0-24)
  day: 1,
  modal: null,        // 'inventory' | 'craft' | 'map' | null
  paused: false,
  muted: false,
};
export const DAY_SECONDS = 600; // real seconds for 24 in-game hours
