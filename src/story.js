// The order of the levels in Story mode, and how to move from one to the next.
//
//   intro cutscene -> 3 bike levels -> middle cutscene -> 3 space tunnel levels -> ending cutscene
//
// To add a level: add a line here, then add its course in level1Track.js (bike) or level2Track.js (tunnel).

export const STORY = [
  { scene: 'Level1', stage: 1, name: 'Sunset Ride' },
  { scene: 'Level1', stage: 2, name: 'Twilight Hills' },
  { scene: 'Level1', stage: 3, name: 'Edge of Space' },
  { scene: 'Level2', stage: 1, name: 'Into the Tube' },
  { scene: 'Level2', stage: 2, name: 'Wall Run Winds' },
  { scene: 'Level2', stage: 3, name: 'UFO Showdown' },
];

// which story level (0 = first) a scene + stage is
export function storyIndex(sceneKey, stage) {
  return STORY.findIndex((l) => l.scene === sceneKey && l.stage === stage);
}

// the data a level scene needs to start story level number i (0 = first)
export function storyData(i) {
  return { mode: 'story', stage: STORY[i].stage };
}

// Go to story level number i (0 = first). Plays the middle cutscene before the first space level,
// and the ending after the last level.
export function startStoryLevel(scene, i) {
  if (i >= STORY.length) { scene.scene.start('Cutscene', { id: 'ending', next: 'Menu' }); return; }
  const level = STORY[i];
  const firstSpace = level.scene === 'Level2' && (i === 0 || STORY[i - 1].scene !== 'Level2');
  if (firstSpace) scene.scene.start('Cutscene', { id: 'middle', next: 'Level2', nextData: storyData(i) });
  else scene.scene.start(level.scene, storyData(i));
}
