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

  // ---------------- Area 0: quick tutorial ----------------
  checkpoint();
  hint('A / D = move left / right');
  full(14);
  make(10, (l) => !(side(l) === 0 && l % LPS < 2));
  full(6);
  hint('W or SPACE = JUMP!');
  full(10);
  make(3, () => false);
  full(10);
  hint('Lily pads = SPEED BOOST!');
  full(6);
  make(14, (l) => (side(l) === 0 ? (l % LPS === 1 || l % LPS === 2 ? PAD : TILE) : TILE));
  full(6);
  hint('Cracked tiles crumble! Keep moving!');
  full(8);
  make(16, (l) => (side(l) === 0 ? CRACKED : TILE));
  full(6);
  hint('Run onto the WALL. The tunnel turns with you!');
  full(8);
  make(20, (l) => side(l) !== 0);
  full(8);

  // ---------------- Area 1: holes, cracks and lily pads ----------------
  checkpoint();
  mixedChunks(7, 1);

  // ---------------- Area 2: WIND ----------------
  checkpoint();
  hint('WIND ahead! Lean against it!');
  full(14);
  windZone(+1, () => holes(34, 0.18));
  full(8);
  windZone(-1, () => narrowPath(1));
  full(8);
  windZone(+1, () => { jumpGap(3); stepping(1); });
  full(8);

  // ---------------- Area 3: BOSS FIGHT ----------------
  checkpoint();
  const bossStart = rows.length;
  hint('BOSS FIGHT! Dodge the bullets and the lasers!');
  full(16);
  holes(30, 0.14);
  full(6);
  make(20, (l) => (side(l) === 2 ? false : rand() > 0.12));
  full(6);
  holes(30, 0.16);
  full(6);
  crackedPatch(14);
  full(6);
  holes(26, 0.18);
  const bossEnd = rows.length;
  hint('You caught up to the UFO!');
  full(46);

  return { rows, checkpoints, hints, winds, bossStart, bossEnd, finishRow: rows.length - 34 };

  // ---- building blocks ----

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

  function narrowPath(difficulty) {
    let centre = Math.floor(rand() * LANES);
    const width = 1;
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
