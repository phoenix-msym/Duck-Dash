import { makeTextures } from '../art.js';
import { makeButton, keyboardMenu, sunsetBackdrop, fmtTime, FONT } from '../ui.js';
import { audio } from '../audio.js';
import { menuScenery } from '../scenery.js';
import { STORY, storyData } from '../story.js';

// STORY MODE level menu: play the whole story from the start, or jump to any of the 6 levels.
// Each level shows your best stars and time.
export class StoryLevelsScene extends Phaser.Scene {
  constructor() { super('StoryLevels'); }

  create() {
    makeTextures(this);
    const { width: W } = this.scale;
    const ground = sunsetBackdrop(this);
    this.scenery = menuScenery(this, ground);
    audio.music('menu');

    const style = { fontFamily: FONT, color: '#fff4dc', stroke: '#3b1d4a', align: 'center' };
    this.add.text(W / 2, 70, 'Story Mode', { ...style, fontSize: '56px', fontStyle: 'bold', strokeThickness: 9 }).setOrigin(0.5);

    const buttons = [];
    // the whole adventure, opening cutscene first
    buttons.push(makeButton(this, W / 2, 160, 'Play from the start', () => (
      this.scene.start('Cutscene', { id: 'intro', next: 'Level1', nextData: storyData(0) })
    ), { w: 420, h: 62, size: 30 }));

    // two columns: the 3 bike levels on the left, the 3 space levels on the right
    const colX = [W / 2 - 250, W / 2 + 250];
    this.add.text(colX[0], 232, 'On the bike', { ...style, fontSize: '24px', fontStyle: 'italic', strokeThickness: 5 }).setOrigin(0.5);
    this.add.text(colX[1], 232, 'In space', { ...style, fontSize: '24px', fontStyle: 'italic', strokeThickness: 5 }).setOrigin(0.5);

    STORY.forEach((level, i) => {
      const x = colX[level.scene === 'Level1' ? 0 : 1];
      const y = 290 + (i % 3) * 110;
      buttons.push(makeButton(this, x, y, `${i + 1}. ${level.name}`, () => (
        this.scene.start(level.scene, storyData(i))
      ), { w: 400, h: 58, size: 26 }));

      // best stars and time under each level
      let best = null;
      try { best = JSON.parse(localStorage.getItem(`duckdash-best-story${i + 1}`) || 'null'); } catch (e) { /* ignore */ }
      for (let s = 0; s < 3; s++) {
        this.add.image(x - 150 + s * 30, y + 44, 'starIcon').setScale(0.26).setTint(best && s < best.stars ? 0xffd23f : 0x4a3a66);
      }
      this.add.text(x - 62, y + 44, best ? `best ${fmtTime(best.secs)}` : 'not beaten yet', {
        ...style, fontSize: '20px', strokeThickness: 4,
      }).setOrigin(0, 0.5);
    });

    buttons.push(makeButton(this, W / 2, 650, 'Back', () => this.scene.start('Modes'), { w: 200, h: 50, size: 24 }));
    keyboardMenu(this, buttons);
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('Modes'));
  }

  update(time, delta) {
    this.scenery.update(time, delta);
  }
}
