// Background decorations: everything that's just there to look nice.
//   level1Scenery(scene, track) -> pond, fence, signs, hay bales, clouds, trees, birds, moon, satellites, UFO trail
//   level2Scenery(scene)        -> planets, space junk, asteroid belt, gas clouds, comets
//   menuScenery(scene, ground)  -> swimming ducks, fireflies, shooting stars and a sky that slowly changes
// Each one returns an object with update(...) that the scene calls every frame.

import { FONT } from './ui.js';
import { groundYAt } from './level1Track.js';

// ============================================================ pictures
function makeSceneryTextures(scene) {
  if (scene.textures.exists('cloud')) return;
  const tex = (key, w, h, draw) => {
    const g = scene.make.graphics({ add: false });
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };

  // soft fluffy cloud (white, tinted later)
  tex('cloud', 240, 100, (g) => {
    g.fillStyle(0xffffff, 0.9);
    [[60, 62, 40], [100, 45, 48], [150, 52, 42], [190, 66, 32], [125, 70, 40], [80, 74, 30]].forEach(([x, y, r]) => g.fillCircle(x, y, r));
  });

  // a row of puffy trees on the far hills (white silhouettes, tinted with the sky)
  tex('treeLine', 1024, 180, (g) => {
    g.fillStyle(0xffffff);
    let x = 20;
    let seed = 3;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    while (x < 1000) {
      const h = 60 + rnd() * 70, r = 22 + rnd() * 22;
      g.fillRect(x - 4, 180 - h * 0.6, 8, h * 0.6);           // trunk
      g.fillCircle(x, 180 - h, r);                          // canopy
      g.fillCircle(x - r * 0.6, 180 - h + r * 0.4, r * 0.75);
      g.fillCircle(x + r * 0.6, 180 - h + r * 0.4, r * 0.75);
      x += 50 + rnd() * 90;
    }
  });

  // bushes closer to the track
  tex('bushLine', 1024, 90, (g) => {
    g.fillStyle(0xffffff);
    for (let x = 0; x < 1024; x += 70) {
      const r = 18 + ((x * 7) % 13);
      g.fillCircle(x + 20, 90 - r * 0.7, r);
      g.fillCircle(x + 42, 90 - r * 0.5, r * 0.8);
    }
    g.fillRect(0, 80, 1024, 10);
  });

  // birds: two flapping frames
  tex('birdA', 28, 14, (g) => {
    g.lineStyle(3, 0x3b1d4a);
    g.beginPath(); g.moveTo(1, 2); g.lineTo(14, 11); g.lineTo(27, 2); g.strokePath();
  });
  tex('birdB', 28, 14, (g) => {
    g.lineStyle(3, 0x3b1d4a);
    g.beginPath(); g.moveTo(1, 9); g.lineTo(14, 7); g.lineTo(27, 9); g.strokePath();
  });

  tex('moon', 200, 200, (g) => {
    for (let r = 100; r > 70; r -= 3) { g.fillStyle(0xfff6d1, 0.04); g.fillCircle(100, 100, r); }
    g.fillStyle(0xf3ecd8); g.fillCircle(100, 100, 68);
    g.fillStyle(0xd8cfb8);
    [[75, 80, 14], [120, 70, 9], [115, 120, 18], [80, 125, 8], [140, 100, 7]].forEach(([x, y, r]) => g.fillCircle(x, y, r));
  });

  tex('satellite', 70, 34, (g) => {
    g.fillStyle(0x3d6fd6); g.fillRect(0, 10, 24, 14); g.fillRect(46, 10, 24, 14);   // solar panels
    g.lineStyle(1, 0x9fc0ff); for (let i = 0; i < 4; i++) { g.lineBetween(6 * i, 10, 6 * i, 24); g.lineBetween(46 + 6 * i, 10, 46 + 6 * i, 24); }
    g.fillStyle(0xc8ced6); g.fillRect(26, 8, 18, 18);
    g.fillStyle(0xffe14d); g.fillCircle(35, 4, 3); g.lineStyle(2, 0xc8ced6); g.lineBetween(35, 8, 35, 4);
  });

  tex('fencePost', 12, 50, (g) => {
    g.fillStyle(0x7a4a26); g.fillRect(2, 4, 8, 46);
    g.fillStyle(0x9c6a3c); g.fillTriangle(2, 4, 10, 4, 6, 0);
  });

  tex('mailbox', 40, 64, (g) => {
    g.fillStyle(0x6b4226); g.fillRect(17, 26, 6, 38);
    g.fillStyle(0x3d8bff); g.fillRoundedRect(4, 8, 32, 20, 9);
    g.fillStyle(0x2a5fbf); g.fillRect(4, 18, 32, 10);
    g.fillStyle(0xe63950); g.fillRect(33, 2, 3, 14); g.fillRect(33, 2, 8, 6); // little flag
  });

  tex('hayBale', 66, 52, (g) => {
    g.fillStyle(0xc99a2e); g.fillRoundedRect(2, 6, 62, 46, 14);
    g.fillStyle(0xe8bf4a); g.fillRoundedRect(4, 4, 58, 40, 12);
    g.lineStyle(2, 0xb5872a);
    for (let i = 0; i < 5; i++) g.lineBetween(10 + i * 11, 8, 8 + i * 11, 42);
    g.lineStyle(3, 0x8a5a1a); g.lineBetween(20, 4, 20, 44); g.lineBetween(46, 4, 46, 44);
  });

  tex('cattail', 16, 80, (g) => {
    g.lineStyle(3, 0x3f8f4a); g.lineBetween(8, 80, 8, 10);
    g.fillStyle(0x6b3a1a); g.fillRoundedRect(4, 14, 8, 26, 4);
    g.lineStyle(2, 0x3f8f4a); g.lineBetween(8, 14, 8, 4);
  });

  tex('reeds', 40, 64, (g) => {
    g.fillStyle(0x4cae5a);
    g.fillTriangle(6, 64, 12, 64, 2, 10);
    g.fillTriangle(14, 64, 20, 64, 18, 0);
    g.fillTriangle(22, 64, 28, 64, 34, 14);
    g.fillStyle(0x3f8f4a); g.fillTriangle(28, 64, 34, 64, 40, 26);
  });

  tex('lilyFlower', 64, 26, (g) => {
    g.fillStyle(0x3f9a4f); g.fillEllipse(32, 15, 60, 18);
    g.fillStyle(0x6fd17f); g.fillEllipse(32, 14, 44, 12);
    g.fillStyle(0x3d6fb8); g.fillTriangle(32, 14, 60, 8, 60, 20); // the notch
    g.fillStyle(0xff7ac8); [[22, 8], [28, 5], [34, 8], [25, 12], [32, 12]].forEach(([x, y]) => g.fillCircle(x, y, 4));
    g.fillStyle(0xffe14d); g.fillCircle(28, 9, 3);
  });

  // ---- space things ----
  tex('planetRinged', 300, 170, (g) => {
    g.lineStyle(10, 0xd9b27a, 0.8); g.strokeEllipse(150, 92, 280, 70);
    g.fillStyle(0xe8a95a); g.fillCircle(150, 85, 62);
    g.fillStyle(0xc97f30); g.fillEllipse(150, 70, 120, 14); g.fillEllipse(150, 100, 110, 12);
    g.lineStyle(10, 0xf0d0a0, 0.9); g.beginPath(); g.arc(150, 92, 140, 0, Math.PI, false); // front half of ring
    g.fillStyle(0xffffff, 0.25); g.fillCircle(130, 62, 18);
  });
  tex('planetRed', 220, 220, (g) => {
    for (let r = 110; r > 90; r -= 3) { g.fillStyle(0xff6b4a, 0.05); g.fillCircle(110, 110, r); }
    g.fillStyle(0xd9502c); g.fillCircle(110, 110, 88);
    g.fillStyle(0xb03a1c); [[80, 80, 26], [140, 130, 22], [100, 150, 14], [150, 75, 10]].forEach(([x, y, r]) => g.fillCircle(x, y, r));
    g.fillStyle(0xffffff, 0.2); g.fillCircle(80, 70, 20);
  });
  tex('planetMoon', 180, 180, (g) => {
    g.fillStyle(0xa9a4b8); g.fillCircle(90, 90, 80);
    g.fillStyle(0x7d7890);
    [[60, 60, 16], [110, 50, 10], [120, 110, 22], [60, 120, 12], [95, 85, 8], [140, 80, 7]].forEach(([x, y, r]) => g.fillCircle(x, y, r));
    g.fillStyle(0xffffff, 0.18); g.fillCircle(65, 55, 22);
  });
  tex('planetIce', 220, 220, (g) => {
    g.fillStyle(0x7fd3ff); g.fillCircle(110, 110, 90);
    g.fillStyle(0xbfe9ff); g.fillEllipse(110, 80, 170, 22); g.fillEllipse(110, 130, 160, 18);
    g.fillStyle(0x4aa8e0); g.fillEllipse(110, 105, 175, 12);
    g.fillStyle(0xffffff, 0.3); g.fillCircle(80, 70, 24);
  });
  tex('mothership', 640, 220, (g) => {
    g.fillStyle(0x0a0510, 0.95); g.fillEllipse(320, 130, 620, 120);
    g.fillEllipse(320, 85, 280, 120);
    g.fillStyle(0x1c0f28); g.fillEllipse(320, 120, 560, 40);
    g.fillStyle(0xff3048);
    for (let i = 0; i < 9; i++) g.fillCircle(80 + i * 60, 140, 6);
  });
  tex('junkSat', 54, 30, (g) => {
    g.fillStyle(0x3d6fd6); g.fillRect(0, 8, 18, 12);
    g.fillStyle(0x8f96a8); g.fillRect(20, 6, 16, 16);
    g.lineStyle(2, 0x8f96a8); g.lineBetween(36, 14, 50, 4);  // bent antenna
    g.fillStyle(0xff5d73); g.fillCircle(50, 4, 3);
  });
  tex('junkGlove', 34, 34, (g) => {
    g.fillStyle(0xf0f0f0); g.fillRoundedRect(6, 12, 20, 18, 6);
    [[8, 4], [13, 2], [18, 3], [23, 6]].forEach(([x, y]) => g.fillRoundedRect(x, y, 5, 14, 2));
    g.fillRoundedRect(24, 16, 9, 6, 3);   // thumb
    g.fillStyle(0xffa64a); g.fillRect(6, 26, 20, 5);
  });
  tex('junkToast', 34, 34, (g) => {
    g.fillStyle(0xb8742a); g.fillRoundedRect(3, 8, 28, 24, 6); g.fillCircle(9, 9, 7); g.fillCircle(25, 9, 7);
    g.fillStyle(0xf3cf8f); g.fillRoundedRect(6, 11, 22, 18, 4); g.fillCircle(11, 11, 5); g.fillCircle(23, 11, 5);
  });

  // ---- menu things ----
  tex('firefly', 20, 20, (g) => {
    for (let r = 10; r > 2; r -= 2) { g.fillStyle(0xe8ff6a, 0.12); g.fillCircle(10, 10, r); }
    g.fillStyle(0xffffcc); g.fillCircle(10, 10, 2.5);
  });
  // a little white pond duck (not Crumb!) floating on the water, facing right
  tex('duckSwim', 46, 34, (g) => {
    g.fillStyle(0xffffff); g.fillEllipse(20, 22, 32, 16);
    g.fillTriangle(4, 18, 0, 12, 8, 20);
    g.fillCircle(32, 10, 7);
    g.fillStyle(0xd8d8d8); g.fillEllipse(18, 22, 16, 7);
    g.fillStyle(0xff8c1a); g.fillEllipse(41, 11, 8, 4);
    g.fillStyle(0x1a1a1a); g.fillCircle(34, 8, 1.6);
  });
}

// ============================================================ helpers
const mixColor = (a, b, t) => {
  t = Phaser.Math.Clamp(t, 0, 1);
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = (a & 255) + (((b & 255) - (a & 255)) * t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
};

// a shooting star: a bright head with a fading tail. Returns false when it's finished.
function drawStreak(g, s, dt) {
  s.life += dt;
  const t = s.life / s.dur;
  if (t >= 1) return false;
  const hx = s.x + s.vx * s.life, hy = s.y + s.vy * s.life;
  const fade = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
  for (let k = 0; k < 8; k++) {
    const k0 = k / 8, k1 = (k + 1) / 8;
    g.lineStyle(s.width * (1 - k0), s.color, fade * (1 - k0) * 0.9);
    g.lineBetween(hx - s.vx * s.tail * k0, hy - s.vy * s.tail * k0, hx - s.vx * s.tail * k1, hy - s.vy * s.tail * k1);
  }
  g.fillStyle(0xffffff, fade); g.fillCircle(hx, hy, s.width * 0.8);
  return true;
}

// ============================================================ LEVEL 1
export function level1Scenery(scene, track) {
  makeSceneryTextures(scene);
  const { width: W, height: H } = scene.scale;

  // ---- sky layers (fixed to the screen, moving at different speeds = parallax) ----
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    clouds.push(scene.add.image(Phaser.Math.Between(0, W), Phaser.Math.Between(60, 300), 'cloud')
      .setScrollFactor(0).setDepth(-97.5).setScale(Phaser.Math.FloatBetween(0.6, 1.3)));
    clouds[i].speed = Phaser.Math.FloatBetween(0.008, 0.02);
    clouds[i].par = Phaser.Math.FloatBetween(0.04, 0.1);
  }
  const moon = scene.add.image(W * 0.25, H + 120, 'moon').setScrollFactor(0).setDepth(-98.5).setAlpha(0);
  const trees = scene.add.tileSprite(W / 2, H - 120, W, 180, 'treeLine').setScrollFactor(0).setDepth(-96.5);
  const bushes = scene.add.tileSprite(W / 2, H - 45, W, 90, 'bushLine').setScrollFactor(0).setDepth(-95.5);
  const skyFx = scene.add.graphics().setScrollFactor(0).setDepth(-98.6);   // shooting stars
  const trailFx = scene.add.graphics().setScrollFactor(0).setDepth(-92.5); // UFO trail
  const birds = [];
  const sats = [];
  const streaks = [];
  let birdTimer = 2000, satTimer = 3000, streakTimer = 1500;
  let lastScroll = scene.cameras.main.scrollX;

  // ---- things beside the track (in the world, they scroll with the ground) ----
  const props = scene.add.graphics().setDepth(1);
  const startY = groundYAt(track, -200) ?? 560;
  // the lily pond Crumb starts next to
  props.fillStyle(0x2d5fa8); props.fillEllipse(-230, startY + 12, 330, 40);
  props.fillStyle(0x4a86d0); props.fillEllipse(-230, startY + 9, 300, 26);
  props.fillStyle(0xffffff, 0.35); props.fillEllipse(-270, startY + 6, 80, 6);
  [[-330, 0], [-250, 4], [-160, -2]].forEach(([x, dy]) => scene.add.image(x, startY + 8 + dy, 'lilyFlower').setDepth(1.5).setScale(0.8));
  [[-410, 'cattail'], [-395, 'reeds'], [-375, 'cattail'], [-80, 'reeds'], [-60, 'cattail'], [-45, 'cattail']].forEach(([x, key]) => {
    scene.add.image(x, startY + 6, key).setOrigin(0.5, 1).setDepth(2);
  });

  // fence posts with rails along the early, flat-ish parts of the course
  const fenceEnd = track.checkpoints[2] ? track.checkpoints[2].x : 6000;
  let prev = null;
  props.lineStyle(4, 0x8a5a32);
  for (let x = 60; x < fenceEnd; x += 130) {
    const y = groundYAt(track, x), y2 = groundYAt(track, x + 20);
    if (y === null || y2 === null || Math.abs(y2 - y) > 12) { prev = null; continue; } // skip gaps and steep bits
    scene.add.image(x, y + 4, 'fencePost').setOrigin(0.5, 1).setDepth(1.2);
    if (prev && x - prev.x < 140) {
      props.lineBetween(prev.x, prev.y - 34, x, y - 34);
      props.lineBetween(prev.x, prev.y - 18, x, y - 18);
    }
    prev = { x, y };
  }
  // Where to stand something "width" pixels wide at x so it never floats: the LOWER of the ground under its
  // left and right edges (on a slope it sinks into the hill a little on the high side instead of hovering).
  // Returns null over a gap.
  const standY = (x, width) => {
    const a = groundYAt(track, x - width / 2), b = groundYAt(track, x + width / 2), m = groundYAt(track, x);
    if (a === null || b === null || m === null) return null;
    return Math.max(a, b, m);
  };

  // a few mailboxes
  [700, 2600, 5200, 9800].forEach((x) => {
    const y = standY(x, 30);
    if (y !== null) scene.add.image(x, y + 4, 'mailbox').setOrigin(0.5, 1).setDepth(1.2);
  });
  // green road signs counting down to space
  const roadSigns = [
    [track.checkpoints[1]?.x + 260, 'SPACE  →  3 km'],
    [track.checkpoints[2]?.x + 260, 'SPACE  →  2 km'],
    [track.checkpoints[3]?.x + 120, 'SPACE  →  1 km'],
  ];
  roadSigns.forEach(([want, text]) => {
    if (!want) return;
    // look for the flattest spot near where we want it (signs look odd on a steep hill)
    let x = null, best = Infinity;
    for (const dx of [0, -80, 80, -160, 160, -240, 240, -320, 320, -400, 400]) {
      const l = groundYAt(track, want + dx - 57), r = groundYAt(track, want + dx + 57);
      if (l === null || r === null) continue;
      // (and keep well away from the checkpoint flags, so they don't overlap)
      const nearFlag = track.checkpoints.some((cp) => Math.abs(want + dx - cp.x) < 160);
      const steep = Math.abs(l - r) + Math.abs(dx) * 0.05 + (nearFlag ? 1000 : 0);
      if (steep < best) { best = steep; x = want + dx; }
    }
    if (x === null) return;
    // each leg goes all the way down to the ground under it, and the board sits above the higher leg
    const legL = groundYAt(track, x - 57), legR = groundYAt(track, x + 57);
    const top = Math.min(legL, legR) - 150;
    const g = scene.add.graphics().setDepth(1.3);
    g.fillStyle(0x6d7486);
    g.fillRect(x - 60, top, 6, legL - top + 6);
    g.fillRect(x + 54, top, 6, legR - top + 6);
    g.fillStyle(0x1f7a3a); g.fillRoundedRect(x - 90, top - 50, 180, 62, 8);
    g.lineStyle(3, 0xffffff); g.strokeRoundedRect(x - 85, top - 45, 170, 52, 6);
    scene.add.text(x, top - 19, text, { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5).setDepth(1.4);
  });
  // hay bales at the bottom of each landing (every ground piece after a gap)
  track.pieces.slice(1).forEach((piece) => {
    let low = piece[0];
    for (const pt of piece) { if (pt.x > piece[0].x + 900) break; if (pt.y > low.y) low = pt; }
    [-40, 30].forEach((dx, i) => {
      const x = low.x + 120 + dx, y = standY(x, i ? 50 : 60);
      if (y !== null) scene.add.image(x, y + 6, 'hayBale').setOrigin(0.5, 1).setDepth(1.1).setScale(i ? 0.85 : 1);
    });
  });

  return {
    // p = how far through the level (0 = start, 3+ = almost space); time in ms
    update(time, p) {
      const delta = scene.game.loop.delta;
      const cam = scene.cameras.main;
      const scrolled = cam.scrollX - lastScroll;
      lastScroll = cam.scrollX;
      const night = Phaser.Math.Clamp((p - 1.6) / 1.6, 0, 1); // 0 = sunset, 1 = nearly space

      // clouds drift and slide past; they thin out as we head for space
      for (const c of clouds) {
        c.x -= c.speed * delta + scrolled * c.par;
        if (c.x < -150) { c.x = W + 150; c.y = Phaser.Math.Between(60, 300); }
        if (c.x > W + 160) c.x = -150;
        c.setTint(mixColor(0xffd6e6, 0x6a4a8a, night)).setAlpha(0.85 * (1 - Phaser.Math.Clamp((p - 2.2) / 1, 0, 1)));
      }
      // trees and bushes: pink-lit at sunset, dark silhouettes later
      trees.tilePositionX = cam.scrollX * 0.22;
      bushes.tilePositionX = cam.scrollX * 0.42;
      trees.setTint(mixColor(0xc4588c, 0x1c0f2e, night));
      bushes.setTint(mixColor(0x8e3a6e, 0x140a22, night));

      // birds fly across the sunset (not once it's dark)
      birdTimer -= delta;
      if (birdTimer <= 0 && p < 2.3) {
        birdTimer = Phaser.Math.Between(5000, 9000);
        const fromLeft = Math.random() < 0.5, y = Phaser.Math.Between(90, 260);
        const flock = [];
        for (let i = 0; i < 5; i++) {
          const b = scene.add.image(0, 0, 'birdA').setScrollFactor(0).setDepth(-97.2).setScale(Phaser.Math.FloatBetween(0.7, 1));
          b.ox = (fromLeft ? -1 : 1) * (i * 26 + (i % 2) * 10); b.oy = Math.abs(i - 2) * 14;
          flock.push(b);
        }
        birds.push({ x: fromLeft ? -80 : W + 80, y, vx: (fromLeft ? 1 : -1) * 0.09, flock, flip: !fromLeft });
      }
      for (const f of birds) {
        f.x += f.vx * delta;
        f.flock.forEach((b, i) => {
          b.setPosition(f.x - b.ox, f.y + b.oy + Math.sin(time / 300 + i) * 4).setFlipX(f.flip);
          b.setTexture(Math.floor(time / 180 + i) % 2 ? 'birdA' : 'birdB');
        });
      }
      for (let i = birds.length - 1; i >= 0; i--) {
        if (birds[i].x < -250 || birds[i].x > W + 250) { birds[i].flock.forEach((b) => b.destroy()); birds.splice(i, 1); }
      }

      // the moon rises near space
      moon.setAlpha(Phaser.Math.Clamp((p - 2.0) / 0.8, 0, 1));
      moon.y = H + 120 - Phaser.Math.Clamp((p - 2.0) / 1.4, 0, 1) * (H - 30);

      // satellites drift across the night sky
      satTimer -= delta;
      if (satTimer <= 0 && p > 2.4) {
        satTimer = Phaser.Math.Between(4000, 7000);
        const s = scene.add.image(-60, Phaser.Math.Between(60, 220), 'satellite').setScrollFactor(0).setDepth(-97.8).setScale(0.6);
        s.vx = 0.04; s.spin = Phaser.Math.FloatBetween(-0.0006, 0.0006);
        sats.push(s);
      }
      for (let i = sats.length - 1; i >= 0; i--) {
        const s = sats[i];
        s.x += s.vx * delta; s.rotation += s.spin * delta;
        if (s.x > W + 80) { s.destroy(); sats.splice(i, 1); }
      }

      // shooting stars once it's getting dark
      skyFx.clear();
      streakTimer -= delta;
      if (streakTimer <= 0 && p > 1.8) {
        streakTimer = Phaser.Math.Between(1500, 3500);
        streaks.push({ x: Phaser.Math.Between(100, W), y: Phaser.Math.Between(20, 200), vx: -0.9, vy: 0.35, life: 0, dur: 700, tail: 140, width: 3, color: 0xffffff });
      }
      for (let i = streaks.length - 1; i >= 0; i--) if (!drawStreak(skyFx, streaks[i], delta)) streaks.splice(i, 1);

      // the UFO leaves a glowing green trail across the sky as it heads for space
      trailFx.clear();
      const trail = Phaser.Math.Clamp((p - 2.0) / 0.8, 0, 1);
      if (trail > 0 && scene.ufo && scene.ufo.visible) {
        const ux = scene.ufo.x - 40, uy = scene.ufo.y + 10;
        for (let k = 0; k < 30; k++) {
          const t0 = k / 30, t1 = (k + 1) / 30;
          const pt = (t) => ({ x: ux - t * 900, y: uy + t * 260 + Math.sin(t * 9 + time / 600) * 18 * t });
          const a = pt(t0), b = pt(t1);
          trailFx.lineStyle(14 * (1 - t0) + 2, 0xb6ff3b, 0.12 * (1 - t0) * trail); trailFx.lineBetween(a.x, a.y, b.x, b.y);
          trailFx.lineStyle(4 * (1 - t0) + 1, 0xeaffb0, 0.6 * (1 - t0) * trail); trailFx.lineBetween(a.x, a.y, b.x, b.y);
        }
      }
    },
  };
}

// ============================================================ LEVEL 2
// Things outside the tunnel are drawn BEHIND it, so you see them through the holes and around the edges.
export function level2Scenery(scene) {
  makeSceneryTextures(scene);
  const { width: W, height: H } = scene.scale;
  const cx = W / 2, cy = H / 2 - 40;

  // one big planet per section (the boss section has none: nothing distracting while you dodge)
  const planetKeys = ['planetRinged', 'planetRed', 'planetMoon', 'planetIce', null];
  const planets = planetKeys.map((key, i) => key && scene.add.image(0, 0, key).setDepth(1.5).setAlpha(0).setData('a', 0.9 + i * 1.3));

  // floating space junk drifting past
  const junk = [];
  ['junkSat', 'junkGlove', 'junkToast', 'junkSat', 'junkToast', 'junkGlove'].forEach((key, i) => {
    junk.push({ img: scene.add.image(0, 0, key).setDepth(2.5), r: 100 + i * 110, a: i * 1.1, spin: Phaser.Math.FloatBetween(-2, 2) });
  });

  const belt = scene.add.graphics().setDepth(1.6);    // asteroid belt
  const beltRocks = [];
  for (let i = 0; i < 80; i++) {
    beltRocks.push({ a: Math.random() * Math.PI * 2, r: 380 + Math.random() * 90, s: Phaser.Math.FloatBetween(2, 7), shade: Math.random() });
  }
  const gas = [];                                      // swirling gas clouds in the wind section
  const gasColors = [0x3dffd9, 0xff6bd5, 0xa45cff, 0x5d7dff, 0x3dffd9, 0xff6bd5];
  gasColors.forEach((col, i) => {
    gas.push(scene.add.image(Phaser.Math.Between(0, W), Phaser.Math.Between(40, H - 80), 'glow')
      .setDepth(1.7).setTint(col).setScale(Phaser.Math.FloatBetween(2, 3.5)).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD));
    gas[i].speed = Phaser.Math.FloatBetween(0.08, 0.16);
  });
  const sky = scene.add.graphics().setDepth(2.2);      // comets and shooting stars
  const streaks = [];
  let streakTimer = 1200;
  const shown = new Array(5).fill(0);                  // how visible each section's things are (fades in and out)

  return {
    // section = which checkpoint area (0-4), sectionT = 0..1 through that section, roll = tunnel turn, windDir = -1/0/+1
    update(time, dt, { section, sectionT, roll, windDir, speed }) {
      for (let i = 0; i < 5; i++) shown[i] += ((i === section ? 1 : 0) - shown[i]) * Math.min(1, dt * 1.5);

      // planets: drift slowly outwards across the section, turning with the tunnel
      planets.forEach((pl, i) => {
        if (!pl) return;
        const t = i === section ? sectionT : i < section ? 1 : 0;
        const a = pl.getData('a') + roll + t * 0.6;
        const r = 260 + t * 160;
        pl.setPosition(cx + Math.cos(a) * r, cy + Math.sin(a) * r).setScale(0.7 + t * 0.8).setAlpha(shown[i]).setRotation(roll * 0.3);
      });

      // space junk floats past (like the stars, flying outwards)
      for (const j of junk) {
        j.r += j.r * dt * 0.012 * speed;
        if (j.r > 900) { j.r = Phaser.Math.Between(40, 120); j.a = Math.random() * Math.PI * 2; }
        const a = j.a + roll;
        j.img.setPosition(cx + Math.cos(a) * j.r, cy + Math.sin(a) * j.r)
          .setScale(0.4 + j.r / 500).setRotation(j.img.rotation + j.spin * dt).setAlpha(Math.min(1, j.r / 200));
      }

      // (the asteroid belt was removed along with the asteroids; set SHOW_BELT = true to bring it back)
      belt.clear();
      const SHOW_BELT = false;
      if (SHOW_BELT && shown[2] > 0.02) {
        for (const b of beltRocks) {
          const a = b.a + time / 9000 + roll;
          belt.fillStyle(mixColor(0x5a4c40, 0xa8988a, b.shade), shown[2]);
          belt.fillCircle(cx + Math.cos(a) * b.r, cy + Math.sin(a) * b.r * 0.45, b.s);
        }
      }

      // colourful gas clouds streaming in the wind's direction (wind section)
      gas.forEach((gc) => {
        const dir = windDir || 1;
        gc.x += dir * gc.speed * dt * 1000 * (windDir ? 2.5 : 1);
        if (gc.x > W + 300) gc.x = -300;
        if (gc.x < -300) gc.x = W + 300;
        gc.setAlpha(shown[3] * 0.35);
      });

      // comets and shooting stars every few seconds
      sky.clear();
      streakTimer -= dt * 1000;
      if (streakTimer <= 0) {
        streakTimer = Phaser.Math.Between(1800, 3500);
        const comet = Math.random() < 0.35;
        const fromLeft = Math.random() < 0.5;
        streaks.push({
          x: fromLeft ? -50 : W + 50, y: Phaser.Math.Between(20, H * 0.6),
          vx: (fromLeft ? 1 : -1) * (comet ? 0.5 : 1.1), vy: comet ? 0.12 : 0.3,
          life: 0, dur: comet ? 2600 : 900, tail: comet ? 320 : 140, width: comet ? 7 : 3, color: comet ? 0x7fd3ff : 0xffffff,
        });
      }
      for (let i = streaks.length - 1; i >= 0; i--) if (!drawStreak(sky, streaks[i], dt * 1000)) streaks.splice(i, 1);
    },
  };
}

// ============================================================ MENU
// The sky slowly goes round: sunset -> dusk -> night -> dawn -> sunset (about a minute for the whole loop).
const SKY_LOOP = [
  { top: 0xff6fa8, bottom: 0xffc78f, land: 0xffffff },
  { top: 0x9c4c9c, bottom: 0xff8a7a, land: 0xc8a0c8 },
  { top: 0x120d33, bottom: 0x3a2a6a, land: 0x6a5a9a },
  { top: 0x6a8cff, bottom: 0xffd0a0, land: 0xe8d8f0 },
];

export function menuScenery(scene, ground) {
  makeSceneryTextures(scene);
  const { width: W, height: H } = scene.scale;

  // a sky that sits right on top of the backdrop's sky, so we can recolour it
  const sky = scene.add.graphics();
  scene.children.moveTo(sky, 1);
  const stars = scene.add.graphics();
  scene.children.moveTo(stars, 2);
  const starList = [];
  for (let i = 0; i < 90; i++) starList.push({ x: Math.random() * W, y: Math.random() * (ground - 160), tw: Math.random() * 6 });
  const sun = scene.children.list.find((o) => o.texture && o.texture.key === 'sun');
  const tintables = scene.children.list.filter((o) => o.texture && ['mountains', 'hillsFar'].includes(o.texture.key));

  // ducks paddling around the pond
  const ducks = [0, 1].map((i) => {
    const d = scene.add.image(120 + i * 120, ground + 26, 'duckSwim').setOrigin(0.5, 0.9).setScale(0.9 - i * 0.15);
    d.dir = i ? -1 : 1; d.speed = 0.02 + i * 0.012;
    return d;
  });

  // fireflies wandering near the grass (brighter at night)
  const flies = [];
  for (let i = 0; i < 14; i++) {
    flies.push({ img: scene.add.image(0, 0, 'firefly').setBlendMode(Phaser.BlendModes.ADD),
      x: Math.random() * W, y: ground - Phaser.Math.Between(20, 140), ph: Math.random() * 10 });
  }

  const fx = scene.add.graphics();
  const streaks = [];
  let streakTimer = 3000;

  return {
    update(time, delta) {
      // where are we in the sky loop?
      const loop = (time / 60000) * SKY_LOOP.length;
      const i = Math.floor(loop) % SKY_LOOP.length, t = loop - Math.floor(loop);
      const a = SKY_LOOP[i], b = SKY_LOOP[(i + 1) % SKY_LOOP.length];
      const ease = t * t * (3 - 2 * t);
      const top = mixColor(a.top, b.top, ease), bottom = mixColor(a.bottom, b.bottom, ease);
      sky.clear(); sky.fillGradientStyle(top, top, bottom, bottom, 1); sky.fillRect(0, 0, W, H);
      const land = mixColor(a.land, b.land, ease);
      tintables.forEach((o) => o.setTint(land));
      // night = how dark it is (0..1), used for stars, fireflies and the sun
      const night = Phaser.Math.Clamp(1 - ((top >> 16) & 255) / 160, 0, 1);

      stars.clear();
      for (const s of starList) {
        stars.fillStyle(0xffffff, night * (0.5 + 0.5 * Math.sin(time / 500 + s.tw)));
        stars.fillRect(s.x, s.y, 2, 2);
      }
      if (sun) sun.setAlpha(1 - night).setY(ground - 150 + night * 160);

      for (const d of ducks) {
        d.x += d.dir * d.speed * delta;
        if (d.x > 320) d.dir = -1;
        if (d.x < 80) d.dir = 1;
        d.setFlipX(d.dir < 0).setY(ground + 26 + Math.sin(time / 400 + d.speed * 100) * 2);
      }
      for (const f of flies) {
        f.x += Math.sin(time / 1300 + f.ph) * 0.03 * delta;
        f.y += Math.cos(time / 1700 + f.ph * 2) * 0.02 * delta;
        f.img.setPosition(f.x, f.y).setAlpha((0.25 + night * 0.75) * (0.5 + 0.5 * Math.sin(time / 300 + f.ph)));
      }

      fx.clear();
      streakTimer -= delta;
      if (streakTimer <= 0) {
        streakTimer = Phaser.Math.Between(3500, 7000);
        streaks.push({ x: Phaser.Math.Between(300, W), y: Phaser.Math.Between(20, 160), vx: -0.8, vy: 0.3, life: 0, dur: 800, tail: 150, width: 3, color: 0xffffff });
      }
      for (let k = streaks.length - 1; k >= 0; k--) if (!drawStreak(fx, streaks[k], delta)) streaks.splice(k, 1);
    },
  };
}
