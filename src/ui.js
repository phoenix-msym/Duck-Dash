// Small helpers for buttons and the sunset background used on menu screens.
import { audio } from './audio.js';
import { wallet } from './wallet.js';

// ------------------------------------------------------------------ fullscreen
// Switch the whole game between a window and fullscreen. (Must be called from a click or key press:
// browsers only allow fullscreen when the player asked for it.)
export function toggleFullscreen(scene) {
  if (scene.scale.isFullscreen) scene.scale.stopFullscreen();
  else scene.scale.startFullscreen();
}

// A button that says "Fullscreen" or "Exit Fullscreen" and keeps its label right.
export function fullscreenButton(scene, x, y, opts = {}) {
  const label = () => (scene.scale.isFullscreen ? 'Exit Fullscreen' : 'Fullscreen');
  const b = makeButton(scene, x, y, label(), () => toggleFullscreen(scene), opts);
  const refresh = () => { if (b.text.active) b.text.setText(label()); };
  scene.scale.on('enterfullscreen', refresh);
  scene.scale.on('leavefullscreen', refresh);
  scene.events.once('shutdown', () => {
    scene.scale.off('enterfullscreen', refresh);
    scene.scale.off('leavefullscreen', refresh);
  });
  return b;
}

// A small square icon button (four corner brackets) for the corner of a screen.
// The corners point out for "go fullscreen" and point in for "exit fullscreen".
export function fullscreenIcon(scene, x = 16, y = 16, size = 52) {
  const g = scene.add.graphics().setDepth(60).setScrollFactor(0);
  const zone = scene.add.zone(x, y, size, size).setOrigin(0).setScrollFactor(0).setDepth(61)
    .setInteractive({ useHandCursor: true });
  let hover = false;
  const draw = () => {
    g.clear();
    g.fillStyle(0x3b1d4a, hover ? 0.95 : 0.75).fillRoundedRect(x, y, size, size, 10);
    g.lineStyle(3, 0xfff4dc, 1).strokeRoundedRect(x, y, size, size, 10);
    const pad = size * 0.24, arm = size * 0.2, l = x + pad, r = x + size - pad, t = y + pad, b = y + size - pad;
    const inward = scene.scale.isFullscreen;
    g.lineStyle(4, hover ? 0xffd23f : 0xfff4dc, 1);
    // each corner: [corner x, corner y, x direction, y direction]
    for (const [cx, cy, dx, dy] of [[l, t, 1, 1], [r, t, -1, 1], [l, b, 1, -1], [r, b, -1, -1]]) {
      const px = inward ? cx + dx * arm : cx, py = inward ? cy + dy * arm : cy; // the bend of the bracket
      const sx = inward ? -dx : dx, sy = inward ? -dy : dy;
      g.beginPath();
      g.moveTo(px + sx * arm, py);
      g.lineTo(px, py);
      g.lineTo(px, py + sy * arm);
      g.strokePath();
    }
  };
  zone.on('pointerover', () => { hover = true; draw(); });
  zone.on('pointerout', () => { hover = false; draw(); });
  zone.on('pointerdown', () => { audio.sfx.click(); toggleFullscreen(scene); });
  scene.scale.on('enterfullscreen', draw);
  scene.scale.on('leavefullscreen', draw);
  scene.events.once('shutdown', () => {
    scene.scale.off('enterfullscreen', draw);
    scene.scale.off('leavefullscreen', draw);
  });
  draw();
  return { g, zone };
}

// ------------------------------------------------------------------ "erase" effect when Crumb dies
// The picture wipes away from the top down, and little yellow bits fly off the wiping edge.
// sprites: the images to erase (the first one sets where the bits come from).
export function eraseSprites(scene, sprites, { duration = 650, fixed = false, depth = 30 } = {}) {
  const main = sprites[0];
  const bits = scene.add.particles(0, 0, 'pixel', {
    speed: { min: 60, max: 220 }, angle: { min: 180, max: 360 }, gravityY: -40,
    lifespan: 700, scale: { start: 1, end: 0 }, alpha: { start: 1, end: 0 },
    tint: [0xffd23f, 0xfff4dc, 0xff8c1a, 0xe63950], emitting: false,
  }).setDepth(depth);
  if (fixed) bits.setScrollFactor(0);
  const state = { t: 0 };
  scene.tweens.add({
    targets: state, t: 1, duration, ease: 'Sine.in',
    onUpdate: () => {
      for (const s of sprites) {
        const fw = s.frame.realWidth, fh = s.frame.realHeight;
        s.setCrop(0, fh * state.t, fw, fh * (1 - state.t));
        s.setAlpha(1 - state.t * 0.4);
      }
      // where the wiping edge is on screen right now
      const top = main.y - main.displayHeight * main.originY;
      const edgeY = top + main.displayHeight * state.t;
      bits.emitParticleAt(main.x + Phaser.Math.Between(-main.displayWidth / 3, main.displayWidth / 3), edgeY, 3);
    },
    onComplete: () => { sprites.forEach((s) => s.setVisible(false)); scene.time.delayedCall(800, () => bits.destroy()); },
  });
}

// put sprites back to normal after they were erased
export function unerase(sprites) {
  sprites.forEach((s) => { s.setCrop(); s.setAlpha(1); s.setVisible(true); });
}

// ------------------------------------------------------------------ bread crumbs
// The little "🍞 x 12" counter under the timer. Call .collect(x, y) when Crumb grabs one.
export function crumbHud(scene, { fixed = false, total = 0 } = {}) {
  const icon = scene.add.image(34, 92, 'crumb').setDepth(50).setScale(0.9);
  const text = scene.add.text(56, 80, '', {
    fontFamily: FONT, fontSize: '22px', color: '#ffe680', stroke: '#3b1d4a', strokeThickness: 5,
  }).setDepth(50);
  if (fixed) { icon.setScrollFactor(0); text.setScrollFactor(0); }
  const hud = {
    got: 0, total,
    draw() { text.setText(`${hud.got} / ${hud.total}`); },
    // x, y = where it was grabbed (in the same space as the HUD if fixed=false, world space if a scrolling level)
    collect(x, y, worldSpace = false) {
      hud.got++;
      hud.draw();
      wallet.add(1);
      audio.sfx.crumb();
      scene.tweens.add({ targets: icon, scale: { from: 1.4, to: 0.9 }, duration: 250, ease: 'Back.out' });
      const plus = scene.add.text(x, y, '+1', {
        fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: '#ffe680', stroke: '#3b1d4a', strokeThickness: 5,
      }).setOrigin(0.5).setDepth(40);
      if (!worldSpace && fixed) plus.setScrollFactor(0);
      scene.tweens.add({ targets: plus, y: y - 50, alpha: 0, duration: 700, onComplete: () => plus.destroy() });
    },
  };
  hud.draw();
  return hud;
}

// ------------------------------------------------------------------ star rating
// Faster time = more stars. limits = [seconds for 3 stars, seconds for 2 stars].
export function starsForTime(secs, limits) {
  return secs <= limits[0] ? 3 : secs <= limits[1] ? 2 : 1;
}

// Saves your best stars/time for a level in the browser and tells you if this run beat it.
export function saveBest(levelKey, stars, secs) {
  let best = null;
  try { best = JSON.parse(localStorage.getItem('duckdash-best-' + levelKey) || 'null'); } catch (e) { /* ignore */ }
  const better = !best || secs < best.secs;
  if (better) {
    try { localStorage.setItem('duckdash-best-' + levelKey, JSON.stringify({ stars, secs })); } catch (e) { /* ignore */ }
  }
  return { best: better ? { stars, secs } : best, newRecord: better && best !== null };
}

export const fmtTime = (secs) => `${Math.floor(secs / 60)}:${(secs % 60).toFixed(1).padStart(4, '0')}`;

// The end-of-level panel: title, time, stars popping in one by one, then it moves on by itself.
// Space / Enter / click skips the wait. onDone runs when it's time to go to the next scene.
export function levelCompletePanel(scene, { title, secs, limits, levelKey, line, onDone, fixed = false, wait = 4200, crumbs = null }) {
  const { width: W, height: H } = scene.scale;
  const stars = starsForTime(secs, limits);
  const { best, newRecord } = saveBest(levelKey, stars, secs);
  const items = [];
  const add = (o) => { if (fixed) o.setScrollFactor(0); items.push(o); return o; };

  const panel = add(scene.add.graphics().setDepth(60));
  panel.fillStyle(0x1a1035, 0.9); panel.fillRoundedRect(W / 2 - 380, H / 2 - 220, 760, 440, 28);
  panel.lineStyle(4, 0xfff4dc, 0.9); panel.strokeRoundedRect(W / 2 - 380, H / 2 - 220, 760, 440, 28);
  const style = { fontFamily: FONT, color: '#fff4dc', align: 'center' };
  add(scene.add.text(W / 2, H / 2 - 170, title, { ...style, fontSize: '52px', fontStyle: 'bold' }).setOrigin(0.5).setDepth(61));

  for (let i = 0; i < 3; i++) {
    const s = add(scene.add.image(W / 2 + (i - 1) * 120, H / 2 - 50, 'starIcon').setDepth(61).setTint(0x4a3a66).setScale(0.9));
    if (i < stars) {
      scene.time.delayedCall(500 + i * 350, () => {
        s.setTint(0xffd23f).setScale(0.3);
        scene.tweens.add({ targets: s, scale: 1, duration: 350, ease: 'Back.out' });
        audio.sfx.checkpoint();
      });
    }
  }
  const crumbLine = crumbs ? `\nBread crumbs: ${crumbs.got} / ${crumbs.total}   ·   in your bag: ${wallet.crumbs}` : '';
  add(scene.add.text(W / 2, H / 2 + 55,
    `Time: ${fmtTime(secs)}${newRecord ? '   NEW BEST!' : ''}\n3 stars: under ${fmtTime(limits[0])}   ·   best: ${fmtTime(best.secs)}${crumbLine}`,
    { ...style, fontSize: '22px', lineSpacing: 4 }).setOrigin(0.5).setDepth(61));
  add(scene.add.text(W / 2, H / 2 + 135, line, { ...style, fontSize: '24px', color: '#ffd23f', fontStyle: 'italic' }).setOrigin(0.5).setDepth(61));
  const hint = add(scene.add.text(W / 2, H / 2 + 180, 'Space = continue', { ...style, fontSize: '18px' }).setOrigin(0.5).setDepth(61).setAlpha(0.7));
  scene.tweens.add({ targets: hint, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });

  let gone = false;
  const go = () => { if (gone) return; gone = true; onDone(); };
  scene.time.delayedCall(wait, go);
  // let the stars pop in before Space can skip
  scene.time.delayedCall(1200, () => {
    scene.input.keyboard.once('keydown-SPACE', go);
    scene.input.keyboard.once('keydown-ENTER', go);
    scene.input.once('pointerdown', go);
  });
  return stars;
}

export const FONT = '"Trebuchet MS", "Segoe UI", sans-serif';

// A rounded button you can click. Returns an object so menus can highlight it with the keyboard.
export function makeButton(scene, x, y, label, onClick, opts = {}) {
  const w = opts.w || 300, h = opts.h || 64, size = opts.size || 30;
  const bg = scene.add.graphics();
  const text = scene.add.text(x, y, label, {
    fontFamily: FONT, fontSize: size + 'px', color: '#3b1d4a', fontStyle: 'bold',
  }).setOrigin(0.5);
  const zone = scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });

  const btn = {
    label, selected: false, hovered: false, onClick, text, bg, zone,
    draw() {
      const lit = btn.selected || btn.hovered;
      bg.clear();
      bg.fillStyle(0x3b1d4a, 0.35); bg.fillRoundedRect(x - w / 2 + 4, y - h / 2 + 6, w, h, 18);
      bg.fillStyle(lit ? 0xffe066 : 0xfff4dc); bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 18);
      bg.lineStyle(4, lit ? 0xff8c1a : 0x3b1d4a, 1); bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 18);
      text.setScale(lit ? 1.06 : 1);
    },
    setSelected(v) { btn.selected = v; btn.draw(); },
    destroy() { bg.destroy(); text.destroy(); zone.destroy(); },
  };
  zone.on('pointerover', () => { btn.hovered = true; btn.draw(); });
  zone.on('pointerout', () => { btn.hovered = false; btn.draw(); });
  zone.on('pointerdown', () => { audio.sfx.click(); onClick(); });
  btn.draw();
  return btn;
}

// Up/down (W/S or arrows) moves between buttons, Enter/Space presses the highlighted one.
export function keyboardMenu(scene, buttons) {
  let index = 0;
  const select = (i) => {
    index = (i + buttons.length) % buttons.length;
    buttons.forEach((b, j) => b.setSelected(j === index));
  };
  select(0);
  const move = (d) => { select(index + d); audio.sfx.select(); };
  const press = () => { audio.sfx.click(); buttons[index].onClick(); };
  const kb = scene.input.keyboard;
  kb.on('keydown-W', () => move(-1));
  kb.on('keydown-UP', () => move(-1));
  kb.on('keydown-S', () => move(1));
  kb.on('keydown-DOWN', () => move(1));
  kb.on('keydown-ENTER', press);
  kb.on('keydown-SPACE', press);
  return { select };
}

export function sunsetBackdrop(scene) {
  const { width: W, height: H } = scene.scale;
  const g = scene.add.graphics();
  g.fillGradientStyle(0xff6fa8, 0xff6fa8, 0xffc78f, 0xffc78f, 1);
  g.fillRect(0, 0, W, H);
  const ground = H - 110; // y of the grass line: characters stand on this

  scene.add.image(W * 0.72, ground - 150, 'sun').setScale(1.6);
  // big mountains far away, then rolling hills, then the ground
  scene.add.image(W / 2, ground + 20, 'mountains').setOrigin(0.5, 1).setTint(0xb04a8a).setAlpha(0.9);
  scene.add.image(W / 2, ground + 10, 'hillsFar').setOrigin(0.5, 1).setDisplaySize(W, 200).setTint(0x8e3a78);

  const land = scene.add.graphics();
  land.fillStyle(0x5b3550); land.fillRect(0, ground, W, H - ground);
  land.fillStyle(0x4fbf6a); land.fillRect(0, ground - 6, W, 14);
  land.fillStyle(0x8fe39c); land.fillRect(0, ground - 6, W, 4);
  // little grass tufts and pebbles
  for (let x = 30; x < W; x += 90) {
    land.fillStyle(0x4fbf6a); land.fillTriangle(x, ground - 4, x + 6, ground - 16, x + 10, ground - 4);
    land.fillStyle(0x6e4563); land.fillEllipse(x + 40, ground + 40 + (x % 3) * 12, 18, 8);
  }
  // pond with a lily pad, sitting IN the ground
  land.fillStyle(0x3d6fb8); land.fillEllipse(200, ground + 34, 320, 56);
  land.fillStyle(0x5a8fd6); land.fillEllipse(200, ground + 30, 300, 46);
  land.fillStyle(0x4cc26a); land.fillEllipse(240, ground + 28, 70, 20);
  land.fillStyle(0x5a8fd6); land.fillTriangle(240, ground + 28, 275, ground + 20, 275, ground + 34);
  return ground;
}
