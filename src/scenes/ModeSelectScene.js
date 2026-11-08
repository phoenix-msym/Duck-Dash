import { makeTextures } from '../art.js';
import { makeButton, keyboardMenu, sunsetBackdrop, FONT } from '../ui.js';
import { audio } from '../audio.js';
import { menuScenery } from '../scenery.js';

// What you see after pressing Play: pick Story, Endless or Demo mode.
const MODES = [
  {
    label: 'Story Mode',
    about: 'The full adventure: 6 levels, from a sunset bike ride all the way into space.',
    go: (s) => s.scene.start('StoryLevels'), // the level menu: play from the start or pick a level
  },
  {
    label: 'Endless Mode',
    about: 'The space tunnel never ends. One life. How many meters can you run?',
    go: (s) => s.scene.start('Level2', { mode: 'endless' }),
  },
  {
    label: 'Demo Mode',
    about: 'A quick tour: faster cutscenes and short versions of both levels with every effect.',
    // fast cutscenes + short levels: intro -> bike -> middle -> tunnel -> ending
    go: (s) => s.scene.start('Cutscene', { id: 'intro', next: 'Level1', nextData: { mode: 'demo' }, fast: true }),
  },
];

export class ModeSelectScene extends Phaser.Scene {
  constructor() { super('Modes'); }

  create() {
    makeTextures(this);
    const { width: W, height: H } = this.scale;
    const ground = sunsetBackdrop(this);
    this.scenery = menuScenery(this, ground);
    audio.music('menu');

    this.add.text(W / 2, 110, 'Choose a mode', {
      fontFamily: FONT, fontSize: '60px', fontStyle: 'bold', color: '#fff4dc', stroke: '#3b1d4a', strokeThickness: 9,
    }).setOrigin(0.5);

    const about = this.add.text(W / 2, 520, '', {
      fontFamily: FONT, fontSize: '22px', color: '#fff4dc', stroke: '#3b1d4a', strokeThickness: 5, align: 'center',
    }).setOrigin(0.5);

    const buttons = MODES.map((m, i) => {
      const b = makeButton(this, W / 2, 230 + i * 85, m.label, () => m.go(this), { w: 360, h: 66, size: 32 });
      b.zone.on('pointerover', () => about.setText(m.about));
      return b;
    });
    buttons.push(makeButton(this, W / 2, 610, 'Back', () => this.scene.start('Menu'), { w: 200, h: 50, size: 24 }));
    const menu = keyboardMenu(this, buttons);
    about.setText(MODES[0].about);
    // (the description of whichever mode is highlighted with the keyboard is updated in update() below.
    //  It used to be a scene event listener, which stayed around after leaving this screen and crashed
    //  the game the second time you opened it.)
    this.buttons = buttons;
    this.about = about;
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('Menu'));
    void menu;
  }

  update(time, delta) {
    this.scenery.update(time, delta);
    const i = this.buttons.findIndex((b) => b.selected);
    if (i >= 0 && i < MODES.length && this.about.text !== MODES[i].about) this.about.setText(MODES[i].about);
  }
}
