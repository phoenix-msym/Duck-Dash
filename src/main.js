import { MenuScene } from './scenes/MenuScene.js';
import { SettingsScene } from './scenes/SettingsScene.js';
import { Level1Scene } from './scenes/Level1Scene.js';
import { Level2Scene } from './scenes/Level2Scene.js';
import { CutsceneScene } from './scenes/CutsceneScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { reconnectGyro } from './gyro.js';

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
  scene: [MenuScene, SettingsScene, Level1Scene, Level2Scene, CutsceneScene, PauseScene],
});

// Testing shortcuts:
//   http://localhost:8080/?level=2          -> jump straight to Level 2
//   http://localhost:8080/?cutscene=ending  -> watch a cutscene (intro, middle, ending)
const params = new URLSearchParams(location.search);
const NEXT_AFTER = { intro: 'Level1', middle: 'Level2', ending: 'Menu' };
game.events.once('ready', () => {
  const menu = game.scene.getScene('Menu').scene;
  if (params.get('level')) menu.start('Level' + params.get('level'));
  else if (params.get('cutscene')) {
    const id = params.get('cutscene');
    menu.start('Cutscene', { id, next: NEXT_AFTER[id] || 'Menu' });
  }
});

window.game = game; // handy for poking at things in the browser console
reconnectGyro();
