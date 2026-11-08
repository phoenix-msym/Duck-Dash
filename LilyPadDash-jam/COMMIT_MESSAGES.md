# Duck Dash – commit messages to paste into GitHub

Each section is one upload. Copy the **Summary** into the first box on GitHub's
upload page and the **Description** into the bigger box under it.
Uploading the whole `src` folder each time is fine.

---

## 1. Egg storyline, pause menu, bigger hills, faster gameplay

**Summary:**
Egg storyline, pause menu, bigger hills and flips, faster gameplay

**Description:**
- The UFO now steals Crumb's egg instead of bread. In the ending the egg hatches into a duckling and Crumb shares bread with the pigeon.
- Opening cutscene and menu now stand on solid ground with big mountains behind.
- Added a pause menu (P / Esc / the II button) with Resume, Back to checkpoint and Main menu. It also pauses when the window loses focus.
- Level 1 hills are bigger, spinning in the air is faster, and landing a flip shows FLIP! / DOUBLE FLIP!!
- Crumb is faster in both levels (jumps in Level 2 are snappier to match).
- Music switches between songs quickly instead of overlapping.

Files: src/art.js, src/ui.js, src/audio.js, src/main.js, src/level1Track.js, src/scenes/MenuScene.js, src/scenes/CutsceneScene.js, src/scenes/Level1Scene.js, src/scenes/Level2Scene.js, src/scenes/PauseScene.js (new)

---

## 2. Shorter levels, boss fight, wind, lily pads, star ratings

**Summary:**
Shorter levels, boss fight, wind, lily pads, cracked tiles, star ratings, new middle cutscene

**Description:**
- Level 2: narrower tunnel (4 tiles per side), lily pad speed boosts, cracked tiles that crumble when touched, more holes, wind zones with a flashing warning and arrow, and a boss fight where the UFO shoots bullets and telegraphed lasers.
- The UFO gets bigger at every checkpoint.
- Level 1: faster bike with more momentum, a push up hills, much faster spins, and a new short course with big trick jumps.
- Both levels are much shorter for the demo.
- Star rating (1-3 stars) based on your time, with your best time saved.
- Finishing a level goes straight into the next cutscene (Esc still skips it).
- Crumb "erases" himself with flying bits when he dies.
- New middle cutscene: the UFO escapes through a portal, Crumb follows on the bike, then a moving chase in space before diving into the tube.
- The ending now happens on a flat asteroid surface (nobody floats).

Files: src/art.js, src/ui.js, src/level1Track.js, src/level2Track.js, src/scenes/Level1Scene.js, src/scenes/Level2Scene.js, src/scenes/CutsceneScene.js

---

## 3. Ending cutscene polish

**Summary:**
Ending cutscene: zoom in, wreckage, bread placement

**Description:**
- The camera zooms in on the conversation; the speech box stays normal size.
- Broken UFO pieces, a scorch mark, smoke and sparks surround the crash.
- The shared bread goes to each character's beak (Crumb, the pigeon and the duckling).

Files: src/scenes/CutsceneScene.js

---

## 4. Bread crumbs, Bread Shop, boost pads, 5-section space level

**Summary:**
Bread crumbs, Bread Shop, boost pads, asteroids, new lily pads and UFO attacks

**Description:**
- Collectable bread crumbs in both levels (counter on screen and on the finish panel). They're saved and spent in the new Bread Shop.
- Bread Shop on the main menu: buy scarf colours, bike colours and hats (cap, party hat, crown) with a live preview of Crumb.
- Level 1: glowing boost pads that shoot you forward, plus crumb trails along the jumps.
- Level 2 is now 5 short sections: basics, holes and cracked tiles, ASTEROIDS, WIND, and the UFO boss fight.
- Lily pads now look like real lily pads with a little pink flower.
- UFO bullets are spiky glowing plasma orbs with trails; lasers have a charging warning with "!" markers, then a flickering beam with sparks.
- Cracked tiles are fairer: they collapse just behind you instead of in front of you.
- Cutscenes have a movie look: black bars, soft dark edges, shadows under characters, and characters bounce when they talk.

Files (#4): src/wallet.js (new), src/scenes/ShopScene.js (new), src/art.js, src/ui.js, src/audio.js, src/main.js, src/level1Track.js, src/level2Track.js, src/scenes/MenuScene.js, src/scenes/Level1Scene.js, src/scenes/Level2Scene.js, src/scenes/CutsceneScene.js

---

## 5. Background decorations everywhere

**Summary:**
Background decorations: pond, fence, clouds, moon, planets, space junk, mothership

**Description:**
- Level 1: a lily pond with lily pads, flowers, cattails and reeds at the start; wooden fence, mailboxes and green "SPACE -> 3 km / 2 km / 1 km" road signs; hay bales at the bottom of big jumps.
- Level 1 sky: pink clouds drifting at different speeds, puffy trees and bushes that turn into dark silhouettes as it gets dark, flocks of birds at sunset, then a rising moon, satellites, shooting stars and the UFO's glowing green trail near space.
- Level 2: a different planet in each section (ringed, red, cratered moon, icy), floating space junk (satellite, glove, toast), an asteroid belt in the asteroid section, colourful gas clouds streaming with the wind, and comets/shooting stars.
- Boss section: red warning lights flashing along the tunnel corners and the mothership's huge shadow sweeping over the tunnel.
- Menu: the sky slowly cycles sunset -> dusk -> night -> dawn, ducks paddle on the pond, fireflies glow and shooting stars fly by.

Files: src/scenery.js (new), src/scenes/Level1Scene.js, src/scenes/Level2Scene.js, src/scenes/MenuScene.js

---

## 6. Smoother riding, longer bike course, easier and clearer space level

**Summary:**
Smoother hills, longer landings, easier Level 2 with clearer colours, no asteroids

**One-sentence description:**
Fixed the bike hopping on hills, made Level 1 longer with long downhill landings so big jumps don't overshoot, and made Level 2 easier and clearer by spreading obstacles out, using fewer and longer tiles, darkening the sky so tiles stand out, scattering lily pads everywhere and removing the asteroids.

**Description:**
- Level 1: smoother ground (no more little steps between ground pieces), curved kicker ramps, softer suspension and gentle "downforce" so the bike stays on the ground going uphill.
- Level 1: every jump now lands on a long downhill slope, so full-speed jumps don't fly past the landing (course is longer; star times updated).
- Level 2: asteroids removed; section 3 is now a "wall run" where whole sides of the tunnel are missing.
- Level 2: more space between obstacles, fewer holes, slower speed, weaker wind, and fewer/slower UFO shots.
- Level 2: tiles are drawn two rows long (half as many tiles on screen), the sky is much darker and tiles brighter so holes are easy to see, especially in the boss section.
- Lily pads are now scattered through every section (never right before a jump).
- Performance: Level 2 draws faster than before (about 3-4 ms per frame).

Files: src/level1Track.js, src/level2Track.js, src/scenes/Level1Scene.js, src/scenes/Level2Scene.js, src/scenery.js

---

## 7. Fewer holes for joystick play

**Summary:**
Fewer holes in the wall-run and wind sections

**One-sentence description:**
Made the wall-run and wind sections of Level 2 easier for joystick players by cutting the random holes to about 5%, widening the narrow path in the wind and making the wind a little weaker.

Files: src/level2Track.js, src/scenes/Level2Scene.js

---

## 8. Hide Crumb when falling, fix overlapping end messages, easier boss

**Summary:**
Hide Crumb when he falls, fix overlapping end messages, easier boss fight

**One-sentence description:**
Crumb now disappears as soon as he drops through a hole, the "THE END" screen and finish panels no longer overlap other messages, and the boss section is easier for gyro players with fewer holes, fewer and slower UFO shots, longer laser warnings and single-lane lasers.

Files: src/level2Track.js, src/scenes/Level2Scene.js, src/scenes/Level1Scene.js, src/scenes/CutsceneScene.js

---

## 9. Wrist sensor controls + flip time bonus

**Summary:**
Wrist sensor controls, new Arduino sketch, flip time bonus

**One-sentence description:**
Added full wrist-sensor controls (bike: fingers down = gas, fingers up = brake, tilt = lean; run: tilt to move even in the air, double flick = jump, triple flick = double jump), updated the Arduino sketch to report triple flicks and unfreeze tilt faster, renamed the Settings option to "Wrist Sensor", removed the "Connect the HW-123" pop-up, and made every bike flip take 0.5 seconds off your time.

Files: arduino/hw123_gyro/hw123_gyro.ino, src/gyro.js, src/scenes/SettingsScene.js, src/scenes/Level1Scene.js, src/scenes/Level2Scene.js

---

## 10. Shallower falls, gentler wrist steering

**Summary:**
Die sooner when falling, lower wrist tilt sensitivity

**One-sentence description:**
Crumb now "dies" much closer to the edge when he falls into a gap (Level 1) or through a hole (Level 2) instead of falling very deep, and the wrist sensor's left/right steering is gentler (80% on the bike, 60% in the run level); the Arduino sketch also prints BOOT and won't freeze if the sensor wiring is wrong.

Files: src/scenes/Level1Scene.js, src/scenes/Level2Scene.js, src/gyro.js, arduino/hw123_gyro/hw123_gyro.ino
