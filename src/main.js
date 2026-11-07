import { MenuScene } from './scenes/MenuScene.js';
import { SettingsScene } from './scenes/SettingsScene.js';
import { Level1Scene } from './scenes/Level1Scene.js';

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
  scene: [MenuScene, SettingsScene, Level1Scene],
});

window.game = game; // handy for poking at things in the browser console
