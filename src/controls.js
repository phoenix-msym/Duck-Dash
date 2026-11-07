// One place where the game asks "what is the player pressing?"
//
// Keyboard and the HW-123 gyro both write four numbers between 0 and 1:
// forward, back, left, right. The levels only ever call controls.read().

import { syncGyro } from './gyro.js';

// The gyro writes into this object. Keyboard is mixed in below.
export const externalInput = { forward: 0, back: 0, left: 0, right: 0, active: false };

export function createControls(scene) {
  const kb = scene.input.keyboard;
  const keys = kb.addKeys({
    W: 'W', A: 'A', S: 'S', D: 'D',
    UP: 'UP', LEFT: 'LEFT', DOWN: 'DOWN', RIGHT: 'RIGHT',
  });

  return {
    read() {
      syncGyro();
      // Keyboard always works, even in gyro or camera mode, as a backup.
      const k = {
        forward: keys.W.isDown || keys.UP.isDown ? 1 : 0,
        back: keys.S.isDown || keys.DOWN.isDown ? 1 : 0,
        left: keys.A.isDown || keys.LEFT.isDown ? 1 : 0,
        right: keys.D.isDown || keys.RIGHT.isDown ? 1 : 0,
      };
      const e = externalInput.active ? externalInput : { forward: 0, back: 0, left: 0, right: 0 };
      return {
        forward: Math.max(k.forward, e.forward),
        back: Math.max(k.back, e.back),
        left: Math.max(k.left, e.left),
        right: Math.max(k.right, e.right),
      };
    },
  };
}
