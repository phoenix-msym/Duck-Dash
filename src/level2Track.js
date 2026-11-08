// The Level 2 space tunnel.
//
// The tunnel is a square tube with 4 sides. Each side has 4 lanes, so there are 16 lanes all the way around.
// Lanes 0-3 = floor, 4-7 = right wall, 8-11 = ceiling, 12-15 = left wall (at the start).
// The level is a list of "rows". Each row says what is in each of the 16 lanes:
//   0 = hole   1 = normal tile   2 = lily pad (speed boost)   3 = cracked tile (crumbles when you step on it)
//
// Three tunnels are built from the same building blocks:
//   buildLevel2()      -> Story mode (5 sections)
//   buildLevel2Demo()  -> Demo mode (the same 5 sections, much shorter)
//   makeEndlessTrack() -> Endless mode (keeps growing and gets harder)

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

// All the building blocks for making tunnel rows.
function makeTunnelBuilder(seed) {
  const rows = [];
  const checkpoints = []; // row numbers
  const hints = [];       // {row, text}
  const winds = [];       // {start, end, dir}  dir: +1 pushes right, -1 pushes left
  const crumbs = [];      // {z, lane, h}  bread crumbs floating in the tunnel
  const rand = seededRandom(seed);
  const LPS = LANES_PER_SIDE;
  const side = (lane) => Math.floor(lane / LPS);
  const ringDist = (a, b) => { const d = Math.abs(a - b) % LANES; return Math.min(d, LANES - d); };

  const b = {
    rows, checkpoints, hints, winds, crumbs, rand, side,

    // make(count, fn): fn(lane, i) returns what goes in that lane (true = tile, false = hole, or a number)
    make(count, fn) {
      for (let i = 0; i < count; i++) {
        const row = [];
        for (let l = 0; l < LANES; l++) {
          const v = fn(l, i);
          row.push(v === true ? TILE : v === false ? HOLE : v);
        }
        rows.push(row);
      }
    },
    full(n) { b.make(n, () => true); },
    // a safe stretch with a few lily pads scattered around (never right before a jump)
    rest(n) { b.make(n, (l, i) => (i > 1 && i < n - 4 && rand() < 0.03 ? PAD : TILE)); },
    hint(text) { hints.push({ row: rows.length, text }); },
    checkpoint() { checkpoints.push(rows.length); b.full(10); },

    // n bread crumbs in a line down one lane, starting "ahead" rows from here, every 2 rows, at height h
    crumbTrail(ahead, n, lane, h) {
      for (let i = 0; i < n; i++) crumbs.push({ z: rows.length + ahead + i * 2 + 0.5, lane, h });
    },
    windZone(dir, build) {
      const start = rows.length;
      build();
      winds.push({ start, end: rows.length, dir });
    },
    jumpGap(difficulty) {
      const len = 2 + Math.floor(rand() * Math.min(3, 1 + difficulty));
      b.make(len, () => false);
      b.full(5);
    },
    missingSides(difficulty) {
      const gone = new Set([Math.floor(rand() * SIDES)]);
      if (difficulty >= 1 && rand() < 0.6) gone.add((Math.floor(rand() * SIDES) + 1) % SIDES);
      if (gone.size === SIDES) gone.delete(0);
      b.make(16 + Math.floor(rand() * 10), (l) => !gone.has(side(l)) && rand() > 0.06);
    },
    holes(count, density) { b.make(count, () => rand() > density); },
    // Two neighbouring sides of the tunnel are all cracked tiles; the other two sides are solid.
    // Step on the cracked ones and the path ahead collapses, so you have to switch to a solid side.
    crackedPatch(count) {
      const first = Math.floor(rand() * SIDES);
      const cracked = new Set([first, (first + 1) % SIDES]);
      b.make(count, (l) => (cracked.has(side(l)) ? CRACKED : TILE));
    },
    // width = how many lanes on each side of the middle stay open (1 = a 3-lane path)
    narrowPath(difficulty, width = 1) {
      let centre = Math.floor(rand() * LANES);
      const len = 22 + difficulty * 4;
      const closeIn = 14;
      for (let i = 0; i < closeIn + len; i++) {
        const radius = i < closeIn ? width + (LANES / 2) * (1 - i / closeIn) : width;
        if (i >= closeIn && i % 5 === 0) centre = (centre + (rand() < 0.5 ? -1 : 1) + LANES) % LANES;
        b.make(1, (l) => ringDist(l, centre) <= radius);
      }
      for (let i = 0; i < 6; i++) b.make(1, (l) => ringDist(l, centre) <= width + i * 2);
    },
    stepping(difficulty) {
      const hops = 3 + difficulty;
      for (let i = 0; i < hops; i++) {
        b.full(6);
        b.make(2 + (difficulty >= 2 ? 1 : 0), () => false);
      }
      b.full(4);
    },
  };
  return b;
}

// ============================================================ STORY MODE
export function buildLevel2() {
  const t = makeTunnelBuilder(7);
  const { side } = t;
  const LPS = LANES_PER_SIDE;

  // ---------------- Section 1: the basics ----------------
  t.checkpoint();
  t.hint('A / D = move.  Grab the bread crumbs!');
  t.crumbTrail(2, 5, 1, 0.5);
  t.rest(16);
  t.make(10, (l) => !(side(l) === 0 && l % LPS < 2));
  t.full(12);
  t.hint('W or SPACE = JUMP!');
  t.full(8);
  t.crumbTrail(1, 3, 1, 1.3); // floating over the gap: jump to get them
  t.make(3, () => false);
  t.rest(14);
  t.hint('Run onto the WALL. The tunnel turns with you!');
  t.full(8);
  t.crumbTrail(6, 4, 5, 0.5); // a trail leading onto the right wall
  t.make(18, (l) => side(l) !== 0);
  t.rest(12);

  // ---------------- Section 2: holes, cracks and lily pads ----------------
  t.checkpoint();
  t.hint('Lily pads = SPEED BOOST!  Cracked tiles collapse ahead: switch sides!');
  t.full(6);
  t.make(10, (l) => (side(l) === 0 ? (l % LPS === 1 || l % LPS === 2 ? PAD : TILE) : TILE));
  t.full(8);
  t.crumbTrail(0, 4, 2, 0.5);
  t.crackedPatch(12);
  t.rest(14);
  t.holes(16, 0.12);
  t.full(12); // (no lily pads right before jumps: the boost would make you overshoot)
  t.crumbTrail(2, 4, 13, 0.5);
  t.jumpGap(1);
  t.rest(14);
  t.stepping(0);
  t.rest(10);

  // ---------------- Section 3: WALL RUN ----------------
  t.checkpoint();
  t.hint('Whole sides are missing! Run onto another wall!');
  t.rest(14);
  t.crumbTrail(4, 6, 9, 0.5);
  t.make(20, (l) => side(l) !== 0);
  t.rest(14);
  t.make(20, (l) => side(l) === 0 || side(l) === 2);
  t.rest(14);
  t.holes(14, 0.05); // only a few holes: this part is played with a joystick!
  t.rest(12);

  // ---------------- Section 4: WIND ----------------
  t.checkpoint();
  t.hint('WIND ahead! Lean against it!');
  t.rest(14);
  t.windZone(+1, () => { t.crumbTrail(4, 5, 0, 0.5); t.holes(22, 0.04); }); // very few holes while the wind pushes you
  t.rest(14);
  t.windZone(-1, () => t.narrowPath(0, 3)); // a wide path (7 lanes) instead of a thin one
  t.rest(14);
  t.windZone(+1, () => { t.full(6); t.jumpGap(1); t.full(8); });
  t.rest(10);

  // ---------------- Section 5: the UFO fights back! ----------------
  t.checkpoint();
  const bossStart = t.rows.length;
  t.hint('BOSS FIGHT! Dodge the blasts and the lasers!');
  // (kept easy on purpose: you're dodging the UFO's shots with a gyro at the same time)
  t.rest(16);
  t.crumbTrail(2, 5, 3, 0.5);
  t.holes(18, 0.04);
  t.rest(18);
  t.crumbTrail(0, 4, 10, 0.5);
  t.holes(16, 0.04);
  t.rest(18);
  const bossEnd = t.rows.length;
  t.hint('You caught up to the UFO!');
  t.full(46);

  return finishTrack(t, bossStart, bossEnd);
}

// ============================================================ DEMO MODE
// The same 5 sections as Story mode, each one short, so everything can be shown off in about a minute.
export function buildLevel2Demo() {
  const t = makeTunnelBuilder(11);
  const { side } = t;
  const LPS = LANES_PER_SIDE;

  // (aims for about 25-30 seconds: every section of Story mode, each one short)
  t.checkpoint();
  t.hint('DEMO: A / D move, W / SPACE jump!');
  t.crumbTrail(2, 4, 1, 0.5);
  t.rest(12);
  t.make(3, () => false);  // a gap to jump
  t.rest(12);
  t.make(12, (l) => side(l) !== 0); // the floor disappears: run onto a wall
  t.full(6);

  t.checkpoint();
  t.hint('Lily pads boost you. Cracked tiles collapse: switch sides!');
  t.make(8, (l) => (side(l) === 0 ? (l % LPS === 1 || l % LPS === 2 ? PAD : TILE) : TILE));
  t.full(6);
  t.crumbTrail(0, 3, 2, 0.5);
  t.crackedPatch(10);
  t.rest(12);

  t.checkpoint();
  t.hint('WALL RUN: whole sides go missing!');
  t.full(5);
  t.make(14, (l) => side(l) === 0 || side(l) === 2);
  t.rest(12);

  t.checkpoint();
  t.hint('WIND! Lean against it!');
  t.full(5);
  t.windZone(+1, () => { t.crumbTrail(1, 4, 0, 0.5); t.holes(18, 0.03); });
  t.rest(12);

  t.checkpoint();
  const bossStart = t.rows.length;
  t.hint('BOSS: the UFO fights back! Dodge!');
  t.full(22);
  t.holes(12, 0.03);
  t.full(36);
  const bossEnd = t.rows.length;
  t.full(46);

  return finishTrack(t, bossStart, bossEnd);
}

function finishTrack(t, bossStart, bossEnd) {
  return {
    rows: t.rows, checkpoints: t.checkpoints, hints: t.hints, winds: t.winds, crumbs: t.crumbs,
    rockZones: [], bossStart, bossEnd, finishRow: t.rows.length - 34,
  };
}

// ============================================================ ENDLESS MODE
// A tunnel that never ends: call track.extend() to add more. It gets harder the further you go.
// The UFO starts shooting after BOSS_FROM rows.
export function makeEndlessTrack() {
  const t = makeTunnelBuilder(Date.now() & 0xffff); // different every run
  const BOSS_FROM = 600;
  t.checkpoints.push(0);
  t.full(24);
  t.hint('ENDLESS! One life. How far can you go?');
  const track = {
    rows: t.rows, checkpoints: t.checkpoints, hints: t.hints, winds: t.winds, crumbs: t.crumbs,
    rockZones: [], bossStart: BOSS_FROM, bossEnd: Infinity, finishRow: Infinity, endless: true,
    // add about n more rows of obstacles
    extend(n = 80) {
      const target = t.rows.length + n;
      while (t.rows.length < target) {
        const dist = t.rows.length;
        const d = Math.min(3, Math.floor(dist / 250));           // difficulty 0..3 grows with distance
        const pick = t.rand();
        const lane = Math.floor(t.rand() * LANES);
        if (t.rand() < 0.6) t.crumbTrail(2, 4, lane, 0.5);
        if (pick < 0.18) { t.full(8); t.jumpGap(Math.min(d, 2)); }
        else if (pick < 0.34) t.missingSides(Math.min(d, 1));
        else if (pick < 0.52) t.holes(16 + d * 4, 0.05 + d * 0.03);
        else if (pick < 0.64) t.crackedPatch(10);
        else if (pick < 0.76) t.narrowPath(0, d >= 2 ? 2 : 3);
        else if (pick < 0.86) { t.full(6); t.stepping(0); }
        else t.windZone(t.rand() < 0.5 ? 1 : -1, () => t.holes(18, 0.04));
        t.rest(Math.max(8, 16 - d * 2)); // a breather that gets shorter the further you go
      }
    },
  };
  track.extend(200);
  return track;
}
