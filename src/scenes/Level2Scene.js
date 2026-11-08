import { makeTextures } from '../art.js';
import { createControls } from '../controls.js';
import { settings } from '../settings.js';
import { gyro } from '../gyro.js';
import { buildLevel2, buildLevel2Demo, makeEndlessTrack, LANES, LANES_PER_SIDE, SIDES, HOLE, PAD, CRACKED } from '../level2Track.js';
import { FONT, eraseSprites, unerase, levelCompletePanel, fmtTime, crumbHud, makeButton, keyboardMenu, levelTitle, checkpointBarClicks, savedCheckpoint, saveCheckpoint } from '../ui.js';
import { STORY, storyIndex, startStoryLevel } from '../story.js';
import { wallet } from '../wallet.js';
import { audio } from '../audio.js';
import { addPauseButton } from './PauseScene.js';
import { level2Scenery } from '../scenery.js';

// ---- Runner tuning ----
const SPEEDS = [9, 9.8, 10.4, 10.8, 10.2]; // rows per second in each section (basics, holes, wall run, wind, boss)
const SIDE_SPEED = 8.5;   // lanes per second when holding A / D
const JUMP_POWER = 10.2;
const GRAVITY = 34.6;
const FAST_FALL = 2.5;    // gravity multiplier while holding S in the air
const COYOTE_TIME = 0.12; // seconds you can still jump after running off an edge
const ENDLESS_SECTION = 200; // Endless mode: the colours and scenery change every this many rows
const FALL_DEPTH = -0.9;  // how far below the floor you fall (in tiles) before "Lost in space!" (was -1.6)
const BOOST = 1.6;        // lily pad speed multiplier
const BOOST_TIME = 1.2;   // seconds a lily pad boost lasts
const GUM_SLOW = 0.5;     // running into a gumdrop: you run at half speed...
const GUM_SLOW_TIME = 0.9; // ...for this many seconds
const CRUMBLE_DELAY = 0.2; // seconds before a touched cracked tile falls (was 0.35)
const CRUMBLE_AHEAD = 7;   // how many rows in front of you collapse when you step on a cracked tile
const WIND = 2.0;         // lanes per second the wind pushes you
// seconds for each story space level: under the first = 3 stars, under the second = 2 stars
const STAR_LIMITS = [[48, 65], [54, 72], [34, 48]];
const ROCK_EVERY = 0.55;  // seconds between asteroids in the asteroid section
const ROCK_SPEED = 6;     // rows per second the asteroids tumble towards you

// ---- Boss fight tuning ----
const BULLET_EVERY = 1.7;  // seconds between bullets
const BULLET_SPEED = 6;    // rows per second the bullets fly towards you
const LASER_EVERY = 4.2;   // seconds between lasers
const LASER_WARN = 1.6;    // seconds of red warning before the laser fires
const LASER_FIRE = 0.4;    // seconds the laser stays on

// ---- How the 3D tunnel is drawn ----
// We fake 3D with "perspective": things further away get drawn closer to the middle of the screen.
const APOTHEM = LANES_PER_SIDE / 2 / Math.tan(Math.PI / SIDES); // distance from tunnel centre to a wall
const VIEW_ROWS = 48;     // how far ahead we draw
const FOCAL = 560;        // bigger = more zoomed in
const CAM_BACK = 4.2;     // camera is this many rows behind Crumb
const CAM_UP = 1.5;       // camera height above the floor
const NEAR = 0.35;
const INSET = 0.06;       // small gap between tiles so you can see the grid

// Colours for each area of the level (between checkpoints).
// The sky is always DARK and the tiles always BRIGHT, so you can always tell what's floor and what's a hole.
const AREAS = [
  { bgTop: 0x03040d, bgBottom: 0x0b0f2a, tileA: 0x6f88ff, tileB: 0x5068e8, nebula: 0x5d7dff },
  { bgTop: 0x070210, bgBottom: 0x1c0a2c, tileA: 0xc47dff, tileB: 0xa55ef0, nebula: 0xd36bff },
  { bgTop: 0x0a0604, bgBottom: 0x1e140a, tileA: 0xffb766, tileB: 0xf09a45, nebula: 0xffb066 }, // wall run
  { bgTop: 0x010a0c, bgBottom: 0x041c20, tileA: 0x5df0dc, tileB: 0x3cd0bd, nebula: 0x3dffd9 }, // wind
  { bgTop: 0x080104, bgBottom: 0x16040a, tileA: 0xffa08f, tileB: 0xff7b74, nebula: 0xff5a49 }, // boss
  { bgTop: 0x010703, bgBottom: 0x051409, tileA: 0xc8ff6a, tileB: 0xa6e84a, nebula: 0xb6ff3b },
];
// DEMO MODE "vibes": every checkpoint switches the whole tunnel to a new look, like a different level.
// pattern = how the two tile colours are laid out: checker, lanes (stripes along the tunnel),
// rings (stripes around the tunnel) or sides (each wall a different colour).
// windGlow = colour of the shimmer that ripples over the tiles in the wind.
const THEMES = {
  neon:      { bgTop: 0x02030c, bgBottom: 0x0a1030, tileA: 0x5d7dff, tileB: 0x3a55e0, nebula: 0x4d7dff, pattern: 'checker' },
  lilyPond:  { bgTop: 0x020a08, bgBottom: 0x06241a, tileA: 0x4fd18b, tileB: 0x2fae6e, nebula: 0xff7ac8, pattern: 'rings' },
  candy:     { bgTop: 0x12030f, bgBottom: 0x2e0a2a, tileA: 0xff8fd0, tileB: 0xfff1a8, nebula: 0xff5fb8, pattern: 'lanes' },
  desert:    { bgTop: 0x0c0603, bgBottom: 0x2a1406, tileA: 0xffc46b, tileB: 0xc0622e, nebula: 0xff9a3c, pattern: 'sides' },
  synthwave: { bgTop: 0x07010f, bgBottom: 0x1c0638, tileA: 0xb44cff, tileB: 0x2ee6ff, nebula: 0xff3cac, pattern: 'rings' },
  frost:     { bgTop: 0x01060f, bgBottom: 0x06203a, tileA: 0x3f86d8, tileB: 0x2a63b3, nebula: 0x9fe8ff, pattern: 'checker', windGlow: 0xe6fbff },
  redAlert:  { bgTop: 0x0a0103, bgBottom: 0x200409, tileA: 0xff7a6e, tileB: 0xffc2b8, nebula: 0xff3049, pattern: 'checker' },
};
const PATTERNS = {
  checker: (r, l) => (Math.floor(r / 2) + l) % 2,
  lanes: (r, l) => l % 2,
  rings: (r) => Math.floor(r / 4) % 2,
  sides: (r, l) => Math.floor(l / LANES_PER_SIDE) % 2,
};

// how big the UFO looks in each section: small and far at the start, closer every checkpoint
const UFO_SCALE = [0.12, 0.17, 0.22, 0.28, 0.45];

function mix(a, b, t) {
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = (a & 255) + (((b & 255) - (a & 255)) * t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

// Tiles must always be LIGHT, so the holes (which show the dark space behind) stand out clearly.
// Any tile colour darker than this gets brightened towards white until it's light enough.
const MIN_TILE_LIGHT = 0.6; // 0 = black, 1 = white
function lightTile(c) {
  const light = (0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255)) / 255;
  if (light >= MIN_TILE_LIGHT) return c;
  return mix(c, 0xffffff, (MIN_TILE_LIGHT - light) / (1 - light));
}

const laneOf = (u) => ((Math.floor(u) % LANES) + LANES) % LANES;
// shortest distance around the tunnel between two positions (in lanes)
const ringGap = (a, b) => { const d = (((a - b) % LANES) + LANES) % LANES; return Math.min(d, LANES - d); };

// Where is a point on the tunnel wall? u = position around the tunnel in lanes, h = height above that wall.
function wallPoint(u, h) {
  const per = LANES;
  const uw = ((u % per) + per) % per;
  let k = Math.floor(uw / LANES_PER_SIDE);
  if (k >= SIDES) k = SIDES - 1;
  const s = uw - k * LANES_PER_SIDE - LANES_PER_SIDE / 2;
  const phi = Math.PI / 2 - (k * 2 * Math.PI) / SIDES; // direction the wall faces (outwards)
  const nx = Math.cos(phi), ny = Math.sin(phi);
  const tx = Math.sin(phi), ty = -Math.cos(phi);
  return { x: APOTHEM * nx + s * tx - h * nx, y: APOTHEM * ny + s * ty - h * ny };
}

export class Level2Scene extends Phaser.Scene {
  constructor() { super('Level2'); }

  // mode: 'story' (normal), 'demo' (short showcase) or 'endless' (infinite, one life)
  init(data) {
    this.mode = (data && data.mode) || 'story';
    this.endless = this.mode === 'endless';
    this.stage = (data && data.stage) || 1; // which space level of the story (1-3)
  }

  // the style (0 basics, 1 holes, 2 wall run, 3 wind, 4 boss) of the part we're in now
  sectionStyle(cp = this.cpIndex) {
    const s = this.track.sections;
    return s[Math.min(cp, s.length - 1)];
  }

  create() {
    makeTextures(this);
    const { width: W, height: H } = this.scale;
    this.cx = W / 2; this.cy = H / 2 - 40;
    this.controls = createControls(this);
    this.space = this.input.keyboard.addKey('SPACE');
    this.track = this.endless ? makeEndlessTrack() : this.mode === 'demo' ? buildLevel2Demo() : buildLevel2(this.stage);
    this.storyIndex = this.mode === 'story' ? storyIndex('Level2', this.stage) : -1;
    this.cpIndex = 0;
    this.elapsed = 0;
    this.finished = false;
    this.runAnim = 0;
    audio.music('space');

    // pre-work out the corners of every lane, so drawing is fast
    this.laneEdges = [];
    for (let l = 0; l < LANES; l++) {
      this.laneEdges.push([wallPoint(l + INSET, 0), wallPoint(l + 1 - INSET, 0)]);
    }

    // background: gradient, nebula clouds, stars
    this.bg = this.add.graphics().setDepth(0);
    this.nebulas = [0, 1, 2].map((i) => {
      const n = this.add.image(0, 0, 'glow').setDepth(1).setBlendMode(Phaser.BlendModes.ADD);
      n.polar = { r: 200 + i * 90, a: i * 2.1, scale: 2.2 + i * 0.6 };
      return n;
    });
    this.stars = [];
    for (let i = 0; i < 220; i++) {
      this.stars.push({ r: Phaser.Math.Between(30, 760), a: Math.random() * Math.PI * 2, size: Math.random() < 0.15 ? 2 : 1 });
    }
    this.starGfx = this.add.graphics().setDepth(2);
    this.scenery = level2Scenery(this); // planets, space junk, asteroid belt, gas clouds, comets

    // the UFO, far down the tunnel
    this.ufo = this.add.image(this.cx, this.cy, 'ufo').setDepth(3);
    this.bread = this.add.image(this.cx, this.cy, 'egg').setDepth(3); // the stolen egg

    this.tunnel = this.add.graphics().setDepth(4);
    this.fx = this.add.graphics().setDepth(5);      // lasers, bullets, wind streaks
    this.shadow = this.add.ellipse(0, 0, 60, 16, 0x000000, 0.35).setDepth(5);
    this.duck = this.add.image(0, 0, 'duckRunA').setOrigin(0.5, 0.95).setDepth(6);

    this.makeHud();
    // bread crumbs floating in the tunnel (one picture each, positioned every frame)
    this.crumbItems = [];
    this.crumbs = null; // forget the counter from a previous run (e.g. after "Run again"), it was destroyed
    this.addCrumbItems();
    this.crumbs = crumbHud(this, { total: this.crumbItems.length });
    this.spawn();

    // R = back to the checkpoint (in Endless mode: start a new run)
    this.input.keyboard.on('keydown-R', () => {
      if (this.endless) this.scene.restart({ mode: 'endless' });
      else if (!this.finished) this.spawn();
    });
    addPauseButton(this, false); // P / Esc / the II button
    if (this.storyIndex >= 0) levelTitle(this, this.storyIndex + 1, STORY[this.storyIndex].name);
  }

  spawn() {
    const row = this.track.checkpoints[this.cpIndex];
    const side = this.player ? Math.floor(this.player.u / LANES_PER_SIDE) : 0;
    this.player = {
      z: row + 2,
      u: side * LANES_PER_SIDE + LANES_PER_SIDE / 2, // middle of whatever side you were on
      h: 0, vh: 0,
      grounded: true, offGroundTime: 0, falling: false, dead: false, didDouble: false,
    };
    if (this.roll === undefined) this.roll = 0;
    // fresh copy of the level, so crumbled tiles come back
    // (Endless mode has one life and a tunnel that keeps growing, so it uses the track's rows directly)
    this.rows = this.endless ? this.track.rows : this.track.rows.map((r) => r.slice());
    this.crumbling = new Map(); // "row,lane" -> time (seconds) it falls
    this.boost = 0;
    this.sticky = 0;
    this.squished = new Set(); // gumdrops you've run into (they're squashed flat until you respawn)
    this.carved = new Set();   // windy stretches whose wall has already dropped away this run
    this.bullets = [];
    this.lasers = [];
    // (Demo mode: the UFO starts shooting almost straight away, so the short boss part still shows a laser)
    this.bulletTimer = this.mode === 'demo' ? 0.4 : 1.5;
    this.laserTimer = this.mode === 'demo' ? 0.8 : 2.5;
    this.rocks = [];
    this.rockTimer = 1;
    unerase([this.duck]);
  }

  // make a picture for every bread crumb in the track we haven't made one for yet
  addCrumbItems() {
    for (let i = this.crumbItems.length; i < this.track.crumbs.length; i++) {
      const c = this.track.crumbs[i];
      this.crumbItems.push({ ...c, got: false, img: this.add.image(0, 0, 'crumb').setDepth(5).setVisible(false) });
    }
    if (this.crumbs) { this.crumbs.total = this.crumbItems.length; this.crumbs.draw(); }
  }

  // how fast Crumb runs right now (rows per second)
  baseSpeed() {
    if (this.endless) return 9 + Math.min(4, this.player.z / 250); // Endless: slowly gets faster
    return SPEEDS[this.sectionStyle()];
  }

  tileAt(z, u) {
    const row = this.rows[Math.floor(z)];
    if (!row) return 1; // past the end: solid
    return row[laneOf(u)];
  }

  // ------------------------------------------------------------------ every frame
  update(time, deltaMs) {
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    if (!this.finished) this.elapsed += deltaMs;
    const now = this.elapsed / 1000;
    const p = this.player;

    // cracked tiles whose time is up fall away
    for (const [key, fallAt] of this.crumbling) {
      if (now >= fallAt) {
        const [r, l] = key.split(',').map(Number);
        this.rows[r][l] = HOLE;
        this.crumbling.delete(key);
      }
    }

    if (!this.finished && !p.dead) {
      this.movePlayer(dt, now);
      if (!p.dead) this.updateBoss(dt, now);
      if (!p.dead) this.updateRocks(dt);
      this.grabCrumbs();
    } else if (this.finished) p.z += SPEEDS[SPEEDS.length - 1] * dt * 0.3; // slow jog after the finish

    // the tunnel turns so that whatever side Crumb is on becomes the floor
    const sideUnwrapped = Math.floor(p.u / LANES_PER_SIDE);
    this.targetRoll = (sideUnwrapped * 2 * Math.PI) / SIDES;
    this.roll += (this.targetRoll - this.roll) * Math.min(1, dt * 10);

    this.draw(time, dt, now);
    this.updateHud(now);
  }

  windAt(z) {
    return this.track.winds.find((w) => z >= w.start && z < w.end);
  }

  movePlayer(dt, now) {
    const p = this.player;
    const c = this.controls.read();
    const wantJump = c.forward > 0.5 || this.space.isDown || gyro.takeJump();

    this.boost = Math.max(0, this.boost - dt);
    this.sticky = Math.max(0, (this.sticky || 0) - dt);
    const speed = this.baseSpeed() * (this.boost > 0 ? BOOST : 1) * (this.sticky > 0 ? GUM_SLOW : 1);
    // Endless: build more tunnel before we run out
    if (this.endless && p.z > this.track.rows.length - 140) {
      this.track.extend(100);
      this.addCrumbItems();
    }
    p.z += speed * dt;
    p.u += (c.right - c.left) * SIDE_SPEED * dt;
    // WIND THAT DROPS A WALL: just before a gust (while it's still far down the tunnel), the side of the
    // tunnel next to you in the wind's direction falls away. Don't lean against the wind and you get
    // blown off the edge. (It's worked out from where you are as you arrive, so it's always beside you.)
    for (const w of this.track.winds) {
      if (!w.dropWall || this.carved.has(w) || p.z < w.start - 40 || p.z > w.end) continue;
      this.carved.add(w);
      const mySide = Math.floor(laneOf(p.u) / LANES_PER_SIDE);
      const gone = (mySide + (w.dir > 0 ? 1 : SIDES - 1)) % SIDES; // the side the wind pushes you towards
      for (let r = w.start; r < w.end; r++) {
        if (!this.rows[r]) continue;
        for (let l = gone * LANES_PER_SIDE; l < (gone + 1) * LANES_PER_SIDE; l++) this.rows[r][l] = HOLE;
      }
    }

    const wind = this.windAt(p.z);
    if (wind) {
      p.u += wind.dir * WIND * dt;
      // gusts: a whoosh and a little camera shake every so often, so the wind feels dangerous
      this.gustTimer = (this.gustTimer ?? 0) - dt;
      if (this.gustTimer <= 0) {
        this.gustTimer = 0.7;
        audio.sfx.whoosh();
        this.cameras.main.shake(180, 0.004);
      }
    } else this.gustTimer = 0;

    if (p.grounded) {
      const under = this.tileAt(p.z, p.u);
      if (under === HOLE) { p.grounded = false; p.offGroundTime = 0; p.vh = 0; }
      else if (under === PAD && this.boost < BOOST_TIME - 0.2) {
        this.boost = BOOST_TIME;
        audio.sfx.boost();
        this.showToast('BOOST!');
      } else if (under === CRACKED) this.startCrumble(Math.floor(p.z), laneOf(p.u), now);
    }
    if (p.grounded) {
      if (wantJump) { p.grounded = false; p.vh = JUMP_POWER; p.offGroundTime = 1; p.didDouble = false; audio.sfx.jump(); }
    } else {
      // Third flick of a quick series: one extra hop. Finger tilt does not do this.
      if (!p.didDouble && gyro.takeDoubleJump()) { p.vh = JUMP_POWER; p.didDouble = true; p.falling = false; audio.sfx.jump(); }
      p.offGroundTime += dt;
      // "coyote time": a tiny moment after running off an edge where you can still jump
      if (wantJump && p.vh <= 0 && p.offGroundTime < COYOTE_TIME && p.h > -0.3) {
        p.vh = JUMP_POWER; p.offGroundTime = 1;
        audio.sfx.jump();
      }
      const g = GRAVITY * (c.back > 0.5 && p.h > 0 ? FAST_FALL : 1);
      p.vh -= g * dt;
      p.h += p.vh * dt;
      // landing
      if (p.h <= 0 && p.vh <= 0) {
        if (p.h > -0.35 && this.tileAt(p.z, p.u) !== HOLE) {
          p.h = 0; p.vh = 0; p.grounded = true; p.didDouble = false;
          gyro.doubleEdge = false;
          audio.sfx.land();
        } else {
          if (!p.falling) audio.sfx.fall(); // just started dropping into space
          p.falling = true;
        }
      }
      if (p.h < FALL_DEPTH && !p.dead) this.die('Lost in space!');
    }

    // candy obstacles: candy canes knock you out (steer around them); gumdrops are sticky: running into one
    // squishes it and slows you down for a moment (jump over them to keep your speed)
    for (const c of this.track.props || []) {
      if (Math.abs(c.z - p.z) > 0.35 || this.squished.has(c)) continue;
      const tall = c.kind === 'cane' ? 1.25 : 0.55; // (a jump only clears a cane right at its very top)
      if (ringGap(c.lane + 0.5, p.u) < 0.6 && p.h < tall && p.h > -0.2) {
        if (c.kind === 'cane') { this.die('Bonked a candy cane!'); return; }
        this.squished.add(c);
        this.sticky = GUM_SLOW_TIME;
        this.boost = 0;
        audio.sfx.land();
        this.cameras.main.shake(120, 0.004);
        this.showToast('Sticky! Slowed down');
      }
    }

    // checkpoints
    const next = this.track.checkpoints[this.cpIndex + 1];
    if (next !== undefined && p.z > next) {
      this.cpIndex++;
      this.reachedCp = Math.max(this.reachedCp || 0, this.cpIndex);
      this.runCp = Math.max(this.runCp || 0, this.cpIndex);
      if (!this.endless) saveCheckpoint(this.levelId, this.cpIndex);
      const bossNow = this.sectionStyle() === 4 && this.sectionStyle(this.cpIndex - 1) !== 4;
      this.showToast(bossNow ? 'BOSS FIGHT!' : `Checkpoint ${this.cpIndex}!`);
      audio.sfx.checkpoint();
    }
    if (p.z > this.track.finishRow) this.finish();
  }

  // Stepping on a cracked tile sets off a chain reaction: the cracked tiles in your lane (and the lanes
  // right next to it) collapse one after another, racing AHEAD of you. They flash red first, so you can
  // see it coming: switch to a solid side of the tunnel to get past!
  startCrumble(r, l, now) {
    for (let rr = r; rr < r + CRUMBLE_AHEAD; rr++) {
      const row = this.rows[rr];
      if (!row) break;
      for (let dl = -1; dl <= 1; dl++) {
        const ll = (l + dl + LANES) % LANES;
        const key = `${rr},${ll}`;
        if (row[ll] === CRACKED && !this.crumbling.has(key)) {
          this.crumbling.set(key, now + CRUMBLE_DELAY + (rr - r) * 0.035);
        }
      }
    }
  }

  // ------------------------------------------------------------------ boss fight
  updateBoss(dt, now) {
    const p = this.player;
    const active = p.z > this.track.bossStart + 6 && p.z < this.track.bossEnd;
    if (!active) { this.bullets.length = 0; this.lasers.length = 0; return; }

    // bullets fly down the tunnel towards Crumb. Jump over them or side-step.
    this.bulletTimer -= dt;
    if (this.bulletTimer <= 0) {
      this.bulletTimer = BULLET_EVERY;
      this.bullets.push({ z: p.z + 34, u: Math.floor(p.u) + Phaser.Math.Between(-1, 1) + 0.5 });
    }
    for (const b of this.bullets) {
      b.z -= BULLET_SPEED * dt;
      if (Math.abs(b.z - p.z) < 0.45 && ringGap(b.u, p.u) < 0.6 && p.h < 0.8) { this.die('Blasted!'); return; }
    }
    this.bullets = this.bullets.filter((b) => b.z > p.z - 4);

    // lasers: a red warning stripe shows which lanes are about to get zapped
    this.laserTimer -= dt;
    if (this.laserTimer <= 0) {
      this.laserTimer = LASER_EVERY;
      const lane = laneOf(p.u);
      // only ONE lane gets zapped, so a small side-step is enough (easier with the gyro)
      this.lasers.push({ lanes: [lane], warnUntil: now + LASER_WARN, fireUntil: now + LASER_WARN + LASER_FIRE });
      audio.sfx.beam();
    }
    for (const L of this.lasers) {
      const firing = now >= L.warnUntil && now < L.fireUntil;
      if (firing && !L.played) { L.played = true; audio.sfx.whoosh(); }
      if (firing && L.lanes.includes(laneOf(p.u))) { this.die('Zapped!'); return; }
    }
    this.lasers = this.lasers.filter((L) => now < L.fireUntil);
  }

  // asteroids tumble down the tunnel towards Crumb in the asteroid section
  updateRocks(dt) {
    const p = this.player;
    const zone = this.track.rockZones.find((r) => p.z > r.start - 4 && p.z < r.end);
    if (zone && p.z < zone.end - 20) {
      this.rockTimer -= dt;
      if (this.rockTimer <= 0) {
        this.rockTimer = ROCK_EVERY;
        const lane = Math.floor(p.u) + Phaser.Math.Between(-3, 3);
        this.rocks.push({ z: p.z + 36, u: lane + 0.5, spin: Math.random() * 6, size: Phaser.Math.FloatBetween(0.38, 0.5), seed: Math.random() });
      }
    }
    for (const r of this.rocks) {
      r.z -= ROCK_SPEED * dt;
      r.spin += dt * 3;
      if (Math.abs(r.z - p.z) < 0.5 && ringGap(r.u, p.u) < 0.75 && p.h < r.size * 2) { this.die('Smashed by an asteroid!'); return; }
    }
    this.rocks = this.rocks.filter((r) => r.z > p.z - 4);
  }

  // pick up bread crumbs you run (or jump) through
  grabCrumbs() {
    const p = this.player;
    for (const c of this.crumbItems) {
      if (c.got || Math.abs(c.z - p.z) > 0.6) continue;
      // crumbs high in the air (h > 1) only get grabbed if you jump for them
      if (ringGap(c.lane + 0.5, p.u) < 0.8 && Math.abs(c.h - 0.5 - Math.max(p.h, 0)) < 0.6) {
        c.got = true;
        c.img.setVisible(false);
        this.crumbs.collect(c.img.x, c.img.y);
      }
    }
  }

  die(message) {
    const p = this.player;
    if (p.dead) return;
    p.dead = true;
    this.cameras.main.shake(200, 0.006);
    audio.sfx.bonk();
    // the erase effect only if you can actually see Crumb (not after he's fallen through the floor)
    if (this.duck.visible) eraseSprites(this, [this.duck], { duration: 600, depth: 20 });
    if (this.endless) { this.time.delayedCall(800, () => this.gameOver(message)); return; } // one life!
    this.showToast(`${message} Try again`);
    this.time.delayedCall(950, () => this.spawn());
  }

  // ENDLESS MODE: the run is over. Show how far you got.
  gameOver(message) {
    if (this.finished) return;
    this.finished = true;
    const { width: W, height: H } = this.scale;
    const meters = Math.floor(this.player.z);
    let best = 0;
    try { best = +(localStorage.getItem('duckdash-endless-best') || 0); } catch (e) { /* ignore */ }
    const newBest = meters > best;
    if (newBest) { best = meters; try { localStorage.setItem('duckdash-endless-best', String(best)); } catch (e) { /* ignore */ } }
    this.hintText.setText(''); this.warnText.setText(''); this.toast.setAlpha(0);
    audio.sfx[newBest ? 'finish' : 'fall']();

    const panel = this.add.graphics().setDepth(60);
    panel.fillStyle(0x1a1035, 0.92); panel.fillRoundedRect(W / 2 - 360, H / 2 - 220, 720, 440, 28);
    panel.lineStyle(4, 0xfff4dc, 0.9); panel.strokeRoundedRect(W / 2 - 360, H / 2 - 220, 720, 440, 28);
    const style = { fontFamily: FONT, color: '#fff4dc', align: 'center' };
    this.add.text(W / 2, H / 2 - 165, 'GAME OVER', { ...style, fontSize: '56px', fontStyle: 'bold' }).setOrigin(0.5).setDepth(61);
    this.add.text(W / 2, H / 2 - 105, message, { ...style, fontSize: '22px', color: '#ffb3b3' }).setOrigin(0.5).setDepth(61);
    const dist = this.add.text(W / 2, H / 2 - 45, `${meters} m`, {
      ...style, fontSize: '64px', fontStyle: 'bold', color: '#ffe066', stroke: '#3b1d4a', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(61).setScale(0.4);
    this.tweens.add({ targets: dist, scale: 1, duration: 450, ease: 'Back.out' });
    this.add.text(W / 2, H / 2 + 25,
      `${newBest ? 'NEW BEST!' : `Best: ${best} m`}   ·   Time: ${fmtTime(this.elapsed / 1000)}   ·   Bread crumbs: ${this.crumbs.got} (bag: ${wallet.crumbs})`,
      { ...style, fontSize: '20px' }).setOrigin(0.5).setDepth(61);
    const opts = { w: 280, h: 56, size: 26 };
    const buttons = [
      makeButton(this, W / 2, H / 2 + 100, 'Run again', () => this.scene.restart({ mode: 'endless' }), opts),
      makeButton(this, W / 2, H / 2 + 170, 'Menu', () => this.scene.start('Menu'), opts),
    ];
    buttons.forEach((b) => { b.bg.setDepth(61); b.text.setDepth(62); });
    this.time.delayedCall(700, () => keyboardMenu(this, buttons)); // a moment before keys work
  }

  // ------------------------------------------------------------------ drawing
  // Endless mode has no checkpoints: the colours and scenery change every ENDLESS_SECTION rows instead
  sectionInfo() {
    const z = this.player.z;
    if (this.endless) {
      const s = Math.floor(z / ENDLESS_SECTION);
      return { section: s % 5, t: (z % ENDLESS_SECTION) / ENDLESS_SECTION, p: (z / ENDLESS_SECTION) % (AREAS.length - 1) };
    }
    const cps = this.track.checkpoints;
    let p = 0;
    for (let i = 0; i < cps.length; i++) {
      const start = cps[i], end = i + 1 < cps.length ? cps[i + 1] : this.track.finishRow;
      if (z >= start) p = i + Phaser.Math.Clamp((z - start) / (end - start), 0, 1);
    }
    const secStart = cps[this.cpIndex], secEnd = cps[this.cpIndex + 1] ?? this.track.finishRow;
    return { section: this.sectionStyle(), t: Phaser.Math.Clamp((z - secStart) / (secEnd - secStart), 0, 1), p };
  }

  areaColors() {
    if (!this.endless) {
      const info = this.sectionInfo();
      const themes = this.track.themes;
      let a, b, t;
      if (themes) {
        // DEMO: each checkpoint has its own vibe. It changes quickly right as you reach the checkpoint.
        const cps = this.track.checkpoints;
        const i = this.cpIndex;
        a = THEMES[themes[Math.min(i, themes.length - 1)]];
        b = THEMES[themes[Math.min(i + 1, themes.length - 1)]];
        const next = cps[i + 1];
        t = next === undefined ? 0 : Phaser.Math.Clamp((this.player.z - (next - 6)) / 6, 0, 1);
      } else {
        // each part's colours come from its style; near the end of a part, blend into the next part's colours
        a = AREAS[info.section]; b = AREAS[this.sectionStyle(this.cpIndex + 1)];
        t = Phaser.Math.Clamp((info.t - 0.75) / 0.25, 0, 1);
      }
      const out = {};
      for (const key of Object.keys(a)) {
        if (typeof a[key] === 'number' && typeof b[key] === 'number') out[key] = mix(a[key], b[key], t);
        else out[key] = t < 0.5 ? a[key] : b[key];
      }
      out.progress = info.p;
      return out;
    }
    let p = this.sectionInfo().p;
    p = Phaser.Math.Clamp(p, 0, AREAS.length - 1);
    const i = Math.min(Math.floor(p), AREAS.length - 2);
    // stay on one area's colours for most of it, then blend at the end
    const t = Phaser.Math.Clamp((p - i - 0.75) / 0.25, 0, 1);
    const a = AREAS[i], b = AREAS[i + 1];
    const out = {};
    for (const key of Object.keys(a)) out[key] = mix(a[key], b[key], t);
    out.progress = p;
    return out;
  }

  draw(time, dt, now) {
    const { width: W, height: H } = this.scale;
    const p = this.player;
    const col = this.areaColors();
    const cosR = Math.cos(this.roll), sinR = Math.sin(this.roll);
    const rot = (pt) => ({ x: pt.x * cosR - pt.y * sinR, y: pt.x * sinR + pt.y * cosR });

    // --- background ---
    this.bg.clear();
    this.bg.fillGradientStyle(col.bgTop, col.bgTop, col.bgBottom, col.bgBottom, 1);
    this.bg.fillRect(0, 0, W, H);
    this.nebulas.forEach((n) => {
      const a = n.polar.a + this.roll;
      n.setPosition(this.cx + Math.cos(a) * n.polar.r, this.cy + Math.sin(a) * n.polar.r);
      n.setScale(n.polar.scale).setTint(col.nebula).setAlpha(0.22); // dim, so it never looks like a tile
    });
    // stars drift outwards like you're flying past them
    const speed = this.finished ? 2 : this.baseSpeed() * (this.boost > 0 ? BOOST : 1);
    this.starGfx.clear();
    for (const s of this.stars) {
      s.r += s.r * dt * 0.02 * speed;
      if (s.r > 800) { s.r = Phaser.Math.Between(20, 120); s.a = Math.random() * Math.PI * 2; }
      const a = s.a + this.roll;
      this.starGfx.fillStyle(0xffffff, Math.min(1, s.r / 300));
      this.starGfx.fillRect(this.cx + Math.cos(a) * s.r, this.cy + Math.sin(a) * s.r, s.size, s.size);
    }

    // --- background decorations (behind the tunnel) ---
    const sec = this.sectionInfo();
    const nearWind = this.track.winds.find((w) => p.z > w.start - 30 && p.z < w.end);
    this.scenery.update(time, dt, {
      section: sec.section, sectionT: sec.t,
      roll: this.roll, windDir: nearWind ? nearWind.dir : 0, speed,
    });

    // --- camera ---
    const pr = rot(wallPoint(p.u, Math.max(p.h, -3.5)));
    const camX = pr.x * 0.55;
    const camY = APOTHEM - CAM_UP;
    const camZ = p.z - CAM_BACK;
    const proj = (x, y, z) => {
      const dz = z - camZ;
      return { x: this.cx + ((x - camX) * FOCAL) / dz, y: this.cy + ((y - camY) * FOCAL) / dz };
    };

    // --- UFO far ahead: a bit bigger (closer) every checkpoint ---
    const bob = Math.sin(time / 300) * 6;
    const inBoss = p.z > this.track.bossStart && p.z < this.track.bossEnd;
    if (!this.finished) {
      const target = UFO_SCALE[this.sectionStyle()] *(inBoss ? 1 + Math.sin(time / 200) * 0.05 : 1);
      const sc = this.ufo.scale + (target - this.ufo.scale) * Math.min(1, dt * 2);
      const wobble = inBoss ? Math.sin(time / 500) * 60 : 0;
      this.ufo.setPosition(this.cx - camX * 20 + wobble, this.cy - 30 + bob).setScale(sc);
      this.bread.setPosition(this.ufo.x, this.ufo.y + 40 * sc + 8).setScale(sc);
    }

    // --- tunnel tiles, far to near ---
    const edges = this.laneEdges.map(([a, b]) => [rot(a), rot(b)]);
    const g = this.tunnel;
    g.clear();
    const rows = this.rows;
    const first = Math.max(0, Math.floor(camZ));
    const last = Math.min(rows.length - 1, first + VIEW_ROWS);
    const cpSet = new Set(this.track.checkpoints);
    const flash = Math.floor(time / 70) % 2 === 0;
    // far-away tiles fade towards a DARK colour (not the sky colour), so tiles never blend into the background
    const fogCol = mix(col.bgTop, 0x000000, 0.35);
    const special = (r) => cpSet.has(r) || cpSet.has(r - 1) || (r >= this.track.finishRow && r < this.track.finishRow + 2);
    // which windy stretches are on screen, so the tiles there can show the wind blowing across them
    const visWinds = this.finished ? [] : this.track.winds.filter((w) => w.end > first && w.start < last);
    const windDirAt = (r) => { for (const w of visWinds) if (r >= w.start && r < w.end) return w.dir; return 0; };

    // draws one tile from row zStart to row zEnd (1 or 2 rows long) in lane l
    const drawTile = (zStart, zEnd, l, type) => {
      const r = zStart;
      let z0 = zStart + INSET, z1 = zEnd - INSET;
      if (z1 - camZ < NEAR) return;
      if (z0 - camZ < NEAR) z0 = camZ + NEAR;
      const fog = Phaser.Math.Clamp((z0 - camZ - 6) / (VIEW_ROWS - 6), 0, 1);
      const [a, b] = edges[l];
      let base = lightTile((PATTERNS[col.pattern] || PATTERNS.checker)(r, l) ? col.tileA : col.tileB);
      if (type === PAD) base = 0x1f4f86; // pond water under the lily pad
      if (type === CRACKED) base = mix(base, 0x2a1a10, 0.45);
      if (type === CRACKED && this.crumbling.has(`${r},${l}`)) base = flash ? 0xff3b3b : 0xffffff; // about to fall!
      if (cpSet.has(r) || cpSet.has(r - 1)) base = 0x3ddc84;
      if (r >= this.track.finishRow && r < this.track.finishRow + 2) base = (l % 2) ? 0xffffff : 0x222222;
      const wd = windDirAt(r);
      // WIND: a glowing shimmer (like an aurora) ripples diagonally across the tiles in the wind's direction
      if (wd && type !== PAD) {
        const wave = Math.max(0, Math.sin(time * 0.008 - l * 0.55 * wd + r * 0.3));
        base = mix(base, col.windGlow ?? 0xc8f6ff, 0.6 * wave * wave);
      }
      const p1 = proj(a.x, a.y, z0), p2 = proj(b.x, b.y, z0), p3 = proj(b.x, b.y, z1), p4 = proj(a.x, a.y, z1);
      // (far tiles only fade a little, so even far away a hole (dark) still stands out from the tiles)
      g.fillStyle(mix(base, fogCol, fog * fog * 0.5), 1);
      g.fillPoints([p1, p2, p3, p4], true);
      if (type === PAD) {
          // A round lily pad lying on the tile, with a notch cut out and a little pink flower.
          // at(s, t) finds a point on the tile: s goes across (0..1), t goes along the tunnel (0..1)
          const at = (s, t) => ({
            x: (p1.x * (1 - s) + p2.x * s) * (1 - t) + (p4.x * (1 - s) + p3.x * s) * t,
            y: (p1.y * (1 - s) + p2.y * s) * (1 - t) + (p4.y * (1 - s) + p3.y * s) * t,
          });
          const f2 = fog * fog;
          const pad = [at(0.5, 0.5)]; // start at the centre so the notch is a wedge
          for (let k = 0; k <= 10; k++) {
            const a = 0.5 + (k / 10) * (Math.PI * 2 - 1); // leave a gap (the notch) near angle 0
            pad.push(at(0.5 + Math.cos(a) * 0.44, 0.5 + Math.sin(a) * 0.44));
          }
          g.fillStyle(mix(0x2f9a4a, fogCol, f2), 1); g.fillPoints(pad, true);
          // lighter inner ring
          const inner = [at(0.5, 0.5)];
          for (let k = 0; k <= 7; k++) {
            const a = 0.5 + (k / 7) * (Math.PI * 2 - 1);
            inner.push(at(0.5 + Math.cos(a) * 0.3, 0.5 + Math.sin(a) * 0.3));
          }
          g.fillStyle(mix(0x4cc26a, fogCol, f2), 1); g.fillPoints(inner, true);
          // the pink flower (only on nearby pads: far away it'd be too small to see anyway)
          if (fog < 0.5) {
            const fc = at(0.36, 0.36);
            const sz = Math.max(1.5, Math.abs(p2.x - p1.x) * 0.09);
            g.fillStyle(mix(0xff7ac8, fogCol, f2), 1); g.fillCircle(fc.x, fc.y, sz * 1.5);
            g.fillStyle(mix(0xffe14d, fogCol, f2), 1); g.fillCircle(fc.x, fc.y, sz * 0.6);
          }
        }
        // boss section: red warning lights flashing along the tunnel's corners
        if (inBoss && r % 5 === 0 && l % LANES_PER_SIDE === 0 && fog < 0.9) {
          const on = Math.floor(time / 250 + r / 5) % 2 === 0;
          const lp = proj(a.x, a.y, (z0 + z1) / 2);
          const lr = Math.max(2, (0.12 * FOCAL) / ((z0 + z1) / 2 - camZ));
          g.fillStyle(0xff2030, on ? 0.35 : 0.1); g.fillCircle(lp.x, lp.y, lr * 2.4);
          g.fillStyle(on ? 0xff5060 : 0x551018, 1); g.fillCircle(lp.x, lp.y, lr);
        }
        if (type === CRACKED && fog < 0.8) {
          g.lineStyle(2, 0x1a0d08, 0.8 * (1 - fog));
          g.lineBetween(p1.x, p1.y, (p1.x + p3.x) / 2 + 3, (p1.y + p3.y) / 2);
          g.lineBetween((p1.x + p3.x) / 2 + 3, (p1.y + p3.y) / 2, p3.x, p3.y);
          g.lineBetween(p2.x, p2.y, (p1.x + p3.x) / 2 + 3, (p1.y + p3.y) / 2);
        }
    };

    // Rows are drawn in pairs. If both rows of a pair have the same plain tile in a lane, draw ONE long tile:
    // half as many tiles on screen (less busy, and faster). Far pairs first, near pairs last.
    for (let base = last - (last % 2); base >= first - (first % 2); base -= 2) {
      const rowA = rows[base], rowB = rows[base + 1];
      if (!rowA) continue;
      for (let l = 0; l < LANES; l++) {
        const tA = rowA[l], tB = rowB ? rowB[l] : HOLE;
        const merge = rowB && tA === tB && tA !== HOLE && tA !== PAD && !special(base) && !special(base + 1)
          && !this.crumbling.has(`${base},${l}`) && !this.crumbling.has(`${base + 1},${l}`);
        if (merge) { drawTile(base, base + 2, l, tA); continue; }
        if (rowB && tB !== HOLE) drawTile(base + 1, base + 2, l, tB); // the further one first
        if (tA !== HOLE) drawTile(base, base + 1, l, tA);
      }
    }

    // --- lasers, bullets and wind streaks ---
    const fx = this.fx;
    fx.clear();
    const mid = (A, B, t) => ({ x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t });
    // --- LASERS: a warning stripe first, then the real beam ---
    for (const L of this.lasers) {
      const firing = now >= L.warnUntil;
      const charge = firing ? 1 : 1 - (L.warnUntil - now) / LASER_WARN; // 0 -> 1 while warning
      for (const lane of L.lanes) {
        const [a, b] = edges[lane];
        const z0 = Math.max(p.z - 2, camZ + NEAR), z1 = p.z + 40;
        const q1 = proj(a.x, a.y, z0), q2 = proj(b.x, b.y, z0), q3 = proj(b.x, b.y, z1), q4 = proj(a.x, a.y, z1);
        if (!firing) {
          // see-through red stripe that flashes faster as the laser charges up
          const blink = Math.floor(time / (140 - charge * 100)) % 2 === 0;
          fx.fillStyle(0xff2040, blink ? 0.35 + charge * 0.25 : 0.12);
          fx.fillPoints([q1, q2, q3, q4], true);
          // dashed edges
          fx.lineStyle(3, 0xffffff, 0.7);
          for (let d = 0; d < 1; d += 0.1) {
            const e0 = mid(q1, q4, d), e1 = mid(q1, q4, d + 0.05);
            const f0 = mid(q2, q3, d), f1 = mid(q2, q3, d + 0.05);
            fx.lineBetween(e0.x, e0.y, e1.x, e1.y); fx.lineBetween(f0.x, f0.y, f1.x, f1.y);
          }
          // "!" warning markers along the lane
          for (const d of [0.04, 0.12, 0.25]) {
            const m = mid(mid(q1, q2, 0.5), mid(q4, q3, 0.5), d);
            const sz = Math.max(4, Math.abs(q2.x - q1.x) * (0.3 - d * 0.6));
            fx.fillStyle(0xffffff, blink ? 1 : 0.5);
            fx.fillRect(m.x - sz * 0.12, m.y - sz, sz * 0.24, sz * 0.7);
            fx.fillCircle(m.x, m.y + sz * 0.15, sz * 0.13);
          }
        } else {
          // the beam: wide red glow, pink middle, flickering white-hot core
          const flick = 0.85 + Math.random() * 0.15;
          fx.fillStyle(0xff2040, 0.35); fx.fillPoints([mid(q1, q2, -0.15), mid(q1, q2, 1.15), mid(q4, q3, 1.15), mid(q4, q3, -0.15)], true);
          fx.fillStyle(0xff4f8a, 0.75); fx.fillPoints([q1, q2, q3, q4], true);
          fx.fillStyle(0xffffff, flick);
          fx.fillPoints([mid(q1, q2, 0.3), mid(q1, q2, 0.7), mid(q4, q3, 0.7), mid(q4, q3, 0.3)], true);
          // sparks flying off the beam
          fx.fillStyle(0xffe14d, 1);
          for (let k = 0; k < 6; k++) {
            const m = mid(mid(q1, q2, Math.random()), mid(q4, q3, Math.random()), Math.random() * 0.3);
            fx.fillRect(m.x, m.y, 3, 3);
          }
        }
      }
      // the UFO glows brighter while it charges
      if (!firing) {
        fx.fillStyle(0xff3060, 0.15 + charge * 0.35);
        fx.fillCircle(this.ufo.x, this.ufo.y + 20 * this.ufo.scale, (20 + charge * 40) * this.ufo.scale * 2);
        fx.fillStyle(0xffffff, charge * 0.8);
        fx.fillCircle(this.ufo.x, this.ufo.y + 20 * this.ufo.scale, 8 * charge * this.ufo.scale * 2);
      }
    }
    // --- BULLETS: glowing plasma orbs with spinning spikes and a fading trail ---
    for (const b of this.bullets) {
      if (b.z - camZ < NEAR + 0.2) continue;
      for (let k = 3; k >= 0; k--) {
        const tz = b.z + k * 0.6; // trail behind it (further away)
        const pt = rot(wallPoint(b.u, 0.45));
        const s = proj(pt.x, pt.y, tz);
        const r = (0.28 * FOCAL) / (tz - camZ);
        if (k > 0) { fx.fillStyle(0xff3b8a, 0.25 - k * 0.05); fx.fillCircle(s.x, s.y, r * (1 - k * 0.15)); continue; }
        fx.fillStyle(0xff3b8a, 0.35); fx.fillCircle(s.x, s.y, r * 1.9);
        // spikes
        const spin = time / 120;
        fx.fillStyle(0xffd0e8, 0.9);
        for (let j = 0; j < 4; j++) {
          const a = spin + (j * Math.PI) / 2;
          fx.fillTriangle(
            s.x + Math.cos(a) * r * 1.6, s.y + Math.sin(a) * r * 1.6,
            s.x + Math.cos(a + 0.5) * r * 0.7, s.y + Math.sin(a + 0.5) * r * 0.7,
            s.x + Math.cos(a - 0.5) * r * 0.7, s.y + Math.sin(a - 0.5) * r * 0.7,
          );
        }
        fx.fillStyle(0xff6bb0, 1); fx.fillCircle(s.x, s.y, r);
        fx.fillStyle(0xffffff, 1); fx.fillCircle(s.x - r * 0.15, s.y - r * 0.15, r * 0.45);
      }
    }
    // --- ASTEROIDS: lumpy spinning space rocks ---
    for (const r of this.rocks) {
      if (r.z - camZ < NEAR + 0.3) continue;
      const pt = rot(wallPoint(r.u, r.size));
      const s = proj(pt.x, pt.y, r.z);
      const rad = (r.size * FOCAL) / (r.z - camZ);
      const shape = [];
      for (let k = 0; k < 9; k++) {
        const a = r.spin + (k / 9) * Math.PI * 2;
        const bump = 0.8 + 0.2 * Math.sin(k * 2.7 + r.seed * 10);
        shape.push({ x: s.x + Math.cos(a) * rad * bump, y: s.y + Math.sin(a) * rad * bump });
      }
      fx.fillStyle(0x000000, 0.3); fx.fillEllipse(s.x, s.y + rad * 1.05, rad * 1.6, rad * 0.4);
      fx.fillStyle(0x7a6a5c, 1); fx.fillPoints(shape, true);
      fx.fillStyle(0x5a4c40, 1);
      fx.fillCircle(s.x + Math.cos(r.spin) * rad * 0.35, s.y + Math.sin(r.spin) * rad * 0.35, rad * 0.22);
      fx.fillCircle(s.x + Math.cos(r.spin + 2.5) * rad * 0.4, s.y + Math.sin(r.spin + 2.5) * rad * 0.4, rad * 0.15);
      fx.fillStyle(0xa8988a, 1); fx.fillCircle(s.x - rad * 0.3, s.y - rad * 0.35, rad * 0.18);
    }
    // --- CANDY: striped candy canes and shiny gumdrops standing on the tiles (far ones first) ---
    const props = this.track.props || [];
    for (let k = props.length - 1; k >= 0; k--) {
      const c = props[k];
      const dz = c.z - camZ;
      if (dz < NEAR + 0.4 || dz > VIEW_ROWS * 0.85) continue;
      const fade = 1 - Phaser.Math.Clamp((dz - 6) / (VIEW_ROWS * 0.85 - 6), 0, 1) * 0.8;
      const at = (du, h) => { const q = rot(wallPoint(c.lane + 0.5 + du, h)); return proj(q.x, q.y, c.z); };
      const unit = FOCAL / dz; // pixels per tile at this distance
      const foot = at(0, 0);
      fx.fillStyle(0x000000, 0.25 * fade); fx.fillEllipse(foot.x, foot.y, unit * 0.6, unit * 0.18);
      if (c.kind === 'cane') {
        // red and white striped pole with a hook on top
        const H = 1.0, seg = 5;
        for (let s = 0; s < seg; s++) {
          const a = at(0, (s / seg) * H), b = at(0, ((s + 1) / seg) * H);
          fx.lineStyle(unit * 0.16, s % 2 ? 0xffffff : 0xff2e4d, fade);
          fx.lineBetween(a.x, a.y, b.x, b.y);
        }
        let prev = at(0, H);
        for (let s = 1; s <= 6; s++) {
          const ang = (s / 6) * Math.PI;
          const q = at(0.2 - 0.2 * Math.cos(ang), H + 0.2 * Math.sin(ang));
          fx.lineStyle(unit * 0.16, s % 2 ? 0xff2e4d : 0xffffff, fade);
          fx.lineBetween(prev.x, prev.y, q.x, q.y);
          prev = q;
        }
      } else if (this.squished && this.squished.has(c)) {
        // a gumdrop you ran into: squashed flat into a sticky puddle
        const col = [0xff5fb8, 0x6dff8a, 0xb46bff, 0xffa53c][Math.floor(c.seed * 4)];
        fx.fillStyle(col, 0.85 * fade); fx.fillEllipse(foot.x, foot.y, unit * 0.9, unit * 0.22);
      } else {
        // a round gumdrop with sugar sparkles
        const col = [0xff5fb8, 0x6dff8a, 0xb46bff, 0xffa53c][Math.floor(c.seed * 4)];
        const mid = at(0, 0.3);
        fx.fillStyle(mix(col, 0x000000, 0.25), fade); fx.fillEllipse(mid.x, mid.y + unit * 0.06, unit * 0.8, unit * 0.64);
        fx.fillStyle(col, fade); fx.fillEllipse(mid.x, mid.y, unit * 0.76, unit * 0.6);
        fx.fillStyle(0xffffff, 0.75 * fade); fx.fillEllipse(mid.x - unit * 0.12, mid.y - unit * 0.1, unit * 0.14, unit * 0.09);
        fx.fillStyle(0xffffff, 0.9 * fade);
        for (let s = 0; s < 4; s++) fx.fillRect(mid.x + Math.cos(s * 1.7 + c.seed * 9) * unit * 0.18, mid.y + Math.sin(s * 2.3) * unit * 0.12, Math.max(1, unit * 0.03), Math.max(1, unit * 0.03));
      }
    }

    // --- BREAD CRUMBS floating in the tunnel ---
    for (const c of this.crumbItems) {
      const show = !c.got && c.z > camZ + 1 && c.z < camZ + VIEW_ROWS * 0.7;
      c.img.setVisible(show);
      if (!show) continue;
      const pt = rot(wallPoint(c.lane + 0.5, c.h + Math.sin(time / 250 + c.z) * 0.08));
      const s = proj(pt.x, pt.y, c.z);
      c.img.setPosition(s.x, s.y).setScale((0.55 * FOCAL) / (c.z - camZ) / 40).setAngle(Math.sin(time / 300 + c.z) * 15);
    }
    // --- WIND IN THE TUNNEL: streaks of dust and leaves whipping around the tube inside every windy
    // stretch. They live at real spots in the tunnel, so you can see the windy part coming from far away.
    for (const w of this.track.winds) {
      if (this.finished || p.z < w.start - VIEW_ROWS - 5 || p.z > w.end + 5) { w.bits = null; continue; }
      if (!w.bits) {
        w.bits = [];
        const n = Math.round((w.end - w.start) * 2.2);
        for (let i = 0; i < n; i++) {
          w.bits.push({
            u: Math.random() * LANES, z: w.start + Math.random() * (w.end - w.start),
            h: 0.15 + Math.random() * 1.8, sp: 6 + Math.random() * 6, leaf: Math.random() < 0.3,
          });
        }
      }
      for (const b of w.bits) {
        b.u += w.dir * b.sp * dt;
        const dz = b.z - camZ;
        if (dz < NEAR + 0.6 || dz > VIEW_ROWS * 0.85) continue;
        const fade = 1 - dz / (VIEW_ROWS * 0.85);
        const hp = rot(wallPoint(b.u, b.h)), tp = rot(wallPoint(b.u - w.dir * 1.4, b.h));
        const head = proj(hp.x, hp.y, b.z), tail = proj(tp.x, tp.y, b.z);
        const thick = Math.max(1.5, (0.07 * FOCAL) / dz);
        if (b.leaf) {
          // a little tumbling leaf
          const sz = thick * 2.2, a = time / 70 + b.z;
          fx.fillStyle(0x8fe36a, 0.9 * fade);
          fx.fillTriangle(head.x + Math.cos(a) * sz, head.y + Math.sin(a) * sz,
            head.x - Math.cos(a) * sz, head.y - Math.sin(a) * sz,
            head.x + Math.cos(a + 1.6) * sz * 0.5, head.y + Math.sin(a + 1.6) * sz * 0.5);
        } else {
          // dark streak with a bright core, so it shows up on both light and dark tiles
          fx.lineStyle(thick * 1.8, 0x0b2f44, 0.6 * fade);
          fx.lineBetween(tail.x, tail.y, head.x, head.y);
          fx.lineStyle(thick * 0.7, 0xffffff, 0.9 * fade);
          fx.lineBetween(tail.x, tail.y, head.x, head.y);
        }
      }
    }

    const wind = this.windAt(p.z);
    if (wind && !this.finished) {
      // WIND: a cold blue tint that pulses with each gust, plus lots of fast streaks and flying specks
      const gust = 0.5 + 0.5 * Math.sin(time / 260);
      fx.fillStyle(0x0a2a4a, 0.08 + gust * 0.12); // the screen darkens like a storm with each gust
      fx.fillRect(0, 0, W, H);
      for (let i = 0; i < 46; i++) {
        const y = (i * 73 + Math.sin(time / 300 + i) * 18) % H;
        const speed = 1.6 + (i % 5) * 0.35;
        const len = 120 + (i % 4) * 70;
        const x = ((time * speed * wind.dir + i * 211) % (W + 400) + W + 400) % (W + 400) - 200;
        const thick = i % 3 === 0 ? 5 : 3;
        fx.lineStyle(thick, i % 2 ? 0xffffff : 0x0b2f44, 0.35 + gust * 0.35);
        fx.lineBetween(x, y, x - wind.dir * len, y + Math.sin(i) * 10);
      }
      fx.fillStyle(0xffffff, 0.8);
      for (let i = 0; i < 30; i++) {
        const y = (i * 131) % H;
        const x = ((time * 2.4 * wind.dir + i * 157) % (W + 100) + W + 100) % (W + 100) - 50;
        fx.fillRect(x, y + Math.sin(time / 120 + i) * 6, 4, 3);
      }
    }

    // --- Crumb ---
    if (!p.dead) {
      const feet = proj(pr.x, pr.y, p.z);
      const dzP = p.z - camZ;
      const scale = (0.95 * FOCAL) / dzP / 80; // Crumb is about 0.95 lanes tall; picture is 80px
      let frame = 'duckJump';
      if (p.grounded) {
        this.runAnim += dt * this.baseSpeed() * 0.9;
        frame = Math.floor(this.runAnim) % 2 ? 'duckRunA' : 'duckRunB';
      }
      const sideRoll = this.roll - this.targetRoll; // tilt with the tunnel while it is turning
      // in the wind Crumb leans hard into it
      const windNow = this.windAt(p.z);
      const windLean = windNow && !this.finished ? -windNow.dir * (0.22 + Math.sin(time / 90) * 0.05) : 0;
      this.duck.setTexture(frame).setPosition(feet.x, feet.y).setScale(scale).setRotation(sideRoll + windLean);
      // once Crumb drops below the floor (through a hole) he's gone from view; otherwise he'd look like
      // he's still standing on the tiles
      this.duck.setVisible(p.h > -0.2);
      // shadow on the floor below Crumb while jumping
      const fp = rot(wallPoint(p.u, 0));
      const floor = proj(fp.x, fp.y, p.z);
      const showShadow = !p.grounded && p.h > 0 && this.tileAt(p.z, p.u) !== HOLE;
      this.shadow.setVisible(showShadow).setPosition(floor.x, floor.y).setScale(scale * 1.2, scale * 1.2);
    } else this.shadow.setVisible(false);
  }

  // ------------------------------------------------------------------ HUD
  makeHud() {
    const { width: W, height: H } = this.scale;
    const style = { fontFamily: FONT, fontSize: '22px', color: '#fff4dc', stroke: '#1a1035', strokeThickness: 5 };
    this.cpText = this.add.text(20, 16, '', style).setDepth(50);
    this.timeText = this.add.text(20, 46, '', style).setDepth(50);
    this.add.text(W - 20, 16, `${this.endless ? 'R = restart' : 'R = back to checkpoint'}   P / Esc = pause`, { ...style, fontSize: '18px' }).setOrigin(1, 0).setDepth(50);
    this.progress = this.add.graphics().setDepth(50);
    // click a checkpoint dot on the bar to jump to it: any checkpoint you've EVER reached in this level
    // (remembered between runs). Jumping ahead of where you've got to in THIS run makes it a practice run.
    this.levelId = this.mode === 'demo' ? 'demo2' : `story${3 + this.stage}`;
    this.reachedCp = this.endless ? 0 : savedCheckpoint(this.levelId); // furthest ever
    this.runCp = 0;                                                      // furthest reached in this run
    this.practice = false;
    if (!this.endless) {
      const end = this.track.finishRow;
      this.barDots = this.track.checkpoints.map((cp) => W / 2 - 200 + (400 * cp) / end);
      this.barClicks = checkpointBarClicks(this, this.barDots, 30,
        (i) => !this.finished && i <= this.reachedCp,
        (i) => {
          if (i > this.runCp) this.practice = true; // skipped ahead: this run's time won't count
          const forward = i > this.cpIndex;
          this.cpIndex = i; this.spawn();
          this.showToast(`${forward ? 'Skip to' : 'Back to'} checkpoint ${i}`);
        });
    }
    this.hintText = this.add.text(W / 2, H - 70, '', {
      ...style, fontSize: '30px', fontStyle: 'bold', align: 'center', wordWrap: { width: 1000 },
    }).setOrigin(0.5).setDepth(50);
    this.toast = this.add.text(W / 2, 150, '', { ...style, fontSize: '40px', fontStyle: 'bold' })
      .setOrigin(0.5).setDepth(50).setAlpha(0);
    this.warnText = this.add.text(W / 2, 240, '', {
      ...style, fontSize: '44px', fontStyle: 'bold', color: '#ff3b3b', stroke: '#ffffff', strokeThickness: 7, align: 'center',
    }).setOrigin(0.5).setDepth(51);
  }

  showToast(msg) {
    this.toast.setText(msg).setAlpha(1).setScale(0.6);
    this.tweens.killTweensOf(this.toast);
    this.tweens.add({ targets: this.toast, scale: 1, duration: 250, ease: 'Back.out' });
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 1400, duration: 500 });
  }

  updateHud(now) {
    const { width: W } = this.scale;
    const p = this.player;
    this.timeText.setText(`Time ${fmtTime(this.elapsed / 1000)}`);
    if (this.endless) {
      // Endless: show how far you've run (1 row = 1 meter) instead of checkpoints and a progress bar
      if (this.bestDist === undefined) {
        try { this.bestDist = +(localStorage.getItem('duckdash-endless-best') || 0); } catch (e) { this.bestDist = 0; }
      }
      this.cpText.setText(`Distance ${Math.floor(p.z)} m   (best ${this.bestDist} m)`);
      this.progress.clear();
    } else this.cpText.setText(`Checkpoint ${this.cpIndex} / ${this.track.checkpoints.length - 1}`);

    const end = this.track.finishRow;
    if (!this.endless) {
    const t = Phaser.Math.Clamp(p.z / end, 0, 1);
    const bx = W / 2 - 200, by = 30, bw = 400;
    this.progress.clear();
    this.progress.fillStyle(0x000000, 0.5); this.progress.fillRoundedRect(bx, by - 6, bw, 12, 6);
    this.progress.fillStyle(0xffd23f); this.progress.fillRoundedRect(bx, by - 6, Math.max(12, bw * t), 12, 6);
    this.track.checkpoints.forEach((cp, i) => {
      const x = this.barDots[i];
      const canClick = i <= this.reachedCp && !this.finished;
      const hover = canClick && this.barClicks.hovered === i;
      if (hover) { this.progress.lineStyle(3, 0xffffff, 1); this.progress.strokeCircle(x, by, 10); } // ring under the mouse
      this.progress.fillStyle(canClick ? 0x3ddc84 : 0xfff4dc);
      this.progress.fillCircle(x, by, hover ? 7 : 5);
    });
    this.progress.fillStyle(0xb6ff3b); this.progress.fillCircle(bx + bw, by, 8);
    }

    // tutorial hint: show the one we're coming up to
    const h = this.track.hints.find((x) => p.z > x.row - 25 && p.z < x.row + 8);
    this.hintText.setText(h && !this.finished ? h.text : '');

    // flashing wind warning just before (and during) a windy stretch, with an arrow for the direction
    const blink = Math.floor(now * 4) % 2 === 0;
    const soon = this.track.winds.find((w) => p.z > w.start - 30 && p.z < w.end);
    if (soon && !this.finished) {
      const arrow = soon.dir > 0 ? '→ → →' : '← ← ←';
      const before = p.z < soon.start;
      this.warnText.setText(before ? `⚠ WARNING: WIND ⚠\n${arrow}` : `${arrow}     ${arrow}`) // (just arrows while it blows)
        .setAlpha(blink ? 1 : 0.45)
        .setScale(1 + Math.sin(now * 12) * 0.06); // pulsing, so it really grabs your attention
      // a warning siren beep just before the wind hits
      if (before && blink && !this.windBeep) { audio.sfx.select(); this.windBeep = true; }
      if (!blink) this.windBeep = false;
    } else this.warnText.setText('').setScale(1);
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    audio.sfx.finish();
    // clear any pop-up messages so nothing sits on top of the finish panel
    this.tweens.killTweensOf(this.toast);
    this.toast.setAlpha(0);
    this.hintText.setText('');
    this.warnText.setText('');
    this.bullets.length = 0; this.lasers.length = 0;
    const demo = this.mode === 'demo';
    const n = this.storyIndex;
    const last = demo || n === STORY.length - 1; // the last level: you catch the UFO
    if (last) this.tweens.add({ targets: [this.ufo, this.bread], scale: 1.1, y: this.cy - 110, duration: 1500, ease: 'Cubic.out' });
    else this.tweens.add({ targets: [this.ufo, this.bread], scale: 0.05, duration: 1500, ease: 'Cubic.in' }); // it zooms off ahead
    const lines = ['The UFO speeds deeper into the tunnel...', 'So close! The UFO is right ahead!', 'Crumb caught the UFO... but who is flying it?'];
    levelCompletePanel(this, {
      title: demo ? 'Demo complete!' : `Level ${n + 1} complete!`, secs: this.elapsed / 1000,
      limits: demo ? [82, 100] : STAR_LIMITS[this.stage - 1], levelKey: this.practice ? null : demo ? 'demo2' : `story${n + 1}`,
      line: demo ? lines[2] : lines[this.stage - 1],
      crumbs: { got: this.crumbs.got, total: this.crumbs.total },
      onDone: () => (demo
        ? this.scene.start('Cutscene', { id: 'ending', next: 'Menu', fast: true })
        : startStoryLevel(this, n + 1)), // the last level goes on to the ending
    });
  }
}
