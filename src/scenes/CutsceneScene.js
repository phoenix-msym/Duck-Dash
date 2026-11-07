import { makeTextures } from '../art.js';
import { sunsetBackdrop, FONT } from '../ui.js';
import { audio } from '../audio.js';

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

  init(data) {
    this.cutsceneId = data.id || 'intro';
    this.nextScene = data.next || 'Menu';
  }

  create() {
    makeTextures(this);
    this.done = false;
    this.runId = (this.runId || 0) + 1;
    this.layer = this.add.container(0, 0);   // everything in the "world"
    this.makeDialogueBox();

    const advance = () => { if (this.onAdvance) this.onAdvance(); };
    this.input.keyboard.on('keydown-SPACE', advance);
    this.input.keyboard.on('keydown-ENTER', advance);
    this.input.on('pointerdown', advance);
    this.input.keyboard.on('keydown-ESC', () => this.finish());

    const { width: W, height: H } = this.scale;
    this.add.text(W - 16, H - 12, 'Space = next   Esc = skip', {
      fontFamily: FONT, fontSize: '16px', color: '#ffffff',
    }).setOrigin(1, 1).setAlpha(0.6).setDepth(100);

    this.cameras.main.fadeIn(500, 0, 0, 0);
    this.events.once('shutdown', () => { this.done = true; this.onAdvance = null; });
    audio.engineStop();
    audio.music(this.cutsceneId === 'ending' ? 'happy' : 'mystery');
    SCRIPTS[this.cutsceneId](this).then(() => this.finish());
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(this.nextScene));
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
    this.box = this.add.container(0, 0).setDepth(90).setVisible(false);
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
    const colors = { Crumb: '#ffd23f', '???': '#b6ff3b', Pigeon: '#b8bccb', '': '#fff4dc' };
    this.box.setVisible(true);
    this.nameTag.setText(name).setVisible(!!name).setBackgroundColor(colors[name] || '#ffd23f');
    this.lineText.setText('');
    this.arrow.setVisible(false);
    let shown = 0;
    return new Promise((resolve) => {
      const typer = this.time.addEvent({
        delay: 28, repeat: text.length - 1,
        callback: () => {
          shown++;
          this.lineText.setText(text.slice(0, shown));
          if (shown % 3 === 1 && text[shown - 1] !== ' ') audio.sfx.talk(name); // little voice blips
          if (shown >= text.length) this.arrow.setVisible(true);
        },
      });
      this.onAdvance = () => {
        if (shown < text.length) { // first press: finish typing the line
          typer.remove(); shown = text.length; this.lineText.setText(text); this.arrow.setVisible(true);
          return;
        }
        this.onAdvance = null;
        this.box.setVisible(false);
        this.stillPlaying(resolve)();
      };
    });
  }

  async title(big, small) {
    const { width: W, height: H } = this.scale;
    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(95);
    const t1 = this.add.text(W / 2, H / 2 - 30, big, {
      fontFamily: FONT, fontSize: '72px', fontStyle: 'bold', color: '#fff4dc', stroke: '#3b1d4a', strokeThickness: 10,
    }).setOrigin(0.5).setDepth(96).setAlpha(0);
    const t2 = this.add.text(W / 2, H / 2 + 45, small, {
      fontFamily: FONT, fontSize: '34px', color: '#ffd23f', fontStyle: 'italic',
    }).setOrigin(0.5).setDepth(96).setAlpha(0);
    await this.move(shade, { fillAlpha: 0.75 }, 500);
    await this.move([t1, t2], { alpha: 1 }, 500);
    await this.wait(1800);
  }
}

// =====================================================================================
//  1. OPENING: the bread gets stolen
// =====================================================================================
async function intro(c) {
  const { width: W, height: H } = c.scale;
  sunsetBackdrop(c);
  const ground = H - 70;

  const parked = c.bike(W - 260, ground - 42, false, 1.5);
  const crumb = c.character('duckStand', 420, ground, 1.7);
  const bread = c.img('bread', 520, ground - 92, { depth: 11 });

  await c.wait(700);
  await c.say('', 'The lily pond. Sunset. A perfect evening.');
  await c.say('Crumb', 'Ahh... a whole loaf of fresh bread. All mine. Just me and my bread.');

  // the UFO swoops in
  const ufo = c.ufo(W + 200, 80);
  c.cameras.main.shake(400, 0.004);
  audio.sfx.whoosh();
  await c.move(ufo, { x: 520, y: 170 }, 1400, 'Cubic.out');
  c.hover(ufo);
  c.pop('?', 440, ground - 150);
  await c.wait(600);

  // tractor beam lifts the bread
  const beam = c.beam({ x: 520, y: 200 }, { x: 520, y: ground - 70 });
  c.tweens.add({ targets: beam, alpha: 0.6, duration: 200, yoyo: true, repeat: -1 });
  audio.sfx.beam();
  await c.move(bread, { y: 230, angle: 360 }, 1600, 'Sine.in');
  bread.setVisible(false);
  beam.destroy();

  c.pop('!', 440, ground - 150);
  await c.say('???', 'Mwahahaha! This bread belongs to ME now!');
  await c.say('???', '...coo.');
  await c.say('Crumb', '"Coo"?');
  await c.say('Crumb', 'HEY! GIVE THAT BACK!!');

  // UFO escapes
  ufo.bob.stop();
  audio.sfx.whoosh();
  await c.move(ufo, { x: W + 250, y: 60 }, 1100, 'Cubic.in');

  await c.say('Crumb', 'Oh, you did NOT just steal a duck\'s bread.');
  await c.say('Crumb', 'Good thing I fixed up the old dirt bike...');

  // Crumb hops on the bike and rides off
  c.tweens.killTweensOf(crumb);
  await c.move(crumb, { x: parked.x, y: ground - 30 }, 800, 'Quad.inOut');
  crumb.setVisible(false);
  parked.body.setTexture('bike');
  parked.spin(true);
  audio.sfx.jump();
  await c.move(parked, { x: W + 200, angle: -8 }, 1300, 'Quad.in');

  await c.title('LEVEL 1', 'The Sunset Chase');
}

// =====================================================================================
//  2. MIDDLE: the UFO heads for space, and Crumb follows
// =====================================================================================
async function middle(c) {
  const { width: W, height: H } = c.scale;
  const ground = H - 90;

  // dusk sky
  const sky = c.add.graphics();
  sky.fillGradientStyle(0x2a1a5e, 0x2a1a5e, 0xc0607e, 0xc0607e, 1); sky.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) { sky.fillStyle(0xffffff, Math.random() * 0.7); sky.fillRect(Math.random() * W, Math.random() * H * 0.5, 2, 2); }
  c.img('hillsFar', W / 2, H - 150).setDisplaySize(W, 260).setTint(0x5a2f6d);
  // cliff with a ramp at the edge
  const land = c.add.graphics().setDepth(5);
  land.fillStyle(0x3c1c4d);
  land.fillPoints([{ x: 0, y: ground }, { x: 820, y: ground }, { x: 960, y: ground - 70 }, { x: 960, y: H }, { x: 0, y: H }], true);
  land.lineStyle(10, 0x4fbf6a); land.strokePoints([{ x: 0, y: ground }, { x: 820, y: ground }, { x: 960, y: ground - 70 }]);

  const ufo = c.ufo(1080, 200);
  c.hover(ufo);
  const bread = c.img('bread', 1080, 262, { depth: 8 });
  const bike = c.bike(-150, ground - 42, true, 1.4);
  bike.spin(true);
  await c.move(bike, { x: 300 }, 1400, 'Quad.out');
  bike.spin(false);

  await c.say('???', 'You\'re a persistent little duck, aren\'t you?');
  await c.say('Crumb', 'You have my bread. I have all evening.');
  await c.say('???', 'Then let\'s see you follow me... to SPACE! Mwahaha... coo!');

  // UFO blasts straight up, leaving its beam behind for a moment
  ufo.bob.stop();
  const beam = c.beam({ x: 1080, y: 200 }, { x: 1080, y: ground });
  c.tweens.add({ targets: beam, alpha: 0.3, duration: 150, yoyo: true, repeat: -1 });
  audio.sfx.whoosh();
  c.move(bread, { y: -200 }, 1400, 'Cubic.in');
  await c.move(ufo, { y: -200 }, 1400, 'Cubic.in');

  await c.say('Crumb', 'The beam is still on... Here goes NOTHING!');

  // full speed up the ramp, into the beam
  bike.spin(true);
  await c.move(bike, { x: 820 }, 900, 'Quad.in');
  await c.move(bike, { x: 960, y: ground - 112, angle: -25 }, 300, 'Linear');
  c.cameras.main.shake(300, 0.006);
  audio.sfx.jump();
  audio.sfx.beam();
  await c.move(bike, { x: 1080, y: -150, angle: -720, scale: 0.6 }, 1600, 'Cubic.in');
  beam.destroy();

  // --- cut to space ---
  await c.wait(300);
  c.tweens.killAll();
  c.children.removeAll(true);
  c.makeDialogueBox();
  c.spaceBackdrop();
  c.img('earth', 200, H + 60, { scale: 1.6, depth: 1 });

  // a giant glowing tunnel floating in space
  const tunnel = c.add.graphics().setDepth(3);
  const tx = 860, ty = 330;
  for (let i = 8; i >= 1; i--) {
    const s = i * 30;
    tunnel.fillStyle(i % 2 ? 0x4d6bff : 0x3b52d1, 1);
    tunnel.fillRect(tx - s, ty - s, s * 2, s * 2);
  }
  tunnel.fillStyle(0x050818); tunnel.fillRect(tx - 24, ty - 24, 48, 48);
  const platform = c.add.graphics().setDepth(4);
  platform.fillStyle(0x4d6bff); platform.fillRect(380, ty + 240, 720, 24);

  const ufo2 = c.ufo(tx, ty - 60, 0.7);
  await c.move(ufo2, { scale: 0.05, y: ty }, 1200, 'Cubic.in');
  ufo2.setVisible(false);

  // Crumb tumbles in, the bike floats away
  const crumb = c.img('duckStand', 300, -80, { origin: [0.5, 1], scale: 1.6, depth: 10 });
  const floatyBike = c.bike(300, -80, false, 1.2);
  c.move(floatyBike, { x: -200, y: 120, angle: -260 }, 3000, 'Sine.out');
  await c.move(crumb, { x: 520, y: ty + 240, angle: 360 }, 1300, 'Bounce.out');
  crumb.setAngle(0);
  audio.sfx.land();

  await c.say('Crumb', 'Whoa... I\'m in SPACE.');
  await c.say('Crumb', 'Bye, bike! I\'ll miss you!');
  await c.say('Crumb', 'And the UFO went into that giant tube. Guess I\'m running from here!');

  await c.title('LEVEL 2', 'The Space Tube');
}

// =====================================================================================
//  3. ENDING: who's flying the UFO? (and the bread gets shared)
// =====================================================================================
async function ending(c) {
  const { width: W, height: H } = c.scale;
  c.spaceBackdrop(0x03140a, 0x14243a);
  const earth = c.img('earth', W - 220, 170, { scale: 0.9, depth: 1 });

  // asteroid to stand on
  const rock = c.add.graphics().setDepth(5);
  rock.fillStyle(0x6b6478); rock.fillEllipse(W / 2, H + 120, W * 1.3, 420);
  rock.fillStyle(0x5a5466);
  [[300, 560, 70, 24], [760, 600, 110, 30], [1050, 570, 60, 20]].forEach(([x, y, w, h]) => rock.fillEllipse(x, y, w, h));
  const ground = H - 100;

  // the UFO sputters in, smoking, and crash-lands
  const ufo = c.img('ufo', -200, 120, { scale: 1.3, depth: 8 });
  const smoke = c.add.particles(0, 0, 'glow', {
    follow: ufo, speed: 30, scale: { start: 0.25, end: 0.6 }, alpha: { start: 0.5, end: 0 },
    tint: 0x555555, lifespan: 1200, frequency: 80,
  }).setDepth(7);
  await c.move(ufo, { x: 760, y: ground - 40, angle: 18 }, 2200, 'Quad.in');
  c.cameras.main.shake(500, 0.012);
  audio.sfx.crash();
  await c.wait(600);

  // Crumb runs in
  const crumb = c.character('duckStand', -100, ground, 1.7);
  await c.move(crumb, { x: 380 }, 1200, 'Quad.out');
  await c.say('Crumb', 'End of the line, bread thief!');
  await c.say('???', 'Ugh... my beautiful saucer...');
  await c.say('Crumb', 'Come out of there. Let\'s see who you REALLY are!');

  // the hatch pops open... smoke... a figure steps out
  smoke.stop();
  const flash = c.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0).setDepth(80);
  const pigeon = c.img('pigeon', 760, ground, { origin: [0.5, 1], scale: 1.7, depth: 9 }).setAlpha(0).setTint(0x000000);
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
  await c.say('Pigeon', 'Nobody ever saves any bread for us pigeons...');
  await c.say('Crumb', '...So you built a whole UFO?');
  await c.say('Pigeon', 'I had a LOT of free time.');

  // the bread comes back
  const bread = c.img('bread', 600, ground - 60, { depth: 11, scale: 1.2 });
  await c.move(bread, { x: 460, y: ground - 95 }, 800, 'Quad.out');
  await c.say('Crumb', 'You know... you could have just asked.');

  // Crumb tears the bread in half
  const halfL = c.img('bread', 460, ground - 95, { depth: 11, scale: 0.75 });
  const halfR = c.img('bread', 460, ground - 95, { depth: 11, scale: 0.75 });
  bread.destroy();
  c.cameras.main.shake(150, 0.003);
  audio.sfx.rip();
  c.move(halfL, { x: 440, y: ground - 95, angle: -15 }, 400);
  await c.move(halfR, { x: 600, y: ground - 95, angle: 15 }, 900, 'Quad.out');
  await c.say('Crumb', 'Here. There\'s enough for both of us.');
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

  await c.say('', 'And so Crumb and the pigeon sat on an asteroid, sharing bread and watching the Earth turn.');

  // slowly drift towards the Earth for the ending card
  c.move(earth, { scale: 1.4, x: W / 2, y: 220 }, 3000);
  await c.wait(800);
  const { width: W2 } = c.scale;
  const end1 = c.add.text(W2 / 2, 120, 'THE END', {
    fontFamily: FONT, fontSize: '84px', fontStyle: 'bold', color: '#fff4dc', stroke: '#3b1d4a', strokeThickness: 12,
  }).setOrigin(0.5).setDepth(96).setAlpha(0);
  const end2 = c.add.text(W2 / 2, 200, 'Thanks for playing Duck Dash!', {
    fontFamily: FONT, fontSize: '32px', color: '#ffd23f',
  }).setOrigin(0.5).setDepth(96).setAlpha(0);
  await c.move([end1, end2], { alpha: 1 }, 1200);
  await c.say('', 'Press Space to go back to the menu.');
}
