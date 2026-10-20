/* Snake: arrow keys or swipe. Eat to grow, and it speeds up over time. */
(function () {
  'use strict';

  var COLS = 20, ROWS = 20, CELL = 20;
  var W = COLS * CELL, H = ROWS * CELL;

  var DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };

  // Pure logic, also used by the tests
  var logic = {
    COLS: COLS,
    ROWS: ROWS,

    isOpposite: function (a, b) {
      return DIRS[a].x === -DIRS[b].x && DIRS[a].y === -DIRS[b].y;
    },

    // Seconds between moves: faster with every apple and a little faster over time
    stepTime: function (eaten, seconds) {
      return Math.max(0.055, 0.14 - eaten * 0.004 - seconds * 0.0008);
    },

    // Queue a turn (up to 2 waiting) so quick key presses aren't lost. Returns the new queue.
    queueTurn: function (queue, current, dir) {
      var lastDir = queue.length ? queue[queue.length - 1] : current;
      if (queue.length >= 2 || dir === lastDir || logic.isOpposite(dir, lastDir)) return queue;
      return queue.concat([dir]);
    },

    // Moves the snake one cell. Returns 'dead', 'ate' or 'moved'.
    // snake is an array of {x, y}, head first.
    step: function (snake, dir, food) {
      var head = snake[0];
      var next = { x: head.x + DIRS[dir].x, y: head.y + DIRS[dir].y };
      if (next.x < 0 || next.y < 0 || next.x >= COLS || next.y >= ROWS) return 'dead';
      var ate = food && next.x === food.x && next.y === food.y;
      // The tail moves away this step unless we ate, so it is safe to move into it
      var bodyLength = ate ? snake.length : snake.length - 1;
      for (var i = 0; i < bodyLength; i++) {
        if (snake[i].x === next.x && snake[i].y === next.y) return 'dead';
      }
      snake.unshift(next);
      if (!ate) snake.pop();
      return ate ? 'ate' : 'moved';
    },

    // Picks a random empty cell, or null if the board is full
    placeFood: function (snake, random) {
      var taken = {};
      for (var i = 0; i < snake.length; i++) taken[snake[i].x + ',' + snake[i].y] = true;
      var free = [];
      for (var y = 0; y < ROWS; y++) {
        for (var x = 0; x < COLS; x++) if (!taken[x + ',' + y]) free.push({ x: x, y: y });
      }
      if (!free.length) return null;
      return free[Math.floor(random * free.length) % free.length];
    }
  };

  if (typeof module === 'object' && module.exports) { module.exports = logic; return; }

  // ---------- Game state ----------
  var snake, dir, queue, food, eaten, timer, swipeStart, prevSnake, popAnim;

  function reset() {
    snake = [{ x: 6, y: 10 }, { x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }];
    prevSnake = snake.map(function (s) { return { x: s.x, y: s.y }; });
    dir = 'right';
    queue = [];
    eaten = 0;
    timer = 0;
    swipeStart = null;
    popAnim = 0;
    food = logic.placeFood(snake, Math.random());
  }

  function turn(newDir) {
    queue = logic.queueTurn(queue, dir, newDir);
  }

  function update(dt, game) {
    popAnim = Math.max(0, popAnim - dt);
    timer += dt;
    var stepTime = logic.stepTime(eaten, game.time);
    while (timer >= stepTime) {
      timer -= stepTime;
      if (queue.length) dir = queue.shift();
      prevSnake = snake.map(function (s) { return { x: s.x, y: s.y }; });
      var result = logic.step(snake, dir, food);
      if (result === 'dead') { timer = 0; game.gameOver(); return; }
      if (result === 'ate') {
        eaten++;
        popAnim = 0.25;
        game.addScore(1);
        game.sound.beep(700 + Math.min(eaten, 30) * 15, 80, 'square', 0.07, 1100);
        food = logic.placeFood(snake, Math.random());
        if (!food) { game.gameOver(); return; } // you filled the whole board!
        prevSnake.push(prevSnake[prevSnake.length - 1]);
      }
    }
  }

  // ---------- Controls ----------
  var KEYS = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right'
  };

  function onKeyDown(e) {
    if (KEYS[e.key]) turn(KEYS[e.key]);
  }

  function onPointerDown(p) { swipeStart = p; }
  function onPointerMove(p) {
    if (!swipeStart) return;
    var d = Arcade.util.swipeDirection(p.x - swipeStart.x, p.y - swipeStart.y, 18);
    if (d) {
      turn(d);
      swipeStart = p; // keep swiping without lifting your finger
    }
  }
  function onPointerUp() { swipeStart = null; }

  // ---------- Drawing ----------
  function draw(ctx, game) {
    // Board
    ctx.fillStyle = '#13301f';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#17391f';
    for (var y = 0; y < ROWS; y++) {
      for (var x = (y % 2); x < COLS; x += 2) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }

    // Smooth movement: slide between the last cell and the next
    var t = game.state === 'playing' ? Math.min(timer / logic.stepTime(eaten, game.time), 1) : 1;

    // Food (an apple)
    if (food) {
      var fx = food.x * CELL + CELL / 2, fy = food.y * CELL + CELL / 2;
      var pulse = 1 + Math.sin(performance.now() / 180) * 0.06;
      ctx.fillStyle = '#ff5470';
      ctx.beginPath(); ctx.arc(fx, fy + 1, 7.5 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#3ddc84'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(fx, fy - 5); ctx.quadraticCurveTo(fx + 2, fy - 10, fx + 6, fy - 10); ctx.stroke();
    }

    // Snake body as one thick rounded line
    // The head slides into its new cell, the body follows the old cells
    // (so corners stay square) and the tail slides out of its last cell.
    function lerpCell(a, b) {
      return { x: (a.x + (b.x - a.x) * t) * CELL + CELL / 2, y: (a.y + (b.y - a.y) * t) * CELL + CELL / 2 };
    }
    var n = prevSnake.length;
    var pts = [lerpCell(prevSnake[0], snake[0])];
    for (var i = 0; i < n - 1; i++) pts.push(lerpCell(prevSnake[i], prevSnake[i]));
    if (n > 1) pts.push(lerpCell(prevSnake[n - 1], prevSnake[n - 2]));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#2bbf6c';
    ctx.lineWidth = CELL - 2 + popAnim * 8;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
    if (pts.length === 1) ctx.lineTo(pts[0].x + 0.1, pts[0].y);
    ctx.stroke();
    ctx.strokeStyle = '#3ddc84';
    ctx.lineWidth = CELL - 8;
    ctx.stroke();

    // Head with eyes looking where it is going
    var h = pts[0], d = DIRS[queue.length && game.state !== 'playing' ? queue[0] : dir];
    ctx.fillStyle = '#5ff09c';
    ctx.beginPath(); ctx.arc(h.x, h.y, CELL / 2, 0, Math.PI * 2); ctx.fill();
    var ex = -d.y * 4.5, ey = d.x * 4.5; // sideways from the direction
    ctx.fillStyle = '#0b2414';
    ctx.beginPath(); ctx.arc(h.x + d.x * 3 + ex, h.y + d.y * 3 + ey, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(h.x + d.x * 3 - ex, h.y + d.y * 3 - ey, 2.6, 0, Math.PI * 2); ctx.fill();
  }

  Arcade.createGame({
    id: 'snake',
    width: W,
    height: H,
    reset: reset,
    update: update,
    draw: draw,
    onKeyDown: onKeyDown,
    onPointerDown: onPointerDown,
    onPointerMove: onPointerMove,
    onPointerUp: onPointerUp
  });
})();
