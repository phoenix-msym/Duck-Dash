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

  // ---------- Area 0: tutorial, pink sunset ----------
  t.flat(600).checkpoint()
    .sign('Hold W to ride!', 180)
    .flat(700)
    .sign('S = brake', 0)
    .hills(2, 40, 400)
    .sign('A / D = lean back / forward', 60)
    .flat(400)
    .sign('Lean back (A) to pop a wheelie!', 0)
    .flat(500)
    .sign('Ramp ahead! Hold W, then lean in the air', 0)
    .flat(200)
    .ramp(220, -60).gap(170, 60)
    .flat(300)
    .sign('Land on your WHEELS. Don\'t bonk your head!', 0)
    .flat(500)
    .sign('Flags are checkpoints. R = go back to one', 100)
    .flat(300);

  // ---------- Area 1: rolling hills ----------
  t.checkpoint().flat(300)
    .hills(2, 90, 600)
    .flat(200)
    .ramp(280, -90).gap(200, 150)
    .slope(300, 60).flat(200)
    .hills(5, 45, 180)
    .flat(200)
    .slope(600, -220).flat(250)
    .slope(500, 220).flat(400);

  // ---------- Area 2: dusk, bumpy ----------
  t.checkpoint().flat(300)
    .hills(6, 30, 200)
    .flat(250)
    .ramp(300, -120).gap(210, 130)
    .slope(400, 120).flat(200)
    .hills(2, 160, 650)
    .flat(300)
    .ramp(240, -70).gap(180, 0)
    .ramp(240, -70).gap(200, 120)
    .flat(400);

  // ---------- Area 3: getting dark, staircase up toward the sky ----------
  t.checkpoint().flat(300);
  for (let i = 0; i < 5; i++) t.slope(140, -60).flat(160);
  t.flat(200)
    .ramp(320, -110).gap(320, 260)
    .slope(500, 150).flat(200)
    .hills(4, 60, 260)
    .flat(400);

  // ---------- Area 4: almost space! ----------
  t.checkpoint().flat(300)
    .slope(900, 300)
    .flat(150)
    .ramp(360, -120).gap(270, 100)
    .slope(400, 80).flat(300)
    .hills(3, 110, 400)
    .flat(300)
    .sign('The UFO is getting away!', 0)
    .flat(900);

  return t.finish();
}
