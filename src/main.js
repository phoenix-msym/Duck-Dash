import { MenuScene } from './scenes/MenuScene.js';
import { SettingsScene } from './scenes/SettingsScene.js';
import { Level1Scene } from './scenes/Level1Scene.js';
import { Level2Scene } from './scenes/Level2Scene.js';

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
  scene: [MenuScene, SettingsScene, Level1Scene, Level2Scene],
});

// Testing shortcut: open http://localhost:8080/?level=2 to jump straight to Level 2
const startLevel = new URLSearchParams(location.search).get('level');
if (startLevel) game.events.once('ready', () => game.scene.getScene('Menu').scene.start('Level' + startLevel));

window.game = game; // handy for poking at things in the browser console
