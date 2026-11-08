import { makeTextures } from '../art.js';
import { createControls } from '../controls.js';
import { settings } from '../settings.js';
import { gyro } from '../gyro.js';
import { buildLevel1, groundYAt } from '../level1Track.js';
import { FONT, eraseSprites, unerase, levelCompletePanel, crumbHud } from '../ui.js';
import { audio } from '../audio.js';
import { addPauseButton } from './PauseScene.js';
import { level1Scenery } from '../scenery.js';

// ---- Bike tuning (change these to make the bike feel different) ----
const MAX_WHEEL_SPIN = 1.3;   // top speed
const WHEEL_ACCEL = 0.06;     // how fast it speeds up
const HILL_PUSH = 0.0005;     // extra push along the ground while riding (stops it bogging down on hills)
const DOWNFORCE = 0.0011;     // presses the bike onto the ground while riding, so it doesn't hop over bumps
const AIR_DRAG = 0.0015;      // low air drag = Crumb keeps his momentum (the default is 0.01)
const STAR_LIMITS = [48, 70]; // seconds: under the first = 3 stars, under the second = 2 stars (course is longer now)
const BRAKE_SPIN = -0.25;     // S makes it slow down / roll back a bit
const LEAN_AIR = 0.04;        // how hard A/D spin you in the air (big = easy flips)
const LEAN_GROUND = 0.006;    // ...and on the ground (weaker)
const MAX_LEAN_SPEED = 0.38;  // fastest spin: a full flip in about a third of a second

// Sky colours for each area of the level: pink sunset that gets darker on the way to space.
// top = top of the screen, bottom = horizon. stars = how visible the stars are (0 to 1).
const SKIES = [
  { top: 0xff6fa8, bottom: 0xffc78f, hillsFar: 0xd66a9a, hillsNear: 0x9c3f7c, stars: 0 },
  { top: 0xe8579a, bottom: 0xffa77f, hillsFar: 0xbd5490, hillsNear: 0x833471, stars: 0 },
  { top: 0x9c4c9c, bottom: 0xff8a7a, hillsFar: 0x8e3f80, hillsNear: 0x5f2763, stars: 0.25 },
  { top: 0x4a2c72, bottom: 0xc0607e, hillsFar: 0x5a2f6d, hillsNear: 0x3c1c4d, stars: 0.6 },
  { top: 0x120d33, bottom: 0x4f3478, hillsFar: 0x34214f, hillsNear: 0x20133a, stars: 1 },
];

const lerpColor = (a, b, t) => {
  const ca = Phaser.Display.Color.IntegerToColor(a), cb = Phaser.Display.Color.IntegerToColor(b);
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(ca, cb, 100, Math.round(t * 100));
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
};

export class Level1Scene extends Phaser.Scene {
  constructor() { super('Level1'); }

  create() {
    makeTextures(this);
    this.controls = createControls(this);
    this.track = buildLevel1();
    this.cpIndex = 0;
    this.crashed = false;
    this.finished = false;
    this.elapsed = 0;
    this.wheelsTouching = new Set();
    this.airTime = 0;
    audio.music('sunset');
    this.events.once('shutdown', () => audio.engineStop());

    this.makeBackground();
    this.makeGround();
    this.makeFlagsAndSigns();
    this.makePickups();
    this.scenery = level1Scenery(this, this.track); // pond, fence, hay, clouds, trees, birds, moon...
    this.makeBikeSprites();
    this.spawnBike(this.track.checkpoints[0]);
    this.makeHud();
    this.crumbs = crumbHud(this, { fixed: true, total: this.crumbItems.length });

    const allY = this.track.pieces.flat().map((p) => p.y);
    this.deathY = Math.max(...allY) + 500;
    this.cameras.main.setBounds(-700, Math.min(...allY) - 1200, this.track.finishX + 1400, this.deathY + 1400 - (Math.min(...allY) - 1200));
    this.cameras.main.startFollow(this.bikeImg, true, 0.12, 0.12, -260, 80);

    this.feathers = this.add.particles(0, 0, 'feather', {
      speed: { min: 120, max: 320 }, angle: { min: 200, max: 340 }, lifespan: 1000,
      gravityY: 500, rotate: { min: 0, max: 360 }, scale: { start: 1.3, end: 0.5 }, emitting: false,
    }).setDepth(20);

    this.matter.world.on('collisionstart', (e) => this.onCollision(e, true));
    this.matter.world.on('collisionend', (e) => this.onCollision(e, false));

    this.input.keyboard.on('keydown-R', () => { if (!this.finished) this.respawn(); });
    addPauseButton(this, true); // P / Esc / the II button
    if (settings.controlMode === 'gyro' && !gyro.ready()) {
      this.time.delayedCall(600, () => this.showToast('Connect the HW-123 in Settings'));
    }
  }

  // ------------------------------------------------------------------ background
  makeBackground() {
    const { width: W, height: H } = this.scale;
    this.sky = this.add.graphics().setScrollFactor(0).setDepth(-100);
    this.stars = [];
    for (let i = 0; i < 140; i++) {
      const s = this.add.image(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H * 0.75), 'star')
        .setScrollFactor(0).setDepth(-99).setScale(Phaser.Math.FloatBetween(0.5, 1.4));
      s.twinkle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      this.stars.push(s);
    }
    this.sun = this.add.image(W * 0.7, 380, 'sun').setScrollFactor(0).setDepth(-98).setScale(1.5);
    this.hillsFar = this.add.tileSprite(W / 2, H - 130, W, 260, 'hillsFar').setScrollFactor(0).setDepth(-97);
    this.hillsNear = this.add.tileSprite(W / 2, H - 70, W, 200, 'hillsNear').setScrollFactor(0).setDepth(-96);

    // the UFO always flying ahead of Crumb, with the stolen egg (this.bread is the egg picture)
    this.ufo = this.add.image(W - 200, 120, 'ufo').setScrollFactor(0).setDepth(-90);
    this.bread = this.add.image(W - 200, 180, 'egg').setScrollFactor(0).setDepth(-91);
    this.beam = this.add.graphics().setScrollFactor(0).setDepth(-92);
  }

  updateBackground(time) {
    const { width: W, height: H } = this.scale;
    const cam = this.cameras.main;
    // how far through the level are we? 0..(number of areas - 1)
    const cps = this.track.checkpoints;
    const x = this.bike ? this.bike.frame.position.x : 0;
    let p = 0;
    for (let i = 0; i < cps.length; i++) {
      const start = cps[i].x, end = i + 1 < cps.length ? cps[i + 1].x : this.track.finishX;
      if (x >= start) p = i + Phaser.Math.Clamp((x - start) / (end - start), 0, 1);
    }
    p = Phaser.Math.Clamp(p, 0, SKIES.length - 1);
    const i = Math.min(Math.floor(p), SKIES.length - 2), t = p - i;
    const a = SKIES[i], b = SKIES[i + 1];
    const top = lerpColor(a.top, b.top, t), bottom = lerpColor(a.bottom, b.bottom, t);
    const starAlpha = a.stars + (b.stars - a.stars) * t;

    this.sky.clear();
    this.sky.fillGradientStyle(top, top, bottom, bottom, 1);
    this.sky.fillRect(0, 0, W, H);
    this.stars.forEach((s) => s.setAlpha(starAlpha * (0.6 + 0.4 * Math.sin(time / 400 + s.twinkle))));
    this.sun.y = 360 + p * 120;
    this.sun.setAlpha(Phaser.Math.Clamp(1 - p / 3.5, 0, 1));
    this.hillsFar.setTint(lerpColor(a.hillsFar, b.hillsFar, t));
    this.hillsNear.setTint(lerpColor(a.hillsNear, b.hillsNear, t));
    this.hillsFar.tilePositionX = cam.scrollX * 0.15;
    this.hillsNear.tilePositionX = cam.scrollX * 0.35;

    if (!this.finished) {
      const bob = Math.sin(time / 300) * 10;
      this.ufo.setPosition(W - 200 + Math.sin(time / 1100) * 40, 120 + bob);
      this.bread.setPosition(this.ufo.x, 190 + bob);
      this.bread.rotation = Math.sin(time / 250) * 0.15;
    }
    this.beam.clear();
    this.beam.fillStyle(0xb6ff3b, 0.18);
    this.beam.fillTriangle(this.ufo.x - 20, this.ufo.y + 25, this.ufo.x + 20, this.ufo.y + 25, this.bread.x + 40, this.bread.y + 20);
    this.beam.fillTriangle(this.ufo.x - 20, this.ufo.y + 25, this.bread.x - 40, this.bread.y + 20, this.bread.x + 40, this.bread.y + 20);
    if (this.scenery) this.scenery.update(time, p);
  }

  // ------------------------------------------------------------------ ground
  makeGround() {
    const g = this.add.graphics().setDepth(0);
    const THICK = 40;
    const pieces = this.track.pieces;
    pieces.forEach((piece, n) => {
      // invisible cliff walls at the edges of each gap, so a short landing
      // slides you down into the gap instead of getting hooked on the corner
      const wall = (x, y) => this.matter.add.rectangle(x, y + 8 + 1000, 20, 2000, {
        isStatic: true, label: 'ground', friction: 0,
      });
      if (n > 0) wall(piece[0].x + 10, piece[0].y);
      if (n < pieces.length - 1) wall(piece[piece.length - 1].x - 10, piece[piece.length - 1].y);
    });
    for (const piece of pieces) {
      // picture: dirt filled down to the bottom, grass line on top
      const bottom = 3000;
      g.fillStyle(0x5b3550);
      g.fillPoints([{ x: piece[0].x, y: bottom }, ...piece, { x: piece[piece.length - 1].x, y: bottom }], true);
      g.lineStyle(14, 0x4fbf6a);
      g.strokePoints(piece, false);
      g.lineStyle(4, 0x8fe39c);
      g.strokePoints(piece.map((p) => ({ x: p.x, y: p.y - 5 })), false);

      // physics: one thin static box per line segment
      for (let i = 0; i < piece.length - 1; i++) {
        const a = piece[i], c = piece[i + 1];
        const dx = c.x - a.x, dy = c.y - a.y;
        const len = Math.hypot(dx, dy);
        if (len < 1) continue;
        const nx = -dy / len, ny = dx / len; // points into the ground
        const cx = (a.x + c.x) / 2 + nx * THICK / 2, cy = (a.y + c.y) / 2 + ny * THICK / 2;
        // exactly the segment's length: making them longer left tiny "steps" where the ground bends up,
        // which bounced the bike into the air when powering uphill
        this.matter.add.rectangle(cx, cy, len, THICK, {
          isStatic: true, angle: Math.atan2(dy, dx), label: 'ground', friction: 1, restitution: 0,
        });
      }
    }
  }

  makeFlagsAndSigns() {
    this.flags = this.track.checkpoints.map((cp, i) => {
      const f = this.add.image(cp.x, cp.y, i === 0 ? 'flagOn' : 'flag').setOrigin(0.07, 1).setDepth(2);
      return f;
    });
    const finishY = groundYAt(this.track, this.track.finishX - 400);
    this.finishLine = this.add.graphics().setDepth(2);
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 2; c++) {
        this.finishLine.fillStyle((r + c) % 2 ? 0x111111 : 0xffffff);
        this.finishLine.fillRect(this.track.finishX - 400 + c * 14, finishY - 168 + r * 14, 14, 14);
      }
    }

    for (const s of this.track.signs) {
      const y = groundYAt(this.track, s.x);
      if (y === null) continue;
      const g = this.add.graphics().setDepth(1);
      g.fillStyle(0x6b4226); g.fillRect(s.x - 5, y - 110, 10, 110);
      const text = this.add.text(s.x, y - 140, s.text, {
        fontFamily: FONT, fontSize: '22px', color: '#3b1d4a', fontStyle: 'bold', align: 'center',
        wordWrap: { width: 260 },
      }).setOrigin(0.5).setDepth(2);
      const w = text.width + 30, h = text.height + 20;
      g.fillStyle(0x3b1d4a, 0.4); g.fillRoundedRect(s.x - w / 2 + 4, y - 140 - h / 2 + 5, w, h, 10);
      g.fillStyle(0xfff4dc); g.fillRoundedRect(s.x - w / 2, y - 140 - h / 2, w, h, 10);
      g.lineStyle(3, 0x6b4226); g.strokeRoundedRect(s.x - w / 2, y - 140 - h / 2, w, h, 10);
    }
  }

  // bread crumbs to collect, and boost pads on the ground
  makePickups() {
    this.crumbItems = this.track.crumbs.map((c) => {
      let y = c.y;
      if (y === undefined) y = (groundYAt(this.track, c.x) ?? 560) - c.lift;
      const img = this.add.image(c.x, y, 'crumb').setDepth(9);
      this.tweens.add({ targets: img, y: y - 8, duration: 700 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.tweens.add({ targets: img, angle: { from: -10, to: 10 }, duration: 900, yoyo: true, repeat: -1 });
      return img;
    });
    this.boostPads = this.track.boosts.map((b) => {
      const y = groundYAt(this.track, b.x) ?? 560;
      const ahead = groundYAt(this.track, b.x + 40) ?? y;
      const img = this.add.image(b.x, y - 4, 'boostPad').setDepth(3).setRotation(Math.atan2(ahead - y, 40));
      this.tweens.add({ targets: img, alpha: 0.6, duration: 300, yoyo: true, repeat: -1 });
      return { x: b.x, y, img, ready: 0 };
    });
  }

  // grab crumbs near the bike, and fire boost pads you drive over
  checkPickups() {
    const { frame, chassis, back, front } = this.bike;
    const { Body } = Phaser.Physics.Matter.Matter;
    for (const img of this.crumbItems) {
      if (!img.visible) continue;
      if (Phaser.Math.Distance.Between(img.x, img.y, frame.position.x, frame.position.y - 20) < 60) {
        img.setVisible(false);
        this.crumbs.collect(img.x, img.y, true);
      }
    }
    for (const pad of this.boostPads) {
      if (this.elapsed < pad.ready) continue;
      // drive over it (or skim just above it) to trigger
      if (Math.abs(frame.position.x - pad.x) < 80 && frame.position.y > pad.y - 120 && frame.position.y < pad.y + 30) {
        pad.ready = this.elapsed + 1500;
        // a big shove forward along the ground
        const dir = { x: Math.cos(chassis.angle), y: Math.sin(chassis.angle) };
        for (const body of [chassis, back, front]) {
          const v = body.velocity;
          Body.setVelocity(body, { x: Math.min(v.x + dir.x * 9, 28), y: v.y + dir.y * 9 });
        }
        audio.sfx.boost();
        this.showToast('BOOST!');
        this.cameras.main.shake(150, 0.004);
      }
    }
  }

  // ------------------------------------------------------------------ bike
  makeBikeSprites() {
    this.backWheelImg = this.add.image(0, 0, 'wheel').setDepth(10);
    this.frontWheelImg = this.add.image(0, 0, 'wheel').setDepth(10);
    this.bikeImg = this.add.image(0, 0, 'bike').setOrigin(0.5, 0.6).setDepth(11);
  }

  // Builds the physics bike: a body (with an invisible "head" sensor on top) and two wheels on springs.
  spawnBike(at) {
    const { Bodies, Body, Constraint } = Phaser.Physics.Matter.Matter;
    if (this.bike) this.matter.world.remove(this.bike.all);
    this.wheelsTouching.clear();

    const x = at.x + 40;
    const gy = groundYAt(this.track, x) ?? at.y;
    const y = gy - 60;
    const group = Body.nextGroup(true); // parts of the bike never hit each other

    const frame = Bodies.rectangle(x, y, 70, 16, { collisionFilter: { group }, density: 0.002, label: 'frame' });
    const head = Bodies.circle(x + 10, y - 34, 10, { collisionFilter: { group }, isSensor: true, density: 0.0005, label: 'head' });
    const chassis = Body.create({ parts: [frame, head], collisionFilter: { group }, label: 'chassis', frictionAir: AIR_DRAG });

    const wheelOpts = {
      collisionFilter: { group }, friction: 1, frictionStatic: 10, restitution: 0, density: 0.0015, label: 'wheel',
      frictionAir: AIR_DRAG,
    };
    const back = Bodies.circle(x - 30, y + 20, 16, wheelOpts);
    const front = Bodies.circle(x + 30, y + 20, 16, wheelOpts);

    const axle = (wheel) => Constraint.create({
      bodyA: chassis,
      pointA: { x: wheel.position.x - chassis.position.x, y: wheel.position.y - chassis.position.y },
      bodyB: wheel, length: 0, stiffness: 0.3, damping: 0.3, // softer, less bouncy suspension
    });
    const all = [chassis, back, front, axle(back), axle(front)];
    this.matter.world.add(all);
    this.bike = { chassis, frame, head, back, front, all };
    this.crashed = false;
    this.stuckCheck = null;
    unerase([this.bikeImg, this.backWheelImg, this.frontWheelImg]);
    this.syncSprites();
  }

  syncSprites() {
    const { chassis, frame, back, front } = this.bike;
    this.bikeImg.setPosition(frame.position.x, frame.position.y).setRotation(chassis.angle);
    this.backWheelImg.setPosition(back.position.x, back.position.y).setRotation(back.angle);
    this.frontWheelImg.setPosition(front.position.x, front.position.y).setRotation(front.angle);
  }

  onCollision(event, starting) {
    if (!this.bike) return;
    for (const pair of event.pairs) {
      const { bodyA: a, bodyB: b } = pair;
      const other = (part) => (a === part ? b : b === part ? a : null);
      for (const part of [this.bike.head, this.bike.back, this.bike.front]) {
        const o = other(part);
        if (!o || o.label !== 'ground') continue;
        if (part === this.bike.head) {
          if (starting) this.crash();
        } else if (starting) this.wheelsTouching.add(part);
        else this.wheelsTouching.delete(part);
      }
    }
  }

  crash() {
    if (this.crashed || this.finished) return;
    this.crashed = true;
    const p = this.bike.head.position;
    this.feathers.explode(16, p.x, p.y);
    this.cameras.main.shake(250, 0.01);
    audio.sfx.bonk();
    const bonk = this.add.text(p.x, p.y - 40, 'BONK!', {
      fontFamily: FONT, fontSize: '48px', fontStyle: 'bold', color: '#ffe066', stroke: '#3b1d4a', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: bonk, y: p.y - 110, alpha: 0, duration: 900, onComplete: () => bonk.destroy() });
    eraseSprites(this, [this.bikeImg, this.backWheelImg, this.frontWheelImg], { duration: 650 });
    this.time.delayedCall(1000, () => this.respawn());
  }

  respawn() {
    this.spawnBike(this.track.checkpoints[this.cpIndex]);
  }

  // ------------------------------------------------------------------ HUD
  makeHud() {
    const { width: W } = this.scale;
    const style = { fontFamily: FONT, fontSize: '22px', color: '#fff4dc', stroke: '#3b1d4a', strokeThickness: 5 };
    this.cpText = this.add.text(20, 16, '', style).setScrollFactor(0).setDepth(50);
    this.timeText = this.add.text(20, 46, '', style).setScrollFactor(0).setDepth(50);
    this.add.text(W - 20, 16, 'R = back to checkpoint   P / Esc = pause', { ...style, fontSize: '18px' })
      .setOrigin(1, 0).setScrollFactor(0).setDepth(50);
    // progress bar: Crumb vs the finish
    this.progress = this.add.graphics().setScrollFactor(0).setDepth(50);
    this.toast = this.add.text(W / 2, 140, '', { ...style, fontSize: '40px', fontStyle: 'bold' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(50).setAlpha(0);
  }

  showToast(msg) {
    this.toast.setText(msg).setAlpha(1).setScale(0.6);
    this.tweens.killTweensOf(this.toast);
    this.tweens.add({ targets: this.toast, scale: 1, duration: 250, ease: 'Back.out' });
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 1400, duration: 500 });
  }

  updateHud() {
    const { width: W } = this.scale;
    const total = this.track.checkpoints.length - 1;
    this.cpText.setText(`Checkpoint ${this.cpIndex} / ${total}`);
    const secs = this.elapsed / 1000;
    this.timeText.setText(`Time ${Math.floor(secs / 60)}:${(secs % 60).toFixed(1).padStart(4, '0')}`);

    const start = this.track.checkpoints[0].x, end = this.track.finishX - 400;
    const t = Phaser.Math.Clamp((this.bike.frame.position.x - start) / (end - start), 0, 1);
    const bx = W / 2 - 200, by = 30, bw = 400;
    this.progress.clear();
    this.progress.fillStyle(0x3b1d4a, 0.6); this.progress.fillRoundedRect(bx, by - 6, bw, 12, 6);
    this.progress.fillStyle(0xffd23f); this.progress.fillRoundedRect(bx, by - 6, Math.max(12, bw * t), 12, 6);
    this.track.checkpoints.forEach((cp, i) => {
      const ct = (cp.x - start) / (end - start);
      this.progress.fillStyle(i <= this.cpIndex ? 0x3ddc84 : 0xfff4dc);
      this.progress.fillCircle(bx + bw * ct, by, 5);
    });
    this.progress.fillStyle(0xb6ff3b); this.progress.fillCircle(bx + bw, by, 8); // the UFO
  }

  // ------------------------------------------------------------------ every frame
  update(time, delta) {
    this.updateBackground(time);
    if (!this.bike) return;
    this.syncSprites();
    this.updateHud();
    if (this.finished) {
      // roll to a gentle stop after the finish line
      const { Body } = Phaser.Physics.Matter.Matter;
      for (const w of [this.bike.back, this.bike.front]) Body.setAngularVelocity(w, w.angularVelocity * 0.95);
      return;
    }
    this.elapsed += delta;

    const { Body } = Phaser.Physics.Matter.Matter;
    const { chassis, back, front, frame } = this.bike;

    if (!this.crashed) {
      const c = this.controls.read();
      // gas: spin both wheels up to top speed (all-wheel drive climbs ramps better)
      if (c.forward > 0) {
        for (const w of [back, front]) {
          Body.setAngularVelocity(w, Math.min(w.angularVelocity + WHEEL_ACCEL * c.forward, MAX_WHEEL_SPIN * c.forward + 0.0001));
        }
      } else if (c.back > 0) {
        for (const w of [back, front]) {
          Body.setAngularVelocity(w, Math.max(w.angularVelocity - WHEEL_ACCEL * 1.5, BRAKE_SPIN));
        }
      }
      // lean: A = back (counter-clockwise), D = forward (clockwise)
      const lean = (c.right - c.left);
      if (lean !== 0) {
        const power = this.wheelsTouching.size === 0 ? LEAN_AIR : LEAN_GROUND;
        const av = Phaser.Math.Clamp(chassis.angularVelocity + lean * power, -MAX_LEAN_SPEED, MAX_LEAN_SPEED);
        Body.setAngularVelocity(chassis, av);
      }
      // a push along the ground, so it powers up hills instead of bogging down (only with BOTH wheels down,
      // otherwise the push would lift the front and make the bike hop)
      if (c.forward > 0 && this.wheelsTouching.size === 2) {
        const f = HILL_PUSH * chassis.mass * c.forward;
        Body.applyForce(chassis, chassis.position, { x: Math.cos(chassis.angle) * f, y: Math.sin(chassis.angle) * f });
      }
    }
    // "downforce": while riding on the ground, press the bike gently onto it so bumps and hill bottoms
    // don't bounce it into the air
    if (!this.crashed && this.wheelsTouching.size > 0) {
      const d = DOWNFORCE * chassis.mass;
      Body.applyForce(chassis, chassis.position, { x: -Math.sin(chassis.angle) * d, y: Math.cos(chassis.angle) * d });
    }

    // engine hum follows wheel speed; a thud when you land after a jump
    audio.engine(this.crashed ? 0 : Phaser.Math.Clamp(Math.abs(back.angularVelocity) / MAX_WHEEL_SPIN, 0, 1));
    if (this.wheelsTouching.size === 0) {
      this.airTime += delta;
      this.airSpin = (this.airSpin || 0) + chassis.angularVelocity; // how far we've rotated this jump
    } else {
      if (this.airTime > 350 && !this.crashed) {
        audio.sfx.land();
        // landed a flip? (check a moment later, in case it was a head-first "landing")
        const flips = Math.floor(Math.abs(this.airSpin || 0) / (Math.PI * 2) + 0.15);
        if (flips >= 1) {
          this.time.delayedCall(200, () => {
            if (this.crashed) return;
            this.showToast(flips >= 3 ? `${flips}x FLIP!!!` : flips === 2 ? 'DOUBLE FLIP!!' : 'FLIP!');
            audio.sfx.checkpoint();
          });
        }
      }
      this.airTime = 0;
      this.airSpin = 0;
    }

    // fell into a gap
    if (frame.position.y > this.deathY && !this.crashed) {
      this.crashed = true;
      this.showToast('Splat! Try again');
      audio.sfx.fall();
      this.time.delayedCall(800, () => this.respawn());
    }

    // stuck? (hasn't moved forward in 4 seconds) -> remind them about R
    if (!this.stuckCheck || frame.position.x > this.stuckCheck.x + 40) {
      this.stuckCheck = { x: frame.position.x, since: this.elapsed };
    } else if (this.elapsed - this.stuckCheck.since > 4000 && !this.crashed) {
      this.showToast('Stuck? Press R');
      this.stuckCheck.since = this.elapsed;
    }

    // reached a checkpoint flag
    const next = this.track.checkpoints[this.cpIndex + 1];
    if (next && frame.position.x > next.x && !this.crashed) {
      this.cpIndex++;
      this.flags[this.cpIndex].setTexture('flagOn');
      this.showToast(`Checkpoint ${this.cpIndex}!`);
      audio.sfx.checkpoint();
    }

    if (!this.crashed) this.checkPickups();

    // finish line
    if (frame.position.x > this.track.finishX - 400 && !this.crashed) this.finish();
  }

  finish() {
    this.finished = true;
    // clear any pop-up message (FLIP!, BOOST!...) so it doesn't overlap the finish panel
    this.tweens.killTweensOf(this.toast);
    this.toast.setAlpha(0);
    audio.engineStop();
    audio.sfx.finish();
    audio.sfx.whoosh();
    // the UFO blasts off toward space
    this.tweens.add({ targets: [this.ufo, this.bread], y: '-=400', x: '+=200', duration: 1600, ease: 'Cubic.in' });
    // show the stars, then go straight into the next cutscene
    levelCompletePanel(this, {
      title: 'Level 1 complete!', secs: this.elapsed / 1000, limits: STAR_LIMITS, levelKey: 'level1',
      line: 'The UFO is heading for space... Crumb won\'t give up!', fixed: true,
      crumbs: { got: this.crumbs.got, total: this.crumbs.total },
      onDone: () => this.scene.start('Cutscene', { id: 'middle', next: 'Level2' }),
    });
  }
}
