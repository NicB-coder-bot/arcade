/* Flappy: tap, click or press Space to flap through the pipes. */
(function () {
  'use strict';

  var W = 400, H = 600;
  var GROUND = 540;        // top of the ground
  var GRAVITY = 1500;      // pixels per second per second
  var FLAP = -470;         // upward speed after a flap
  var MAX_FALL = 720;
  var PIPE_W = 66;
  var GAP = 165;
  var PIPE_EVERY = 1.45;   // seconds between pipes
  var BIRD_X = 110;
  var BIRD_R = 16;         // drawn size
  var HIT_R = 12;          // a smaller hitbox feels fairer

  // Pure logic, also used by the tests
  var logic = {
    // Where the middle of the next gap goes, never too close to the top or the ground
    gapCenter: function (random) {
      var min = 70 + GAP / 2, max = GROUND - 60 - GAP / 2;
      return min + random * (max - min);
    },
    hitsPipe: function (birdY, pipe) {
      var hit = Arcade_util().circleHitsRect;
      return hit(BIRD_X, birdY, HIT_R, pipe.x, -100, PIPE_W, pipe.gapY - GAP / 2 + 100) ||
             hit(BIRD_X, birdY, HIT_R, pipe.x, pipe.gapY + GAP / 2, PIPE_W, H);
    },
    GAP: GAP, BIRD_X: BIRD_X, PIPE_W: PIPE_W
  };

  function Arcade_util() {
    return typeof window !== 'undefined' ? window.Arcade.util : require('./common.js');
  }

  if (typeof module === 'object' && module.exports) { module.exports = logic; return; }

  // ---------- Game state ----------
  var bird, pipes, pipeTimer, started, groundX, clouds, flapAnim;

  function reset() {
    bird = { y: 280, vy: 0, angle: 0 };
    pipes = [];
    pipeTimer = 0.6;
    started = false; // the bird waits for your first flap
    flapAnim = 0;
  }

  groundX = 0;
  clouds = [];
  for (var i = 0; i < 5; i++) clouds.push({ x: Math.random() * W, y: 40 + Math.random() * 200, s: 0.6 + Math.random() * 0.8 });

  function speed(game) {
    return Math.min(160 + game.getScore() * 2.5, 230);
  }

  function flap(game) {
    started = true;
    bird.vy = FLAP;
    flapAnim = 0.15;
    game.sound.beep(600, 90, 'triangle', 0.09, 900);
  }

  function scroll(dt, s) {
    groundX = (groundX - s * dt) % 40;
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      c.x -= s * 0.2 * c.s * dt;
      if (c.x < -80) { c.x = W + 60; c.y = 40 + Math.random() * 200; }
    }
  }

  function update(dt, game) {
    flapAnim = Math.max(0, flapAnim - dt);
    var s = speed(game);
    scroll(dt, s);

    if (!started) {
      // Gentle hover until the first flap
      bird.y = 280 + Math.sin(game.time * 5) * 8;
      bird.angle = 0;
      return;
    }

    bird.vy = Math.min(bird.vy + GRAVITY * dt, MAX_FALL);
    bird.y += bird.vy * dt;
    if (bird.y < BIRD_R) { bird.y = BIRD_R; bird.vy = 0; }
    bird.angle = Math.max(-0.45, Math.min(1.3, bird.vy / 600));

    // New pipes
    pipeTimer -= dt;
    if (pipeTimer <= 0) {
      pipeTimer += PIPE_EVERY * (160 / s); // keep pipes evenly spaced as speed goes up
      pipes.push({ x: W + 10, gapY: logic.gapCenter(Math.random()), passed: false });
    }

    for (var i = pipes.length - 1; i >= 0; i--) {
      var p = pipes[i];
      p.x -= s * dt;
      if (!p.passed && p.x + PIPE_W < BIRD_X - HIT_R) {
        p.passed = true;
        game.addScore(1);
        game.sound.point();
      }
      if (logic.hitsPipe(bird.y, p)) { game.gameOver(); return; }
      if (p.x < -PIPE_W - 20) pipes.splice(i, 1);
    }

    if (bird.y + HIT_R >= GROUND) {
      bird.y = GROUND - HIT_R;
      game.gameOver();
    }
  }

  // On the start screen, keep the clouds drifting; after a crash, let the bird fall
  function idle(dt, game, state) {
    if (state === 'start') {
      scroll(dt, 60);
      bird.y = 280 + Math.sin(performance.now() / 200) * 8;
    } else if (state === 'over' && bird.y < GROUND - HIT_R) {
      bird.vy = Math.min(bird.vy + GRAVITY * dt, MAX_FALL);
      bird.y = Math.min(bird.y + bird.vy * dt, GROUND - HIT_R);
      bird.angle = Math.min(bird.angle + dt * 6, 1.5);
    }
  }

  // ---------- Drawing ----------
  function draw(ctx, game) {
    var sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, '#4fc0ef');
    sky.addColorStop(1, '#c4f1ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Clouds
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 34 * c.s, 13 * c.s, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + 20 * c.s, c.y - 8 * c.s, 22 * c.s, 12 * c.s, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Faraway hills
    ctx.fillStyle = '#9ddc9a';
    ctx.beginPath();
    ctx.moveTo(0, GROUND);
    for (var x = 0; x <= W; x += 40) ctx.lineTo(x, GROUND - 40 - Math.sin((x + groundX * 0.3) / 50) * 14);
    ctx.lineTo(W, GROUND);
    ctx.fill();

    // Pipes
    for (var j = 0; j < pipes.length; j++) drawPipe(ctx, pipes[j]);

    // Ground
    ctx.fillStyle = '#e3c27a';
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = '#7fcf5f';
    ctx.fillRect(0, GROUND, W, 12);
    ctx.fillStyle = '#d2ad63';
    for (var g = groundX; g < W; g += 40) ctx.fillRect(g, GROUND + 24, 20, 6);

    drawBird(ctx);

    if (game.state === 'playing' && !started) {
      ctx.fillStyle = 'rgba(15,17,36,0.55)';
      roundRect(ctx, W / 2 - 110, 360, 220, 46, 23);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Tap or Space to flap', W / 2, 383);
    }
  }

  function drawPipe(ctx, p) {
    var topH = p.gapY - GAP / 2, botY = p.gapY + GAP / 2;
    var grad = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
    grad.addColorStop(0, '#43c25e');
    grad.addColorStop(0.5, '#6fe08a');
    grad.addColorStop(1, '#2e9e48');
    ctx.fillStyle = grad;
    ctx.fillRect(p.x, 0, PIPE_W, topH);
    ctx.fillRect(p.x, botY, PIPE_W, GROUND - botY);
    // Lips
    ctx.fillStyle = '#2a9444';
    roundRect(ctx, p.x - 5, topH - 22, PIPE_W + 10, 22, 6); ctx.fill();
    roundRect(ctx, p.x - 5, botY, PIPE_W + 10, 22, 6); ctx.fill();
  }

  function drawBird(ctx) {
    ctx.save();
    ctx.translate(BIRD_X, bird.y);
    ctx.rotate(bird.angle);
    // Body
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2); ctx.fill();
    // Wing (flips up for a moment after each flap)
    ctx.fillStyle = '#ffb020';
    ctx.beginPath();
    ctx.ellipse(-5, flapAnim > 0 ? -2 : 4, 10, 6, flapAnim > 0 ? -0.6 : 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(6, -5, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1b1b2a';
    ctx.beginPath(); ctx.arc(7.8, -5, 2.6, 0, Math.PI * 2); ctx.fill();
    // Beak
    ctx.fillStyle = '#ff7a3d';
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(24, 4); ctx.lineTo(12, 9); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  Arcade.createGame({
    id: 'flappy',
    width: W,
    height: H,
    reset: reset,
    update: update,
    idle: idle,
    draw: draw,
    onPress: flap
  });
})();
