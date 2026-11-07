// Player settings, saved in the browser so they survive a refresh.
const KEY = 'duckdash-settings';

const DEFAULTS = {
  controlMode: 'keyboard',  // 'keyboard' | 'gyro'
  gyroWanted: false,        // reconnect the HW-123 on the next page load
  musicOn: true,
  sfxOn: true,
};

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (saved.controlMode === 'joystick') saved.controlMode = 'gyro';
    if (saved.controlMode === 'camera') saved.controlMode = 'keyboard'; // camera mode was removed
    delete saved.cameraMode;
    return { ...DEFAULTS, ...saved };
  } catch (e) {
    return { ...DEFAULTS };
  }
}

export const settings = load();

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* private window: just don't save */ }
}
