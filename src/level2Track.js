// The Level 2 space tunnel.
//
// The tunnel is a square tube with 4 sides. Each side has 5 lanes, so there are 20 lanes all the way around.
// Lanes 0-4 = floor, 5-9 = right wall, 10-14 = ceiling, 15-19 = left wall (at the start).
// The level is a long list of "rows". Each row says which of the 20 lanes has a tile (1) or a hole (0).

export const SIDES = 4;
export const LANES_PER_SIDE = 5;
export const LANES = SIDES * LANES_PER_SIDE;

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
  const rand = seededRandom(2026);
  const side = (lane) => Math.floor(lane / LANES_PER_SIDE);
  const ringDist = (a, b) => { const d = Math.abs(a - b) % LANES; return Math.min(d, LANES - d); };

  const make = (count, hasTile) => {
    for (let i = 0; i < count; i++) {
      const row = [];
      for (let l = 0; l < LANES; l++) row.push(hasTile(l, i) ? 1 : 0);
      rows.push(row);
    }
  };
  const full = (n) => make(n, () => true);
  const hint = (text) => hints.push({ row: rows.length, text });
  const checkpoint = () => { checkpoints.push(rows.length); full(12); };

  // ---------------- Area 0: tutorial ----------------
  checkpoint();
  hint('Crumb runs by himself!  A / D = move left / right');
  full(40);
  hint('Dodge the holes with A / D');
  make(14, (l) => !(side(l) === 0 && l % 5 < 3));
  full(14);
  make(14, (l) => !(side(l) === 0 && l % 5 >= 2));
  full(20);
  hint('W or SPACE = JUMP!');
  full(16);
  make(3, () => false);
  full(18);
  make(4, () => false);
  full(20);
  hint('Big hole? Run off the edge onto the WALL. The tunnel turns with you!');
  full(24);
  make(34, (l) => side(l) !== 0);
  full(16);
  hint('Now try a different side!');
  full(16);
  make(34, (l) => side(l) === 2 || side(l) === 3);
  full(16);
  hint('S = drop down faster while jumping');
  full(10);
  holes(30, 0.12);
  full(16);

  // ---------------- Areas 1-4: harder and harder ----------------
  checkpoint(); area(10, 0);
  checkpoint(); area(12, 1);
  checkpoint(); area(14, 2);
  checkpoint(); area(16, 3);
  hint('The UFO is right there! Keep going!');
  full(70);

  return { rows, checkpoints, hints, finishRow: rows.length - 40 };

  // ---- building blocks for the areas ----

  function area(chunks, difficulty) {
    for (let c = 0; c < chunks; c++) {
      const pick = rand();
      if (pick < 0.22) jumpGap(difficulty);
      else if (pick < 0.44) missingSides(difficulty);
      else if (pick < 0.66) holes(24 + difficulty * 4, 0.1 + difficulty * 0.03);
      else if (pick < 0.84) narrowPath(difficulty);
      else stepping(difficulty);
      full(8 - Math.min(difficulty, 2) * 2); // a little breather after each chunk
    }
  }

  // the whole ring is missing: you have to jump
  function jumpGap(difficulty) {
    const len = 2 + Math.floor(rand() * Math.min(3, 1 + difficulty));
    make(len, () => false);
    full(6);
    if (difficulty >= 2 && rand() < 0.5) { make(len, () => false); full(6); }
  }

  // one or two whole sides are gone: switch to a wall
  function missingSides(difficulty) {
    const gone = new Set([Math.floor(rand() * SIDES)]);
    if (difficulty >= 1 && rand() < 0.6) gone.add((Math.floor(rand() * SIDES) + 1) % SIDES);
    if (gone.size === SIDES) gone.delete(0);
    make(22 + Math.floor(rand() * 18), (l) => !gone.has(side(l)));
  }

  // random scattered holes
  function holes(count, density) {
    make(count, () => rand() > density);
  }

  // the tunnel closes in to a thin path that wiggles around
  function narrowPath(difficulty) {
    let centre = Math.floor(rand() * LANES);
    const width = difficulty >= 3 ? 1 : 2;
    const len = 30 + difficulty * 6;
    const closeIn = 22;
    for (let i = 0; i < closeIn + len; i++) {
      const radius = i < closeIn ? width + (LANES / 2) * (1 - i / closeIn) : width;
      if (i >= closeIn && i % 5 === 0) centre = (centre + (rand() < 0.5 ? -1 : 1) + LANES) % LANES;
      make(1, (l) => ringDist(l, centre) <= radius);
    }
    // open back up
    for (let i = 0; i < 8; i++) make(1, (l) => ringDist(l, centre) <= width + i * 2);
  }

  // stripes of tiles with gaps between them: hop hop hop
  function stepping(difficulty) {
    const hops = 3 + difficulty;
    for (let i = 0; i < hops; i++) {
      full(6); // long enough to land, then pick your moment to jump again
      make(2 + (difficulty >= 2 ? 1 : 0), () => false);
    }
    full(4);
  }
}
