// Custom line-icon set: 24x24 grid, 1.6 px rounded strokes, inherits colour via currentColor.
const I = {
  heart: '<path d="M12 20s-7.500-4.600-7.500-10.300A4.300 4.300 0 0 1 12 7.100a4.300 4.300 0 0 1 7.500 2.600C19.500 15.400 12 20 12 20z"/>',
  food: '<path d="M15.500 3.500a4.700 4.700 0 1 1-1.300 9.200l-5.500 5.600a1.800 1.800 0 1 1-2.600-2.600l5.600-5.500a4.700 4.700 0 0 1 3.800-6.700z"/>',
  drop: '<path d="M12 3.500s6.200 6.300 6.200 10.600a6.200 6.200 0 0 1-12.400 0C5.800 9.800 12 3.500 12 3.500z"/><path d="M9 14.500a3 3 0 0 0 2.500 2.800"/>',
  bolt: '<path d="M13.500 3L6 13.500h5.200L10.500 21 18 10.500h-5.200L13.500 3z"/>',
  first_aid: '<rect x="3.500" y="7" width="17" height="12.500" rx="2.500"/><path d="M9 7V5.800A1.800 1.800 0 0 1 10.800 4h2.400A1.800 1.800 0 0 1 15 5.800V7M12 10.500v5M9.500 13h5"/>',
  bandage: '<rect x="2.800" y="8.800" width="18.400" height="6.400" rx="3.200" transform="rotate(-38 12 12)"/><path d="M10.200 10.600l3.200 3.200M12.400 8.800l3.200 3.200"/>',
  bottle_empty: '<path d="M10 3h4v3.200l1.800 2.300c.4.500.6 1.100.6 1.800V19a2 2 0 0 1-2 2h-4.800a2 2 0 0 1-2-2v-8.700c0-.7.200-1.300.6-1.800L10 6.200V3z"/><path d="M8 13h8"/>',
  water_clean: '<path d="M12 3.500s6.200 6.300 6.200 10.600a6.200 6.200 0 0 1-12.400 0C5.800 9.800 12 3.500 12 3.500z"/><path d="M12 11v4M10 13h4"/>',
  water_dirty: '<path d="M12 3.500s6.200 6.300 6.200 10.600a6.200 6.200 0 0 1-12.400 0C5.800 9.800 12 3.500 12 3.500z"/><circle cx="10.500" cy="14" r=".8"/><circle cx="13.600" cy="12.300" r=".8"/><circle cx="13.300" cy="16" r=".8"/>',
  canned_food: '<path d="M6 7.500c0-1.400 2.700-2.500 6-2.500s6 1.100 6 2.500v9c0 1.400-2.700 2.500-6 2.500s-6-1.100-6-2.500v-9z"/><path d="M6 7.500C6 8.900 8.700 10 12 10s6-1.100 6-2.500M6 14c0 1.400 2.700 2.500 6 2.500s6-1.100 6-2.500"/>',
  coconut: '<circle cx="12" cy="13" r="7.500"/><circle cx="9.800" cy="11" r=".9"/><circle cx="14.200" cy="11" r=".9"/><circle cx="12" cy="14.300" r=".9"/><path d="M12 5.500V3.500"/>',
  fruit: '<path d="M4.500 16.500c6.500 2.500 13.500-1 14.500-10l-2.300.8c-1.500 4.800-5.500 7-10.200 6.400L4.500 16.500z"/><path d="M19 6.500l1.200-1.700"/>',
  berries: '<circle cx="8.800" cy="14.500" r="3.400"/><circle cx="15.600" cy="14.800" r="3.400"/><circle cx="12.200" cy="9" r="3.400"/><path d="M12.200 5.600V3.500M12.200 3.500c1.600 0 2.600.7 3.200 1.600"/>',
  raw_meat: '<path d="M5.800 8.500c1.500-2.700 5.700-3.800 8.800-2.500 3.300 1.400 5.100 4.600 4.200 7.900-1 3.500-4.800 5.500-8.400 5C7 18.200 3.800 13.600 5.800 8.500z"/><circle cx="14" cy="11.500" r="2.100"/>',
  cooked_meat: '<path d="M5.800 8.500c1.500-2.700 5.700-3.800 8.800-2.500 3.300 1.400 5.100 4.600 4.200 7.900-1 3.500-4.800 5.500-8.400 5C7 18.200 3.800 13.600 5.800 8.500z"/><path d="M9 9.500l4 4M11.500 8l4 4M7.500 12l3 3"/>',
  raw_fish: '<path d="M3 12c3-4.200 7-5.700 11-4l4.500-2.500V18.500L14 16c-4 1.700-8 .2-11-4z"/><circle cx="8.300" cy="11" r=".8"/>',
  cooked_fish: '<path d="M3 12c3-4.200 7-5.700 11-4l4.500-2.500V18.500L14 16c-4 1.700-8 .2-11-4z"/><path d="M10 9.500v5M12.600 9v6"/>',
  knife: '<path d="M4.500 19.500l3.200-1 11.500-11.500a1.900 1.900 0 0 0-2.700-2.700L5 15.800l-.5 3.700z"/><path d="M13.500 8.200l2.300 2.300"/>',
  stone_axe: '<path d="M5 19.500l11-11"/><path d="M13.200 5.200c2.700-1.700 5.300-1.200 6.600.2-.6 3-2.900 5.900-6 7l-3.700-3.800"/>',
  spear: '<path d="M3.800 20.200L17 7"/><path d="M15.500 4.800l4-.8.700 4-2.200 1.700-2.500-2.800z"/>',
  torch: '<path d="M9.500 21l1.400-8.500h2.200l1.400 8.500z"/><path d="M12 11.500c-3.500-2.700-3-6.300 0-8.800 3 2.500 3.500 6.100 0 8.800z"/>',
  flare: '<rect x="8.800" y="9.500" width="6.400" height="11.500" rx="1"/><path d="M12 9.500V6.500M8.500 4.200l1.600 2.200M15.500 4.200l-1.600 2.200M12 2v2.500"/>',
  stick: '<path d="M4.500 19.500L19.500 4.500"/><path d="M11.500 12.500l4.500.8M8.500 15.500l-3.500-.6"/>',
  log: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.500"/><circle cx="12" cy="12" r="1.200"/>',
  stone: '<path d="M3.800 15.500l3-6.500 5.200-3.200 6.200 3.200 2 6.500-4 3.500H7.800l-4-3.500z"/><path d="M6.800 9l5.200 3.200L18.200 9M12 12.200v6.500"/>',
  fiber: '<path d="M4.500 7.500c3.500-2 11.500-2 15 0M4.500 12c3.500-2 11.500-2 15 0M4.500 16.500c3.500-2 11.500-2 15 0"/><path d="M4.500 7.500v9M19.500 7.500v9"/>',
  campfire: '<path d="M12 3c1.200 3.200-2.700 4.300-2.700 7.500a2.700 2.700 0 0 0 5.400 0c0-1-.5-1.900-1.100-2.700 2.200 1.100 3.900 3.200 3.900 5.900a5.500 5.500 0 0 1-11 0C6.500 8 11 6.500 12 3z"/><path d="M4 20.500l16-3M4 17.500l16 3"/>',
  shelter: '<path d="M2.800 20.500L12 4.500l9.200 16H2.800z"/><path d="M12 20.500l-3.200-6.500h6.400L12 20.500z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2.500M12 18.500V21M3 12h2.500M18.500 12H21M5.600 5.600l1.800 1.800M16.600 16.600l1.800 1.800M5.600 18.400l1.800-1.800M16.600 7.400l1.800-1.800"/>',
  moon: '<path d="M19.500 14.500A8 8 0 0 1 9.500 4.500a8 8 0 1 0 10 10z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.500 8.500l-2 5-5 2 2-5 5-2z"/>',
  skull: '<path d="M12 3.500c-4.200 0-7 2.800-7 6.600 0 2.200 1 3.800 2.500 4.800V18h9v-3.100c1.500-1 2.500-2.600 2.500-4.800 0-3.800-2.800-6.600-7-6.600z"/><circle cx="9.200" cy="11" r="1.500"/><circle cx="14.800" cy="11" r="1.500"/><path d="M10.500 18v2.500M13.500 18v2.500"/>',
  hand: '<path d="M8 12V6.200a1.300 1.300 0 0 1 2.600 0V11M10.600 10.500V5a1.300 1.300 0 0 1 2.600 0v5.500M13.200 10.500V6a1.300 1.300 0 0 1 2.600 0v6M15.800 9.500a1.300 1.300 0 0 1 2.600 0V14a6 6 0 0 1-6 6h-.8a5.500 5.500 0 0 1-4.400-2.200L4.500 14.200a1.400 1.400 0 0 1 2.200-1.700L8 14"/>',
  sick: '<circle cx="12" cy="12" r="8.500"/><path d="M8.500 15.500c1-1.300 2.200-2 3.500-2s2.500.7 3.500 2M9 9.500l1.500.8M15 9.500l-1.500.8"/>',
  zzz: '<path d="M5 6.500h5L5 12.500h5M13 12.500h4l-4 5h4"/>',
  fist: '<path d="M7 11V8a1.500 1.500 0 0 1 3 0v1.500a1.500 1.500 0 0 1 3 0V10a1.500 1.500 0 0 1 3 0v1a1.500 1.500 0 0 1 2.500 1v3.500a5 5 0 0 1-5 5H11a4.500 4.500 0 0 1-4-2.500L5.500 13.500A1.300 1.300 0 0 1 7.500 12L9 13.500"/>',
  bag: '<path d="M6 8.500h12l1.200 11H4.800L6 8.500z"/><path d="M9 8.500V7a3 3 0 0 1 6 0v1.500M8.500 12.500h7"/>',
  hammer: '<path d="M4 20l9-9M11.500 5.500l3-2 5 5-2 3-3-.5-3-3z"/>',
  map: '<path d="M3.500 6.500l5-2 7 2.500 5-2v13l-5 2-7-2.500-5 2v-13z"/><path d="M8.500 4.500v13M15.500 7v13"/>',
  speaker: '<path d="M4 9.500h3.500L12 5.500v13l-4.500-4H4v-5z"/><path d="M15.500 9a4 4 0 0 1 0 6M18 6.500a7.500 7.500 0 0 1 0 11"/>',
  speaker_off: '<path d="M4 9.500h3.500L12 5.500v13l-4.500-4H4v-5z"/><path d="M16 9.500l5 5M21 9.500l-5 5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.200M12 18.800V21M3 12h2.200M18.800 12H21M5.600 5.600l1.600 1.600M16.800 16.800l1.600 1.600M5.600 18.400l1.600-1.600M16.800 7.200l1.600-1.600"/>',
  check: '<path d="M5 12.500l4.500 4.500L19 7.500"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  drop_item: '<path d="M12 4v10M8 10.500l4 4 4-4M5 19.500h14"/>',
  arrow_up: '<path d="M12 19V6M6.500 11.500L12 6l5.500 5.500"/>',
};

// Drop PNG/SVG/WebP files named after the icon id (e.g. campfire.png) into src/assets/icons and they replace the line icons.
const FILES = {};
const found = import.meta.glob('./assets/icons/*.{png,svg,webp}', { eager: true, query: '?url', import: 'default' });
// Flaticon filenames (Survival Dazzle pack) -> game icon ids, so files can be dropped in exactly as downloaded.
const ALIAS = {
  'first-aid': 'first_aid', 'water-bottle': 'bottle_empty', 'water': 'water_clean', 'water-filter': 'water_dirty', 'ration': 'canned_food',
  'knife': 'knife', 'multitool': 'knife', 'hand-axe': 'stone_axe', 'log': 'log', 'rope': 'fiber', 'distress-signal': 'flare', 'bonfire': 'campfire', 'building-fire': 'campfire',
  'tent': 'shelter', 'shelter': 'shelter', 'compass': 'compass', 'map': 'map', 'backpack': 'bag', 'survival-kit': 'first_aid', 'matches': 'torch', 'fishing': 'raw_fish',
  'gear': 'gear', 'warm': 'sun', 'hunting': 'raw_meat', 'plants': 'fruit', 'sleeping-bag': 'zzz', 'lost': 'skull',
};
const norm = (n) => n.toLowerCase().replace(/\s*\(\d+\)$/, '').replace(/_/g, '-').replace(/\s+/g, '-').replace(/^(\d+-)?/, '');
for (const [path, url] of Object.entries(found)) {
  const base = path.split('/').pop().replace(/\.(png|svg|webp)$/i, ''), key = norm(base);
  if (FILES[base] === undefined && !ALIAS[key]) FILES[base] = url;           // exact game id (e.g. campfire.png)
  if (ALIAS[key]) { if (FILES[ALIAS[key]] === undefined || key === ALIAS[key].replace(/_/g, '-')) FILES[ALIAS[key]] = url; }
}
export const CUSTOM_ICON_COUNT = Object.keys(FILES).length;

const EMOJI = {
  first_aid: '🧰', bandage: '🩹', bottle_empty: '🫙', water_clean: '💧', water_dirty: '🥤', canned_food: '🥫', coconut: '🥥', fruit: '🍌', berries: '🫐',
  raw_meat: '🥩', cooked_meat: '🍖', raw_fish: '🐟', cooked_fish: '🍣', knife: '🔪', stone_axe: '🪓', spear: '🔱', torch: '🔥', flare: '🧨',
  stick: '🥢', log: '🪵', stone: '🪨', fiber: '🧵', campfire: '🔥', shelter: '⛺', heart: '❤️', food: '🍖', drop: '💧', bolt: '⚡',
};
export function icon(name, size = 24, extra = '') {
  if (FILES[name]) return `<img class="ic ico ${extra}" src="${FILES[name]}" width="${size}" height="${size}" alt="" draggable="false">`;
  if (EMOJI[name]) return `<span class="ic emo ${extra}" style="font-size:${Math.round(size * 0.92)}px;width:${size}px;height:${size}px">${EMOJI[name]}</span>`;
  const body = I[name] || I.stone;
  return `<svg class="ic ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
export const ICON_NAMES = Object.keys(I);
