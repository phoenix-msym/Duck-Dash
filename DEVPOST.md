# Duck Dash

**Tagline:** A duck, a stolen egg, and a game you play with a flick of your wrist.

## Inspiration

Back in high school, I hated playing Coolmath Games on Chromebook keyboards, as someone who has always used a mechanical one. Duck Dash is our answer, and it's also built for people with limited hand mobility who can still move a wrist. We built it using "Run 3" and "Moto X3M" from Coolmath Games as inspirations.

## What it does

Duck Dash is a browser game about Crumb, a duck whose egg gets stolen by a mysterious UFO. To get it back, Crumb chases the UFO from a pink sunset bike ride all the way into a space tunnel, where he finally catches it and finds out who has been flying it the whole time. You can play with a keyboard, but the main way to play is with our wrist controller, an Arduino and a motion sensor worn on the wrist. On the bike levels you point your fingers down for gas, point them up to brake, and tilt your wrist left and right to lean and pull off flips. In the space tunnel Crumb runs on his own, so you tilt your wrist to move around the tunnel, double flick to jump and triple flick to double jump.

Story mode has six levels tied together by an opening, middle and ending cutscene. The first three are bike levels where the sky slowly turns from sunset to night as you climb toward space, and the last three take place in a spinning space tunnel with lily pads that boost your speed, cracked tiles that collapse ahead of you, missing walls you have to run around, wind you have to lean against, and a final boss fight where the UFO shoots back. There is also an Endless mode, where the tunnel never ends, you get one life, and the game saves your best distance, and a Demo mode that gives a quick tour of everything with shorter levels and faster cutscenes. Along the way you collect bread crumbs and spend them in the Bread Shop on scarves, bike colours and hats, which you can try on Crumb before you buy them.

## How we built it

The game is written in JavaScript using Phaser 3. The bike levels use Matter.js physics, where the bike is a body with two wheels on springs that rides over ground built from each course's layout. The space tunnel is drawn with our own fake 3D: it is a square tube with sixteen lanes, and every frame we project the rows of tiles with perspective and roll the whole tunnel so that whichever wall Crumb is running on becomes the floor. Everything in the game is made in code, including all of the art, from Crumb and the UFO to the planets and lily pads, as well as all of the music and sound effects, which are generated live with the Web Audio API. There are no image or audio files at all. The cutscenes run on a small cutscene system we wrote ourselves, with moving characters, a zooming camera and dialogue that types itself out.

The wrist controller is an Arduino Mega with an MPU-6050 (HW-123) motion sensor. The Arduino reads the sensor, works out the roll and pitch of your wrist, detects quick flicks, and sends all of it to the browser over USB. The game reads that data with the Web Serial API, so players don't need to install anything to use it.

## Challenges we ran into

Our first big challenge was getting the sensor to work at all. At first the Arduino printed nothing, and then it kept telling us the sensor wasn't there. It turned out to be a wiring problem: the sensor's data pins needed to go to the Mega's SDA and SCL pins, and the headers had to be soldered properly. It taught us to check the hardware before blaming the code.

Turning wrist movement into good controls was harder than we expected. A wrist is never perfectly still, so we added dead zones so that small shakes don't move Crumb. A single flick caused too many accidental jumps, so we made jumping a double flick and the double jump a triple flick, and we sped up how quickly a flick counts so it still feels responsive. We also found that levels that felt easy on a keyboard were far too hard with tilt controls, so we reduced the number of holes, widened the paths, made the boss's lasers only hit one lane, and removed jumping from the bike so you only ever have to lean.

The bike physics gave us trouble too. The bike kept making small hops on hills, and the cause turned out to be a sneaky bug: when a wheel rolled from one piece of ground onto the next, the game briefly thought it was in the air and turned off its grip. Fixing that made riding feel much smoother. Faking 3D in the tunnel was also slow at first because we were drawing hundreds of tiles every frame, so we merged tiles, simplified details and only drew what was needed. Finally, skipping or restarting a cutscene sometimes left the old one running in the background, so we had to make every cutscene check that it was still the one playing.

## Accomplishments that we're proud of

We are proud that the wrist controller actually works and that you can beat the whole game without touching a keyboard. We are also proud that every picture, song and sound effect in the game was made in code during the hackathon, and that we managed to tell a complete story with a beginning, a middle, a plot twist and an ending across six levels and two very different kinds of gameplay. We put a lot of care into the small touches that make it feel like a finished game, like the sky changing as you get closer to space, wind you can see coming, flowers on the lily pads, flip bonuses, a shop and a best score. And because it runs in a browser, anyone with the link can play it.

## What we learned

We learned how game physics really works, from springs and friction to why bikes bounce, and how to fake a 3D world using perspective math. We learned how to read a motion sensor, deal with noisy data and send it from an Arduino to a web page. Most of all, we learned that designing for accessibility changes almost everything: when the input is a wrist instead of fingers, the timing, the width of paths and the way you warn players all need to be rethought. We also learned a lot about scoping, keeping track of what mattered most and cutting ideas that didn't work, like a camera-controlled mode, instead of forcing them in.

## What's next for Duck Dash

Next, we want to add one-button recalibration so the controller can be reset for each new player and doesn't drift over time, along with adjustable sensitivity and dead zones in the settings so it fits more people's range of motion. We would like to make the controller wireless using Bluetooth instead of a USB cable, and most importantly, test the game with people who have limited hand mobility and build the controls around their feedback. We also want to add more levels, a level select, an online leaderboard for Endless mode, and a wrist gesture for flips so tricks are as easy on the controller as they are on a keyboard.

## Built with

JavaScript, Phaser 3, Matter.js, Web Audio API, Web Serial API, HTML5 Canvas, Arduino (C++), Arduino Mega, MPU-6050 / HW-123, Node.js, GitHub
