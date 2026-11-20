// configs for gen_long.js (one per new level): [name, cfg, seed]
module.exports = {
  c2a: { W: 13, H: 27, nsec: 3, orient: 'v', feats: [['tile', 1, 2, 'abcd'], ['tile', 0, 1, 'mn'], ['tile', 0, 1, 'O'], ['tile', 0, 1, 'X']], stubs: [1, 3], need: ['deflect'], target: 14 },
  c2b: { W: 26, H: 13, nsec: 3, orient: 'h', feats: [['tile', 0, 1, 'abcd'], ['tile', 0, 1, 'M'], ['tile', 0, 1, 'O'], ['pad', 0, 1]], stubs: [1, 3], need: ['deflect', 'graze'], target: 17 },
  c2f: { W: 15, H: 36, nsec: 4, orient: 'v', feats: [['tile', 0, 1, 'abcd'], ['tile', 0, 1, 'mn'], ['tile', 0, 1, 'O'], ['tile', 0, 1, 'X'], ['tile', 0, 1, 'M']], stubs: [1, 3], need: ['deflect', 'mirror', 'graze'], needDeaths: true, target: 22, shards: 4 },
  c3a: { W: 18, H: 30, nsec: 3, orient: 'v', feats: [['curve', 1, 1], ['wind', 0, 1]], stubs: [1, 2], need: ['curve'], target: 14, maxMoves: 19 },
  c3b: { W: 32, H: 15, nsec: 3, orient: 'h', feats: [['curve', 0, 1], ['wind', 1, 1], ['well', 0, 1]], stubs: [1, 2], need: ['curve'], target: 16, maxMoves: 21 },
  c3f: { W: 20, H: 40, nsec: 4, orient: 'v', feats: [['curve', 1, 1], ['wind', 0, 1], ['well', 0, 1], ['mover', 0, 1]], stubs: [1, 2], need: ['curve'], needDeaths: true, target: 17, shards: 4, period: 3 },
  c4a: { W: 15, H: 30, nsec: 3, orient: 'v', feats: [['rock', 1, 2], ['hail', 0, 1]], stubs: [1, 3], hailDirs: ['D', 'DL', 'DR'], target: 22 },
  c4b: { W: 34, H: 15, nsec: 3, orient: 'h', feats: [['ring', 0, 1], ['rock', 1, 1]], stubs: [1, 3], target: 24 },
  c4f: { W: 18, H: 40, nsec: 4, orient: 'v', feats: [['curve', 0, 1], ['ring', 0, 1], ['rock', 1, 1], ['hail', 0, 1]], stubs: [1, 3], hailDirs: ['D', 'DL', 'DR'], target: 28, shards: 4 },
  c5a: { W: 18, H: 30, nsec: 3, orient: 'v', plugs: ['gate', 'gate'], feats: [['bow', 1, 1]], stubs: [1, 2], need: ['bow', 'prism'], target: 16, maxMoves: 21 },
  c5b: { W: 32, H: 16, nsec: 3, orient: 'h', plugs: ['gate'], feats: [['bow', 0, 1], ['hail', 1, 1]], hiddenBows: 1, stubs: [1, 2], need: ['bow', 'rain', 'prism'], target: 15 },
  c5f: { W: 20, H: 40, nsec: 4, orient: 'v', plugs: ['gate', 'gate', 'gate'], feats: [['bow', 0, 1], ['hail', 0, 1]], hiddenBows: 1, stubs: [1, 2], need: ['bow', 'rain', 'prism'], target: 28, shards: 4 },
  c6a: { W: 17, H: 30, nsec: 3, orient: 'v', plugs: ['ice', 'glacier'], feats: [], stubs: [1, 3], need: ['lantern', 'grow', 'smash'], target: 14, maxMoves: 18 },
  c6b: { W: 32, H: 15, nsec: 3, orient: 'h', plugs: ['crack', 'ice'], feats: [['hail', 1, 1]], stubs: [1, 3], need: ['lantern', 'shrink'], target: 16, maxMoves: 20, gapW: 2 },
  c6f: { W: 20, H: 40, nsec: 4, orient: 'v', plugs: ['ice', 'glacier', 'crack'], feats: [['hail', 0, 1]], stubs: [1, 3], need: ['lantern', 'grow', 'smash', 'shrink'], target: 26, shards: 4 },
};
