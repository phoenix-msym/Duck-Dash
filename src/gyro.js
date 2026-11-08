// The wrist sensor (MPU-6050 / HW-123 / GY-521 / MPU-9250) on an Arduino, read over USB by the browser.
// Chrome and Edge only. The sketch in arduino/hw123_gyro prints:
//   roll,pitch,flick     at 115200 baud, about 50 times a second.
//   flick: 0 = nothing, 1 = double flick (jump), 3 = triple flick (double jump)
// Bike level:  fingers down = gas, fingers up = brake, tilt left/right = lean.
// Run level:   tilt left/right = move (works in the air too), double flick = jump, triple flick = double jump.
// Those numbers land in externalInput, which both levels already read.

import { settings, saveSettings } from './settings.js';
import { externalInput } from './controls.js';

const BAUD = 115200;
const DEAD = 12;   // degrees from neutral before the duck starts to move
const DEAD_RUN = 6; // run level: half the tilt before Crumb starts moving left/right, so he reacts sooner
const FULL = 30;   // degrees for a full lean, gas, or brake
const CALIB_SAMPLES = 25;
// How strongly left/right tilt steers (1 = full). Lower = less sensitive.
const LEAN_SENS_BIKE = 0.8;  // bike level: a bit less
const LEAN_SENS_RUN = 0.6;   // run level: about 3/5
const FLICK_GAP = 700;   // ms: flicks farther apart than this start a new sequence
const JUMP_HOLD = 250;   // how long a double-flick jump stays available
const DOUBLE_HOLD = 600; // how long the third flick can still double jump

function tiltAmount(delta, dead = DEAD) {
  let d = delta;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  const mag = Math.min(1, Math.max(0, (Math.abs(d) - dead) / (FULL - dead)));
  return Math.sign(d) * mag;
}

export const gyro = {
  supported: typeof navigator !== 'undefined' && 'serial' in navigator,
  status: 'off',   // off | connecting | waiting | ready | error
  error: '',
  message: '',
  roll: 0,
  pitch: 0,
  port: null,
  reader: null,
  roll0: 0,
  pitch0: 0,
  calib: null,
  lastPacket: 0,
  flickCount: 0,
  lastFlickAt: 0,
  jumpEdge: false,
  jumpUntil: 0,
  doubleEdge: false,
  doubleUntil: 0,

  async connect(pick) {
    if (!this.supported) {
      this.status = 'error';
      this.error = 'The wrist sensor needs Chrome or Edge.';
      return;
    }
    if (this.status === 'connecting' || this.status === 'waiting' || this.status === 'ready') return;
    try {
      // requestPort has to be the first thing after the click, or the browser hides the port list.
      const port = pick
        ? await navigator.serial.requestPort()
        : (await navigator.serial.getPorts())[0];
      if (!port) return;
      this.status = 'connecting';
      this.error = '';
      await port.open({ baudRate: BAUD });
      this.port = port;
      this.status = 'waiting';
      settings.gyroWanted = true;
      saveSettings();
      this.readLoop();
      // If the sketch was already running, it may not print READY again.
      setTimeout(() => {
        if (this.status === 'waiting') this.calibrate();
      }, 4000);
    } catch (e) {
      this.status = 'error';
      this.error = e.name === 'NotFoundError' ? 'No port picked.'
        : e.name === 'InvalidStateError' ? 'That port is already open. Close the Arduino Serial Monitor.'
        : e.name === 'NetworkError' ? 'Could not open the port. Close the Arduino Serial Monitor, then try again.'
        : (e.message || String(e));
    }
  },

  async disconnect() {
    settings.gyroWanted = false;
    saveSettings();
    this.status = 'off';
    this.jumpEdge = false;
    this.doubleEdge = false;
    this.flickCount = 0;
    externalInput.active = false;
    externalInput.forward = externalInput.back = externalInput.left = externalInput.right = 0;
    try { if (this.reader) await this.reader.cancel(); } catch (e) { /* already closed */ }
    try { if (this.port) await this.port.close(); } catch (e) { /* already closed */ }
    this.port = null;
    this.reader = null;
  },

  async readLoop() {
    const decoder = new TextDecoderStream();
    this.port.readable.pipeTo(decoder.writable).catch(() => {});
    const reader = decoder.readable.getReader();
    this.reader = reader;
    let buffer = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let i;
        while ((i = buffer.indexOf('\n')) >= 0) {
          this.onLine(buffer.slice(0, i).trim());
          buffer = buffer.slice(i + 1);
        }
      }
    } catch (e) { /* unplugged */ }
    if (this.status !== 'off') {
      this.status = 'error';
      this.error = 'Lost the wrist sensor. Plug it back in and press Connect.';
      try { await this.port.close(); } catch (e) { /* already closed */ }
      this.port = null;
    }
    this.reader = null;
    externalInput.active = false;
  },

  onLine(line) {
    if (!line) return;
    const parts = line.split(',');
    if (parts.length !== 3 || parts.some((p) => p === '' || Number.isNaN(+p))) {
      this.message = line;
      if (line === 'READY') this.calibrate();
      if (line.startsWith('NO_SENSOR')) {
        this.status = 'error';
        this.error = line;
      }
      return;
    }
    this.roll = +parts[0];
    this.pitch = +parts[1];
    this.lastPacket = performance.now();
    const flick = +parts[2];
    if (flick === 1 || flick === 3) this.noteFlick(flick);

    if (this.calib) {
      this.calib.push([this.roll, this.pitch]);
      if (this.calib.length >= CALIB_SAMPLES) {
        this.roll0 = this.calib.reduce((s, c) => s + c[0], 0) / this.calib.length;
        this.pitch0 = this.calib.reduce((s, c) => s + c[1], 0) / this.calib.length;
        this.calib = null;
        this.status = 'ready';
      }
    } else if (this.status === 'waiting') {
      this.status = 'ready';
    }
  },

  calibrate() {
    this.calib = [];
    this.status = 'waiting';
  },

  ready() {
    return this.status === 'ready' && !this.calib;
  },

  // Tunnel only (the bike ignores flicks). The sketch counts the flicks for us:
  //   flick = 1 -> a double flick: jump
  //   flick = 3 -> a triple flick: double jump (a second jump while you're in the air)
  noteFlick(kind) {
    const now = performance.now();
    // in a cutscene, a double flick moves on to the next line of dialogue
    if (kind === 1 && sceneRunning('Cutscene')) { this.nextEdge = true; this.nextUntil = now + 600; return; }
    if (currentLevel() !== 'Level2') return;
    if (kind === 1) {
      this.jumpEdge = true;
      this.jumpUntil = now + JUMP_HOLD;
    } else if (kind === 3) {
      this.doubleEdge = true;
      this.doubleUntil = now + DOUBLE_HOLD;
    }
  },

  takeJump() {
    if (!this.jumpEdge || performance.now() > this.jumpUntil) {
      this.jumpEdge = false;
      return false;
    }
    this.jumpEdge = false;
    return true;
  },

  // cutscenes: was there a double flick just now? (true once per flick)
  takeNext() {
    const yes = !!this.nextEdge && performance.now() <= this.nextUntil;
    this.nextEdge = false;
    return yes;
  },

  takeDoubleJump() {
    if (!this.doubleEdge || performance.now() > this.doubleUntil) {
      this.doubleEdge = false;
      return false;
    }
    this.doubleEdge = false;
    return true;
  },

  describe() {
    if (!this.supported) return 'The wrist sensor needs Chrome or Edge.';
    if (this.status === 'error') return this.error;
    if (this.status === 'connecting') return 'Connecting...';
    if (this.status === 'waiting' || this.calib) {
      return `Hold your hand still.${this.message ? ' ' + this.message : ''}`;
    }
    if (this.status === 'ready') {
      const roll = this.roll - this.roll0;
      const pitch = this.pitch - this.pitch0;
      const lean = roll > DEAD ? 'right' : roll < -DEAD ? 'left' : 'straight';
      return `Connected. Leaning ${lean}. Roll ${roll.toFixed(0)}°, pitch ${pitch.toFixed(0)}°.`;
    }
    return 'Not connected.';
  },
};

// Called every frame from the levels. Copies the latest tilt into the shared controls.
export function syncGyro() {
  const use = settings.controlMode === 'gyro' && (gyro.status === 'ready' || gyro.status === 'waiting');
  if (!use) {
    if (settings.controlMode !== 'gyro') externalInput.active = false;
    return;
  }
  const stale = performance.now() - gyro.lastPacket > 500;
  let forward = 0, back = 0, left = 0, right = 0;
  if (!stale && gyro.ready()) {
    const run = currentLevel() === 'Level2';
    const sens = run ? LEAN_SENS_RUN : LEAN_SENS_BIKE;
    const lean = tiltAmount(gyro.roll - gyro.roll0, run ? DEAD_RUN : DEAD) * sens;
    if (lean > 0) right = lean;
    if (lean < 0) left = -lean;
    // Finger tilt is gas and brake on the bike. The tunnel ignores it.
    if (currentLevel() === 'Level1') {
      const pitch = tiltAmount(gyro.pitch - gyro.pitch0);
      if (pitch > 0) forward = pitch;
      if (pitch < 0) back = -pitch;
    }
  }
  externalInput.forward = forward;
  externalInput.back = back;
  externalInput.left = left;
  externalInput.right = right;
  externalInput.active = true;
}

function sceneRunning(key) {
  const running = window.game?.scene?.getScenes(true) || [];
  return running.some((scene) => scene.scene.key === key);
}

function currentLevel() {
  const running = window.game?.scene?.getScenes(true) || [];
  for (const scene of running) {
    const key = scene.scene.key;
    if (key === 'Level1' || key === 'Level2') return key;
  }
  return '';
}

export function reconnectGyro() {
  if (gyro.supported && settings.gyroWanted && settings.controlMode === 'gyro') gyro.connect(false);
}
