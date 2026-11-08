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
  const props = [];       // {z, lane, kind}  candy to dodge: 'cane' (too tall to jump, steer around) or 'gum' (jump it)
  const rand = seededRandom(seed);
  const LPS = LANES_PER_SIDE;
  const side = (lane) => Math.floor(lane / LPS);
  const ringDist = (a, b) => { const d = Math.abs(a - b) % LANES; return Math.min(d, LANES - d); };

  const b = {
    rows, checkpoints, hints, winds, crumbs, props, rand, side,

    // fill with plain tiles until this part (which started at row "start") is "length" rows long
    padPart(start, length) { b.full(Math.max(0, start + length - rows.length)); },

    // fill the rest of a part with more of its obstacle: a few calm rows, then obstacle(), again and again,
    // so there are no long empty stretches. Ends with a few calm rows before the next checkpoint.
    fillPart(start, length, obstacle, calm = 7) {
      let k = 0;
      while (rows.length < start + length - calm - 6) { b.full(calm); obstacle(k++); }
      b.padPart(start, length);
    },

    // A field of candy obstacles: every "every" rows, a few candy canes and gumdrops stand on the tiles.
    // There's always plenty of room to steer between them.
    candyField(count, every = 4, perRow = 4) {
      const start = rows.length;
      b.full(count);
      for (let r = start + 3; r < start + count - 2; r += every) {
        const used = new Set();
        const n = perRow;
        for (let k = 0; k < n; k++) {
          const lane = Math.floor(rand() * LANES);
          if (used.has(lane)) continue;
          used.add(lane);
          props.push({ z: r + 0.5, lane, kind: rand() < 0.5 ? 'cane' : 'gum', seed: rand() });
        }
      }
    },

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
    rest(n) { b.make(n, (l, i) => (i > 1 && i < n - 4 && rand() < 0.012 ? PAD : TILE)); }, // only the odd lily pad
    hint(text) { hints.push({ row: rows.length, text }); },
    checkpoint() { checkpoints.push(rows.length); b.full(10); },

    // n bread crumbs in a line down one lane, starting "ahead" rows from here, every 2 rows, at height h
    crumbTrail(ahead, n, lane, h) {
      for (let i = 0; i < n; i++) crumbs.push({ z: rows.length + ahead + i * 2 + 0.5, lane, h });
    },
    // dropWall = true: just before you get there, the game removes the side of the tunnel next to you in the
    // direction the wind blows, so if you don't lean against the wind it pushes you off the edge
    windZone(dir, build, dropWall = false) {
      const start = rows.length;
      build();
      winds.push({ start, end: rows.length, dir, dropWall });
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
// 3 space tunnel levels. stage = 1, 2 or 3.
// Every part between checkpoints has a "style" (0 basics, 1 holes/cracks, 2 wall run, 3 wind, 4 boss)
// that sets its colours, speed and background planet. That list is track.sections.
export function buildLevel2(stage = 1) {
  if (stage === 2) return wallRunWinds();
  if (stage === 3) return ufoShowdown();
  return intoTheTube();
}

// ---------------------------------------------------------------- Level 4: Into the Tube
function intoTheTube() {
  const t = makeTunnelBuilder(7);
  const { side } = t;
  const LPS = LANES_PER_SIDE;

  // ---------------- Part 1: the basics ----------------
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

  // ---------------- Part 2: practice ----------------
  t.checkpoint();
  t.hint('Jump the gaps, or run around them on the walls!');
  t.rest(12);
  t.crumbTrail(2, 4, 2, 1.3);
  t.jumpGap(0);
  t.rest(12);
  t.crumbTrail(4, 5, 13, 0.5);
  t.make(16, (l) => side(l) !== 0 && !(side(l) === 1 && l % LPS < 2));
  t.rest(12);
  t.stepping(0);
  t.rest(12);
  t.holes(14, 0.06);
  t.rest(12);

  // ---------------- Part 3: holes, cracks and lily pads ----------------
  t.checkpoint();
  t.hint('Lily pads = SPEED BOOST!  Cracked tiles collapse ahead: switch sides!');
  t.full(6);
  t.make(10, (l, i) => (side(l) === 0 && l % LPS === 1 + (i % 2) && i % 3 === 0 ? PAD : TILE)); // a few pads, spread out
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
  t.hint('The UFO is getting closer!');
  t.full(46);

  return finishTrack(t, Infinity, Infinity, [0, 0, 1]);
}

// ---------------------------------------------------------------- Level 5: Wall Run Winds
function wallRunWinds() {
  const t = makeTunnelBuilder(21);
  const { side } = t;

  // ---------------- Part 1: WALL RUN ----------------
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

  // ---------------- Part 2: more wall running ----------------
  t.checkpoint();
  t.hint('Sides keep vanishing! Find a wall that is still there!');
  t.rest(12);
  t.missingSides(0);
  t.rest(12);
  t.crumbTrail(4, 5, 5, 0.5);
  t.make(18, (l) => side(l) === 1 || side(l) === 3);
  t.rest(12);
  t.crackedPatch(12);
  t.rest(12);
  t.missingSides(1);
  t.rest(12);

  // ---------------- Part 3: WIND ----------------
  t.checkpoint();
  t.hint("WIND! Don't get blown off the edge!");
  t.rest(14);
  t.windZone(+1, () => { t.crumbTrail(4, 5, 0, 0.5); t.full(22); }, true); // no holes: the wall beside you drops away instead
  t.rest(14);
  t.windZone(-1, () => t.narrowPath(0, 3)); // a wide path (7 lanes) instead of a thin one
  t.rest(14);
  t.windZone(+1, () => { t.full(6); t.jumpGap(1); t.full(8); });
  t.rest(10);

  // ---------------- Part 4: a storm ----------------
  t.checkpoint();
  t.hint('A space storm! The wind keeps changing direction!');
  t.rest(12);
  t.windZone(-1, () => { t.crumbTrail(3, 4, 14, 0.5); t.full(20); }, true);
  t.rest(12);
  t.windZone(+1, () => { t.full(4); t.crackedPatch(10); t.full(4); });
  t.rest(12);
  t.windZone(-1, () => t.make(18, (l) => side(l) !== 2));
  t.rest(10);
  t.hint('There it is! The UFO is right ahead!');
  t.full(46);

  return finishTrack(t, Infinity, Infinity, [2, 2, 3, 3]);
}

// ---------------------------------------------------------------- Level 6: UFO Showdown
function ufoShowdown() {
  const t = makeTunnelBuilder(33);

  // ---------------- Part 1: the final stretch ----------------
  t.checkpoint();
  t.hint('Last chase! Get close to the UFO!');
  t.rest(14);
  t.crumbTrail(2, 5, 1, 0.5);
  t.holes(16, 0.05);
  t.rest(12);
  t.windZone(+1, () => t.full(16), true);
  t.rest(12);
  t.jumpGap(1);
  t.rest(12);

  // ---------------- Part 2: the UFO fights back! ----------------
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

  // ---------------- Part 3: it's getting angry! ----------------
  t.checkpoint();
  t.hint('The UFO is angry! Keep dodging!');
  t.rest(12);
  t.crackedPatch(10);
  t.rest(14);
  t.crumbTrail(2, 5, 6, 0.5);
  t.holes(16, 0.05);
  t.rest(14);
  t.missingSides(0);
  t.rest(16);
  const bossEnd = t.rows.length;
  t.hint('You caught up to the UFO!');
  t.full(46);

  return finishTrack(t, bossStart, bossEnd, [3, 4, 4]);
}

// ============================================================ DEMO MODE
// The same 5 sections as Story mode, each one short, so everything can be shown off in about a minute.
export function buildLevel2Demo() {
  const t = makeTunnelBuilder(11);
  const { side } = t;
  const LPS = LANES_PER_SIDE;

  // (7 parts. Every checkpoint switches the tunnel to a new "vibe" (listed in themes at the bottom) AND has
  //  its own obstacle, so it feels like a tour of different levels. Each part lasts about 10 seconds
  //  (its length in rows = 10 x how fast you run there), and the boss fight at the end lasts about 16.)
  let part = t.rows.length;
  t.checkpoint(); // NEON: the basics (runs at 9 rows/s)
  t.hint('DEMO: A / D move, W / SPACE jump!');
  t.crumbTrail(2, 4, 1, 0.5);
  t.rest(12);
  t.make(3, () => false);  // a gap to jump
  t.rest(12);
  t.make(12, (l) => side(l) !== 0); // the floor disappears: run onto a wall
  t.rest(10);
  t.make(3, () => false);  // ...and one more gap
  t.rest(10);
  t.make(12, (l) => side(l) !== 2); // the ceiling disappears this time
  t.fillPart(part, 90, (k) => (k % 2 ? t.make(3, () => false) : t.make(12, (l) => side(l) !== (k + 1) % 4))); // more gaps and missing walls

  part = t.rows.length;
  t.checkpoint(); // LILY POND: lily pads everywhere (9.8 rows/s, but the boosts make you faster)
  t.hint('LILY PADS! Run over them for a speed boost!');
  t.crumbTrail(0, 4, 2, 0.5);
  t.make(12, (l, i) => (side(l) === 0 && l % LPS === 1 + (i % 2) && i % 4 === 0 ? PAD : TILE)); // a trail of pads on the floor
  t.full(6);
  t.make(12, (l, i) => (l % LPS === 1 && i % 6 === 0 ? PAD : TILE));                        // ...one on every wall
  t.full(6);
  t.crumbTrail(0, 5, 6, 0.5);
  t.make(14, (l, i) => (i % 3 === 0 && (l * 5 + i) % 7 === 0 ? PAD : TILE));             // scattered around
  t.full(6);
  t.make(12, (l, i) => (side(l) === 2 && l % LPS === 1 + (i % 2) && i % 4 === 0 ? PAD : TILE)); // a trail on the ceiling
  t.fillPart(part, 110, (k) => t.make(8, (l, i) => (i % 4 === 0 && (l * 5 + i * 3 + k) % 9 === 0 ? PAD : TILE))); // a few more pads, spread out

  part = t.rows.length;
  t.checkpoint(); // CANDY: candy canes and gumdrops to dodge, and floating platforms (9.8 rows/s)
  t.hint('CANDY! Steer around the candy canes, jump the gumdrops!');
  t.full(4);
  t.candyField(24, 5, 3);
  t.full(4);
  t.crumbTrail(2, 4, 2, 1.3);
  t.stepping(0);
  t.full(8);
  t.candyField(22, 4, 4); // a bit closer together and more of them
  t.fillPart(part, 98, () => t.candyField(14, 4, 4)); // more candy

  part = t.rows.length;
  t.checkpoint(); // DESERT: wall run (10.4 rows/s)
  t.hint('WALL RUN! Whole sides go missing!');
  t.full(4);
  t.crumbTrail(4, 5, 9, 0.5);
  t.make(14, (l) => side(l) === 0 || side(l) === 2);
  t.full(8);
  t.make(14, (l) => side(l) === 1 || side(l) === 3);
  t.full(8);
  t.make(14, (l) => side(l) === 3); // only one wall left!
  t.full(8);
  t.make(14, (l) => side(l) === 0 || side(l) === 2);
  t.fillPart(part, 104, (k) => t.make(12, (l) => side(l) === k % 4 || side(l) === (k + 1) % 4)); // only two walls left

  part = t.rows.length;
  t.checkpoint(); // SYNTHWAVE: broken tiles (9.8 rows/s)
  t.hint('BROKEN TILES! They collapse ahead of you: switch sides!');
  t.full(4);
  for (let k = 0; k < 6; k++) {
    t.crackedPatch(9); // two sides cracked, two sides solid (a different pair each time)
    t.full(4);
  }
  t.fillPart(part, 98, () => t.crackedPatch(9), 4); // more broken tiles

  part = t.rows.length;
  t.checkpoint(); // FROST: wind (10.8 rows/s)
  t.hint("WIND! Don't get blown off the edge!");
  t.full(5);
  t.windZone(+1, () => { t.crumbTrail(1, 4, 0, 0.5); t.full(18); }, true);
  t.rest(8);
  t.windZone(-1, () => t.full(16), true);
  t.rest(8);
  t.windZone(+1, () => t.make(18, (l) => side(l) !== 0));
  t.fillPart(part, 108, (k) => t.windZone(k % 2 ? 1 : -1, () => t.full(14), true)); // more gusts

  part = t.rows.length;
  t.checkpoint(); // RED ALERT: the boss fight, the longest part (10.2 rows/s x 16 seconds)
  const bossStart = t.rows.length;
  t.hint('BOSS: the UFO fights back! Dodge!');
  t.full(20);
  t.crumbTrail(2, 5, 1, 0.5);
  t.holes(12, 0.03);
  t.full(30);
  t.crumbTrail(2, 5, 9, 0.5);
  t.holes(12, 0.03);
  t.full(30);
  t.holes(12, 0.03);
  t.fillPart(part, 157, () => t.holes(10, 0.03), 9); // the UFO keeps shooting, a few holes too
  const bossEnd = t.rows.length;
  t.full(6 + 34); // a short calm run to the finish line, then the bit you jog along after finishing

  const track = finishTrack(t, bossStart, bossEnd, [0, 1, 1, 2, 1, 3, 4]);
  track.themes = ['neon', 'lilyPond', 'candy', 'desert', 'synthwave', 'frost', 'redAlert'];
  return track;
}

// Bread crumbs are placed in a lane before we know what the tiles there will be, so some ended up
// floating over a hole or a missing wall where you can't reach them. Low crumbs over a hole get moved
// to the nearest lane that has a tile (or removed if the whole row is empty). Crumbs high in the air
// (h > 1) are left alone: those are the ones over gaps that you jump for.
function fixCrumbs(rows, crumbs, from = 0) {
  for (let i = crumbs.length - 1; i >= from; i--) {
    const c = crumbs[i];
    if (c.h > 1) continue;
    const row = rows[Math.floor(c.z)];
    if (!row || row[c.lane] !== HOLE) continue;
    let moved = false;
    for (let d = 1; d <= LANES / 2 && !moved; d++) {
      for (const lane of [(c.lane + d) % LANES, (c.lane - d + LANES) % LANES]) {
        if (row[lane] !== HOLE) { c.lane = lane; moved = true; break; }
      }
    }
    if (!moved) crumbs.splice(i, 1);
  }
}

// sections: the style (0-4) of each part between checkpoints (see buildLevel2)
function finishTrack(t, bossStart, bossEnd, sections = [0, 1, 2, 3, 4]) {
  fixCrumbs(t.rows, t.crumbs);
  return {
    rows: t.rows, checkpoints: t.checkpoints, hints: t.hints, winds: t.winds, crumbs: t.crumbs, props: t.props,
    rockZones: [], bossStart, bossEnd, finishRow: t.rows.length - 34, sections,
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
    rockZones: [], bossStart: BOSS_FROM, bossEnd: Infinity, finishRow: Infinity, endless: true, sections: [0],
    // add about n more rows of obstacles
    extend(n = 80) {
      const target = t.rows.length + n;
      const firstNewCrumb = t.crumbs.length;
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
        else t.windZone(t.rand() < 0.5 ? 1 : -1, () => t.full(18), true);
        t.rest(Math.max(8, 16 - d * 2)); // a breather that gets shorter the further you go
      }
      fixCrumbs(t.rows, t.crumbs, firstNewCrumb); // no crumbs floating over holes
    },
  };
  track.extend(200);
  return track;
}
