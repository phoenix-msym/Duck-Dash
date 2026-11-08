// The Level 2 space tunnel.
//
// The tunnel is a square tube with 4 sides. Each side has 4 lanes, so there are 16 lanes all the way around.
// Lanes 0-3 = floor, 4-7 = right wall, 8-11 = ceiling, 12-15 = left wall (at the start).
// The level is a list of "rows". Each row says what is in each of the 16 lanes:
//   0 = hole   1 = normal tile   2 = lily pad (speed boost)   3 = cracked tile (crumbles when you step on it)

export const SIDES = 4;
export const LANES_PER_SIDE = 4;
export const LANES = SIDES * LANES_PER_SIDE;
export const HOLE = 0, TILE = 1, PAD = 2, CRACKED = 3;

// A random number generator that always gives the same numbers, so the level is the same every time.
function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildLevel2() {
  const rows = [];
  const checkpoints = []; // row numbers
  const hints = [];       // {row, text}
  const winds = [];       // {start, end, dir}  dir: +1 pushes right, -1 pushes left
  const rockZones = [];   // {start, end}  asteroids come flying down the tunnel here
  const crumbs = [];      // {z, lane, h}  bread crumbs floating in the tunnel
  const rand = seededRandom(7);
  const LPS = LANES_PER_SIDE;
  const side = (lane) => Math.floor(lane / LPS);
  const ringDist = (a, b) => { const d = Math.abs(a - b) % LANES; return Math.min(d, LANES - d); };

  // make(count, fn): fn(lane, i) returns what goes in that lane (true = tile, false = hole, or a number)
  const make = (count, fn) => {
    for (let i = 0; i < count; i++) {
      const row = [];
      for (let l = 0; l < LANES; l++) {
        const v = fn(l, i);
        row.push(v === true ? TILE : v === false ? HOLE : v);
      }
      rows.push(row);
    }
  };
  const full = (n) => make(n, () => true);
  const hint = (text) => hints.push({ row: rows.length, text });
  const checkpoint = () => { checkpoints.push(rows.length); full(10); };

  // Five short sections for the demo, each with its own obstacle.

  // A safe stretch with a few lily pads scattered around (used between obstacles, never right before a jump).
  const rest = (n) => make(n, (l, i) => (i > 1 && i < n - 4 && rand() < 0.03 ? PAD : TILE));

  // ---------------- Section 1: the basics ----------------
  checkpoint();
  hint('A / D = move.  Grab the bread crumbs!');
  crumbTrail(2, 5, 1, 0.5);
  rest(16);
  make(10, (l) => !(side(l) === 0 && l % LPS < 2));
  full(12);
  hint('W or SPACE = JUMP!');
  full(8);
  crumbTrail(1, 3, 1, 1.3); // floating over the gap: jump to get them
  make(3, () => false);
  rest(14);
  hint('Run onto the WALL. The tunnel turns with you!');
  full(8);
  crumbTrail(6, 4, 5, 0.5); // a trail leading onto the right wall
  make(18, (l) => side(l) !== 0);
  rest(12);

  // ---------------- Section 2: holes, cracks and lily pads ----------------
  checkpoint();
  hint('Lily pads = SPEED BOOST!  Cracked tiles crumble!');
  full(6);
  make(10, (l) => (side(l) === 0 ? (l % LPS === 1 || l % LPS === 2 ? PAD : TILE) : TILE));
  full(8);
  crumbTrail(0, 4, 2, 0.5);
  crackedPatch(12);
  rest(14);
  holes(16, 0.12);
  full(12); // (no lily pads right before jumps: the boost would make you overshoot)
  crumbTrail(2, 4, 13, 0.5);
  jumpGap(1);
  rest(14);
  stepping(0);
  rest(10);

  // ---------------- Section 3: WALL RUN ----------------
  checkpoint();
  hint('Whole sides are missing! Run onto another wall!');
  rest(14);
  crumbTrail(4, 6, 9, 0.5);
  make(20, (l) => side(l) !== 0);
  rest(14);
  make(20, (l) => side(l) === 0 || side(l) === 2);
  rest(14);
  holes(14, 0.05); // only a few holes: this part is played with a joystick!
  rest(12);

  // ---------------- Section 4: WIND ----------------
  checkpoint();
  hint('WIND ahead! Lean against it!');
  rest(14);
  windZone(+1, () => { crumbTrail(4, 5, 0, 0.5); holes(22, 0.04); }); // very few holes while the wind pushes you
  rest(14);
  windZone(-1, () => narrowPath(0, 3)); // a wide path (7 lanes) instead of a thin one
  rest(14);
  windZone(+1, () => { full(6); jumpGap(1); full(8); });
  rest(10);

  // ---------------- Section 5: the UFO fights back! ----------------
  checkpoint();
  const bossStart = rows.length;
  hint('BOSS FIGHT! Dodge the blasts and the lasers!');
  // (kept easy on purpose: you're dodging the UFO's shots with a gyro at the same time)
  rest(16);
  crumbTrail(2, 5, 3, 0.5);
  holes(18, 0.04);
  rest(18);
  crumbTrail(0, 4, 10, 0.5);
  holes(16, 0.04);
  rest(18);
  const bossEnd = rows.length;
  hint('You caught up to the UFO!');
  full(46);

  return { rows, checkpoints, hints, winds, rockZones, crumbs, bossStart, bossEnd, finishRow: rows.length - 34 };

  // ---- building blocks ----

  // n bread crumbs in a line down one lane, starting "ahead" rows from here, every 2 rows, at height h
  function crumbTrail(ahead, n, lane, h) {
    for (let i = 0; i < n; i++) crumbs.push({ z: rows.length + ahead + i * 2 + 0.5, lane, h });
  }

  function windZone(dir, build) {
    const start = rows.length;
    build();
    winds.push({ start, end: rows.length, dir });
  }

  function mixedChunks(chunks, difficulty) {
    for (let c = 0; c < chunks; c++) {
      const pick = rand();
      if (pick < 0.2) jumpGap(difficulty);
      else if (pick < 0.4) missingSides(difficulty);
      else if (pick < 0.6) holes(22, 0.18 + difficulty * 0.03);
      else if (pick < 0.75) crackedPatch(14);
      else if (pick < 0.88) narrowPath(difficulty);
      else stepping(difficulty);
      // a few lily pads scattered in the breather
      make(5, () => (rand() < 0.12 ? PAD : TILE));
    }
  }

  function jumpGap(difficulty) {
    const len = 2 + Math.floor(rand() * Math.min(3, 1 + difficulty));
    make(len, () => false);
    full(5);
  }

  function missingSides(difficulty) {
    const gone = new Set([Math.floor(rand() * SIDES)]);
    if (difficulty >= 1 && rand() < 0.6) gone.add((Math.floor(rand() * SIDES) + 1) % SIDES);
    if (gone.size === SIDES) gone.delete(0);
    make(16 + Math.floor(rand() * 10), (l) => !gone.has(side(l)) && rand() > 0.06);
  }

  function holes(count, density) {
    make(count, () => rand() > density);
  }

  // a patch where most tiles are cracked: they start falling the moment you touch them
  function crackedPatch(count) {
    make(count, () => (rand() < 0.7 ? CRACKED : rand() < 0.15 ? false : TILE));
  }

  // width = how many lanes on each side of the middle stay open (1 = a 3-lane path)
  function narrowPath(difficulty, width = 1) {
    let centre = Math.floor(rand() * LANES);
    const len = 22 + difficulty * 4;
    const closeIn = 14;
    for (let i = 0; i < closeIn + len; i++) {
      const radius = i < closeIn ? width + (LANES / 2) * (1 - i / closeIn) : width;
      if (i >= closeIn && i % 5 === 0) centre = (centre + (rand() < 0.5 ? -1 : 1) + LANES) % LANES;
      make(1, (l) => ringDist(l, centre) <= radius);
    }
    for (let i = 0; i < 6; i++) make(1, (l) => ringDist(l, centre) <= width + i * 2);
  }

  function stepping(difficulty) {
    const hops = 3 + difficulty;
    for (let i = 0; i < hops; i++) {
      full(6);
      make(2 + (difficulty >= 2 ? 1 : 0), () => false);
    }
    full(4);
  }
}
