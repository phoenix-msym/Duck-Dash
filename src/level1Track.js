// The shape of the Level 1 bike course, built from small "pieces" like flat, hills, ramp and gap.
// y goes DOWN in Phaser, so a negative "rise" means uphill.
//
// To change the level, edit the list in buildLevel1() at the bottom.

const STEP = 40; // how far apart the ground points are on curvy bits

export function makeTrackBuilder(startX, startY) {
  const pieces = [];          // separate chunks of ground (gaps go between them)
  let pts = [{ x: startX, y: startY }];
  let x = startX, y = startY;
  const checkpoints = [];     // {x, y}
  const signs = [];           // {x, y, text}

  const push = (px, py) => { pts.push({ x: px, y: py }); x = px; y = py; };

  const b = {
    get x() { return x; },
    get y() { return y; },

    flat(len) { push(x + len, y); return b; },

    // smooth up or down: change height by "rise" over "len"
    slope(len, rise) {
      const x0 = x, y0 = y;
      for (let d = STEP; d <= len; d += STEP) {
        const t = d / len;
        push(x0 + d, y0 + rise * (1 - Math.cos(Math.PI * t)) / 2);
      }
      if (x !== x0 + len) push(x0 + len, y0 + rise);
      return b;
    },

    // bumps that start and end at the same height. "count" = number of bumps
    hills(count, height, width) {
      const x0 = x, y0 = y, len = count * width;
      for (let d = STEP / 2; d <= len; d += STEP / 2) {
        push(x0 + d, y0 - height * (1 - Math.cos((2 * Math.PI * d) / width)) / 2);
      }
      push(x0 + len, y0);
      return b;
    },

    // a straight kicker ramp that ends sharply (use before a gap)
    ramp(len, rise) { push(x + len * 0.5, y + rise * 0.3); push(x + len * 0.5, y + rise * 0.7); return b; },

    // empty space you have to jump. "drop" > 0 means the landing is lower
    gap(width, drop = 0) {
      pieces.push(pts);
      x += width; y += drop;
      pts = [{ x, y }];
      return b;
    },

    checkpoint() { checkpoints.push({ x, y }); return b; },
    sign(text, offset = 0) { signs.push({ x: x + offset, text }); return b; },

    finish() {
      const finishX = x;
      push(x + 2000, y); // extra ground past the finish so Crumb can roll to a stop
      pieces.push(pts);
      return { pieces, checkpoints, signs, finishX };
    },
  };
  return b;
}

// Find the ground height under some x (used to place signs and respawn the bike).
export function groundYAt(track, x) {
  for (const piece of track.pieces) {
    for (let i = 0; i < piece.length - 1; i++) {
      const a = piece[i], c = piece[i + 1];
      if (x >= a.x && x <= c.x) {
        const t = c.x === a.x ? 0 : (x - a.x) / (c.x - a.x);
        return a.y + (c.y - a.y) * t;
      }
    }
  }
  return null; // over a gap
}

export function buildLevel1() {
  const t = makeTrackBuilder(-600, 560);

  // A short course (built for a quick demo) with BIG jumps for tricks.
  // "kicker" = steep ramp, then a gap, then a long downhill landing so big air feels smooth.

  // ---------- Area 0: tutorial, pink sunset ----------
  t.flat(600).checkpoint()
    .sign('Hold W to ride!', 180)
    .flat(500)
    .sign('A / D = lean back / forward.  S = brake', 0)
    .hills(1, 110, 600)
    .flat(250)
    .sign('Ramp! In the air, hold A or D to SPIN', 0)
    .flat(350)
    .ramp(260, -110).gap(260, 160)
    .slope(500, 120).flat(250)
    .sign('Land on your WHEELS. Flags are checkpoints!', 0)
    .flat(450);

  // ---------- Area 1: big hills and a big kicker ----------
  t.checkpoint().flat(250)
    .hills(1, 240, 900)
    .flat(150)
    .ramp(320, -190).gap(380, 320)
    .slope(700, 220).flat(200)
    .hills(2, 150, 560)
    .flat(300);

  // ---------- Area 2: dusk, huge drops ----------
  t.checkpoint().flat(250)
    .slope(500, -260)
    .ramp(240, -120).gap(420, 480)
    .slope(800, 260).flat(150)
    .ramp(260, -110).gap(300, 60)
    .hills(1, 320, 1000)
    .flat(300);

  // ---------- Area 3: almost space! the mega jump ----------
  t.checkpoint().flat(200)
    .slope(800, 380)
    .flat(120)
    .ramp(400, -260).gap(560, 360)
    .slope(800, 300).flat(200)
    .sign('The UFO is getting away!', 0)
    .flat(800);

  return t.finish();
}
