// All of Duck Dash's music and sound effects, made live with the browser's built-in synthesizer
// (the Web Audio API). No sound files needed.
//
//   import { audio } from './audio.js';
//   audio.music('sunset');   // start a song (it loops). audio.music(null) stops it.
//   audio.sfx.jump();        // play a sound effect
//
// Browsers only allow sound after the player clicks or presses a key, so the first
// click/keypress "unlocks" audio automatically.

import { settings, saveSettings } from './settings.js';

let ctx = null;
let master, musicBus, sfxBus, noiseBuffer;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    applyVolumes();
    // one second of white noise, reused for drums, crashes and whooshes
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
window.addEventListener('pointerdown', ensure);
window.addEventListener('keydown', ensure);

function applyVolumes() {
  if (!ctx) return;
  musicBus.gain.value = settings.musicOn === false ? 0 : 0.32;
  sfxBus.gain.value = settings.sfxOn === false ? 0 : 0.7;
}

const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// 'C4' -> 60, 'F#3' -> 54, 'Bb2' -> 46
function noteToMidi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return null;
  return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

// ------------------------------------------------------------------ basic sound makers

// one note: oscillator -> (optional filter) -> volume envelope -> bus
function tone({ freq, type = 'square', start, dur = 0.2, vol = 0.3, attack = 0.005, release = 0.08,
  slideTo = null, bus = sfxBus, filter = null, detune = 0 }) {
  const t = start ?? ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.detune.value = detune;
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = osc;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = filter.type || 'lowpass';
    f.frequency.value = filter.freq;
    f.Q.value = filter.q || 1;
    osc.connect(f); node = f;
  }
  node.connect(g); g.connect(bus);
  osc.start(t); osc.stop(t + dur + 0.05);
}

function noise({ start, dur = 0.2, vol = 0.3, type = 'highpass', freq = 1000, freqTo = null, q = 1, bus = sfxBus }) {
  const t = start ?? ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(bus);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
}

// ------------------------------------------------------------------ drums (for the music)
// Each song plays into its own volume knob (songBus), so switching songs can fade the old one out fast.
let songBus = null;

const drums = {
  kick(t) { tone({ freq: 150, slideTo: 40, type: 'sine', start: t, dur: 0.22, vol: 0.9, bus: songBus }); },
  snare(t) {
    noise({ start: t, dur: 0.16, vol: 0.45, type: 'bandpass', freq: 1800, q: 0.7, bus: songBus });
    tone({ freq: 220, slideTo: 140, type: 'triangle', start: t, dur: 0.1, vol: 0.25, bus: songBus });
  },
  hat(t) { noise({ start: t, dur: 0.04, vol: 0.18, type: 'highpass', freq: 8000, bus: songBus }); },
};

// ------------------------------------------------------------------ the songs
// Each song is a loop of bars. Melody and bass are written in 8th notes:
//   'E5' = play a note,  '-' = keep holding the note before,  '.' = rest.
// Drums are 16 characters per bar (16th notes): x = hit, . = nothing.
// Chords: one chord per bar, played as a soft pad.

const SONGS = {
  // calm and friendly, for the menu and settings
  menu: {
    bpm: 92,
    chords: [['C4', 'E4', 'G4'], ['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4']],
    bass: 'C3 - - - G2 - - -  A2 - - - E2 - - -  F2 - - - C3 - - -  G2 - - - D3 - - -',
    lead: 'E5 - G5 - E5 D5 C5 -  . C5 D5 E5 - - . .  F5 - E5 - D5 - C5 -  D5 - - - . . . .',
    leadSound: { type: 'triangle', vol: 0.22 },
    kick: 'x.......x.......', snare: '................', hat: '..x...x...x...x.',
  },
  // upbeat chase music for the sunset bike level
  sunset: {
    bpm: 132,
    chords: [['F3', 'A3', 'C4'], ['G3', 'B3', 'D4'], ['E3', 'G3', 'B3'], ['A3', 'C4', 'E4']],
    bass: 'F2 F2 F3 F2 F2 F2 F3 F2  G2 G2 G3 G2 G2 G2 G3 G2  E2 E2 E3 E2 E2 E2 E3 E2  A2 A2 A3 A2 G2 G2 G3 G2',
    lead: 'A4 C5 F5 - E5 C5 A4 -  B4 D5 G5 - F5 - D5 -  B4 E5 G5 - E5 B4 G4 -  A4 - C5 E5 - D5 C5 B4',
    leadSound: { type: 'square', vol: 0.12, filter: { freq: 2600 } },
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
  },
  // floaty spacey music for the tunnel
  space: {
    bpm: 118,
    chords: [['D3', 'F3', 'A3'], ['Bb2', 'D3', 'F3'], ['F3', 'A3', 'C4'], ['C3', 'E3', 'G3']],
    bass: 'D2 - - D2 - - D3 -  Bb1 - - Bb1 - - Bb2 -  F2 - - F2 - - F3 -  C2 - - C2 - - E2 -',
    lead: 'D5 F5 A5 F5 D5 F5 A5 D6  D5 F5 Bb5 F5 D5 F5 Bb5 D6  C5 F5 A5 F5 C5 F5 A5 C6  C5 E5 G5 E5 C5 E5 G5 C6',
    leadSound: { type: 'sine', vol: 0.2 },
    kick: 'x.......x.......', snare: '........x.......', hat: '..x...x...x...xx',
  },
  // sneaky, mysterious music for the cutscenes before each level
  mystery: {
    bpm: 84,
    chords: [['E3', 'G3', 'B3'], ['C3', 'E3', 'G3'], ['A2', 'C3', 'E3'], ['B2', 'D#3', 'F#3']],
    bass: 'E2 . E2 . E2 . E2 .  C2 . C2 . C2 . C2 .  A1 . A1 . A1 . A1 .  B1 . B1 . B1 . B1 .',
    lead: 'B4 . G4 . E4 . . .  C5 . G4 . E4 . . .  A4 . E4 . C4 . E4 .  D#4 - - - F#4 - - -',
    leadSound: { type: 'triangle', vol: 0.18, release: 0.2 },
    kick: '................', snare: '................', hat: '....x.......x...',
  },
  // happy ending music
  happy: {
    bpm: 108,
    chords: [['G3', 'B3', 'D4'], ['D3', 'F#3', 'A3'], ['E3', 'G3', 'B3'], ['C3', 'E3', 'G3']],
    bass: 'G2 - D3 - G2 - D3 -  D2 - A2 - D2 - A2 -  E2 - B2 - E2 - B2 -  C3 - G2 - C3 - D3 -',
    lead: 'D5 - B4 - G4 - B4 D5  F#5 - E5 - D5 - A4 -  G5 - F#5 - E5 - B4 -  C5 - E5 - D5 - - -',
    leadSound: { type: 'triangle', vol: 0.22 },
    kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
  },
};

// turn the 8th-note text into a list of {step, midi, len} where step is in 16ths
function parseLine(text) {
  const tokens = text.trim().split(/\s+/);
  const events = [];
  tokens.forEach((tok, i) => {
    if (tok === '-') { if (events.length && events[events.length - 1].open) events[events.length - 1].len += 2; return; }
    if (events.length) events[events.length - 1].open = false;
    if (tok === '.') return;
    events.push({ step: i * 2, midi: noteToMidi(tok), len: 2, open: true });
  });
  return { events, steps: tokens.length * 2 };
}

const parsed = {};
for (const [name, s] of Object.entries(SONGS)) {
  parsed[name] = { ...s, leadEv: parseLine(s.lead), bassEv: parseLine(s.bass) };
}

// ------------------------------------------------------------------ the music player
// It looks a little ahead and schedules notes just before they're needed, so the timing stays tight.
let current = null, nextStepTime = 0, step = 0, timer = null;

function scheduleStep(song, s, t) {
  const sixteenth = 60 / song.bpm / 4;
  const bar = Math.floor(s / 16), inBar = s % 16;
  if (song.kick[inBar] === 'x') drums.kick(t);
  if (song.snare[inBar] === 'x') drums.snare(t);
  if (song.hat[inBar] === 'x') drums.hat(t);
  if (inBar === 0) {
    const chord = song.chords[bar % song.chords.length];
    chord.forEach((n) => {
      tone({ freq: midiToHz(noteToMidi(n)), type: 'sawtooth', start: t, dur: sixteenth * 16, vol: 0.05,
        attack: 0.3, release: 0.6, bus: songBus, filter: { freq: 900 }, detune: -6 });
      tone({ freq: midiToHz(noteToMidi(n)), type: 'sawtooth', start: t, dur: sixteenth * 16, vol: 0.05,
        attack: 0.3, release: 0.6, bus: songBus, filter: { freq: 900 }, detune: 6 });
    });
  }
  const leadStep = s % song.leadEv.steps;
  for (const e of song.leadEv.events) {
    if (e.step === leadStep) {
      const ls = song.leadSound;
      tone({ freq: midiToHz(e.midi), type: ls.type, start: t, dur: e.len * sixteenth * 0.95, vol: ls.vol,
        release: ls.release || 0.06, bus: songBus, filter: ls.filter });
    }
  }
  const bassStep = s % song.bassEv.steps;
  for (const e of song.bassEv.events) {
    if (e.step === bassStep) {
      tone({ freq: midiToHz(e.midi), type: 'triangle', start: t, dur: e.len * sixteenth * 0.9, vol: 0.35, bus: songBus });
    }
  }
}

function tick() {
  if (!ctx || !current) return;
  const song = parsed[current];
  const sixteenth = 60 / song.bpm / 4;
  while (nextStepTime < ctx.currentTime + 0.12) {
    scheduleStep(song, step, nextStepTime);
    nextStepTime += sixteenth;
    step++;
  }
}

// ------------------------------------------------------------------ bike engine hum (Level 1)
let engine = null;

// ------------------------------------------------------------------ public API
export const audio = {
  music(name) {
    if (name === current) return;
    current = name;
    clearInterval(timer);
    // quickly fade out whatever was playing (including notes that were already scheduled)
    if (songBus && ctx) {
      const old = songBus;
      old.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      setTimeout(() => old.disconnect(), 400);
      songBus = null;
    }
    if (!name) return;
    const start = () => {
      if (!ensure()) return;
      songBus = ctx.createGain();
      songBus.connect(musicBus);
      step = 0;
      nextStepTime = ctx.currentTime + 0.02;
      clearInterval(timer);
      timer = setInterval(tick, 25);
    };
    // if audio isn't unlocked yet, start the song on the first click / key press
    if (ctx && ctx.state === 'running') start();
    else {
      const once = () => { window.removeEventListener('pointerdown', once); window.removeEventListener('keydown', once); if (current === name) start(); };
      window.addEventListener('pointerdown', once);
      window.addEventListener('keydown', once);
    }
  },

  setMusicOn(on) { settings.musicOn = on; saveSettings(); applyVolumes(); },
  setSfxOn(on) { settings.sfxOn = on; saveSettings(); applyVolumes(); },

  // speed: 0 (idle) to 1 (flat out). Call every frame in Level 1; call engineStop() when leaving.
  engine(speed) {
    if (!ensure() || ctx.state !== 'running') return;
    if (!engine) {
      const osc = ctx.createOscillator(); osc.type = 'sawtooth';
      const osc2 = ctx.createOscillator(); osc2.type = 'square';
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
      const g = ctx.createGain(); g.gain.value = 0;
      osc.connect(f); osc2.connect(f); f.connect(g); g.connect(sfxBus);
      osc.start(); osc2.start();
      engine = { osc, osc2, f, g };
    }
    const t = ctx.currentTime;
    const hz = 45 + speed * 75;
    engine.osc.frequency.setTargetAtTime(hz, t, 0.05);
    engine.osc2.frequency.setTargetAtTime(hz * 0.5, t, 0.05);
    engine.f.frequency.setTargetAtTime(350 + speed * 900, t, 0.05);
    engine.g.gain.setTargetAtTime(0.05 + speed * 0.07, t, 0.05);
  },
  engineStop() {
    if (!engine) return;
    const e = engine; engine = null;
    e.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    setTimeout(() => { e.osc.stop(); e.osc2.stop(); }, 300);
  },

  sfx: {
    click() { if (!ensure()) return; tone({ freq: 880, type: 'square', dur: 0.05, vol: 0.12, filter: { freq: 3000 } }); },
    select() { if (!ensure()) return; tone({ freq: 660, type: 'triangle', dur: 0.04, vol: 0.1 }); },
    jump() { if (!ensure()) return; tone({ freq: 320, slideTo: 760, type: 'square', dur: 0.16, vol: 0.14, filter: { freq: 2500 } }); },
    land() { if (!ensure()) return; tone({ freq: 140, slideTo: 60, type: 'sine', dur: 0.1, vol: 0.4 }); },
    bonk() {
      if (!ensure()) return;
      tone({ freq: 520, slideTo: 130, type: 'square', dur: 0.3, vol: 0.2, filter: { freq: 1800 } });
      noise({ dur: 0.18, vol: 0.35, type: 'lowpass', freq: 1200 });
      tone({ freq: 900, slideTo: 600, type: 'sine', dur: 0.4, vol: 0.12, start: ctx.currentTime + 0.08 }); // "boing"
    },
    fall() { if (!ensure()) return; tone({ freq: 900, slideTo: 90, type: 'sine', dur: 0.9, vol: 0.22 }); },
    checkpoint() {
      if (!ensure()) return;
      ['C6', 'E6', 'G6', 'C7'].forEach((n, i) => tone({ freq: midiToHz(noteToMidi(n)), type: 'triangle',
        start: ctx.currentTime + i * 0.07, dur: 0.18, vol: 0.2 }));
    },
    finish() {
      if (!ensure()) return;
      const notes = ['G5', 'C6', 'E6', 'G6', '-', 'E6', 'G6'];
      notes.forEach((n, i) => { if (n !== '-') tone({ freq: midiToHz(noteToMidi(n)), type: 'square',
        start: ctx.currentTime + i * 0.11, dur: i === notes.length - 1 ? 0.6 : 0.14, vol: 0.13, filter: { freq: 3000 } }); });
    },
    beam() {
      if (!ensure()) return;
      for (let i = 0; i < 6; i++) tone({ freq: 400 + i * 60, slideTo: 300 + i * 60, type: 'sine',
        start: ctx.currentTime + i * 0.12, dur: 0.16, vol: 0.12 });
    },
    whoosh() { if (!ensure()) return; noise({ dur: 0.7, vol: 0.35, type: 'bandpass', freq: 300, freqTo: 3000, q: 2 }); },
    crash() {
      if (!ensure()) return;
      noise({ dur: 0.9, vol: 0.6, type: 'lowpass', freq: 2500, freqTo: 200 });
      tone({ freq: 120, slideTo: 35, type: 'sine', dur: 0.6, vol: 0.6 });
    },
    reveal() {
      if (!ensure()) return;
      for (let i = 0; i < 8; i++) tone({ freq: midiToHz(72 + i * 3), type: 'sine', start: ctx.currentTime + i * 0.05, dur: 0.3, vol: 0.12 });
    },
    // bread crumb pickup: a quick happy two-note "bling"
    crumb() {
      if (!ensure()) return;
      tone({ freq: midiToHz(88), type: 'triangle', dur: 0.08, vol: 0.14 });
      tone({ freq: midiToHz(95), type: 'triangle', start: ctx.currentTime + 0.06, dur: 0.12, vol: 0.14 });
    },
    // boost pad / lily pad: a rising zoom
    boost() {
      if (!ensure()) return;
      tone({ freq: 200, slideTo: 900, type: 'sawtooth', dur: 0.3, vol: 0.12, filter: { freq: 2400 } });
      noise({ dur: 0.35, vol: 0.2, type: 'bandpass', freq: 600, freqTo: 3000, q: 1.5 });
    },
    heart() { if (!ensure()) return; tone({ freq: midiToHz(84), type: 'sine', dur: 0.25, vol: 0.12 }); tone({ freq: midiToHz(88), type: 'sine', start: ctx.currentTime + 0.08, dur: 0.3, vol: 0.1 }); },
    rip() { if (!ensure()) return; noise({ dur: 0.25, vol: 0.4, type: 'bandpass', freq: 2500, freqTo: 900, q: 1.5 }); },
    // little voice blips while dialogue types out. Each character gets a different voice.
    talk(who) {
      if (!ensure()) return;
      const voices = {
        Crumb: { f: 620, type: 'square' },
        Pigeon: { f: 300, type: 'triangle' },
        Duckling: { f: 1100, type: 'sine' },
        '???': { f: 200, type: 'sawtooth' },
      };
      const v = voices[who] || { f: 480, type: 'sine' };
      tone({ freq: v.f * (0.9 + Math.random() * 0.25), type: v.type, dur: 0.045, vol: 0.06, filter: { freq: 2200 } });
    },
  },
};
