// All the game's pictures are drawn with code here, so there are no image files to load yet.
// Each makeX() draws shapes onto a Graphics object and saves it as a texture
// that sprites can use by name, e.g. this.add.image(x, y, 'wheel').

import { wallet } from './wallet.js';

const YELLOW = 0xffd23f;
const YELLOW_DARK = 0xe8b31e;
const ORANGE = 0xff8c1a;

// What Crumb is wearing right now (picked in the shop)
function look() {
  return { scarf: wallet.equipped('scarf').color, bike: wallet.equipped('bike').colors, hat: wallet.equipped('hat').id };
}

// Redraw every picture of Crumb, e.g. after buying something in the shop
export function refreshLook(scene) {
  ['bike', 'bikeEmpty', 'duckStand', 'duckRunA', 'duckRunB', 'duckJump'].forEach((k) => {
    if (scene.textures.exists(k)) scene.textures.remove(k);
  });
  makeBike(scene);
  makeDuckStand(scene);
  makeDuckBack(scene, 'duckRunA', 0);
  makeDuckBack(scene, 'duckRunB', 1);
  makeDuckBack(scene, 'duckJump', 2);
}

export function makeTextures(scene) {
  if (scene.textures.exists('wheel')) return; // only draw once
  refreshLook(scene);
  makeWheel(scene);
  makeUfo(scene);
  makeBread(scene);
  makeFlag(scene, 'flag', 0x9a9a9a);
  makeFlag(scene, 'flagOn', 0x3ddc84);
  makeHills(scene, 'hillsFar', 0.55, 3);
  makeHills(scene, 'hillsNear', 0.85, 5);
  makeSun(scene);
  makeDot(scene, 'star', 2, 0xffffff);
  makeFeather(scene);
  makeGlow(scene);
  makePigeon(scene);
  makeCrumbPickup(scene);
  makeBoostPad(scene);
  makeVignette(scene);
  makeEarth(scene);
  makeEgg(scene);
  makeDuckling(scene);
  makePixel(scene);
  makeStarIcon(scene);
  makeNest(scene);
  makeMountains(scene);
}

// Hats from the shop. cx = middle of the head, top = top of the head, s = size, side = true if seen from the side
function drawHat(g, kind, cx, top, s, side) {
  if (kind === 'cap') {
    g.fillStyle(0x3d6fd6); g.fillEllipse(cx, top + 2 * s, 24 * s, 16 * s);
    g.fillStyle(0xffffff); g.fillCircle(cx, top - 5 * s, 2 * s);
    g.fillStyle(0x2a4fa0);
    if (side) g.fillEllipse(cx + 12 * s, top + 6 * s, 16 * s, 5 * s);   // peak sticking out the front
    else g.fillRect(cx - 12 * s, top + 6 * s, 24 * s, 3 * s);
  } else if (kind === 'party') {
    g.fillStyle(0xff6bd5); g.fillTriangle(cx - 9 * s, top + 5 * s, cx + 9 * s, top + 5 * s, cx, top - 20 * s);
    g.fillStyle(0xffe14d);
    g.fillTriangle(cx - 6 * s, top - 2 * s, cx + 6 * s, top - 2 * s, cx, top - 7 * s);
    g.fillStyle(0xffffff); g.fillCircle(cx, top - 20 * s, 3.5 * s);
  } else if (kind === 'crown') {
    g.fillStyle(0xffc400);
    g.fillRect(cx - 11 * s, top - 2 * s, 22 * s, 8 * s);
    g.fillTriangle(cx - 11 * s, top - 2 * s, cx - 7 * s, top - 2 * s, cx - 11 * s, top - 13 * s);
    g.fillTriangle(cx - 4 * s, top - 2 * s, cx + 4 * s, top - 2 * s, cx, top - 15 * s);
    g.fillTriangle(cx + 7 * s, top - 2 * s, cx + 11 * s, top - 2 * s, cx + 11 * s, top - 13 * s);
    g.fillStyle(0xe63950); g.fillCircle(cx, top + 2 * s, 2.2 * s);
    g.fillStyle(0x3d8bff); g.fillCircle(cx - 7 * s, top + 2 * s, 1.8 * s); g.fillCircle(cx + 7 * s, top + 2 * s, 1.8 * s);
  }
}

// a golden bread crumb you can collect, with a soft glow
function makeCrumbPickup(scene) {
  const g = scene.make.graphics({ add: false });
  for (let r = 18; r > 8; r -= 2) { g.fillStyle(0xffe680, 0.07); g.fillCircle(20, 20, r); }
  g.fillStyle(0xb8742a); g.fillRoundedRect(9, 12, 22, 16, 7);
  g.fillStyle(0xe8a95a); g.fillRoundedRect(10, 11, 20, 13, 6);
  g.fillStyle(0xfff0c2); g.fillCircle(15, 15, 2.5);
  g.generateTexture('crumb', 40, 40);
  g.destroy();
}

// dark soft edges around the screen, for a "movie" look in cutscenes
function makeVignette(scene) {
  const W = 1280, H = 720;
  const g = scene.make.graphics({ add: false });
  for (let i = 0; i < 40; i++) {
    g.lineStyle(10, 0x000000, 0.035);
    g.strokeRoundedRect(-60 + i * 4, -60 + i * 4, W + 120 - i * 8, H + 120 - i * 8, 120);
  }
  g.generateTexture('vignette', W, H);
  g.destroy();
}

// a glowing boost strip with arrows, sits on the ground in Level 1
function makeBoostPad(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0x00e5ff, 0.25); g.fillRoundedRect(0, 0, 140, 22, 10);
  g.fillStyle(0x1a3a66); g.fillRoundedRect(4, 6, 132, 12, 6);
  g.fillStyle(0x00e5ff);
  for (let i = 0; i < 4; i++) {
    const x = 18 + i * 30;
    g.fillTriangle(x, 7, x + 14, 12, x, 17);
  }
  g.generateTexture('boostPad', 140, 22);
  g.destroy();
}

// a tiny white square: the "bits" that fly off when Crumb gets erased
function makePixel(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0xffffff); g.fillRect(0, 0, 6, 6);
  g.generateTexture('pixel', 6, 6);
  g.destroy();
}

// a 5-pointed star for the star rating (white, gets tinted gold or grey)
function makeStarIcon(scene) {
  const g = scene.make.graphics({ add: false });
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 22 : 50, a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push({ x: 52 + Math.cos(a) * r, y: 54 + Math.sin(a) * r });
  }
  g.fillStyle(0xffffff); g.fillPoints(pts, true);
  g.generateTexture('starIcon', 104, 104);
  g.destroy();
}

// Crumb's egg: cream coloured with little speckles
function makeEgg(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0x3b1d4a, 0.25); g.fillEllipse(19, 26, 32, 40);
  g.fillStyle(0xfff3d6); g.fillEllipse(18, 24, 30, 38);
  g.fillStyle(0xffffff, 0.8); g.fillEllipse(12, 15, 8, 12); // shine
  g.fillStyle(0xc9a77a);
  [[22, 14], [10, 28], [24, 32], [16, 36], [26, 22]].forEach(([x, y]) => g.fillCircle(x, y, 1.6));
  g.generateTexture('egg', 38, 46);
  g.destroy();
}

// the baby duck that hatches at the end
function makeDuckling(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0xff8c1a); g.fillEllipse(18, 44, 8, 4); g.fillEllipse(26, 44, 8, 4);
  g.fillStyle(0xffe680); g.fillEllipse(22, 32, 28, 22);
  g.fillCircle(30, 16, 10);
  g.fillTriangle(27, 7, 29, 1, 32, 7); // fluff on top
  g.fillStyle(0xff8c1a); g.fillEllipse(41, 18, 9, 5);
  g.fillStyle(0x1a1a1a); g.fillCircle(33, 13, 2);
  g.fillStyle(0xffffff); g.fillCircle(33.6, 12.4, 0.7);
  g.fillStyle(0xf5d04a); g.fillEllipse(18, 32, 14, 9); // little wing
  g.generateTexture('duckling', 48, 48);
  g.destroy();
}

function makeNest(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0x7a4a26); g.fillEllipse(40, 20, 78, 26);
  g.fillStyle(0x5c3519); g.fillEllipse(40, 14, 60, 12);
  g.lineStyle(3, 0x9c6a3c);
  for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(6 + i * 11, 22 + (i % 2) * 4); g.lineTo(16 + i * 11, 12 + (i % 2) * 6); g.strokePath(); }
  g.generateTexture('nest', 80, 34);
  g.destroy();
}

// big jagged white mountains (tinted later), repeating sideways
function makeMountains(scene) {
  const W = 1280, H = 360;
  const g = scene.make.graphics({ add: false });
  const peaks = [0, 300, 120, 340, 60, 260, 150, 330, 40, 280, 110, 0];
  const pts = [{ x: 0, y: H }];
  peaks.forEach((h, i) => pts.push({ x: (i / (peaks.length - 1)) * W, y: H - h }));
  pts.push({ x: W, y: H });
  g.fillStyle(0xffffff); g.fillPoints(pts, true);
  // snow caps on the tall ones
  g.fillStyle(0xffffff, 0.55);
  peaks.forEach((h, i) => {
    if (h < 250) return;
    const x = (i / (peaks.length - 1)) * W, y = H - h;
    g.fillTriangle(x, y - 2, x - 34, y + 46, x + 34, y + 46);
  });
  g.generateTexture('mountains', W, H);
  g.destroy();
}

// Crumb standing, side view, facing right (for cutscenes). Feet at the bottom middle.
function makeDuckStand(scene) {
  const L = look();
  const g = scene.make.graphics({ add: false });
  g.translateCanvas(0, 16); // leave room above the head for a hat (feet stay at the bottom)
  // legs + feet
  g.lineStyle(4, ORANGE);
  g.beginPath(); g.moveTo(32, 54); g.lineTo(32, 70); g.strokePath();
  g.beginPath(); g.moveTo(42, 54); g.lineTo(42, 70); g.strokePath();
  g.fillStyle(ORANGE); g.fillEllipse(36, 72, 12, 5); g.fillEllipse(46, 72, 12, 5);
  // tail
  g.fillStyle(YELLOW); g.fillTriangle(14, 36, 4, 28, 16, 48);
  // body
  g.fillEllipse(36, 44, 46, 30);
  // wing
  g.fillStyle(YELLOW_DARK); g.fillEllipse(32, 44, 26, 14);
  // scarf
  g.fillStyle(L.scarf); g.fillRoundedRect(44, 26, 18, 7, 3); g.fillTriangle(46, 28, 30, 24, 34, 34);
  // head
  g.fillStyle(YELLOW); g.fillCircle(54, 18, 13);
  g.fillTriangle(48, 8, 50, 0, 54, 7);
  // beak
  g.fillStyle(ORANGE); g.fillEllipse(70, 22, 16, 8);
  g.fillStyle(0xd9700f); g.fillRect(63, 22, 14, 1);
  // eye
  g.fillStyle(0x1a1a1a); g.fillCircle(58, 15, 2.8);
  g.fillStyle(0xffffff); g.fillCircle(59, 14, 1);
  drawHat(g, L.hat, 53, 7, 1, true);
  g.generateTexture('duckStand', 80, 94);
  g.destroy();
}

// The UFO pilot, finally revealed: a scruffy city pigeon. Side view, facing left.
function makePigeon(scene) {
  const g = scene.make.graphics({ add: false });
  // legs
  g.lineStyle(4, 0xd9707a);
  g.beginPath(); g.moveTo(36, 54); g.lineTo(36, 70); g.strokePath();
  g.beginPath(); g.moveTo(46, 54); g.lineTo(46, 70); g.strokePath();
  g.fillStyle(0xd9707a); g.fillEllipse(32, 72, 12, 5); g.fillEllipse(42, 72, 12, 5);
  // tail fan
  g.fillStyle(0x4e5361); g.fillTriangle(62, 38, 80, 32, 78, 50);
  // body
  g.fillStyle(0x8a8f9e); g.fillEllipse(42, 44, 46, 30);
  // wing with two dark bars
  g.fillStyle(0x6d7282); g.fillEllipse(48, 42, 28, 16);
  g.fillStyle(0x2e313a); g.fillRect(44, 40, 14, 3); g.fillRect(46, 46, 14, 3);
  // shiny green/purple neck
  g.fillStyle(0x4fa38a); g.fillEllipse(26, 32, 20, 16);
  g.fillStyle(0x8a5fa8); g.fillEllipse(30, 36, 14, 10);
  // head
  g.fillStyle(0x7d8291); g.fillCircle(22, 18, 12);
  // scruffy head feathers
  g.fillTriangle(20, 7, 18, 0, 25, 6);
  g.fillTriangle(25, 7, 27, 1, 29, 8);
  // beak
  g.fillStyle(0x2e313a); g.fillTriangle(10, 18, 2, 23, 11, 24);
  g.fillStyle(0xeeeeee); g.fillEllipse(12, 18, 5, 3);
  // orange eye
  g.fillStyle(0xff8c1a); g.fillCircle(18, 15, 4);
  g.fillStyle(0x111111); g.fillCircle(18, 15, 2);
  g.generateTexture('pigeon', 82, 78);
  g.destroy();
}

function makeEarth(scene) {
  const g = scene.make.graphics({ add: false });
  for (let r = 150; r > 120; r -= 3) { g.fillStyle(0x7fd3ff, 0.05); g.fillCircle(150, 150, r); }
  g.fillStyle(0x2f6fd6); g.fillCircle(150, 150, 120);
  g.fillStyle(0x4cc26a);
  g.fillEllipse(110, 110, 90, 60); g.fillEllipse(190, 170, 70, 90); g.fillEllipse(95, 190, 50, 40);
  g.fillStyle(0xffffff, 0.8);
  g.fillEllipse(160, 80, 80, 14); g.fillEllipse(80, 160, 60, 12); g.fillEllipse(200, 220, 50, 10);
  g.generateTexture('earth', 300, 300);
  g.destroy();
}

// Crumb seen from behind, for the space tunnel level. pose: 0/1 = running steps, 2 = jumping
function makeDuckBack(scene, key, pose) {
  const L = look();
  const g = scene.make.graphics({ add: false });
  g.translateCanvas(0, 14); // room for a hat
  // feet
  g.fillStyle(ORANGE);
  const leftFootY = pose === 0 ? 74 : 68, rightFootY = pose === 1 ? 74 : 68;
  if (pose === 2) { g.fillEllipse(24, 70, 12, 7); g.fillEllipse(40, 70, 12, 7); }
  else { g.fillEllipse(23, leftFootY, 13, 8); g.fillEllipse(41, rightFootY, 13, 8); }
  // wings (raised when jumping)
  g.fillStyle(YELLOW_DARK);
  if (pose === 2) {
    g.fillTriangle(14, 44, 0, 18, 8, 50);
    g.fillTriangle(50, 44, 64, 18, 56, 50);
  } else {
    g.fillEllipse(11, 46 + (pose === 0 ? -2 : 2), 12, 24);
    g.fillEllipse(53, 46 + (pose === 1 ? -2 : 2), 12, 24);
  }
  // body
  g.fillStyle(YELLOW); g.fillEllipse(32, 46, 42, 40);
  // tail tuft
  g.fillStyle(YELLOW_DARK); g.fillTriangle(26, 60, 32, 50, 38, 60);
  // head (back of it)
  g.fillStyle(YELLOW); g.fillCircle(32, 20, 14);
  g.fillTriangle(29, 8, 32, 0, 36, 8); // head feather
  // beak tips peeking out on both sides
  g.fillStyle(ORANGE); g.fillEllipse(18, 24, 6, 4); g.fillEllipse(46, 24, 6, 4);
  // scarf with a tail flapping out to the side
  g.fillStyle(L.scarf);
  g.fillRoundedRect(18, 30, 28, 7, 3);
  const flap = pose === 1 ? 4 : -2;
  g.fillTriangle(40, 32, 60, 26 + flap, 58, 36 + flap);
  drawHat(g, L.hat, 32, 8, 1, false);
  g.generateTexture(key, 64, 94);
  g.destroy();
}

// soft round glow used for space nebula clouds
function makeGlow(scene) {
  const g = scene.make.graphics({ add: false });
  for (let r = 128; r > 0; r -= 4) { g.fillStyle(0xffffff, 0.035); g.fillCircle(128, 128, r); }
  g.generateTexture('glow', 256, 256);
  g.destroy();
}

// Crumb the duck riding a dirt bike. The bike frame's centre is at (60, 60) in this 120x100 picture.
// The wheels are separate sprites so they can spin.
// Also makes 'bikeEmpty': the same bike with nobody on it (for cutscenes).
function makeBike(scene) {
  const L = look();
  const empty = scene.make.graphics({ add: false });
  drawBikeFrame(empty, L);
  empty.generateTexture('bikeEmpty', 120, 100);
  empty.destroy();

  const g = scene.make.graphics({ add: false });

  // scarf trailing behind (drawn first so it's behind the duck)
  g.fillStyle(L.scarf);
  g.fillTriangle(62, 34, 30, 30, 34, 40);
  g.fillTriangle(34, 30, 22, 26, 26, 36);

  drawBikeFrame(g, L);
  drawRider(g, L);
  g.generateTexture('bike', 120, 100);
  g.destroy();
}

function drawBikeFrame(g, L) {
  g.lineStyle(6, L.bike[0]);
  g.beginPath(); g.moveTo(30, 80); g.lineTo(48, 58); g.lineTo(84, 52); g.lineTo(90, 80); g.strokePath();
  g.lineStyle(5, L.bike[1]);
  g.beginPath(); g.moveTo(48, 58); g.lineTo(62, 76); g.lineTo(30, 80); g.strokePath();
  // engine
  g.fillStyle(0x555b66); g.fillRoundedRect(50, 62, 24, 14, 3);
  g.fillStyle(0x7d8594); g.fillRect(54, 65, 16, 3);
  // seat
  g.fillStyle(0x222222); g.fillRoundedRect(38, 50, 26, 7, 3);
  // front number plate + handlebar
  g.fillStyle(0xffffff); g.fillRoundedRect(84, 46, 10, 12, 2);
  g.lineStyle(4, 0x333333);
  g.beginPath(); g.moveTo(84, 52); g.lineTo(90, 38); g.strokePath();
}

function drawRider(g, L) {
  // duck leg to the foot peg
  g.lineStyle(4, ORANGE);
  g.beginPath(); g.moveTo(54, 50); g.lineTo(60, 66); g.lineTo(66, 66); g.strokePath();

  // duck body
  g.fillStyle(YELLOW); g.fillEllipse(54, 42, 36, 24);
  // tail tuft
  g.fillTriangle(38, 38, 30, 32, 38, 46);
  // wing reaching for the handlebar
  g.lineStyle(7, YELLOW_DARK);
  g.beginPath(); g.moveTo(58, 40); g.lineTo(88, 39); g.strokePath();
  // scarf knot
  g.fillStyle(L.scarf); g.fillRoundedRect(60, 30, 14, 7, 3);

  // head
  g.fillStyle(YELLOW); g.fillCircle(70, 24, 11);
  // beak
  g.fillStyle(ORANGE); g.fillEllipse(83, 27, 14, 7);
  g.fillStyle(0xd9700f); g.fillRect(77, 27, 12, 1);
  // eye with a shine, and a determined eyebrow
  g.fillStyle(0x1a1a1a); g.fillCircle(74, 21, 2.6);
  g.fillStyle(0xffffff); g.fillCircle(75, 20, 1);
  g.lineStyle(2, 0x1a1a1a);
  g.beginPath(); g.moveTo(70, 16); g.lineTo(77, 18); g.strokePath();
  // tiny head feather
  g.fillStyle(YELLOW); g.fillTriangle(64, 15, 66, 8, 69, 14);
  drawHat(g, L.hat, 70, 15, 0.75, true);
}

function makeWheel(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0x1d1d1d); g.fillCircle(16, 16, 16);
  g.fillStyle(0x3a3a3a); g.fillCircle(16, 16, 11);
  g.lineStyle(2, 0x9aa3ad);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI;
    g.beginPath();
    g.moveTo(16 + Math.cos(a) * 10, 16 + Math.sin(a) * 10);
    g.lineTo(16 - Math.cos(a) * 10, 16 - Math.sin(a) * 10);
    g.strokePath();
  }
  g.fillStyle(0xc8ced6); g.fillCircle(16, 16, 4);
  // tread bumps so you can see it spinning
  g.fillStyle(0x444444);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    g.fillCircle(16 + Math.cos(a) * 14.5, 16 + Math.sin(a) * 14.5, 1.6);
  }
  g.generateTexture('wheel', 32, 32);
  g.destroy();
}

// The mysterious "alien" UFO. The pilot is just a dark shape with glowing eyes... for now.
function makeUfo(scene) {
  const g = scene.make.graphics({ add: false });
  // glass dome
  g.fillStyle(0x9fe7ff, 0.55); g.fillEllipse(80, 34, 64, 50);
  // pilot silhouette
  g.fillStyle(0x161126); g.fillEllipse(80, 40, 30, 32);
  g.fillCircle(80, 26, 11);
  g.fillStyle(0xb6ff3b); g.fillEllipse(76, 25, 5, 3); g.fillEllipse(85, 25, 5, 3);
  // dome shine
  g.fillStyle(0xffffff, 0.6); g.fillEllipse(66, 24, 8, 14);
  // saucer
  g.fillStyle(0x6d7486); g.fillEllipse(80, 56, 156, 34);
  g.fillStyle(0xa9b0c2); g.fillEllipse(80, 51, 150, 22);
  // lights
  const colors = [0xff5d73, 0xffe14d, 0x5dffb0, 0x5dc8ff, 0xff5d73];
  colors.forEach((c, i) => { g.fillStyle(c); g.fillCircle(30 + i * 25, 58, 5); });
  g.generateTexture('ufo', 160, 76);
  g.destroy();
}

function makeBread(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0xb8742a); g.fillRoundedRect(2, 6, 44, 22, 10);
  g.fillStyle(0xd99a4e); g.fillRoundedRect(4, 4, 40, 18, 9);
  g.lineStyle(2, 0xf3cf8f);
  for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(12 + i * 10, 8); g.lineTo(17 + i * 10, 16); g.strokePath(); }
  g.generateTexture('bread', 48, 30);
  g.destroy();
}

function makeFlag(scene, key, color) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0xeeeeee); g.fillRect(4, 0, 5, 90);
  g.fillStyle(color); g.fillTriangle(9, 4, 56, 18, 9, 34);
  g.fillStyle(0xffffff, 0.8); g.fillCircle(24, 18, 5); // little bread-crumb logo
  g.generateTexture(key, 60, 90);
  g.destroy();
}

// White hill silhouettes. They get tinted per area, and repeat sideways forever.
function makeHills(scene, key, heightFrac, bumps) {
  const W = 1024, H = 260;
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0xffffff);
  const pts = [{ x: 0, y: H }];
  for (let x = 0; x <= W; x += 8) {
    const t = (x / W) * Math.PI * 2;
    const y = H - H * heightFrac * (0.55 + 0.25 * Math.sin(t * bumps) + 0.2 * Math.sin(t * (bumps + 2) + 1));
    pts.push({ x, y });
  }
  pts.push({ x: W, y: H });
  g.fillPoints(pts, true);
  g.generateTexture(key, W, H);
  g.destroy();
}

function makeSun(scene) {
  const g = scene.make.graphics({ add: false });
  for (let r = 120; r > 60; r -= 6) { g.fillStyle(0xfff1b8, 0.06); g.fillCircle(120, 120, r); }
  g.fillStyle(0xffe58a); g.fillCircle(120, 120, 60);
  g.fillStyle(0xfff6d1); g.fillCircle(120, 120, 48);
  g.generateTexture('sun', 240, 240);
  g.destroy();
}

function makeDot(scene, key, r, color) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(color); g.fillCircle(r, r, r);
  g.generateTexture(key, r * 2, r * 2);
  g.destroy();
}

function makeFeather(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(YELLOW); g.fillEllipse(8, 4, 16, 7);
  g.fillStyle(0xfff3b0); g.fillRect(1, 3.5, 14, 1);
  g.generateTexture('feather', 16, 8);
  g.destroy();
}
