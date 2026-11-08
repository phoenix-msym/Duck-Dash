import { makeTextures } from '../art.js';
import { makeButton, keyboardMenu, sunsetBackdrop, fmtTime, FONT } from '../ui.js';
import { audio } from '../audio.js';
import { menuScenery } from '../scenery.js';
import { STORY, storyData, startStoryLevel } from '../story.js';

// STORY MODE level menu: the 6 levels in two columns (bike levels on the left, space levels on the right).
//  - a level you've beaten shows its name, your best stars and best time
//  - the next level to play is a mystery ("? ? ?") until you beat it
//  - levels after that are greyed out and locked
// Level 1 starts with the opening cutscene, and the first space level with the space cutscene.

// your best result for story level i (0 = first), or null if you haven't beaten it
function bestFor(i) {
  try { return JSON.parse(localStorage.getItem(`duckdash-best-story${i + 1}`) || 'null'); } catch (e) { return null; }
}

export class StoryLevelsScene extends Phaser.Scene {
  constructor() { super('StoryLevels'); }

  create() {
    makeTextures(this);
    const { width: W } = this.scale;
    const ground = sunsetBackdrop(this);
    this.scenery = menuScenery(this, ground);
    audio.music('menu');

    const style = { fontFamily: FONT, color: '#fff4dc', stroke: '#3b1d4a', align: 'center' };
    this.add.text(W / 2, 80, 'Story Mode', { ...style, fontSize: '56px', fontStyle: 'bold', strokeThickness: 9 }).setOrigin(0.5);

    // two columns: the 3 bike levels on the left, the 3 space levels on the right
    const colX = [W / 2 - 250, W / 2 + 250];
    this.add.text(colX[0], 175, 'On the bike', { ...style, fontSize: '24px', fontStyle: 'italic', strokeThickness: 5 }).setOrigin(0.5);
    this.add.text(colX[1], 175, 'In space', { ...style, fontSize: '24px', fontStyle: 'italic', strokeThickness: 5 }).setOrigin(0.5);

    const buttons = [];
    STORY.forEach((level, i) => {
      const x = colX[level.scene === 'Level1' ? 0 : 1];
      const y = 235 + (i % 3) * 120;
      const best = bestFor(i);
      const unlocked = i === 0 || best || bestFor(i - 1); // you can play it once the level before is beaten

      if (best) {
        // beaten: name, stars and best time
        buttons.push(makeButton(this, x, y, `${i + 1}. ${level.name}`, () => this.play(i), { w: 400, h: 58, size: 26 }));
        for (let s = 0; s < 3; s++) {
          this.add.image(x - 150 + s * 30, y + 46, 'starIcon').setScale(0.26).setTint(s < best.stars ? 0xffd23f : 0x4a3a66);
        }
        this.add.text(x - 62, y + 46, `best ${fmtTime(best.secs)}`, { ...style, fontSize: '20px', strokeThickness: 4 }).setOrigin(0, 0.5);
      } else if (unlocked) {
        // the next level to play: still a mystery until you beat it
        buttons.push(makeButton(this, x, y, `${i + 1}.  ? ? ?`, () => this.play(i), { w: 400, h: 58, size: 28 }));
        const tag = this.add.text(x, y + 46, 'NEW! Play to find out what it is', {
          ...style, fontSize: '20px', color: '#ffe066', strokeThickness: 4, fontStyle: 'bold',
        }).setOrigin(0.5);
        this.tweens.add({ targets: tag, alpha: 0.45, duration: 600, yoyo: true, repeat: -1 });
      } else {
        // locked: a dark card with question marks and a padlock
        const g = this.add.graphics();
        g.fillStyle(0x000000, 0.25); g.fillRoundedRect(x - 200 + 4, y - 29 + 6, 400, 58, 18);
        g.fillStyle(0x2c2140, 0.92); g.fillRoundedRect(x - 200, y - 29, 400, 58, 18);
        g.lineStyle(3, 0x5c4a78); g.strokeRoundedRect(x - 200, y - 29, 400, 58, 18);
        // padlock
        g.lineStyle(4, 0x8c7aa8); g.beginPath(); g.arc(x - 160, y - 6, 9, Math.PI, 0); g.strokePath();
        g.fillStyle(0x8c7aa8); g.fillRoundedRect(x - 173, y - 6, 26, 20, 4);
        g.fillStyle(0x2c2140); g.fillCircle(x - 160, y + 3, 3);
        this.add.text(x + 10, y, `${i + 1}.  ? ? ?`, {
          fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: '#7d6b98',
        }).setOrigin(0.5);
        this.add.text(x, y + 46, `Beat level ${i} to unlock`, { ...style, fontSize: '18px', color: '#c9bfdc', strokeThickness: 4 }).setOrigin(0.5);
      }
    });

    buttons.push(makeButton(this, W / 2, 650, 'Back', () => this.scene.start('Modes'), { w: 200, h: 50, size: 24 }));
    keyboardMenu(this, buttons);
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('Modes'));
  }

  // start story level i: level 1 plays the opening cutscene first, and the first space level plays the
  // space cutscene first (startStoryLevel handles that one); after that the story carries on by itself
  play(i) {
    if (i === 0) this.scene.start('Cutscene', { id: 'intro', next: 'Level1', nextData: storyData(0) });
    else startStoryLevel(this, i);
  }

  update(time, delta) {
    this.scenery.update(time, delta);
  }
}
