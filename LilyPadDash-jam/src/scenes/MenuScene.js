import { makeTextures } from '../art.js';
import { makeButton, keyboardMenu, sunsetBackdrop, FONT } from '../ui.js';
import { audio } from '../audio.js';
import { wallet } from '../wallet.js';
import { menuScenery } from '../scenery.js';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    makeTextures(this);
    const { width: W, height: H } = this.scale;
    const ground = sunsetBackdrop(this);
    // changing sky, ducks on the pond, fireflies, shooting stars
    this.scenery = menuScenery(this, ground);
    audio.music('menu');
    audio.engineStop();

    // the UFO drifting across the sky with Crumb's egg
    const ufo = this.add.image(-200, 130, 'ufo');
    const egg = this.add.image(-200, 195, 'egg');
    this.tweens.add({
      targets: [ufo, egg], x: W + 200, duration: 9000, repeat: -1, repeatDelay: 1500,
    });
    this.tweens.add({ targets: ufo, y: 115, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: egg, y: 180, angle: 10, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // title
    this.add.text(W / 2 + 4, 150 + 6, 'DUCK DASH', {
      fontFamily: FONT, fontSize: '96px', fontStyle: 'bold', color: '#3b1d4a',
    }).setOrigin(0.5).setAlpha(0.4);
    const title = this.add.text(W / 2, 150, 'DUCK DASH', {
      fontFamily: FONT, fontSize: '96px', fontStyle: 'bold', color: '#fff4dc',
      stroke: '#3b1d4a', strokeThickness: 10,
    }).setOrigin(0.5);
    this.tweens.add({ targets: title, scale: 1.04, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.add.text(W / 2, 228, 'Crumb wants the egg back.', {
      fontFamily: FONT, fontSize: '26px', color: '#fff4dc', fontStyle: 'italic', stroke: '#3b1d4a', strokeThickness: 5,
    }).setOrigin(0.5);

    // Crumb on the bike, bouncing on the spot (wheels touching the grass)
    const bikeY = ground - 56;
    const crumb = this.add.container(W * 0.22, bikeY);
    crumb.add([
      this.add.image(-30, 20, 'wheel').setScale(0.95),
      this.add.image(30, 20, 'wheel').setScale(0.95),
      this.add.image(0, 0, 'bike').setOrigin(0.5, 0.6),
    ]);
    crumb.setScale(1.6);
    this.tweens.add({ targets: crumb, y: bikeY - 6, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    const buttons = [
      makeButton(this, W / 2, 330, 'Play', () => this.scene.start('Cutscene', { id: 'intro', next: 'Level1' })),
      makeButton(this, W / 2, 410, `Bread Shop  (${wallet.crumbs})`, () => this.scene.start('Shop')),
      makeButton(this, W / 2, 490, 'Settings', () => this.scene.start('Settings')),
    ];
    keyboardMenu(this, buttons);

    this.add.text(W / 2, H - 28, 'W/S or mouse to choose  •  Enter to press', {
      fontFamily: FONT, fontSize: '18px', color: '#fff4dc',
    }).setOrigin(0.5);
  }

  update(time, delta) {
    this.scenery.update(time, delta);
  }
}
