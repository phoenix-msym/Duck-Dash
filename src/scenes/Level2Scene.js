import { makeTextures } from '../art.js';
import { createControls } from '../controls.js';
import { settings } from '../settings.js';
import { gyro } from '../gyro.js';
import { buildLevel2, LANES, LANES_PER_SIDE, SIDES } from '../level2Track.js';
import { makeButton, keyboardMenu, FONT } from '../ui.js';
import { audio } from '../audio.js';

// ---- Runner tuning ----
const SPEEDS = [7.5, 8.5, 9.5, 10.5, 11.5]; // rows per second in each area
const SIDE_SPEED = 7;     // lanes per second when holding A / D
const JUMP_POWER = 8.5;
const GRAVITY = 24;
const FAST_FALL = 2.5;    // gravity multiplier while holding S in the air
const COYOTE_TIME = 0.12; // seconds you can still jump after running off an edge

// ---- How the 3D tunnel is drawn ----
// We fake 3D with "perspective": things further away get drawn closer to the middle of the screen.
const APOTHEM = LANES_PER_SIDE / 2 / Math.tan(Math.PI / SIDES); // distance from tunnel centre to a wall
const VIEW_ROWS = 48;     // how far ahead we draw
const FOCAL = 560;        // bigger = more zoomed in
const CAM_BACK = 5;       // camera is this many rows behind Crumb
const CAM_UP = 1.7;       // camera height above the floor
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

function mix(a, b, t) {
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = (a & 255) + (((b & 255) - (a & 255)) * t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

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
    this.bread = this.add.image(this.cx, this.cy, 'bread').setDepth(3);

    this.tunnel = this.add.graphics().setDepth(4);
    this.shadow = this.add.ellipse(0, 0, 60, 16, 0x000000, 0.35).setDepth(5);
    this.duck = this.add.image(0, 0, 'duckRunA').setOrigin(0.5, 0.95).setDepth(6);

    this.makeHud();
    this.spawn();

    this.input.keyboard.on('keydown-R', () => { if (!this.finished) this.spawn(); });
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('Menu'));
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
  }

  tileAt(z, u) {
    const row = this.track.rows[Math.floor(z)];
    if (!row) return true; // past the end: solid
    const lane = ((Math.floor(u) % LANES) + LANES) % LANES;
    return row[lane] === 1;
  }

  // ------------------------------------------------------------------ every frame
  update(time, deltaMs) {
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    if (!this.finished) this.elapsed += deltaMs;
    const p = this.player;

    if (!this.finished && !p.dead) this.movePlayer(dt);
    else if (this.finished) p.z += SPEEDS[4] * dt * 0.3; // slow jog after the finish

    // the tunnel turns so that whatever side Crumb is on becomes the floor
    const sideUnwrapped = Math.floor(p.u / LANES_PER_SIDE);
    this.targetRoll = (sideUnwrapped * 2 * Math.PI) / SIDES;
    this.roll += (this.targetRoll - this.roll) * Math.min(1, dt * 10);

    this.draw(time, dt);
    this.updateHud();
  }

  movePlayer(dt) {
    const p = this.player;
    const c = this.controls.read();
    const wantJump = c.forward > 0.5 || this.space.isDown || gyro.takeJump();

    p.z += SPEEDS[Math.min(this.cpIndex, SPEEDS.length - 1)] * dt;
    p.u += (c.right - c.left) * SIDE_SPEED * dt;

    if (p.grounded) {
      if (!this.tileAt(p.z, p.u)) { p.grounded = false; p.offGroundTime = 0; p.vh = 0; }
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
        if (p.h > -0.35 && this.tileAt(p.z, p.u)) {
          p.h = 0; p.vh = 0; p.grounded = true; p.didDouble = false;
          gyro.doubleEdge = false;
          audio.sfx.land();
        }
        else {
          if (!p.falling) audio.sfx.fall(); // just started dropping into space
          p.falling = true;
        }
      }
      if (p.h < -3.5 && !p.dead) this.lostInSpace();
    }

    // checkpoints
    const next = this.track.checkpoints[this.cpIndex + 1];
    if (next !== undefined && p.z > next) {
      this.cpIndex++;
      this.showToast(`Checkpoint ${this.cpIndex}!`);
      audio.sfx.checkpoint();
    }
    if (p.z > this.track.finishRow) this.finish();
  }

  lostInSpace() {
    this.player.dead = true;
    this.cameras.main.shake(200, 0.006);
    this.showToast('Lost in space! Try again');
    this.time.delayedCall(800, () => this.spawn());
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

  draw(time, dt) {
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
    const speed = this.finished ? 2 : SPEEDS[Math.min(this.cpIndex, 4)];
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

    // --- UFO far ahead, getting closer the further you get ---
    const prog = col.progress / (AREAS.length - 1);
    const bob = Math.sin(time / 300) * 6;
    if (!this.finished) {
      this.ufo.setPosition(this.cx - camX * 20, this.cy - 30 + bob).setScale(0.25 + prog * 0.45);
      this.bread.setPosition(this.ufo.x, this.ufo.y + 30 * this.ufo.scale + 8).setScale(this.ufo.scale);
    }

    // --- tunnel tiles, far to near ---
    const edges = this.laneEdges.map(([a, b]) => [rot(a), rot(b)]);
    const g = this.tunnel;
    g.clear();
    const rows = this.track.rows;
    const first = Math.max(0, Math.floor(camZ));
    const last = Math.min(rows.length - 1, first + VIEW_ROWS);
    const cpSet = new Set(this.track.checkpoints);
    for (let r = last; r >= first; r--) {
      const row = rows[r];
      let z0 = r + INSET, z1 = r + 1 - INSET;
      if (z1 - camZ < NEAR) continue;
      if (z0 - camZ < NEAR) z0 = camZ + NEAR;
      const fog = Phaser.Math.Clamp((z0 - camZ - 6) / (VIEW_ROWS - 6), 0, 1);
      const isCp = cpSet.has(r) || cpSet.has(r - 1);
      for (let l = 0; l < LANES; l++) {
        if (!row[l]) continue;
        const [a, b] = edges[l];
        let base = (r + l) % 2 ? col.tileA : col.tileB;
        if (isCp) base = 0x3ddc84;
        if (r >= this.track.finishRow && r < this.track.finishRow + 2) base = (l % 2) ? 0xffffff : 0x222222;
        g.fillStyle(mix(base, col.bgBottom, fog * fog), 1);
        const p1 = proj(a.x, a.y, z0), p2 = proj(b.x, b.y, z0), p3 = proj(b.x, b.y, z1), p4 = proj(a.x, a.y, z1);
        g.fillPoints([p1, p2, p3, p4], true);
      }
    }

    // --- Crumb ---
    const feet = proj(pr.x, pr.y, p.z);
    const dzP = p.z - camZ;
    const scale = (0.95 * FOCAL) / dzP / 80; // Crumb is about 0.95 lanes tall; picture is 80px
    let frame = 'duckJump';
    if (p.grounded) {
      this.runAnim += dt * SPEEDS[Math.min(this.cpIndex, 4)] * 0.9;
      frame = Math.floor(this.runAnim) % 2 ? 'duckRunA' : 'duckRunB';
    }
    const sideRoll = this.roll - this.targetRoll; // tilt with the tunnel while it is turning
    this.duck.setTexture(frame).setPosition(feet.x, feet.y).setScale(scale).setRotation(sideRoll);
    this.duck.setVisible(!(p.dead && p.h < -3));
    // shadow on the floor below Crumb while jumping
    const floor = proj(rot(wallPoint(p.u, 0)).x, rot(wallPoint(p.u, 0)).y, p.z);
    const showShadow = !p.grounded && p.h > 0 && this.tileAt(p.z, p.u);
    this.shadow.setVisible(showShadow).setPosition(floor.x, floor.y).setScale(scale * 1.2, scale * 1.2);
  }

  // ------------------------------------------------------------------ HUD
  makeHud() {
    const { width: W, height: H } = this.scale;
    const style = { fontFamily: FONT, fontSize: '22px', color: '#fff4dc', stroke: '#1a1035', strokeThickness: 5 };
    this.cpText = this.add.text(20, 16, '', style).setDepth(50);
    this.timeText = this.add.text(20, 46, '', style).setDepth(50);
    this.add.text(W - 20, 16, 'R = back to checkpoint   Esc = menu', { ...style, fontSize: '18px' }).setOrigin(1, 0).setDepth(50);
    this.progress = this.add.graphics().setDepth(50);
    this.hintText = this.add.text(W / 2, H - 70, '', {
      ...style, fontSize: '30px', fontStyle: 'bold', align: 'center', wordWrap: { width: 1000 },
    }).setOrigin(0.5).setDepth(50);
    this.toast = this.add.text(W / 2, 150, '', { ...style, fontSize: '40px', fontStyle: 'bold' })
      .setOrigin(0.5).setDepth(50).setAlpha(0);
  }

  showToast(msg) {
    this.toast.setText(msg).setAlpha(1).setScale(0.6);
    this.tweens.killTweensOf(this.toast);
    this.tweens.add({ targets: this.toast, scale: 1, duration: 250, ease: 'Back.out' });
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 1400, duration: 500 });
  }

  updateHud() {
    const { width: W } = this.scale;
    const p = this.player;
    this.cpText.setText(`Checkpoint ${this.cpIndex} / ${this.track.checkpoints.length - 1}`);
    const secs = this.elapsed / 1000;
    this.timeText.setText(`Time ${Math.floor(secs / 60)}:${(secs % 60).toFixed(1).padStart(4, '0')}`);

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
    const h = this.track.hints.find((x) => p.z > x.row - 30 && p.z < x.row + 8);
    this.hintText.setText(h && !this.finished ? h.text : '');
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    const { width: W, height: H } = this.scale;
    audio.sfx.finish();
    this.tweens.add({ targets: [this.ufo, this.bread], scale: 1.2, y: this.cy - 120, duration: 1500, ease: 'Cubic.out' });

    const secs = this.elapsed / 1000;
    const panel = this.add.graphics().setDepth(60);
    panel.fillStyle(0x0d0420, 0.85); panel.fillRoundedRect(W / 2 - 380, H / 2 - 200, 760, 400, 28);
    const style = { fontFamily: FONT, color: '#fff4dc', align: 'center' };
    this.add.text(W / 2, H / 2 - 140, 'Level 2 complete!', { ...style, fontSize: '54px', fontStyle: 'bold' }).setOrigin(0.5).setDepth(61);
    this.add.text(W / 2, H / 2 - 62,
      `Time: ${Math.floor(secs / 60)}:${(secs % 60).toFixed(1).padStart(4, '0')}\nCrumb caught up to the UFO... but who is flying it?`,
      { ...style, fontSize: '24px' }).setOrigin(0.5).setDepth(61);
    const buttons = [
      makeButton(this, W / 2, H / 2 + 20, 'Find out who!', () => this.scene.start('Cutscene', { id: 'ending', next: 'Menu' }), { w: 320, h: 56, size: 26 }),
      makeButton(this, W / 2, H / 2 + 90, 'Run again', () => this.scene.restart(), { w: 320, h: 56, size: 26 }),
      makeButton(this, W / 2, H / 2 + 160, 'Menu', () => this.scene.start('Menu'), { w: 320, h: 56, size: 26 }),
    ];
    buttons.forEach((b) => { b.bg.setDepth(61); b.text.setDepth(62); });
    // wait a moment before keys work, so a last-second jump doesn't press a button
    this.time.delayedCall(800, () => keyboardMenu(this, buttons));
  }
}
