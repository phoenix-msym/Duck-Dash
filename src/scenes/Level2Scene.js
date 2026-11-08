import { makeTextures } from '../art.js';
import { createControls } from '../controls.js';
import { settings } from '../settings.js';
import { gyro } from '../gyro.js';
import { buildLevel2, LANES, LANES_PER_SIDE, SIDES, HOLE, PAD, CRACKED } from '../level2Track.js';
import { FONT, eraseSprites, unerase, levelCompletePanel, fmtTime, crumbHud } from '../ui.js';
import { audio } from '../audio.js';
import { addPauseButton } from './PauseScene.js';
import { level2Scenery } from '../scenery.js';

// ---- Runner tuning ----
const SPEEDS = [9, 9.8, 10.4, 10.8, 11.2]; // rows per second in each section (basics, holes, wall run, wind, boss)
const SIDE_SPEED = 8.5;   // lanes per second when holding A / D
const JUMP_POWER = 10.2;
const GRAVITY = 34.6;
const FAST_FALL = 2.5;    // gravity multiplier while holding S in the air
const COYOTE_TIME = 0.12; // seconds you can still jump after running off an edge
const BOOST = 1.6;        // lily pad speed multiplier
const BOOST_TIME = 1.2;   // seconds a lily pad boost lasts
const CRUMBLE_DELAY = 0.35;// seconds before a touched cracked tile falls
const WIND = 2.4;         // lanes per second the wind pushes you
const STAR_LIMITS = [75, 100]; // seconds: under the first = 3 stars, under the second = 2 stars
const ROCK_EVERY = 0.55;  // seconds between asteroids in the asteroid section
const ROCK_SPEED = 6;     // rows per second the asteroids tumble towards you

// ---- Boss fight tuning ----
const BULLET_EVERY = 1.2;  // seconds between bullets
const BULLET_SPEED = 7;    // rows per second the bullets fly towards you
const LASER_EVERY = 3.4;   // seconds between lasers
const LASER_WARN = 1.2;    // seconds of red warning before the laser fires
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
// how big the UFO looks in each section: small and far at the start, closer every checkpoint
const UFO_SCALE = [0.12, 0.17, 0.22, 0.28, 0.45];

function mix(a, b, t) {
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = (a & 255) + (((b & 255) - (a & 255)) * t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
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

  create() {
    makeTextures(this);
    const { width: W, height: H } = this.scale;
    this.cx = W / 2; this.cy = H / 2 - 40;
    this.controls = createControls(this);
    this.space = this.input.keyboard.addKey('SPACE');
    this.track = buildLevel2();
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
    this.scenery = level2Scenery(this); // planets, space junk, asteroid belt, gas clouds, mothership, comets

    // the UFO, far down the tunnel
    this.ufo = this.add.image(this.cx, this.cy, 'ufo').setDepth(3);
    this.bread = this.add.image(this.cx, this.cy, 'egg').setDepth(3); // the stolen egg

    this.tunnel = this.add.graphics().setDepth(4);
    this.fx = this.add.graphics().setDepth(5);      // lasers, bullets, wind streaks
    this.shadow = this.add.ellipse(0, 0, 60, 16, 0x000000, 0.35).setDepth(5);
    this.duck = this.add.image(0, 0, 'duckRunA').setOrigin(0.5, 0.95).setDepth(6);

    this.makeHud();
    // bread crumbs floating in the tunnel (one picture each, positioned every frame)
    this.crumbItems = this.track.crumbs.map((c) => ({ ...c, got: false, img: this.add.image(0, 0, 'crumb').setDepth(5).setVisible(false) }));
    this.crumbs = crumbHud(this, { total: this.crumbItems.length });
    this.spawn();

    this.input.keyboard.on('keydown-R', () => { if (!this.finished) this.spawn(); });
    addPauseButton(this, false); // P / Esc / the II button
    if (settings.controlMode === 'gyro' && !gyro.ready()) {
      this.time.delayedCall(600, () => this.showToast('Connect the HW-123 in Settings'));
    }
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
    this.rows = this.track.rows.map((r) => r.slice());
    this.crumbling = new Map(); // "row,lane" -> time (seconds) it falls
    this.boost = 0;
    this.bullets = [];
    this.lasers = [];
    this.bulletTimer = 1.5;
    this.laserTimer = 2.5;
    this.rocks = [];
    this.rockTimer = 1;
    unerase([this.duck]);
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
    const speed = SPEEDS[Math.min(this.cpIndex, SPEEDS.length - 1)] * (this.boost > 0 ? BOOST : 1);
    p.z += speed * dt;
    p.u += (c.right - c.left) * SIDE_SPEED * dt;
    const wind = this.windAt(p.z);
    if (wind) p.u += wind.dir * WIND * dt;

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
      if (p.h < -1.6 && !p.dead) this.die('Lost in space!');
    }

    // checkpoints
    const next = this.track.checkpoints[this.cpIndex + 1];
    if (next !== undefined && p.z > next) {
      this.cpIndex++;
      this.showToast(this.cpIndex === this.track.checkpoints.length - 1 ? 'BOSS FIGHT!' : `Checkpoint ${this.cpIndex}!`);
      audio.sfx.checkpoint();
    }
    if (p.z > this.track.finishRow) this.finish();
  }

  // Stepping on a cracked tile sets off the cracked tiles around it and just ahead: they fall soon after.
  // (Only a few rows ahead, so if you keep running they collapse right behind you, not in front of you.)
  startCrumble(r, l, now) {
    for (let rr = r; rr < r + 3; rr++) {
      const row = this.rows[rr];
      if (!row) break;
      for (let dl = -1; dl <= 1; dl++) {
        const ll = (l + dl + LANES) % LANES;
        const key = `${rr},${ll}`;
        if (row[ll] === CRACKED && !this.crumbling.has(key)) {
          this.crumbling.set(key, now + CRUMBLE_DELAY + (rr - r) * 0.04);
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
      const other = (lane + (Math.random() < 0.5 ? -1 : 1) + LANES) % LANES;
      this.lasers.push({ lanes: [lane, other], warnUntil: now + LASER_WARN, fireUntil: now + LASER_WARN + LASER_FIRE });
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
    this.showToast(`${message} Try again`);
    audio.sfx.bonk();
    eraseSprites(this, [this.duck], { duration: 600, depth: 20 });
    this.time.delayedCall(950, () => this.spawn());
  }

  // ------------------------------------------------------------------ drawing
  areaColors() {
    const cps = this.track.checkpoints;
    const z = this.player.z;
    let p = 0;
    for (let i = 0; i < cps.length; i++) {
      const start = cps[i], end = i + 1 < cps.length ? cps[i + 1] : this.track.finishRow;
      if (z >= start) p = i + Phaser.Math.Clamp((z - start) / (end - start), 0, 1);
    }
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
    const speed = this.finished ? 2 : SPEEDS[Math.min(this.cpIndex, SPEEDS.length - 1)] * (this.boost > 0 ? BOOST : 1);
    this.starGfx.clear();
    for (const s of this.stars) {
      s.r += s.r * dt * 0.02 * speed;
      if (s.r > 800) { s.r = Phaser.Math.Between(20, 120); s.a = Math.random() * Math.PI * 2; }
      const a = s.a + this.roll;
      this.starGfx.fillStyle(0xffffff, Math.min(1, s.r / 300));
      this.starGfx.fillRect(this.cx + Math.cos(a) * s.r, this.cy + Math.sin(a) * s.r, s.size, s.size);
    }

    // --- background decorations (behind the tunnel) ---
    const cps = this.track.checkpoints;
    const secStart = cps[this.cpIndex], secEnd = cps[this.cpIndex + 1] ?? this.track.finishRow;
    const nearWind = this.track.winds.find((w) => p.z > w.start - 30 && p.z < w.end);
    this.scenery.update(time, dt, {
      section: Math.min(this.cpIndex, 4),
      sectionT: Phaser.Math.Clamp((p.z - secStart) / (secEnd - secStart), 0, 1),
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
      const target = UFO_SCALE[Math.min(this.cpIndex, UFO_SCALE.length - 1)] * (inBoss ? 1 + Math.sin(time / 200) * 0.05 : 1);
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

    // draws one tile from row zStart to row zEnd (1 or 2 rows long) in lane l
    const drawTile = (zStart, zEnd, l, type) => {
      const r = zStart;
      let z0 = zStart + INSET, z1 = zEnd - INSET;
      if (z1 - camZ < NEAR) return;
      if (z0 - camZ < NEAR) z0 = camZ + NEAR;
      const fog = Phaser.Math.Clamp((z0 - camZ - 6) / (VIEW_ROWS - 6), 0, 1);
      const [a, b] = edges[l];
      let base = (Math.floor(r / 2) + l) % 2 ? col.tileA : col.tileB;
      if (type === PAD) base = 0x1f4f86; // pond water under the lily pad
      if (type === CRACKED) base = mix(base, 0x2a1a10, 0.45);
      if (type === CRACKED && this.crumbling.has(`${r},${l}`)) base = flash ? 0xff3b3b : 0xffffff; // about to fall!
      if (cpSet.has(r) || cpSet.has(r - 1)) base = 0x3ddc84;
      if (r >= this.track.finishRow && r < this.track.finishRow + 2) base = (l % 2) ? 0xffffff : 0x222222;
      const p1 = proj(a.x, a.y, z0), p2 = proj(b.x, b.y, z0), p3 = proj(b.x, b.y, z1), p4 = proj(a.x, a.y, z1);
      g.fillStyle(mix(base, fogCol, fog * fog), 1);
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
    // --- BREAD CRUMBS floating in the tunnel ---
    for (const c of this.crumbItems) {
      const show = !c.got && c.z > camZ + 1 && c.z < camZ + VIEW_ROWS * 0.7;
      c.img.setVisible(show);
      if (!show) continue;
      const pt = rot(wallPoint(c.lane + 0.5, c.h + Math.sin(time / 250 + c.z) * 0.08));
      const s = proj(pt.x, pt.y, c.z);
      c.img.setPosition(s.x, s.y).setScale((0.55 * FOCAL) / (c.z - camZ) / 40).setAngle(Math.sin(time / 300 + c.z) * 15);
    }
    const wind = this.windAt(p.z);
    if (wind && !this.finished) {
      fx.lineStyle(3, 0xffffff, 0.25);
      for (let i = 0; i < 18; i++) {
        const y = ((i * 97) % H);
        const x = ((time * 1.2 * wind.dir + i * 211) % (W + 200) + W + 200) % (W + 200) - 100;
        fx.lineBetween(x, y, x - wind.dir * 120, y);
      }
    }

    // --- Crumb ---
    if (!p.dead) {
      const feet = proj(pr.x, pr.y, p.z);
      const dzP = p.z - camZ;
      const scale = (0.95 * FOCAL) / dzP / 80; // Crumb is about 0.95 lanes tall; picture is 80px
      let frame = 'duckJump';
      if (p.grounded) {
        this.runAnim += dt * SPEEDS[Math.min(this.cpIndex, SPEEDS.length - 1)] * 0.9;
        frame = Math.floor(this.runAnim) % 2 ? 'duckRunA' : 'duckRunB';
      }
      const sideRoll = this.roll - this.targetRoll; // tilt with the tunnel while it is turning
      this.duck.setTexture(frame).setPosition(feet.x, feet.y).setScale(scale).setRotation(sideRoll);
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
    this.add.text(W - 20, 16, 'R = back to checkpoint   P / Esc = pause', { ...style, fontSize: '18px' }).setOrigin(1, 0).setDepth(50);
    this.progress = this.add.graphics().setDepth(50);
    this.hintText = this.add.text(W / 2, H - 70, '', {
      ...style, fontSize: '30px', fontStyle: 'bold', align: 'center', wordWrap: { width: 1000 },
    }).setOrigin(0.5).setDepth(50);
    this.toast = this.add.text(W / 2, 150, '', { ...style, fontSize: '40px', fontStyle: 'bold' })
      .setOrigin(0.5).setDepth(50).setAlpha(0);
    this.warnText = this.add.text(W / 2, 240, '', {
      ...style, fontSize: '46px', fontStyle: 'bold', color: '#ff4a4a', stroke: '#ffffff', strokeThickness: 6,
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
    this.cpText.setText(`Checkpoint ${this.cpIndex} / ${this.track.checkpoints.length - 1}`);
    this.timeText.setText(`Time ${fmtTime(this.elapsed / 1000)}`);

    const end = this.track.finishRow;
    const t = Phaser.Math.Clamp(p.z / end, 0, 1);
    const bx = W / 2 - 200, by = 30, bw = 400;
    this.progress.clear();
    this.progress.fillStyle(0x000000, 0.5); this.progress.fillRoundedRect(bx, by - 6, bw, 12, 6);
    this.progress.fillStyle(0xffd23f); this.progress.fillRoundedRect(bx, by - 6, Math.max(12, bw * t), 12, 6);
    this.track.checkpoints.forEach((cp, i) => {
      this.progress.fillStyle(i <= this.cpIndex ? 0x3ddc84 : 0xfff4dc);
      this.progress.fillCircle(bx + (bw * cp) / end, by, 5);
    });
    this.progress.fillStyle(0xb6ff3b); this.progress.fillCircle(bx + bw, by, 8);

    // tutorial hint: show the one we're coming up to
    const h = this.track.hints.find((x) => p.z > x.row - 25 && p.z < x.row + 8);
    this.hintText.setText(h && !this.finished ? h.text : '');

    // flashing wind warning just before (and during) a windy stretch, with an arrow for the direction
    const blink = Math.floor(now * 4) % 2 === 0;
    const soon = this.track.winds.find((w) => p.z > w.start - 30 && p.z < w.end);
    if (soon && !this.finished) {
      const arrow = soon.dir > 0 ? '→ → →' : '← ← ←';
      this.warnText.setText(p.z < soon.start ? `⚠ WARNING: WIND ⚠\n${arrow}` : arrow).setAlpha(blink ? 1 : 0.35);
    } else this.warnText.setText('');
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    audio.sfx.finish();
    this.bullets.length = 0; this.lasers.length = 0;
    this.tweens.add({ targets: [this.ufo, this.bread], scale: 1.1, y: this.cy - 110, duration: 1500, ease: 'Cubic.out' });
    levelCompletePanel(this, {
      title: 'Level 2 complete!', secs: this.elapsed / 1000, limits: STAR_LIMITS, levelKey: 'level2',
      line: 'Crumb caught the UFO... but who is flying it?',
      crumbs: { got: this.crumbs.got, total: this.crumbs.total },
      onDone: () => this.scene.start('Cutscene', { id: 'ending', next: 'Menu' }),
    });
  }
}
