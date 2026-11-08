import { makeButton, keyboardMenu, fullscreenButton, FONT } from '../ui.js';
import { audio } from '../audio.js';

// The pause screen. It sits on top of a level while the level is frozen underneath.
// Open it from a level with:  this.scene.launch('Pause', { from: this.scene.key }); this.scene.pause();

export class PauseScene extends Phaser.Scene {
  constructor() { super('Pause'); }

  init(data) { this.from = data.from; }

  create() {
    const { width: W, height: H } = this.scale;
    this.add.rectangle(W / 2, H / 2, W, H, 0x0d0420, 0.6);
    const panel = this.add.graphics();
    panel.fillStyle(0x1a1035, 0.92); panel.fillRoundedRect(W / 2 - 260, H / 2 - 245, 520, 490, 28);
    panel.lineStyle(4, 0xfff4dc, 0.9); panel.strokeRoundedRect(W / 2 - 260, H / 2 - 245, 520, 490, 28);
    this.add.text(W / 2, H / 2 - 185, 'Paused', {
      fontFamily: FONT, fontSize: '60px', fontStyle: 'bold', color: '#fff4dc', stroke: '#3b1d4a', strokeThickness: 8,
    }).setOrigin(0.5);

    const opts = { w: 340, h: 60, size: 28 };
    const buttons = [
      makeButton(this, W / 2, H / 2 - 95, 'Resume', () => this.resume(), opts),
      makeButton(this, W / 2, H / 2 - 20, this.scene.get(this.from).endless ? 'Restart run' : 'Back to checkpoint', () => this.toCheckpoint(), opts),
      fullscreenButton(this, W / 2, H / 2 + 55, opts),
      makeButton(this, W / 2, H / 2 + 130, 'Main menu', () => this.toMenu(), opts),
    ];
    keyboardMenu(this, buttons);
    this.input.keyboard.on('keydown-ESC', () => this.resume());
    this.input.keyboard.on('keydown-P', () => this.resume());
    this.add.text(W / 2, H / 2 + 200, 'Esc or P = keep playing   •   F = fullscreen', {
      fontFamily: FONT, fontSize: '18px', color: '#fff4dc',
    }).setOrigin(0.5).setAlpha(0.7);
  }

  resume() {
    this.scene.resume(this.from);
    this.scene.stop();
  }

  toCheckpoint() {
    const level = this.scene.get(this.from);
    if (level.endless) { this.scene.stop(); level.scene.restart({ mode: 'endless' }); return; } // Endless: new run
    if (level.respawn) level.respawn();      // Level 1
    else if (level.spawn) level.spawn();     // Level 2
    this.resume();
  }

  toMenu() {
    audio.engineStop();
    this.scene.stop(this.from);
    this.scene.start('Menu');
  }
}

// Adds a round "II" pause button in the top-right corner of a level, plus the P / Esc keys.
export function addPauseButton(scene, fixedToScreen = true) {
  const { width: W } = scene.scale;
  const x = W - 44, y = 74;
  const g = scene.add.graphics().setDepth(55);
  const draw = (hover) => {
    g.clear();
    g.fillStyle(hover ? 0xffe066 : 0xfff4dc, 1); g.fillCircle(x, y, 24);
    g.lineStyle(3, 0x3b1d4a, 1); g.strokeCircle(x, y, 24);
    g.fillStyle(0x3b1d4a, 1); g.fillRect(x - 9, y - 10, 6, 20); g.fillRect(x + 3, y - 10, 6, 20);
  };
  draw(false);
  const zone = scene.add.zone(x, y, 56, 56).setInteractive({ useHandCursor: true }).setDepth(55);
  if (fixedToScreen) { g.setScrollFactor(0); zone.setScrollFactor(0); }
  zone.on('pointerover', () => draw(true));
  zone.on('pointerout', () => draw(false));

  const open = () => {
    if (scene.finished || !scene.scene.isActive()) return;
    audio.sfx.click();
    audio.engineStop();
    scene.scene.launch('Pause', { from: scene.scene.key });
    scene.scene.pause();
  };
  zone.on('pointerdown', open);
  scene.input.keyboard.on('keydown-P', open);
  scene.input.keyboard.on('keydown-ESC', open);
  // pause automatically if the player switches to another window/tab
  const onBlur = () => open();
  scene.game.events.on('blur', onBlur);
  scene.events.once('shutdown', () => scene.game.events.off('blur', onBlur));
}
