// The shape of the Level 1 bike course, built from small "pieces" like flat, hills, ramp and gap.
// y goes DOWN in Phaser, so a negative "rise" means uphill.
//
// To change the level, edit the list in buildLevel1() at the bottom.

const STEP = 20; // how far apart the ground points are on curvy bits (smaller = smoother hills, fewer bumps)

export function makeTrackBuilder(startX, startY) {
  const pieces = [];          // separate chunks of ground (gaps go between them)
  let pts = [{ x: startX, y: startY }];
  let x = startX, y = startY;
  const checkpoints = [];     // {x, y}
  const signs = [];           // {x, y, text}
  const crumbs = [];          // {x, y} = exact spot, or {x, lift} = this high above the ground
  const boosts = [];          // {x} boost pads on the ground

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

    // the downhill you land on after a jump: steepest right at the top (where you come down, so you land
    // smoothly along it instead of slamming flat into it), easing out to flat at the bottom so you roll
    // straight into whatever comes next
    landing(len, drop) {
      const x0 = x, y0 = y;
      for (let d = STEP; d <= len; d += STEP) {
        const t = d / len;
        push(x0 + d, y0 + drop * (1 - (1 - t) * (1 - t)));
      }
      if (x !== x0 + len) push(x0 + len, y0 + drop);
      return b;
    },

    // bumps that start and end at the same height. "count" = number of bumps
    hills(count, height, width) {
      // Every hill is made wide enough for its height that, even at full speed, if the bike floats off the
      // top it comes down on the far side of the SAME hill and rolls smoothly into the next one (instead of
      // sailing over the dip and slamming into the face of the next hill).
      width = Math.max(width, 85 * Math.sqrt(height));
      const x0 = x, y0 = y, len = count * width;
      for (let d = STEP / 2; d <= len; d += STEP / 2) {
        push(x0 + d, y0 - height * (1 - Math.cos((2 * Math.PI * d) / width)) / 2);
      }
      push(x0 + len, y0);
      return b;
    },

    // a smoothly curved kicker ramp (gentle at the bottom, steep at the lip) - use before a gap
    ramp(len, rise) {
      const x0 = x, y0 = y;
      for (let d = STEP; d <= len; d += STEP) push(x0 + d, y0 + rise * Math.pow(d / len, 1.8));
      if (x !== x0 + len) push(x0 + len, y0 + rise);
      return b;
    },

    // empty space you have to jump. "drop" > 0 means the landing is lower
    gap(width, drop = 0) {
      pieces.push(pts);
      x += width; y += drop;
      pts = [{ x, y }];
      return b;
    },

    checkpoint() { checkpoints.push({ x, y }); return b; },
    sign(text, offset = 0) { signs.push({ x: x + offset, text }); return b; },

    // a row of bread crumbs floating just above the ground over the next "len" pixels
    crumbs(len, n, lift = 55) {
      for (let i = 0; i < n; i++) crumbs.push({ x: x + (len * (i + 0.5)) / n, lift });
      return b;
    },
    // crumbs in an arc through the air, for the jump starting right here. Only good air gets them all!
    airCrumbs(width, height, n) {
      for (let i = 0; i < n; i++) {
        const t = (i + 1) / (n + 1);
        crumbs.push({ x: x + width * t, y: y - 40 - height * Math.sin(Math.PI * t) });
      }
      return b;
    },
    // a boost pad on the ground here (shoots you forward)
    boost(offset = 0) { boosts.push({ x: x + offset }); return b; },

    finish() {
      const finishX = x;
      push(x + 2000, y); // extra ground past the finish so Crumb can roll to a stop
      pieces.push(pts);
      return { pieces, checkpoints, signs, crumbs, boosts, finishX };
    },
  };
  return b;
}

// Find the ground height under some x (used to place signs and respawn the bike).
// (It's called many times every frame, so the first time it makes a sorted list of all the ground
//  segments and after that finds the right one with a quick "binary search" instead of checking them all.)
export function groundYAt(track, x) {
  if (!track._segs) {
    track._segs = [];
    for (const piece of track.pieces) {
      for (let i = 0; i < piece.length - 1; i++) track._segs.push([piece[i], piece[i + 1]]);
    }
    track._segs.sort((p, q) => p[0].x - q[0].x);
  }
  const segs = track._segs;
  let lo = 0, hi = segs.length - 1, found = -1;
  while (lo <= hi) { // the last segment that starts at or before x
    const mid = (lo + hi) >> 1;
    if (segs[mid][0].x <= x) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  for (let k = found; k >= 0 && k >= found - 1; k--) { // (check one before too, for segments that touch)
    const [a, c] = segs[k];
    if (x >= a.x && x <= c.x) {
      const t = c.x === a.x ? 0 : (x - a.x) / (c.x - a.x);
      return a.y + (c.y - a.y) * t;
    }
  }
  return null; // over a gap
}

// STORY MODE has 3 bike levels. stage = 1, 2 or 3.
// Each course also says which part of the sky it uses (0 = pink sunset ... 4 = night, almost space),
// so the sky keeps getting darker from level to level.
// "kicker" = steep ramp, then a gap, then a long downhill landing so big air feels smooth.
export function buildLevel1(stage = 1) {
  if (stage === 2) return twilightHills();
  if (stage === 3) return edgeOfSpace();
  return sunsetRide();
}

// ---------------------------------------------------------------- Level 1: Sunset Ride
function sunsetRide() {
  const t = makeTrackBuilder(-600, 560);

  // ---------- Area 0: tutorial, pink sunset ----------
  t.flat(600).checkpoint()
    .sign('Hold W to ride!', 180)
    .crumbs(500, 4)
    .flat(500)
    .sign('A / D = lean back / forward.  S = brake', 0)
    .hills(1, 110, 600)
    .flat(250)
    .sign('Blue arrows = BOOST!  Grab the bread crumbs!', 0)
    .boost(180)
    .flat(350)
    .ramp(260, -110).airCrumbs(300, 110, 4).gap(260, 160)
    .landing(1400, 320).flat(300)
    .sign('Land on your WHEELS. Flags are checkpoints!', 0)
    .crumbs(450, 3)
    .flat(450);

  // ---------- Area 1: big hills and a big kicker ----------
  t.checkpoint().flat(250)
    .hills(1, 240, 900)
    .boost(70)
    .flat(150)
    .ramp(320, -190).airCrumbs(420, 200, 5).gap(380, 320)
    .landing(1300, 360).flat(300)
    .crumbs(1120, 4, 70)
    .hills(2, 150, 560)
    .flat(300);

  // ---------- Area 2: bumpy meadow and one more jump ----------
  t.checkpoint().flat(250)
    .crumbs(900, 5)
    .hills(3, 120, 500)
    .flat(200)
    .boost(60)
    .flat(150)
    .ramp(260, -110).airCrumbs(320, 120, 3).gap(300, 60)
    .landing(1200, 270).flat(300)
    .sign('Next stop: the twilight hills!', 0)
    .flat(600);

  const track = t.finish();
  track.sky = [0, 1.4];
  return track;
}

// ---------------------------------------------------------------- Level 2: Twilight Hills
function twilightHills() {
  const t = makeTrackBuilder(-600, 560);

  // ---------- rolling hills ----------
  t.flat(600).checkpoint()
    .sign('Keep your speed up for the big jumps!', 160)
    .crumbs(500, 4)
    .flat(500)
    .hills(2, 180, 640)
    .flat(250)
    .boost(80)
    .flat(200)
    .ramp(260, -110).airCrumbs(300, 110, 4).gap(260, 160)
    .landing(1400, 320).flat(300);

  // ---------- the big drop ----------
  t.checkpoint().flat(250)
    .ramp(740, -380).airCrumbs(460, 180, 5).gap(420, 480) // one smooth kicker (an uphill + a separate ramp left a bump)
    .landing(1400, 400).flat(150).boost(60).flat(150)
    .ramp(320, -190).airCrumbs(420, 200, 5).gap(380, 320)
    .landing(1300, 360).flat(300);

  // ---------- camel humps ----------
  t.checkpoint().flat(250)
    .crumbs(1000, 5, 70)
    .hills(1, 320, 1000)
    .flat(200)
    .hills(2, 150, 560)
    .flat(200)
    .boost(40)
    .flat(150)
    .ramp(260, -110).airCrumbs(320, 120, 3).gap(300, 60)
    .landing(1250, 285).flat(300)
    .sign('Stars are coming out... nearly at the edge of space!', 0)
    .flat(600);

  const track = t.finish();
  track.sky = [1.4, 2.8];
  return track;
}

// ---------------------------------------------------------------- Level 3: Edge of Space
function edgeOfSpace() {
  const t = makeTrackBuilder(-600, 560);

  // ---------- warm-up ----------
  t.flat(600).checkpoint()
    .sign('The UFO is heading for space. Catch it!', 160)
    .crumbs(500, 4)
    .flat(500)
    .hills(2, 150, 560)
    .flat(250)
    .boost(80)
    .flat(200)
    .ramp(260, -110).airCrumbs(300, 110, 4).gap(260, 160)
    .landing(1600, 370).flat(300); // (long landing: the boost pad before this jump sends you far)

  // ---------- dusk, huge drops ----------
  t.checkpoint().flat(250)
    .ramp(740, -380).airCrumbs(460, 180, 5).gap(420, 480) // one smooth kicker (an uphill + a separate ramp left a bump)
    .landing(1400, 400).flat(150).boost(60).flat(150)
    .ramp(260, -110).airCrumbs(320, 120, 3).gap(300, 60)
    .landing(800, 180).flat(250)
    .hills(1, 320, 1000)
    .flat(300);

  // ---------- Area 3: almost space! the mega jump ----------
  t.checkpoint().flat(200)
    .slope(800, 380)
    .boost(10)
    .flat(120)
    .ramp(400, -170).airCrumbs(500, 220, 6).gap(440, 360) // lower ramp + shorter gap to suit the slower bike
    .landing(1500, 440).flat(300)
    .sign('The UFO is getting away!', 0)
    .crumbs(800, 3)
    .flat(800);

  const track = t.finish();
  track.sky = [2.8, 4];
  return track;
}

// DEMO MODE: a short course that shows off everything (boost pads, crumbs, big air, the sky going
// from sunset to night) with checkpoints close together.
export function buildLevel1Demo() {
  // (about half the length of before: aims for under 20 seconds, but still has crumbs, boost pads,
  //  a kicker jump, a big hill, 4 checkpoints for the sunset-to-night sky, and the mega jump)
  const t = makeTrackBuilder(-600, 560);
  t.flat(600).checkpoint()
    .sign('DEMO! Hold W to ride, A / D to spin', 160)
    .crumbs(300, 3)
    .flat(300)
    .boost(40)
    .flat(150)
    .ramp(240, -100).airCrumbs(280, 100, 3).gap(240, 150)
    .landing(1450, 415).flat(150); // long landing slopes, so even at top speed you land on the way down

  t.checkpoint().flat(100)
    .hills(1, 200, 700)
    .flat(100);

  t.checkpoint().flat(100)
    .ramp(260, -110).airCrumbs(300, 120, 3).gap(280, 100)
    .landing(1000, 260).flat(150);

  // the big drop (added to make the demo a bit longer)
  t.checkpoint().flat(150)
    .crumbs(600, 4, 70)
    .hills(2, 150, 560)
    .flat(150)
    .ramp(740, -380).airCrumbs(460, 180, 5).gap(420, 480) // one smooth kicker (an uphill + a separate ramp left a bump)
    .landing(1400, 400).flat(150);

  t.checkpoint().flat(100)
    .slope(500, 250).boost(10).flat(100)
    .ramp(380, -150).airCrumbs(420, 190, 5).gap(340, 320)
    .landing(1450, 515).flat(150)
    .sign('The UFO is getting away!', 0)
    .flat(500);

  return t.finish();
}
