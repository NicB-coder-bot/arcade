// Quick checks for the game rules. Run with: node tests/logic.test.js
'use strict';
var assert = require('assert');
var util = require('../js/common.js');
var flappy = require('../js/flappy.js');
var snake = require('../js/snake.js');
var ski = require('../js/ski.js');
var stack = require('../js/stack.js');

var passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}

// Shared helpers
test('swipe picks the bigger direction', function () {
  assert.strictEqual(util.swipeDirection(40, 5), 'right');
  assert.strictEqual(util.swipeDirection(-40, 10), 'left');
  assert.strictEqual(util.swipeDirection(3, -50), 'up');
  assert.strictEqual(util.swipeDirection(0, 30), 'down');
  assert.strictEqual(util.swipeDirection(5, 5), null);
});
test('circle and rectangle collision', function () {
  assert.ok(util.circleHitsRect(10, 10, 5, 12, 0, 10, 20));
  assert.ok(!util.circleHitsRect(0, 0, 5, 10, 10, 10, 10));
});

// Flappy
test('flappy gap is always inside the screen', function () {
  [0, 0.5, 1].forEach(function (r) {
    var c = flappy.gapCenter(r);
    assert.ok(c - flappy.GAP / 2 >= 60 && c + flappy.GAP / 2 <= 540, 'gap at ' + c);
  });
});
test('flappy bird in the gap is safe, bird in the pipe is not', function () {
  var pipe = { x: flappy.BIRD_X - 20, gapY: 300 };
  assert.ok(!flappy.hitsPipe(300, pipe));
  assert.ok(flappy.hitsPipe(300 - flappy.GAP / 2, pipe));
  assert.ok(!flappy.hitsPipe(100, { x: 300, gapY: 300 }));
});

// Snake
test('snake cannot turn straight back', function () {
  assert.deepStrictEqual(snake.queueTurn([], 'right', 'left'), []);
  assert.deepStrictEqual(snake.queueTurn([], 'right', 'up'), ['up']);
  assert.deepStrictEqual(snake.queueTurn(['up'], 'right', 'left'), ['up', 'left']);
  assert.deepStrictEqual(snake.queueTurn(['up', 'left'], 'right', 'down'), ['up', 'left']);
});
test('snake grows when it eats and dies on walls', function () {
  var s = [{ x: 2, y: 2 }, { x: 1, y: 2 }];
  assert.strictEqual(snake.step(s, 'right', { x: 3, y: 2 }), 'ate');
  assert.strictEqual(s.length, 3);
  assert.strictEqual(snake.step(s, 'right', null), 'moved');
  assert.strictEqual(s.length, 3);
  var edge = [{ x: 19, y: 0 }];
  assert.strictEqual(snake.step(edge, 'right', null), 'dead');
  assert.strictEqual(snake.step([{ x: 0, y: 0 }], 'up', null), 'dead');
});
test('snake may move into the cell its tail is leaving', function () {
  var s = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }];
  assert.strictEqual(snake.step(s, 'down', null), 'moved');
});
test('snake dies when it bites itself', function () {
  var s = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 }];
  assert.strictEqual(snake.step(s, 'down', null), 'dead');
});
test('snake food never lands on the snake', function () {
  var s = [];
  for (var x = 0; x < 20; x++) for (var y = 0; y < 20; y++) if (!(x === 7 && y === 9)) s.push({ x: x, y: y });
  assert.deepStrictEqual(snake.placeFood(s, 0.99), { x: 7, y: 9 });
  s.push({ x: 7, y: 9 });
  assert.strictEqual(snake.placeFood(s, 0.5), null);
});
test('snake speeds up but has a limit', function () {
  assert.ok(snake.stepTime(10, 0) < snake.stepTime(0, 0));
  assert.ok(snake.stepTime(0, 30) < snake.stepTime(0, 0));
  assert.strictEqual(snake.stepTime(1000, 1000), 0.055);
});

// Ski
test('ski always leaves free lanes', function () {
  for (var i = 0; i < 200; i++) {
    var lanes = ski.pickLanes(10, Math.random);
    assert.ok(lanes.length <= ski.LANES / 2);
    assert.strictEqual(new Set(lanes).size, lanes.length);
  }
});
test('ski speed builds up and stops at a top speed', function () {
  assert.ok(ski.speedAt(10) > ski.speedAt(0));
  assert.strictEqual(ski.speedAt(10000), ski.speedAt(20000));
});

// Stack
test('stack cuts off the overhang', function () {
  var r = stack.drop({ x: 100, w: 200 }, { x: 150, w: 200 });
  assert.deepStrictEqual(r.placed, { x: 150, w: 150 });
  assert.deepStrictEqual(r.cut, { x: 300, w: 50 });
  r = stack.drop({ x: 100, w: 200 }, { x: 40, w: 200 });
  assert.deepStrictEqual(r.placed, { x: 100, w: 140 });
  assert.deepStrictEqual(r.cut, { x: 40, w: 60 });
});
test('stack snaps a nearly perfect drop', function () {
  var r = stack.drop({ x: 100, w: 200 }, { x: 103, w: 200 });
  assert.ok(r.perfect);
  assert.deepStrictEqual(r.placed, { x: 100, w: 200 });
});
test('stack misses when nothing overlaps', function () {
  assert.ok(stack.drop({ x: 100, w: 50 }, { x: 150, w: 50 }).miss);
  assert.ok(stack.drop({ x: 100, w: 50 }, { x: 0, w: 60 }).miss);
});

console.log('\n' + passed + ' checks passed');
