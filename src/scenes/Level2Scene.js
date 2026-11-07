import { makeTextures } from '../art.js';
import { createControls } from '../controls.js';
import { settings } from '../settings.js';
import { gyro } from '../gyro.js';
import { buildLevel2, LANES, LANES_PER_SIDE, SIDES, HOLE, PAD, CRACKED } from '../level2Track.js';
import { FONT, eraseSprites, unerase, levelCompletePanel, fmtTime } from '../ui.js';
import { audio } from '../audio.js';
import { addPauseButton } from './PauseScene.js';

// ---- Runner tuning ----
const SPEEDS = [10, 11, 12, 12.5]; // rows per second in each area (tutorial, holes, wind, boss)
const SIDE_SPEED = 8.5;   // lanes per second when holding A / D
const JUMP_POWER = 10.2;
const GRAVITY = 34.6;
const FAST_FALL = 2.5;    // gravity multiplier while holding S in the air
const COYOTE_TIME = 0.12; // seconds you can still jump after running off an edge
const BOOST = 1.6;        // lily pad speed multiplier
const BOOST_TIME = 1.2;   // seconds a lily pad boost lasts
const CRUMBLE_DELAY = 0.3;// seconds before a touched cracked tile falls
const WIND = 3.2;         // lanes per second the wind pushes you
const STAR_LIMITS = [75, 100]; // seconds: under the first = 3 stars, under the second = 2 stars

// ---- Boss fight tuning ----
const BULLET_EVERY = 0.8;  // seconds between bullets
const BULLET_SPEED = 9;    // rows per second the bullets fly towards you
const LASER_EVERY = 2.6;   // seconds between lasers
const LASER_WARN = 1.0;    // seconds of red warning before the laser fires
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

// Colours for each area of the level (between checkpoints)
const AREAS = [
  { bgTop: 0x050818, bgBottom: 0x141a48, tileA: 0x4d6bff, tileB: 0x3b52d1, nebula: 0x5d7dff },
  { bgTop: 0x0d0420, bgBottom: 0x341150, tileA: 0xb35cff, tileB: 0x8c3fd6, nebula: 0xd36bff },
  { bgTop: 0x021317, bgBottom: 0x07363d, tileA: 0x2fd6c0, tileB: 0x21a898, nebula: 0x3dffd9 },
  { bgTop: 0x170309, bgBottom: 0x40101f, tileA: 0xff6b6b, tileB: 0xd94f5c, nebula: 0xff7a59 },
  { bgTop: 0x03140a, bgBottom: 0x0c3a1d, tileA: 0xb6ff3b, tileB: 0x8fd62a, nebula: 0xb6ff3b },
];
// how big the UFO looks in each area: small and far at the start, closer every checkpoint
const UFO_SCALE = [0.14, 0.2, 0.27, 0.45];

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

    // the UFO, far down the tunnel
    this.ufo = this.add.image(this.cx, this.cy, 'ufo').setDepth(3);
    this.bread = this.add.image(this.cx, this.cy, 'egg').setDepth(3); // the stolen egg

    this.tunnel = this.add.graphics().setDepth(4);
    this.fx = this.add.graphics().setDepth(5);      // lasers, bullets, wind streaks
    this.shadow = this.add.ellipse(0, 0, 60, 16, 0x000000, 0.35).setDepth(5);
    this.duck = this.add.image(0, 0, 'duckRunA').setOrigin(0.5, 0.95).setDepth(6);

    this.makeHud();
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
      this.updateBoss(dt, now);
    } else if (this.finished) p.z += SPEEDS[3] * dt * 0.3; // slow jog after the finish

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
        audio.sfx.jump();
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
  startCrumble(r, l, now) {
    for (let rr = r; rr < r + 7; rr++) {
      const row = this.rows[rr];
      if (!row) break;
      for (let dl = -1; dl <= 1; dl++) {
        const ll = (l + dl + LANES) % LANES;
        const key = `${rr},${ll}`;
        if (row[ll] === CRACKED && !this.crumbling.has(key)) {
          this.crumbling.set(key, now + CRUMBLE_DELAY + (rr - r) * 0.03);
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
      n.setScale(n.polar.scale).setTint(col.nebula).setAlpha(0.5);
    });
    // stars drift outwards like you're flying past them
    const speed = this.finished ? 2 : SPEEDS[Math.min(this.cpIndex, 3)] * (this.boost > 0 ? BOOST : 1);
    this.starGfx.clear();
    for (const s of this.stars) {
      s.r += s.r * dt * 0.02 * speed;
      if (s.r > 800) { s.r = Phaser.Math.Between(20, 120); s.a = Math.random() * Math.PI * 2; }
      const a = s.a + this.roll;
      this.starGfx.fillStyle(0xffffff, Math.min(1, s.r / 300));
      this.starGfx.fillRect(this.cx + Math.cos(a) * s.r, this.cy + Math.sin(a) * s.r, s.size, s.size);
    }

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
    for (let r = last; r >= first; r--) {
      const row = rows[r];
      let z0 = r + INSET, z1 = r + 1 - INSET;
      if (z1 - camZ < NEAR) continue;
      if (z0 - camZ < NEAR) z0 = camZ + NEAR;
      const fog = Phaser.Math.Clamp((z0 - camZ - 6) / (VIEW_ROWS - 6), 0, 1);
      const isCp = cpSet.has(r) || cpSet.has(r - 1);
      for (let l = 0; l < LANES; l++) {
        const type = row[l];
        if (type === HOLE) continue;
        const [a, b] = edges[l];
        let base = (r + l) % 2 ? col.tileA : col.tileB;
        if (type === PAD) base = 0x3fae5a;
        if (type === CRACKED) base = mix(base, 0x2a1a10, 0.45);
        if (type === CRACKED && this.crumbling.has(`${r},${l}`)) base = flash ? 0xff3b3b : 0xffffff; // about to fall!
        if (isCp) base = 0x3ddc84;
        if (r >= this.track.finishRow && r < this.track.finishRow + 2) base = (l % 2) ? 0xffffff : 0x222222;
        const p1 = proj(a.x, a.y, z0), p2 = proj(b.x, b.y, z0), p3 = proj(b.x, b.y, z1), p4 = proj(a.x, a.y, z1);
        g.fillStyle(mix(base, col.bgBottom, fog * fog), 1);
        g.fillPoints([p1, p2, p3, p4], true);
        if (type === PAD) {
          // a lighter round-ish lily pad in the middle of the tile
          const cxp = (p1.x + p2.x + p3.x + p4.x) / 4, cyp = (p1.y + p2.y + p3.y + p4.y) / 4;
          const shrink = (q) => ({ x: cxp + (q.x - cxp) * 0.6, y: cyp + (q.y - cyp) * 0.6 });
          g.fillStyle(mix(0x8fe39c, col.bgBottom, fog * fog), 1);
          g.fillPoints([shrink(p1), shrink(p2), shrink(p3), shrink(p4)], true);
        } else if (type === CRACKED && fog < 0.8) {
          g.lineStyle(2, 0x1a0d08, 0.8 * (1 - fog));
          g.lineBetween(p1.x, p1.y, (p1.x + p3.x) / 2 + 3, (p1.y + p3.y) / 2);
          g.lineBetween((p1.x + p3.x) / 2 + 3, (p1.y + p3.y) / 2, p3.x, p3.y);
          g.lineBetween(p2.x, p2.y, (p1.x + p3.x) / 2 + 3, (p1.y + p3.y) / 2);
        }
      }
    }

    // --- lasers, bullets and wind streaks ---
    const fx = this.fx;
    fx.clear();
    for (const L of this.lasers) {
      const firing = now >= L.warnUntil;
      for (const lane of L.lanes) {
        const [a, b] = edges[lane];
        const z0 = Math.max(p.z - 2, camZ + NEAR), z1 = p.z + 40;
        const q1 = proj(a.x, a.y, z0), q2 = proj(b.x, b.y, z0), q3 = proj(b.x, b.y, z1), q4 = proj(a.x, a.y, z1);
        if (!firing) {
          fx.fillStyle(0xff2040, flash ? 0.45 : 0.18);
          fx.fillPoints([q1, q2, q3, q4], true);
        } else {
          fx.fillStyle(0xff4060, 0.55); fx.fillPoints([q1, q2, q3, q4], true);
          // bright core of the beam
          const mid = (A, B, t) => ({ x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t });
          fx.fillStyle(0xffffff, 0.9);
          fx.fillPoints([mid(q1, q2, 0.35), mid(q1, q2, 0.65), mid(q4, q3, 0.65), mid(q4, q3, 0.35)], true);
        }
      }
    }
    for (const b of this.bullets) {
      if (b.z - camZ < NEAR + 0.2) continue;
      const pt = rot(wallPoint(b.u, 0.45));
      const s = proj(pt.x, pt.y, b.z);
      const r = (0.28 * FOCAL) / (b.z - camZ);
      fx.fillStyle(0xff3b8a, 0.5); fx.fillCircle(s.x, s.y, r * 1.6);
      fx.fillStyle(0xff6bb0, 1); fx.fillCircle(s.x, s.y, r);
      fx.fillStyle(0xffffff, 1); fx.fillCircle(s.x, s.y, r * 0.45);
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
        this.runAnim += dt * SPEEDS[Math.min(this.cpIndex, 3)] * 0.9;
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
      onDone: () => this.scene.start('Cutscene', { id: 'ending', next: 'Menu' }),
    });
  }
}
