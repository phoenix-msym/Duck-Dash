// Small helpers for buttons and the sunset background used on menu screens.

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
  zone.on('pointerdown', () => onClick());
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
  const kb = scene.input.keyboard;
  kb.on('keydown-W', () => select(index - 1));
  kb.on('keydown-UP', () => select(index - 1));
  kb.on('keydown-S', () => select(index + 1));
  kb.on('keydown-DOWN', () => select(index + 1));
  kb.on('keydown-ENTER', () => buttons[index].onClick());
  kb.on('keydown-SPACE', () => buttons[index].onClick());
  return { select };
}

export function sunsetBackdrop(scene) {
  const { width: W, height: H } = scene.scale;
  const g = scene.add.graphics();
  g.fillGradientStyle(0xff6fa8, 0xff6fa8, 0xffc78f, 0xffc78f, 1);
  g.fillRect(0, 0, W, H);
  scene.add.image(W * 0.72, H * 0.62, 'sun').setScale(1.6);
  scene.add.image(W / 2, H - 130, 'hillsFar').setDisplaySize(W, 260).setTint(0xc2548f);
  scene.add.image(W / 2, H - 70, 'hillsNear').setDisplaySize(W, 200).setTint(0x7e2f6f);
  // pond with a lily pad, because of course
  g.fillStyle(0x3f2a6b, 1); // drawn on top below
  const pond = scene.add.graphics();
  pond.fillStyle(0x5a8fd6); pond.fillEllipse(220, H - 40, 300, 60);
  pond.fillStyle(0x4cc26a); pond.fillEllipse(250, H - 44, 70, 22);
  pond.fillStyle(0x5a8fd6); pond.fillTriangle(250, H - 44, 285, H - 52, 285, H - 38);
}
