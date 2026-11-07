import { makeTextures } from '../art.js';
import { makeButton, sunsetBackdrop, FONT } from '../ui.js';
import { settings, saveSettings } from '../settings.js';

const CONTROL_OPTIONS = [
  { value: 'keyboard', label: 'Keyboard' },
  { value: 'joystick', label: 'Arduino Joystick' },
  { value: 'camera', label: 'Camera' },
];
const CAMERA_OPTIONS = [
  { value: 'hand', label: 'Hand' },
  { value: 'head', label: 'Head' },
  { value: 'custom', label: 'Custom' },
];

export class SettingsScene extends Phaser.Scene {
  constructor() { super('Settings'); }

  create() {
    makeTextures(this);
    const { width: W, height: H } = this.scale;
    sunsetBackdrop(this);

    const panel = this.add.graphics();
    panel.fillStyle(0x2a1440, 0.78); panel.fillRoundedRect(W / 2 - 480, 60, 960, 560, 28);

    this.add.text(W / 2, 110, 'Settings', {
      fontFamily: FONT, fontSize: '56px', fontStyle: 'bold', color: '#fff4dc',
    }).setOrigin(0.5);

    this.add.text(W / 2, 185, 'Controls', { fontFamily: FONT, fontSize: '28px', color: '#ffd23f' }).setOrigin(0.5);
    this.controlButtons = this.row(250, CONTROL_OPTIONS, 'controlMode');

    this.camLabel = this.add.text(W / 2, 330, 'Camera tracking', { fontFamily: FONT, fontSize: '28px', color: '#ffd23f' }).setOrigin(0.5);
    this.cameraButtons = this.row(395, CAMERA_OPTIONS, 'cameraMode');

    this.note = this.add.text(W / 2, 480, '', {
      fontFamily: FONT, fontSize: '20px', color: '#fff4dc', align: 'center', wordWrap: { width: 820 },
    }).setOrigin(0.5);

    makeButton(this, W / 2, 570, 'Back', () => this.scene.start('Menu'), { w: 220, h: 56, size: 26 }).setSelected(true);
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('Menu'));
    this.input.keyboard.on('keydown-ENTER', () => this.scene.start('Menu'));

    this.refresh();
  }

  // A row of option buttons where exactly one is "on".
  row(y, options, settingName) {
    const { width: W } = this.scale;
    const gap = 290;
    return options.map((opt, i) => {
      const x = W / 2 + (i - (options.length - 1) / 2) * gap;
      const b = makeButton(this, x, y, opt.label, () => {
        settings[settingName] = opt.value;
        saveSettings();
        this.refresh();
      }, { w: 260, h: 56, size: 24 });
      b.value = opt.value;
      return b;
    });
  }

  refresh() {
    this.controlButtons.forEach((b) => b.setSelected(b.value === settings.controlMode));
    const camOn = settings.controlMode === 'camera';
    this.cameraButtons.forEach((b) => {
      b.setSelected(camOn && b.value === settings.cameraMode);
      b.text.setAlpha(camOn ? 1 : 0.4);
    });
    this.camLabel.setAlpha(camOn ? 1 : 0.4);

    const notes = {
      keyboard: 'W = go   S = brake   A / D = tilt back / forward',
      joystick: 'Plug in the Arduino joystick. You\'ll pick its port when the level starts.\n(Joystick support is the next thing being built. The keyboard still works meanwhile.)',
      camera: {
        hand: 'Hold your hand up to the webcam and tilt it to lean Crumb.\n(Camera controls are coming soon. The keyboard still works meanwhile.)',
        head: 'Tilt your head left and right to lean Crumb.\n(Camera controls are coming soon. The keyboard still works meanwhile.)',
        custom: 'Set up your own camera moves.\n(Still being designed. The keyboard still works meanwhile.)',
      }[settings.cameraMode],
    };
    this.note.setText(notes[settings.controlMode]);
  }
}
