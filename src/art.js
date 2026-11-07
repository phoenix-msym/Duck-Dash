// All the game's pictures are drawn with code here, so there are no image files to load yet.
// Each makeX() draws shapes onto a Graphics object and saves it as a texture
// that sprites can use by name, e.g. this.add.image(x, y, 'wheel').

const YELLOW = 0xffd23f;
const YELLOW_DARK = 0xe8b31e;
const ORANGE = 0xff8c1a;
const SCARF = 0xe63950;

export function makeTextures(scene) {
  if (scene.textures.exists('bike')) return; // only draw once
  makeBike(scene);
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
  makeDuckBack(scene, 'duckRunA', 0);
  makeDuckBack(scene, 'duckRunB', 1);
  makeDuckBack(scene, 'duckJump', 2);
  makeGlow(scene);
  makeDuckStand(scene);
  makePigeon(scene);
  makeEarth(scene);
}

// Crumb standing, side view, facing right (for cutscenes). Feet at the bottom middle.
function makeDuckStand(scene) {
  const g = scene.make.graphics({ add: false });
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
  g.fillStyle(SCARF); g.fillRoundedRect(44, 26, 18, 7, 3); g.fillTriangle(46, 28, 30, 24, 34, 34);
  // head
  g.fillStyle(YELLOW); g.fillCircle(54, 18, 13);
  g.fillTriangle(48, 8, 50, 0, 54, 7);
  // beak
  g.fillStyle(ORANGE); g.fillEllipse(70, 22, 16, 8);
  g.fillStyle(0xd9700f); g.fillRect(63, 22, 14, 1);
  // eye
  g.fillStyle(0x1a1a1a); g.fillCircle(58, 15, 2.8);
  g.fillStyle(0xffffff); g.fillCircle(59, 14, 1);
  g.generateTexture('duckStand', 80, 78);
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
  const g = scene.make.graphics({ add: false });
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
  g.fillStyle(SCARF);
  g.fillRoundedRect(18, 30, 28, 7, 3);
  const flap = pose === 1 ? 4 : -2;
  g.fillTriangle(40, 32, 60, 26 + flap, 58, 36 + flap);
  g.generateTexture(key, 64, 80);
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
  const empty = scene.make.graphics({ add: false });
  drawBikeFrame(empty);
  empty.generateTexture('bikeEmpty', 120, 100);
  empty.destroy();

  const g = scene.make.graphics({ add: false });

  // scarf trailing behind (drawn first so it's behind the duck)
  g.fillStyle(SCARF);
  g.fillTriangle(62, 34, 30, 30, 34, 40);
  g.fillTriangle(34, 30, 22, 26, 26, 36);

  drawBikeFrame(g);
  drawRider(g);
  g.generateTexture('bike', 120, 100);
  g.destroy();
}

function drawBikeFrame(g) {
  g.lineStyle(6, 0x2e9cca);
  g.beginPath(); g.moveTo(30, 80); g.lineTo(48, 58); g.lineTo(84, 52); g.lineTo(90, 80); g.strokePath();
  g.lineStyle(5, 0x22779b);
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

function drawRider(g) {
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
  g.fillStyle(SCARF); g.fillRoundedRect(60, 30, 14, 7, 3);

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
