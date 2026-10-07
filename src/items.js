// Item, food and recipe definitions.
export const ITEMS = {
  first_aid:    { name: 'First Aid Kit',       icon: '🧰', max: 3,  kind: 'med',  heal: 45, desc: 'Restores 45 health.' },
  bandage:      { name: 'Bandage',             icon: '🩹', max: 5,  kind: 'med',  heal: 18, desc: 'Restores 18 health.' },
  bottle_empty: { name: 'Empty Bottle',        icon: '🫙', max: 2,  kind: 'misc', desc: 'Fill it with fresh water at a lake.' },
  water_clean:  { name: 'Clean Water',         icon: '💧', max: 3,  kind: 'food', thirst: 45, returns: 'bottle_empty', desc: 'Safe to drink.' },
  water_dirty:  { name: 'Lake Water',          icon: '🥤', max: 3,  kind: 'food', thirst: 35, sick: 0.4, returns: 'bottle_empty', desc: 'Risky. Boil it at a campfire first.' },
  canned_food:  { name: 'Canned Food',         icon: '🥫', max: 5,  kind: 'food', hunger: 35, thirst: 3, desc: 'Emergency rations.' },
  coconut:      { name: 'Coconut',             icon: '🥥', max: 5,  kind: 'food', hunger: 8, thirst: 18, desc: 'Water and a little food.' },
  fruit:        { name: 'Jungle Fruit',        icon: '🍌', max: 8,  kind: 'food', hunger: 14, thirst: 5, desc: 'Sweet and filling.' },
  berries:      { name: 'Wild Berries',        icon: '🫐', max: 10, kind: 'food', hunger: 7, thirst: 3, sick: 0.1, desc: 'Mostly safe.' },
  raw_meat:     { name: 'Raw Meat',            icon: '🥩', max: 6,  kind: 'food', hunger: 14, sick: 0.45, desc: 'Cook it first.' },
  cooked_meat:  { name: 'Cooked Meat',         icon: '🍖', max: 6,  kind: 'food', hunger: 42, health: 5, desc: 'Hearty and safe.' },
  raw_fish:     { name: 'Raw Fish',            icon: '🐟', max: 6,  kind: 'food', hunger: 10, sick: 0.3, desc: 'Cook it first.' },
  cooked_fish:  { name: 'Cooked Fish',         icon: '🍣', max: 6,  kind: 'food', hunger: 30, health: 3, desc: 'Light and nourishing.' },
  knife:        { name: 'Survival Knife',      icon: '🔪', max: 1,  kind: 'tool', dmg: 18, chop: 0.45, reach: 2.0, desc: 'Cuts, butchers, and slowly chops.' },
  stone_axe:    { name: 'Stone Axe',           icon: '🪓', max: 1,  kind: 'tool', dmg: 28, chop: 1.0, reach: 2.2, desc: 'Chops trees fast.' },
  spear:        { name: 'Spear',               icon: '🔱', max: 1,  kind: 'tool', dmg: 36, chop: 0, reach: 3.2, fish: true, desc: 'Hunt and spear fish.' },
  torch:        { name: 'Torch',               icon: '🔥', max: 1,  kind: 'tool', dmg: 8, chop: 0, reach: 1.8, light: true, desc: 'Lights the way at night.' },
  flare:        { name: 'Flare',               icon: '🧨', max: 3,  kind: 'misc', desc: 'Press F to light. Scares predators.' },
  stick:        { name: 'Stick',               icon: '🥢', max: 20, kind: 'mat' },
  log:          { name: 'Log',                 icon: '🪵', max: 10, kind: 'mat' },
  stone:        { name: 'Stone',               icon: '🪨', max: 20, kind: 'mat' },
  fiber:        { name: 'Plant Fiber',         icon: '🧵', max: 20, kind: 'mat' },
};

export const CATS = { med: 'Medical', food: 'Food & Drink', tool: 'Tools', mat: 'Materials', misc: 'Supplies' };

export const RECIPES = [
  { id: 'bandage',   cat: 'Survival', out: { bandage: 1 },   needs: { fiber: 3 },                     time: 1.2, note: 'Heals 18', desc: 'Strips of plant fibre wound tight. Slows nothing, stops the bleeding, and buys you time.' },
  { id: 'torch',     cat: 'Survival', out: { torch: 1 },     needs: { stick: 1, fiber: 1 },           time: 1.2, note: 'Light source', desc: 'A fibre-wrapped branch. Lights your way at night and keeps predators at a distance while it burns.' },
  { id: 'stone_axe', cat: 'Tools',    out: { stone_axe: 1 }, needs: { stick: 1, stone: 2, fiber: 2 }, time: 2.0, note: 'Fells trees quickly', desc: 'A sharpened stone lashed to a handle. Chops trees far faster than a knife.' },
  { id: 'spear',     cat: 'Tools',    out: { spear: 1 },     needs: { stick: 2, stone: 1, fiber: 1 }, time: 2.0, note: 'Hunt and spear fish', desc: 'Long reach and a stone tip. Brings down deer and boar, and catches fish in the shallows.' },
  { id: 'campfire',  cat: 'Build',    place: 'campfire',      needs: { stick: 4, stone: 3 },           time: 2.4, note: 'Cook, boil, warmth, safe sleep', icon: 'campfire', name: 'Campfire', desc: 'Cook meat, boil lake water, keep predators away, and sleep safely nearby. Needs sticks to keep burning.' },
  { id: 'shelter',   cat: 'Build',    place: 'shelter',       needs: { stick: 8, fiber: 6 },           time: 3.2, note: 'Lean-to for safe sleep', icon: 'shelter', name: 'Lean-to Shelter', desc: 'A leaf-roofed lean-to. Sleep here for better rest than the open ground.' },
];

export const COOK = { raw_meat: 'cooked_meat', raw_fish: 'cooked_fish' };
