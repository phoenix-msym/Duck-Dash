import { makeTextures } from '../art.js';
import { sunsetBackdrop, FONT } from '../ui.js';
import { audio } from '../audio.js';
import { gyro } from '../gyro.js';

// Plays one of the story cutscenes, then moves on to the next scene.
// Start it with:  this.scene.start('Cutscene', { id: 'intro', next: 'Level1' })
//
// Each cutscene is an "async" function below. Inside it:
//   await c.wait(1000)              -> pause for 1 second
//   await c.move(thing, {x: 500})   -> slide something somewhere (and wait until it gets there)
//   await c.say('Crumb', 'Hello!')  -> show a speech box and wait for Space / Enter / click
//   await c.title('LEVEL 1', 'The Sunset Chase')
//
// Space / Enter / click = next line.   Esc = skip the whole cutscene.

const SCRIPTS = { intro, middle, ending };

export class CutsceneScene extends Phaser.Scene {
  constructor() { super('Cutscene'); }

  // data: { id, next, nextData, fast }
  //   nextData = what to pass to the next scene (e.g. { mode: 'demo' })
  //   fast     = Demo mode: everything plays 1.6x faster and lines move on by themselves
  init(data) {
    this.cutsceneId = data.id || 'intro';
    this.nextScene = data.next || 'Menu';
    this.nextData = data.nextData;
    this.fast = !!data.fast;
  }

  create() {
    makeTextures(this);
    this.done = false;
    this.onUpdate = null;
    // Demo mode plays the cutscene faster (all animations, waits and typing), Story mode at normal speed
    const speed = this.fast ? 1.6 : 1;
    this.time.timeScale = speed;
    this.tweens.timeScale = speed;
    this.runId = (this.runId || 0) + 1;
    // Two cameras: the main one shows the world (and can zoom in), the UI one shows the speech box,
    // title cards and flashes at normal size, so zooming never makes the text huge.
    const { width: W0, height: H0 } = this.scale;
    this.uiObjects = new Set();
    this.uiCam = this.cameras.add(0, 0, W0, H0);
    const sort = () => this.sortCameras();
    this.events.on('postupdate', sort);
    this.events.once('shutdown', () => this.events.off('postupdate', sort)); // don't pile up one per cutscene
    this.actors = {};    // who to bounce when they talk: { Crumb: sprite, Pigeon: sprite, ... }
    this.shadows = [];   // [{ obj, shadow }] soft shadows that follow characters
    this.makeDialogueBox();
    this.cinematic();

    const advance = () => { if (this.onAdvance) this.onAdvance(); };
    this.input.keyboard.on('keydown-SPACE', advance);
    this.input.keyboard.on('keydown-ENTER', advance);
    this.input.on('pointerdown', advance);
    this.input.keyboard.on('keydown-ESC', () => this.finish());

    const { width: W, height: H } = this.scale;
    this.ui(this.add.text(W - 16, H - 12, 'Space / click / double flick = next   Esc = skip', {
      fontFamily: FONT, fontSize: '16px', color: '#ffffff',
    }).setOrigin(1, 1).setAlpha(0.6).setDepth(100));

    this.cameras.main.fadeIn(500, 0, 0, 0);
    this.uiCam.fadeIn(500, 0, 0, 0);
    this.events.once('shutdown', () => { this.done = true; this.onAdvance = null; });
    audio.engineStop();
    audio.music(this.cutsceneId === 'ending' ? 'happy' : 'mystery');
    SCRIPTS[this.cutsceneId](this).then(() => this.finish());
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.uiCam.fadeOut(400, 0, 0, 0);
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(this.nextScene, this.nextData));
  }

  // mark something as UI: drawn by the UI camera only (never zoomed)
  ui(obj) {
    this.uiObjects.add(obj);
    this.cameras.main.ignore(obj);
    return obj;
  }

  // every frame: anything new that isn't UI is hidden from the UI camera (so it isn't drawn twice)
  sortCameras() {
    for (const obj of this.children.list) {
      if (!this.uiObjects.has(obj) && !obj.__worldOnly) { this.uiCam.ignore(obj); obj.__worldOnly = true; }
    }
    // shadows follow their characters along the ground
    for (const s of this.shadows) {
      if (!s.obj.active) { s.shadow.setVisible(false); continue; }
      s.shadow.setVisible(s.obj.visible).setPosition(s.obj.x, s.groundY + 2);
      const lift = Math.max(0, s.groundY - s.obj.y);            // higher up = smaller, fainter shadow
      s.shadow.setScale(Math.max(0.3, 1 - lift / 300)).setAlpha(Math.max(0, 0.35 - lift / 900) * s.obj.alpha);
    }
  }

  // "movie" look: black bars slide in at the top and bottom, plus soft dark corners
  cinematic() {
    const { width: W, height: H } = this.scale;
    this.ui(this.add.image(W / 2, H / 2, 'vignette').setDepth(87).setAlpha(0.8));
    const top = this.ui(this.add.rectangle(W / 2, -24, W, 48, 0x000000).setDepth(88));
    const bottom = this.ui(this.add.rectangle(W / 2, H + 24, W, 48, 0x000000).setDepth(88));
    this.tweens.add({ targets: top, y: 24, duration: 600, ease: 'Cubic.out' });
    this.tweens.add({ targets: bottom, y: H - 24, duration: 600, ease: 'Cubic.out' });
  }

  // a soft shadow under a character standing on the ground at groundY
  addShadow(obj, groundY, width = 70) {
    const shadow = this.add.ellipse(obj.x, groundY + 2, width, 14, 0x000000, 0.35).setDepth((obj.depth || 10) - 1);
    this.shadows.push({ obj, shadow, groundY });
    return shadow;
  }

  // little bounce on whoever is talking
  bounceSpeaker(name) {
    const who = this.actors[name];
    if (!who || !who.active || !who.visible) return;
    const sx = who.scaleX, sy = who.scaleY;
    this.tweens.add({ targets: who, scaleY: sy * 1.08, scaleX: sx * 0.95, duration: 110, yoyo: true, ease: 'Quad.out' });
  }

  // zoom the world camera in on a spot (the speech box stays normal size)
  zoomTo(zoom, x, y, ms = 1200) {
    // (camera moves need the long ease name, e.g. 'Sine.easeInOut')
    this.cameras.main.pan(x, y, ms, 'Sine.easeInOut');
    this.cameras.main.zoomTo(zoom, ms, 'Sine.easeInOut');
    return this.wait(ms);
  }

  // scripts can set c.onUpdate = (time, delta) => {...} for things that move every frame (scrolling, spinning)
  update(time, delta) {
    if (this.onUpdate && !this.done) this.onUpdate(time, delta);
    // a double flick of the wrist sensor = next line (same as Space)
    if (gyro.takeNext() && this.onAdvance) this.onAdvance();
  }

  // a swirling portal. Grow it with c.move(portal, { scale: 1 }).
  portal(x, y) {
    const g = this.add.graphics();
    const colors = [0x3dffd9, 0xb35cff, 0x5d7dff, 0xff6bd5, 0x1a0633];
    colors.forEach((col, i) => {
      const r = 110 - i * 22;
      g.fillStyle(col, i === colors.length - 1 ? 1 : 0.85);
      g.fillEllipse(0, 0, r * 2, r * 2.6);
    });
    // swirl arms
    g.lineStyle(5, 0xffffff, 0.5);
    for (let a = 0; a < 4; a++) {
      g.beginPath();
      for (let t = 0; t < 1; t += 0.05) {
        const ang = a * Math.PI / 2 + t * 4, r = 10 + t * 95;
        const px = Math.cos(ang) * r, py = Math.sin(ang) * r * 1.3;
        if (t === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.strokePath();
    }
    const p = this.add.container(x, y, [g]).setDepth(6).setScale(0);
    this.tweens.add({ targets: g, angle: 360, duration: 1400, repeat: -1 });
    return p;
  }

  // a big white flash over everything (for scene changes)
  async flash(inMs = 250, holdMs = 100, outMs = 500, between = null) {
    const { width: W, height: H } = this.scale;
    let f = this.ui(this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0).setDepth(85));
    await this.move(f, { fillAlpha: 1 }, inMs);
    if (between) {
      between(); // this may clear the whole scene (including the flash), so draw a fresh white one on top
      f = this.ui(this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 1).setDepth(85));
    }
    await this.wait(holdMs);
    await this.move(f, { fillAlpha: 0 }, outMs);
    f.destroy();
  }

  // dusk version of the menu backdrop: purple sky, mountains, solid ground. Returns the ground y.
  duskBackdrop() {
    const { width: W, height: H } = this.scale;
    const ground = H - 110;
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x2a1a5e, 0x2a1a5e, 0xc0607e, 0xc0607e, 1); sky.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) { sky.fillStyle(0xffffff, Math.random() * 0.7); sky.fillRect(Math.random() * W, Math.random() * H * 0.5, 2, 2); }
    this.add.image(W / 2, ground + 20, 'mountains').setOrigin(0.5, 1).setTint(0x5a2f6d);
    this.add.image(W / 2, ground + 10, 'hillsFar').setOrigin(0.5, 1).setDisplaySize(W, 180).setTint(0x3c1c4d);
    const land = this.add.graphics().setDepth(5);
    land.fillStyle(0x2e1830); land.fillRect(0, ground, W, H - ground);
    land.fillStyle(0x3f9a58); land.fillRect(0, ground - 6, W, 14);
    land.fillStyle(0x6fcf86); land.fillRect(0, ground - 6, W, 4);
    return ground;
  }

  // ---------------------------------------------------------------- helpers used by the scripts
  // Only carry on with the script while this cutscene is still playing.
  // (If the player pressed Esc, the rest of the script just quietly stops.)
  stillPlaying(resolve) {
    const run = this.runId; // which playthrough asked; an old one can never wake up inside a new one
    return () => { if (run === this.runId && !this.done && this.sys.isActive()) resolve(); };
  }

  wait(ms) {
    return new Promise((resolve) => this.time.delayedCall(ms, this.stillPlaying(resolve)));
  }

  move(targets, props, duration = 1000, ease = 'Sine.inOut') {
    // resolves when the slide finishes, or if it gets cancelled, so a cutscene can never get stuck
    return new Promise((resolve) => {
      const go = this.stillPlaying(resolve);
      this.tweens.add({ targets, ...props, duration, ease, onComplete: go, onStop: go });
    });
  }

  img(key, x, y, opts = {}) {
    const i = this.add.image(x, y, key);
    if (opts.origin) i.setOrigin(...opts.origin);
    if (opts.scale) i.setScale(opts.scale);
    if (opts.depth !== undefined) i.setDepth(opts.depth);
    return i;
  }

  // a duck (or pigeon) that bobs up and down a little so it looks alive
  character(key, x, y, scale = 1.6, flip = false) {
    const c = this.img(key, x, y, { origin: [0.5, 1], scale, depth: 10 }).setFlipX(flip);
    this.tweens.add({ targets: c, scaleY: scale * 0.96, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    // y is the ground they stand on: give them a shadow, and remember who they are so they bounce when talking
    this.addShadow(c, y, 46 * scale);
    const names = { duckStand: 'Crumb', pigeon: 'Pigeon', duckling: 'Duckling' };
    if (names[key]) this.actors[names[key]] = c;
    return c;
  }

  // the bike with spinning wheels, as one group
  bike(x, y, withRider = true, scale = 1.5) {
    const back = this.add.image(-30, 20, 'wheel');
    const front = this.add.image(30, 20, 'wheel');
    const body = this.add.image(0, 0, withRider ? 'bike' : 'bikeEmpty').setOrigin(0.5, 0.6);
    const b = this.add.container(x, y, [back, front, body]).setScale(scale).setDepth(10);
    b.spin = (on) => {
      this.tweens.killTweensOf([back, front]);
      if (on) this.tweens.add({ targets: [back, front], angle: 360, duration: 300, repeat: -1 });
    };
    b.body = body;
    return b;
  }

  ufo(x, y, scale = 1.4) {
    const u = this.img('ufo', x, y, { scale, depth: 8 });
    u.bob = { stop() {} }; // no hovering until we call hover(), so it doesn't fight with move()
    this.actors['???'] = u;
    return u;
  }

  // gentle up-and-down floating. Call ufo.bob.stop() before moving it somewhere else.
  hover(obj) {
    obj.bob = this.tweens.add({ targets: obj, y: obj.y - 10, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  beam(from, to, color = 0xb6ff3b) {
    const g = this.add.graphics().setDepth(7);
    const draw = () => {
      g.clear(); g.fillStyle(color, 0.25);
      g.fillTriangle(from.x - 30, from.y + 30, from.x + 30, from.y + 30, to.x + 70, to.y);
      g.fillTriangle(from.x - 30, from.y + 30, to.x - 70, to.y, to.x + 70, to.y);
    };
    draw();
    g.redraw = draw;
    return g;
  }

  // a little "!" or "?" over someone's head
  pop(symbol, x, y) {
    const t = this.add.text(x, y, symbol, {
      fontFamily: FONT, fontSize: '56px', fontStyle: 'bold', color: '#ffe066', stroke: '#3b1d4a', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(50).setScale(0);
    this.tweens.add({ targets: t, scale: 1, duration: 250, ease: 'Back.out' });
    this.time.delayedCall(1100, () => this.tweens.add({ targets: t, alpha: 0, duration: 300, onComplete: () => t.destroy() }));
  }

  spaceBackdrop(top = 0x050818, bottom = 0x1d1450) {
    const { width: W, height: H } = this.scale;
    const g = this.add.graphics().setDepth(0);
    g.fillGradientStyle(top, top, bottom, bottom, 1); g.fillRect(0, 0, W, H);
    for (let i = 0; i < 200; i++) {
      g.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.3, 1));
      const s = Math.random() < 0.15 ? 2 : 1;
      g.fillRect(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), s, s);
    }
    this.add.image(W * 0.25, H * 0.3, 'glow').setScale(3).setTint(0x8a5fff).setAlpha(0.35).setDepth(1).setBlendMode(Phaser.BlendModes.ADD);
    this.add.image(W * 0.8, H * 0.6, 'glow').setScale(2.5).setTint(0x3dffd9).setAlpha(0.25).setDepth(1).setBlendMode(Phaser.BlendModes.ADD);
    return g;
  }

  // ---------------------------------------------------------------- dialogue
  makeDialogueBox() {
    const { width: W, height: H } = this.scale;
    this.box = this.ui(this.add.container(0, 0).setDepth(90).setVisible(false));
    // the speech box sits at the TOP so it never covers the characters standing on the ground
    const top = 36;
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1035, 0.88); bg.fillRoundedRect(80, top, W - 160, 140, 22);
    bg.lineStyle(4, 0xfff4dc, 0.9); bg.strokeRoundedRect(80, top, W - 160, 140, 22);
    this.nameTag = this.add.text(110, top - 22, '', {
      fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: '#1a1035', backgroundColor: '#ffd23f', padding: { x: 14, y: 4 },
    });
    this.lineText = this.add.text(120, top + 34, '', {
      fontFamily: FONT, fontSize: '30px', color: '#fff4dc', wordWrap: { width: W - 260 }, lineSpacing: 6,
    });
    this.arrow = this.add.text(W - 120, top + 116, '▶', { fontFamily: FONT, fontSize: '24px', color: '#ffd23f' }).setOrigin(0.5);
    this.tweens.add({ targets: this.arrow, x: W - 112, duration: 400, yoyo: true, repeat: -1 });
    this.box.add([bg, this.nameTag, this.lineText, this.arrow]);
  }

  // Shows a line of speech, typed out letter by letter. Resolves when the player presses Space.
  say(name, text) {
    const colors = { Crumb: '#ffd23f', '???': '#b6ff3b', Pigeon: '#b8bccb', Duckling: '#ffe680', '': '#fff4dc' };
    this.box.setVisible(true);
    this.nameTag.setText(name).setVisible(!!name).setBackgroundColor(colors[name] || '#ffd23f');
    this.bounceSpeaker(name);
    this.lineText.setText('');
    this.arrow.setVisible(false);
    let shown = 0;
    return new Promise((resolve) => {
      // (the clock runs faster in Demo mode, so stretch the delay: the text still types at normal speed)
      const timeScale = this.time.timeScale || 1;
      const typer = this.time.addEvent({
        delay: 28 * timeScale, repeat: text.length - 1,
        callback: () => {
          shown++;
          this.lineText.setText(text.slice(0, shown));
          if (shown % 3 === 1 && text[shown - 1] !== ' ') audio.sfx.talk(name); // little voice blips
          if (shown >= text.length) { this.arrow.setVisible(true); autoNext(); }
        },
      });
      const next = () => {
        if (shown < text.length) { // first press: finish typing the line
          typer.remove(); shown = text.length; this.lineText.setText(text); this.arrow.setVisible(true);
          autoNext();
          return;
        }
        this.onAdvance = null;
        this.box.setVisible(false);
        this.stillPlaying(resolve)();
      };
      // (lines never move on by themselves, in any mode: the player moves on with Space / Enter / a click /
      //  a double flick of the wrist sensor, so whoever is presenting controls the pace)
      const autoNext = () => {};
      this.onAdvance = next;
    });
  }

  async title(big, small) {
    const { width: W, height: H } = this.scale;
    const shade = this.ui(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(95));
    const t1 = this.ui(this.add.text(W / 2, H / 2 - 30, big, {
      fontFamily: FONT, fontSize: '72px', fontStyle: 'bold', color: '#fff4dc', stroke: '#3b1d4a', strokeThickness: 10,
    }).setOrigin(0.5).setDepth(96).setAlpha(0));
    const t2 = this.ui(this.add.text(W / 2, H / 2 + 45, small, {
      fontFamily: FONT, fontSize: '34px', color: '#ffd23f', fontStyle: 'italic',
    }).setOrigin(0.5).setDepth(96).setAlpha(0));
    await this.move(shade, { fillAlpha: 0.75 }, 500);
    await this.move([t1, t2], { alpha: 1 }, 500);
    await this.wait(1800);
  }
}

// =====================================================================================
//  1. OPENING: Crumb's egg gets stolen
// =====================================================================================
async function intro(c) {
  const { width: W } = c.scale;
  const ground = sunsetBackdrop(c); // y of the grass, everyone stands on this

  // bike: wheels are 24px below + 30px down from its middle at scale 1.5, so lift it 54px
  const parked = c.bike(W - 260, ground - 54, false, 1.5);
  const crumb = c.character('duckStand', 440, ground, 1.7);
  c.img('nest', 560, ground + 4, { origin: [0.5, 1], depth: 10 });
  const egg = c.img('egg', 560, ground - 12, { origin: [0.5, 1], depth: 11 });
  c.tweens.add({ targets: egg, angle: { from: -4, to: 4 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

  await c.wait(700);
  await c.say('', 'The lily pond. Sunset. A perfect evening.');
  await c.say('Crumb', 'My very own egg... any day now it\'s going to hatch. I\'ll keep it nice and safe.');

  // the UFO swoops in
  const ufo = c.ufo(W + 200, 80);
  c.cameras.main.shake(400, 0.004);
  audio.sfx.whoosh();
  await c.move(ufo, { x: 560, y: 170 }, 1400, 'Cubic.out');
  c.hover(ufo);
  c.pop('?', 460, ground - 160);
  await c.wait(600);

  // tractor beam lifts the egg out of the nest
  const beam = c.beam({ x: 560, y: 200 }, { x: 560, y: ground });
  c.tweens.add({ targets: beam, alpha: 0.6, duration: 200, yoyo: true, repeat: -1 });
  audio.sfx.beam();
  c.tweens.killTweensOf(egg);
  await c.move(egg, { y: 235, angle: 360 }, 1600, 'Sine.in');
  egg.setVisible(false);
  beam.destroy();

  c.pop('!', 460, ground - 160);
  await c.say('???', 'Mwahahaha! This egg belongs to ME now!');
  await c.say('???', '...coo.');
  await c.say('Crumb', '"Coo"?');
  await c.say('Crumb', 'HEY! THAT\'S MY EGG! GIVE IT BACK!!');

  // UFO escapes
  ufo.bob.stop();
  audio.sfx.whoosh();
  await c.move(ufo, { x: W + 250, y: 60 }, 1100, 'Cubic.in');

  await c.say('Crumb', 'Nobody steals a duck\'s egg. NOBODY.');
  await c.say('Crumb', 'Good thing I fixed up the old dirt bike...');

  // Crumb hops on the bike and rides off
  c.tweens.killTweensOf(crumb);
  await c.move(crumb, { x: parked.x, y: ground - 20 }, 800, 'Quad.inOut');
  crumb.setVisible(false);
  parked.body.setTexture('bike');
  parked.spin(true);
  audio.sfx.jump();
  await c.move(parked, { x: W + 200, angle: -8 }, 1300, 'Quad.in');

  await c.title('LEVEL 1', 'The Sunset Chase');
}

// =====================================================================================
//  2. MIDDLE: the UFO escapes through a portal, Crumb follows, and the chase continues in space
// =====================================================================================
async function middle(c) {
  const { width: W, height: H } = c.scale;
  const ground = c.duskBackdrop();

  // a wooden kicker ramp sitting on the ground
  const rampX = 760;
  const ramp = c.add.graphics().setDepth(6);
  ramp.fillStyle(0x8a5a32); ramp.fillTriangle(rampX, ground, rampX + 150, ground, rampX + 150, ground - 80);
  ramp.fillStyle(0x6b4226); ramp.fillRect(rampX + 140, ground - 80, 10, 80);

  const ufo = c.ufo(1040, 210);
  c.hover(ufo);
  const egg = c.img('egg', 1040, 278, { depth: 8 });
  c.tweens.add({ targets: egg, y: 268, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  const bike = c.bike(-150, ground - 50, true, 1.4); // wheels resting on the grass
  c.actors.Crumb = bike;
  c.addShadow(bike, ground, 110);
  bike.spin(true);
  audio.sfx.whoosh();
  await c.move(bike, { x: 280 }, 1200, 'Quad.out');
  bike.spin(false);

  await c.say('???', 'You\'re a persistent little duck, aren\'t you?');
  await c.say('Crumb', 'You have my egg. I have all evening.');
  await c.say('???', 'Then try following me through THIS! Mwahaha... coo!');

  // the UFO zaps open a portal in the sky...
  ufo.bob.stop();
  const portal = c.portal(1120, 150);
  const zap = c.add.graphics().setDepth(7);
  zap.lineStyle(6, 0xb6ff3b, 0.9); zap.lineBetween(ufo.x, ufo.y, 1120, 150);
  audio.sfx.reveal();
  await c.move(portal, { scale: 1 }, 700, 'Back.out');
  zap.destroy();
  // ...and dives in with the egg
  c.tweens.killTweensOf(egg);
  audio.sfx.whoosh();
  c.move(egg, { x: 1120, y: 150, scale: 0.1, alpha: 0 }, 700, 'Cubic.in');
  await c.move(ufo, { x: 1120, y: 150, scale: 0.1, alpha: 0, angle: 180 }, 700, 'Cubic.in');

  await c.say('Crumb', 'Oh no you DON\'T!');

  // Crumb guns it: up the ramp and into the portal, right behind the UFO
  bike.spin(true);
  audio.sfx.jump();
  await c.move(bike, { x: rampX + 10 }, 700, 'Quad.in');
  await c.move(bike, { x: rampX + 150, y: ground - 80 - 50, angle: -28 }, 220, 'Linear');
  audio.sfx.beam();
  await c.move(bike, { x: 1120, y: 150, angle: -360, scale: 0.25 }, 750, 'Sine.out');
  c.cameras.main.shake(300, 0.01);

  // --- whoosh through the portal: a white flash, and we're in space ---
  const roadY = H - 130;
  let scroll = 0, speed = 0.55; // how fast the world slides past (pixels per ms)
  let stars = [], road, earth, tube = null;
  await c.flash(200, 150, 600, () => {
    c.tweens.killAll();
    c.children.removeAll(true);
    c.shadows = [];
    c.actors = {};
    c.makeDialogueBox();
    c.cinematic();
    c.spaceBackdrop();
    earth = c.img('earth', 260, H + 40, { scale: 1.5, depth: 1 });
    // fast-moving star streaks so it feels like a chase
    stars = [];
    for (let i = 0; i < 90; i++) {
      stars.push(c.add.rectangle(Math.random() * W, Math.random() * (roadY - 20), Phaser.Math.Between(6, 30), 2, 0xffffff,
        Phaser.Math.FloatBetween(0.3, 0.9)).setDepth(2));
    }
    road = c.add.graphics().setDepth(4);
  });

  // a glowing space road that scrolls past, so everyone is always running ON something
  c.onUpdate = (time, delta) => {
    scroll += speed * delta;
    for (const s of stars) { s.x -= speed * delta * (s.width / 12); if (s.x < -40) s.x = W + 40; }
    earth.x -= speed * delta * 0.02;
    road.clear();
    road.fillStyle(0x1d2266); road.fillRect(0, roadY, W, H - roadY);
    road.fillStyle(0x4d6bff); road.fillRect(0, roadY - 4, W, 8);
    road.fillStyle(0x7f98ff);
    for (let x = -(scroll % 120); x < W; x += 120) road.fillRect(x, roadY + 18, 60, 6);
    if (tube && tube.x > 1000) tube.x = Math.max(1000, tube.x - speed * delta); // the tube stops just ahead
  };

  // Crumb comes flying out of the portal and lands running; the bike drifts off
  const backPortal = c.portal(140, 260);
  backPortal.setScale(0.8);
  const crumb = c.img('duckStand', 140, 260, { origin: [0.5, 1], scale: 0.3, depth: 10 });
  const floaty = c.bike(140, 260, false, 0.4);
  c.move(floaty, { x: -150, y: 80, angle: -300, scale: 1 }, 2200, 'Sine.out');
  await c.move(crumb, { x: 330, y: roadY, scale: 1.5, angle: 360 }, 700, 'Quad.in');
  crumb.setAngle(0);
  c.actors.Crumb = crumb;
  c.addShadow(crumb, roadY, 70);
  audio.sfx.land();
  c.move(backPortal, { scale: 0 }, 500);
  // running: a quick bob up and down
  c.tweens.add({ targets: crumb, y: roadY - 10, angle: 4, duration: 130, yoyo: true, repeat: -1 });

  // the UFO zooms ahead, taunting
  const ufo2 = c.ufo(W + 150, 230, 1.1);
  const egg2 = c.img('egg', W + 150, 290, { depth: 8 });
  c.move(egg2, { x: 900 }, 900, 'Cubic.out');
  await c.move(ufo2, { x: 900 }, 900, 'Cubic.out');
  c.hover(ufo2);
  c.tweens.add({ targets: egg2, y: 280, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

  await c.say('???', 'Try and catch me NOW, duck! Mwahahaha!');
  await c.say('Crumb', 'My bike\'s gone... fine. I\'ll RUN!');

  // a giant tube comes into view on the road. The UFO dives in.
  tube = c.add.graphics().setDepth(5);
  for (let i = 6; i >= 1; i--) {
    const s = i * 26;
    tube.fillStyle(i % 2 ? 0x4d6bff : 0x3b52d1, 1);
    tube.fillRect(-s, -s * 2 + 6, s * 2, s * 2);
  }
  tube.fillStyle(0x050818); tube.fillRect(-26, -46, 52, 52);
  tube.x = W + 200; tube.y = roadY;
  await c.wait(1500);
  ufo2.bob.stop();
  c.tweens.killTweensOf(egg2);
  audio.sfx.whoosh();
  c.move(egg2, { x: tube.x, y: roadY - 70, scale: 0.1, alpha: 0 }, 600, 'Cubic.in');
  await c.move(ufo2, { x: tube.x, y: roadY - 80, scale: 0.1, alpha: 0 }, 600, 'Cubic.in');
  await c.say('Crumb', 'Into the tube? Then I\'m going in too!');

  // Crumb sprints after it and jumps in
  c.tweens.killTweensOf(crumb);
  audio.sfx.jump();
  speed = 0.2;
  await c.move(crumb, { x: tube.x, y: roadY - 60, scale: 0.2 }, 800, 'Quad.in');
  crumb.setVisible(false);

  await c.title('LEVEL 2', 'The Space Tube');
}

// =====================================================================================
//  3. ENDING: who's flying the UFO? (and the bread gets shared)
// =====================================================================================
async function ending(c) {
  const { width: W, height: H } = c.scale;
  c.spaceBackdrop(0x03140a, 0x14243a);
  const earth = c.img('earth', W - 220, 170, { scale: 0.9, depth: 1 });

  // a big flat asteroid surface to stand on (flat on top, so nobody floats)
  const ground = H - 110;
  const rock = c.add.graphics().setDepth(5);
  rock.fillStyle(0x4a4456); rock.fillRect(0, ground + 8, W, H - ground);
  rock.fillStyle(0x6b6478); rock.fillRect(0, ground - 4, W, 16);
  rock.fillStyle(0x8a849a); rock.fillRect(0, ground - 4, W, 4);
  // craters, pebbles and distant rocks. They're on their own layer that SLIDES past during the chase at the
  // start (drawn twice side by side, so it can scroll forever), then stops when Crumb catches up.
  const scenery = c.add.container(0, 0).setDepth(5.5);
  for (const ox of [0, W]) {
    const d = c.add.graphics();
    d.fillStyle(0x3a3546);
    [[160, 40, 90, 18], [520, 70, 140, 24], [900, 45, 110, 20], [1180, 80, 70, 14]].forEach(([x, y, w, h]) => d.fillEllipse(ox + x, ground + y, w, h));
    d.fillStyle(0x6b6478);
    [[250, -8], [700, -6], [1050, -8]].forEach(([x, y]) => d.fillEllipse(ox + x, ground + y, 22, 12));
    // the far edge of the asteroid with distant rocks, so it looks like a place
    d.fillStyle(0x5a5466);
    d.fillTriangle(ox + 60, ground - 4, ox + 140, ground - 60, ox + 220, ground - 4);
    d.fillTriangle(ox + 1000, ground - 4, ox + 1090, ground - 80, ox + 1200, ground - 4);
    scenery.add(d);
  }

  // a tween you can "await", with an onUpdate (for curved jumps)
  const tweenP = (cfg) => new Promise((res) => {
    const go = c.stillPlaying(res);
    c.tweens.add({ ...cfg, onComplete: go, onStop: go });
  });

  // ---- the chase, still going: the asteroid slides past, the UFO flees ahead, and Crumb runs flat out
  // and slowly catches up. Once he's caught it, everything slows to a stop and the scene carries on. ----
  const ufo = c.img('ufo', 1050, 300, { scale: 1.3, depth: 8 });
  const crumb = c.character('duckStand', 90, ground, 1.7);
  c.tweens.killTweensOf(crumb); // no idle bobbing during the action
  const chase = { speed: 0.9 };  // how fast the ground slides past (pixels per ms)
  const dust = c.add.particles(0, 0, 'pixel', {
    speed: { min: 20, max: 70 }, angle: { min: 190, max: 240 }, lifespan: 450, gravityY: -40,
    scale: { start: 1.6, end: 0 }, alpha: { start: 0.6, end: 0 }, tint: 0x8a849a, emitting: false,
  }).setDepth(9);
  let runTime = 0;
  c.onUpdate = (time, delta) => {
    scenery.x -= chase.speed * delta;
    if (scenery.x <= -W) scenery.x += W;
    if (chase.speed > 0.05) {
      // running: quick little hops with a forward lean, kicking up dust
      runTime += delta;
      crumb.y = ground - Math.abs(Math.sin(runTime / 70)) * 14;
      crumb.setAngle(8 + Math.sin(runTime / 70) * 4);
      if (Math.floor(runTime / 70) % 2 === 0) dust.emitParticleAt(crumb.x - 30, ground - 4, 1);
      ufo.y += Math.sin(runTime / 240) * 0.6; // the UFO wobbles as it flees
    }
  };
  audio.sfx.whoosh();
  // over a few seconds, Crumb closes the gap: he moves up the screen while the UFO drifts back to him
  c.move(ufo, { x: 600 }, 4200, 'Sine.inOut');
  const caughtUp = c.move(crumb, { x: 300 }, 4200, 'Sine.inOut');
  await c.wait(900);
  await c.say('Crumb', 'You\'re not getting away this time!');
  await caughtUp;
  // caught it! everything slows down and stops, and the scene goes on from here
  await c.move(chase, { speed: 0 }, 600, 'Quad.out');
  c.onUpdate = null;
  crumb.setY(ground).setAngle(0);
  await c.move(ufo, { y: 330 }, 300, 'Sine.out'); // (low enough that Crumb riding on top stays below the speech box)

  // ---- Crumb leaps onto the UFO's dome ----
  audio.sfx.jump();
  const sx = crumb.x, sy = crumb.y;
  const jump = { t: 0 };
  await tweenP({
    targets: jump, t: 1, duration: 700, ease: 'Sine.inOut',
    onUpdate: () => {
      const tx = ufo.x + 8, ty = ufo.y - 30;
      crumb.setPosition(sx + (tx - sx) * jump.t, sy + (ty - sy) * jump.t - Math.sin(Math.PI * jump.t) * 230);
      crumb.setAngle(jump.t * 360);
    },
  });
  audio.sfx.land();
  // ride on top of the UFO (Crumb sticks to it while it moves)
  const peck = { a: 0 };
  c.onUpdate = () => { crumb.setPosition(ufo.x + 8, ufo.y - 30).setAngle(ufo.angle + peck.a); };
  c.tweens.add({ targets: ufo, y: ufo.y - 12, duration: 300, yoyo: true, repeat: 1, ease: 'Sine.inOut' });
  await c.say('???', 'HEY! Get off my saucer!');

  // ---- PECK! PECK! PECK! ----
  const peckSparks = c.add.particles(0, 0, 'pixel', {
    speed: { min: 80, max: 260 }, lifespan: 450, gravityY: 300, scale: { start: 1, end: 0 },
    tint: [0xffe14d, 0xffffff, 0xff8c1a], emitting: false,
  }).setDepth(12);
  for (let i = 0; i < 3; i++) {
    await tweenP({ targets: peck, a: 40, duration: 90, yoyo: true, ease: 'Quad.out' });
    const bx = ufo.x + 60, by = ufo.y - 40;
    peckSparks.explode(14, bx, by);
    audio.sfx.bonk();
    c.cameras.main.shake(140, 0.006);
    const word = c.add.text(bx + 20, by - 30, i < 2 ? 'PECK!' : 'CRACK!', {
      fontFamily: FONT, fontSize: i < 2 ? '34px' : '52px', fontStyle: 'bold', color: '#ffe066', stroke: '#3b1d4a', strokeThickness: 7,
    }).setOrigin(0.5).setDepth(40);
    c.tweens.add({ targets: word, y: word.y - 50, alpha: 0, duration: 800, onComplete: () => word.destroy() });
    c.tweens.add({ targets: ufo, angle: i % 2 ? 10 : -10, duration: 80, yoyo: true });
    await c.wait(i < 2 ? 280 : 400);
  }

  // ---- the UFO breaks: smoke, flickering lights, and it swerves out of control ----
  const smoke = c.add.particles(0, 0, 'glow', {
    follow: ufo, speed: 30, scale: { start: 0.25, end: 0.6 }, alpha: { start: 0.5, end: 0 },
    tint: 0x555555, lifespan: 1200, frequency: 60,
  }).setDepth(7);
  c.time.addEvent({ delay: 90, repeat: 25, callback: () => ufo.setTint(ufo.isTinted ? 0xffffff : 0xff6060) });
  await c.say('???', 'No no NO! My controls!!');
  audio.sfx.whoosh();
  await c.move(ufo, { x: 950, y: 150, angle: -25 }, 450, 'Sine.inOut');
  audio.sfx.whoosh();
  await c.move(ufo, { x: 420, y: 230, angle: 25 }, 450, 'Sine.inOut');
  // Crumb jumps off just in time
  c.onUpdate = null;
  audio.sfx.jump();
  const jx = crumb.x, jy = crumb.y, off = { t: 0 };
  tweenP({
    targets: off, t: 1, duration: 650, ease: 'Sine.in',
    onUpdate: () => {
      crumb.setPosition(jx + (380 - jx) * off.t, jy + (ground - jy) * off.t - Math.sin(Math.PI * off.t) * 120);
      crumb.setAngle(-360 * off.t);
    },
  }).then(() => { crumb.setAngle(0); audio.sfx.land(); });
  audio.sfx.whoosh();
  await c.move(ufo, { x: 1000, y: 140, angle: -40 }, 500, 'Sine.inOut');
  // ...and it spirals down and crashes into the little planet
  await c.move(ufo, { x: 760, y: ground - 30, angle: 374 }, 1100, 'Quad.in'); // lands with its bottom on the rock
  ufo.clearTint().setAngle(14);
  c.cameras.main.shake(500, 0.012);
  audio.sfx.crash();
  smoke.setFrequency(160); // keeps smoking gently

  // WRECKAGE: a scorch mark, and broken pieces of saucer scattered all around it
  const scorch = c.add.graphics().setDepth(6);
  scorch.fillStyle(0x221d28, 0.85); scorch.fillEllipse(760, ground + 2, 380, 30);
  scorch.fillStyle(0x15121a, 0.9); scorch.fillEllipse(760, ground + 2, 200, 16);
  const pieces = [
    // [landing x, angle, kind]  kind: 0 = hull panel, 1 = sharp shard, 2 = broken light, 3 = bent antenna, 4 = bolt
    [560, -25, 0], [610, 40, 2], [650, 120, 4], [690, -60, 1], [845, 70, 1], [890, -15, 0],
    [930, 200, 3], [975, 30, 2], [1015, -80, 4], [520, 160, 1], [1060, 15, 0], [720, 95, 4],
  ];
  const lightColors = [0xff5d73, 0xffe14d, 0x5dffb0, 0x5dc8ff];
  pieces.forEach(([x, ang, kind], i) => {
    const p = c.add.graphics().setDepth(9);
    if (kind === 0) {
      p.fillStyle(0x8f96a8); p.fillRoundedRect(-22, -9, 44, 18, 4);
      p.fillStyle(0x6d7486); p.fillRect(-22, 2, 44, 4);
      p.fillStyle(0x4a5060); p.fillCircle(-14, -3, 2); p.fillCircle(14, -3, 2); // rivets
    } else if (kind === 1) {
      p.fillStyle(0xa9b0c2); p.fillTriangle(-16, 6, 14, 8, 2, -14);
      p.fillStyle(0x6d7486); p.fillTriangle(-6, 6, 14, 8, 4, -2);
    } else if (kind === 2) {
      p.fillStyle(0x6d7486); p.fillRect(-8, 0, 16, 6);
      p.fillStyle(lightColors[i % lightColors.length], 0.9); p.fillCircle(0, -2, 7);
      p.fillStyle(0xffffff, 0.7); p.fillCircle(-2, -4, 2);
    } else if (kind === 3) {
      p.lineStyle(4, 0x8f96a8); p.beginPath(); p.moveTo(-16, 6); p.lineTo(0, -6); p.lineTo(14, 2); p.strokePath();
      p.fillStyle(0xff5d73); p.fillCircle(14, 2, 5);
    } else {
      p.fillStyle(0x5a6070); p.fillRect(-5, -5, 10, 10);
      p.fillStyle(0x8f96a8); p.fillCircle(0, 0, 3);
    }
    // each piece flies out of the crash and lands on the rock
    p.setPosition(760, ground - 40);
    const ry = ground - 4 - Phaser.Math.Between(0, 8);
    c.tweens.add({ targets: p, x, duration: 500 + i * 40, ease: 'Quad.out' });
    c.tweens.add({ targets: p, y: { from: ground - 40, to: ry }, duration: 500 + i * 40, ease: 'Bounce.out' });
    c.tweens.add({ targets: p, angle: ang + 360, duration: 500 + i * 40, ease: 'Quad.out' });
  });
  // little sparks crackling off the wreck now and then
  const sparks = c.add.particles(0, 0, 'pixel', {
    x: { min: 690, max: 830 }, y: ground - 40, speed: { min: 80, max: 200 }, angle: { min: 220, max: 320 },
    gravityY: 400, lifespan: 500, scale: { start: 0.8, end: 0 }, tint: [0xffe14d, 0xff8c1a, 0xffffff],
    frequency: 700, quantity: 5,
  }).setDepth(10);
  await c.wait(900);

  // Crumb is back on the ground (breathing again), and the camera moves in closer for the big conversation
  crumb.setPosition(380, ground).setAngle(0);
  c.tweens.add({ targets: crumb, scaleY: 1.7 * 0.96, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  await c.zoomTo(1.3, 580, 440, 1100);
  await c.say('Crumb', 'End of the line, egg thief!');
  await c.say('???', 'Ugh... my beautiful saucer...');
  await c.say('Crumb', 'Come out of there. Let\'s see who you REALLY are!');

  // the hatch pops open... smoke... a figure steps out
  const flash = c.ui(c.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0).setDepth(80));
  const pigeon = c.img('pigeon', 760, ground, { origin: [0.5, 1], scale: 1.7, depth: 9 }).setAlpha(0).setTint(0x000000);
  c.actors.Pigeon = pigeon;
  c.addShadow(pigeon, ground, 75);
  ufo.setTexture('ufoEmpty'); // the pilot has climbed out, so the dome is empty now
  await c.move(pigeon, { alpha: 1, x: 640 }, 900);
  await c.say('???', '...');
  audio.sfx.reveal();
  await c.move(flash, { fillAlpha: 1 }, 150);
  pigeon.clearTint();
  await c.move(flash, { fillAlpha: 0 }, 500);

  await c.say('Pigeon', '...coo.');
  c.pop('!', 380, ground - 150);
  await c.say('Crumb', 'A PIGEON?!');
  await c.say('Pigeon', 'Okay, okay. You got me.');
  await c.say('Pigeon', 'Every day, everybody at the pond feeds the ducks. Ducks this, ducks that.');
  await c.say('Pigeon', 'Nobody ever shares any bread with us pigeons...');
  await c.say('Pigeon', 'So I thought... if I hatched my OWN duck, it would share with me.');
  await c.say('Crumb', '...So you built a whole UFO?');
  await c.say('Pigeon', 'I had a LOT of free time.');

  // the egg comes back...
  const egg = c.img('egg', 600, ground, { origin: [0.5, 1], depth: 11, scale: 1.2 });
  await c.move(egg, { x: 500 }, 800, 'Quad.out');
  await c.say('Pigeon', 'Here. Your egg. Sorry, duck.');

  // ...and starts to wobble
  await c.move(egg, { angle: 12 }, 120); await c.move(egg, { angle: -12 }, 120);
  await c.move(egg, { angle: 12 }, 120); await c.move(egg, { angle: 0 }, 120);
  c.pop('!', 380, ground - 150);
  await c.say('Crumb', 'Wait... it\'s moving!');
  for (let i = 0; i < 3; i++) { await c.move(egg, { angle: 15 }, 80); await c.move(egg, { angle: -15 }, 80); }
  egg.setAngle(0);

  // CRACK! A duckling pops out
  audio.sfx.rip();
  audio.sfx.reveal();
  c.cameras.main.shake(150, 0.004);
  const shellL = c.img('egg', 490, ground, { origin: [0.5, 1], depth: 11, scale: 1.2 }).setCrop(0, 0, 19, 46);
  const shellR = c.img('egg', 510, ground, { origin: [0.5, 1], depth: 11, scale: 1.2 }).setCrop(19, 0, 19, 46);
  egg.destroy();
  c.move(shellL, { x: 450, angle: -40, alpha: 0 }, 700);
  c.move(shellR, { x: 550, angle: 40, alpha: 0 }, 700);
  const duckling = c.character('duckling', 500, ground, 1.4);
  await c.move(duckling, { y: ground - 30 }, 180, 'Quad.out');
  await c.move(duckling, { y: ground }, 180, 'Quad.in');
  await c.say('Duckling', 'Peep!');
  await c.say('Crumb', 'My baby!! You hatched!');
  await c.say('Duckling', 'Peep peep!');

  // Crumb pulls out some bread to share
  await c.say('Crumb', 'You know, pigeon... you could have just asked. I always have bread.');
  // Where everyone's beak is (each character stands on the ground, so this is measured from their feet)
  const crumbBeak = { x: crumb.x + 56, y: ground - 92 };
  const pigeonBeak = { x: pigeon.x - 58, y: ground - 95 };
  const babyBeak = { x: duckling.x + 26, y: ground - 40 };
  // Crumb pulls a loaf out and holds it in front of the beak
  const bread = c.img('bread', crumbBeak.x, ground - 60, { depth: 12, scale: 0.2 });
  await c.move(bread, { x: crumbBeak.x, y: crumbBeak.y, scale: 1.1 }, 450, 'Back.out');
  await c.wait(250);
  // RIP! Three pieces: one stays with Crumb, one goes to the pigeon, a little one for the duckling
  const forCrumb = c.img('bread', crumbBeak.x, crumbBeak.y, { depth: 12, scale: 0.6 });
  const forPigeon = c.img('bread', crumbBeak.x, crumbBeak.y, { depth: 12, scale: 0.6 });
  const forBaby = c.img('bread', crumbBeak.x, crumbBeak.y, { depth: 12, scale: 0.4 });
  bread.destroy();
  c.cameras.main.shake(150, 0.003);
  audio.sfx.rip();
  c.move(forCrumb, { angle: -10 }, 300);
  c.move(forBaby, { x: babyBeak.x, y: babyBeak.y, angle: 10 }, 700, 'Sine.inOut');
  await c.move(forPigeon, { x: pigeonBeak.x, y: pigeonBeak.y, angle: 15 }, 900, 'Sine.inOut');
  await c.say('Crumb', 'Here. There\'s enough for all three of us.');
  await c.say('Pigeon', '...Really? For me?');
  await c.say('Pigeon', 'Coo!! Thank you, duck!');
  await c.say('Crumb', 'The name\'s Crumb.');

  // happy hearts
  for (let i = 0; i < 10; i++) {
    const heart = c.add.text(Phaser.Math.Between(380, 680), ground - 120, '♥', {
      fontFamily: FONT, fontSize: '36px', color: '#ff6b9a',
    }).setOrigin(0.5).setDepth(40);
    c.tweens.add({ targets: heart, y: heart.y - 160, alpha: 0, duration: 1600, delay: i * 150 });
    if (i % 3 === 0) c.time.delayedCall(i * 150, () => audio.sfx.heart());
  }
  await c.wait(1200);

  await c.say('', 'And so Crumb, the little duckling and the pigeon sat on an asteroid, sharing bread and watching the Earth turn.');

  // zoom back out and drift towards the Earth for the ending card
  c.zoomTo(1, W / 2, H / 2, 1500);
  c.move(earth, { scale: 1.4, x: W / 2, y: 220 }, 3000);
  await c.wait(800);
  // The ending card sits in the MIDDLE of the screen, and the "press Space" hint at the bottom,
  // so nothing overlaps the speech box at the top.
  const end1 = c.ui(c.add.text(W / 2, H / 2 - 20, 'THE END', {
    fontFamily: FONT, fontSize: '84px', fontStyle: 'bold', color: '#fff4dc', stroke: '#3b1d4a', strokeThickness: 12,
  }).setOrigin(0.5).setDepth(96).setAlpha(0));
  const end2 = c.ui(c.add.text(W / 2, H / 2 + 60, 'Thanks for playing Duck Dash!', {
    fontFamily: FONT, fontSize: '32px', color: '#ffd23f', stroke: '#3b1d4a', strokeThickness: 6,
  }).setOrigin(0.5).setDepth(96).setAlpha(0));
  await c.move([end1, end2], { alpha: 1 }, 1200);
  const hint = c.ui(c.add.text(W / 2, H - 80, 'Press Space to go back to the menu', {
    fontFamily: FONT, fontSize: '22px', color: '#fff4dc', stroke: '#3b1d4a', strokeThickness: 5,
  }).setOrigin(0.5).setDepth(96).setAlpha(0));
  c.tweens.add({ targets: hint, alpha: { from: 0.3, to: 1 }, duration: 700, yoyo: true, repeat: -1 });
  // wait for Space / Enter / click without opening a speech box (Demo mode also moves on by itself)
  await new Promise((resolve) => {
    const done = () => { c.onAdvance = null; c.stillPlaying(resolve)(); };
    c.onAdvance = done;
  });
}
