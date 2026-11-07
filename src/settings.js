// Player settings, saved in the browser so they survive a refresh.
const KEY = 'lilypad-settings';

const DEFAULTS = {
  controlMode: 'keyboard',  // 'keyboard' | 'joystick' | 'camera'
  cameraMode: 'hand',       // 'hand' | 'head' | 'custom'
};

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...DEFAULTS, ...saved };
  } catch (e) {
    return { ...DEFAULTS };
  }
}

export const settings = load();

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* private window: just don't save */ }
}
