import { makeTextures } from '../art.js';
import { makeButton, keyboardMenu, sunsetBackdrop, FONT } from '../ui.js';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    makeTextures(this);
    const { width: W, height: H } = this.scale;
    sunsetBackdrop(this);

    // the UFO drifting across the sky with Crumb's bread
    const ufo = this.add.image(-200, 130, 'ufo');
    const bread = this.add.image(-200, 190, 'bread').setScale(0.9);
    this.tweens.add({
      targets: [ufo, bread], x: W + 200, duration: 9000, repeat: -1, repeatDelay: 1500,
    });
    this.tweens.add({ targets: ufo, y: 115, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: bread, y: 175, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // title
    this.add.text(W / 2 + 4, 150 + 6, 'DUCK DASH', {
      fontFamily: FONT, fontSize: '96px', fontStyle: 'bold', color: '#3b1d4a',
    }).setOrigin(0.5).setAlpha(0.4);
    const title = this.add.text(W / 2, 150, 'DUCK DASH', {
      fontFamily: FONT, fontSize: '96px', fontStyle: 'bold', color: '#fff4dc',
      stroke: '#3b1d4a', strokeThickness: 10,
    }).setOrigin(0.5);
    this.tweens.add({ targets: title, scale: 1.04, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.add.text(W / 2, 228, 'Crumb wants the bread back.', {
      fontFamily: FONT, fontSize: '26px', color: '#3b1d4a', fontStyle: 'italic',
    }).setOrigin(0.5);

    // Crumb on the bike, bouncing on the spot
    const crumb = this.add.container(W * 0.22, H - 180);
    crumb.add([
      this.add.image(-30, 20, 'wheel').setScale(0.95),
      this.add.image(30, 20, 'wheel').setScale(0.95),
      this.add.image(0, 0, 'bike').setOrigin(0.5, 0.6),
    ]);
    crumb.setScale(1.6);
    this.tweens.add({ targets: crumb, y: H - 188, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    const buttons = [
      makeButton(this, W / 2, 360, 'Play', () => this.scene.start('Level1')),
      makeButton(this, W / 2, 450, 'Settings', () => this.scene.start('Settings')),
    ];
    keyboardMenu(this, buttons);

    this.add.text(W / 2, H - 28, 'W/S or mouse to choose  •  Enter to press', {
      fontFamily: FONT, fontSize: '18px', color: '#fff4dc',
    }).setOrigin(0.5);
  }
}
