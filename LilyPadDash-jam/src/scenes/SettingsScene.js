import { makeTextures } from '../art.js';
import { makeButton, sunsetBackdrop, FONT } from '../ui.js';
import { settings, saveSettings } from '../settings.js';
import { gyro } from '../gyro.js';
import { audio } from '../audio.js';

const CONTROL_OPTIONS = [
  { value: 'keyboard', label: 'Keyboard' },
  { value: 'gyro', label: 'Wrist Sensor' },
];

export class SettingsScene extends Phaser.Scene {
  constructor() { super('Settings'); }

  create() {
    makeTextures(this);
    const { width: W, height: H } = this.scale;
    sunsetBackdrop(this);

    const panel = this.add.graphics();
    panel.fillStyle(0x2a1440, 0.78); panel.fillRoundedRect(W / 2 - 480, 40, 960, 640, 28);

    this.add.text(W / 2, 110, 'Settings', {
      fontFamily: FONT, fontSize: '56px', fontStyle: 'bold', color: '#fff4dc',
    }).setOrigin(0.5);

    this.add.text(W / 2, 185, 'Controls', { fontFamily: FONT, fontSize: '28px', color: '#ffd23f' }).setOrigin(0.5);
    this.controlButtons = this.row(250, CONTROL_OPTIONS, 'controlMode');

    this.add.text(W / 2, 330, 'Sound', { fontFamily: FONT, fontSize: '28px', color: '#ffd23f' }).setOrigin(0.5);
    this.musicButton = makeButton(this, W / 2 - 145, 395, '', () => { audio.setMusicOn(settings.musicOn === false); this.refresh(); }, { w: 260, h: 56, size: 24 });
    this.sfxButton = makeButton(this, W / 2 + 145, 395, '', () => { audio.setSfxOn(settings.sfxOn === false); this.refresh(); }, { w: 260, h: 56, size: 24 });
    audio.music('menu');

    this.note = this.add.text(W / 2, 478, '', {
      fontFamily: FONT, fontSize: '18px', color: '#fff4dc', align: 'center', wordWrap: { width: 860 },
    }).setOrigin(0.5);
    this.gyroStatus = this.add.text(W / 2, 545, '', {
      fontFamily: FONT, fontSize: '18px', color: '#b6ff3b', align: 'center', wordWrap: { width: 820 },
    }).setOrigin(0.5);

    this.connectButton = makeButton(this, W / 2 - 150, 620, 'Connect', () => this.toggleGyro(), { w: 260, h: 56, size: 24 });
    makeButton(this, W / 2 + 150, 620, 'Back', () => this.scene.start('Menu'), { w: 220, h: 56, size: 26 }).setSelected(true);
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
    const musicOn = settings.musicOn !== false, sfxOn = settings.sfxOn !== false;
    this.musicButton.text.setText(`Music: ${musicOn ? 'On' : 'Off'}`);
    this.musicButton.setSelected(musicOn);
    this.sfxButton.text.setText(`Sounds: ${sfxOn ? 'On' : 'Off'}`);
    this.sfxButton.setSelected(sfxOn);

    const notes = {
      keyboard: 'W = go   S = brake   A / D = tilt back / forward',
      gyro: 'BIKE: fingers down = gas, fingers up = brake, tilt left / right = lean.\nRUN: you run by yourself. Tilt left / right to move (even in the air), double flick = jump, triple flick = double jump.\nPlug in the Arduino, press Connect and pick its port (close the Serial Monitor first).',
    };
    this.note.setText(notes[settings.controlMode]);

    const gyroOn = settings.controlMode === 'gyro';
    this.connectButton.text.setText(gyro.ready() || gyro.status === 'waiting' || gyro.status === 'connecting' ? 'Disconnect' : 'Connect');
    this.connectButton.text.setAlpha(gyroOn ? 1 : 0.35);
    this.connectButton.bg.setAlpha(gyroOn ? 1 : 0.35);
    if (gyroOn) this.connectButton.zone.setInteractive({ useHandCursor: true });
    else this.connectButton.zone.disableInteractive();
    this.gyroStatus.setText(gyroOn ? gyro.describe() : '');
  }

  async toggleGyro() {
    if (settings.controlMode !== 'gyro') return;
    if (gyro.status === 'off' || gyro.status === 'error') await gyro.connect(true);
    else await gyro.disconnect();
    this.refresh();
  }

  update() {
    if (settings.controlMode !== 'gyro') return;
    const live = gyro.describe();
    if (live !== this.gyroStatus.text) this.gyroStatus.setText(live);
  }
}
