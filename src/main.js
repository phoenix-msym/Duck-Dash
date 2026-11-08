import { MenuScene } from './scenes/MenuScene.js';
import { SettingsScene } from './scenes/SettingsScene.js';
import { Level1Scene } from './scenes/Level1Scene.js';
import { Level2Scene } from './scenes/Level2Scene.js';
import { CutsceneScene } from './scenes/CutsceneScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { ModeSelectScene } from './scenes/ModeSelectScene.js';
import { StoryLevelsScene } from './scenes/StoryLevelsScene.js';
import { reconnectGyro } from './gyro.js';
import { STORY, storyData } from './story.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#1a1035',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: {
    default: 'matter',
    matter: { gravity: { y: 1 }, positionIterations: 8, velocityIterations: 6, debug: false },
  },
  scene: [MenuScene, SettingsScene, Level1Scene, Level2Scene, CutsceneScene, PauseScene, ShopScene, ModeSelectScene, StoryLevelsScene],
});

// Testing shortcuts:
//   http://localhost:8080/?story=5          -> jump straight to story level 5 (1-6)
//   http://localhost:8080/?cutscene=ending  -> watch a cutscene (intro, middle, ending)
const params = new URLSearchParams(location.search);
const NEXT_AFTER = { intro: 'Level1', middle: 'Level2', ending: 'Menu' };
game.events.once('ready', () => {
  const menu = game.scene.getScene('Menu').scene;
  const story = Number(params.get('story') || params.get('level'));
  if (story >= 1 && story <= STORY.length) menu.start(STORY[story - 1].scene, storyData(story - 1));
  else if (params.get('cutscene')) {
    const id = params.get('cutscene');
    menu.start('Cutscene', { id, next: NEXT_AFTER[id] || 'Menu' });
  }
});

window.game = game; // handy for poking at things in the browser console

// F = fullscreen on / off, from anywhere in the game
window.addEventListener('keydown', (e) => {
  if (e.key !== 'f' && e.key !== 'F') return;
  if (game.scale.isFullscreen) game.scale.stopFullscreen();
  else game.scale.startFullscreen();
});
reconnectGyro();
