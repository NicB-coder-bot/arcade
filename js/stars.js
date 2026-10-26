/* Catch Stars: move the basket to catch falling stars. 3 lives, and the stars fall faster over time. */
(function () {
  'use strict';

  var W = 360, H = 560;
  var BASKET_W = 84, BASKET_H = 40, BASKET_Y = H - 70;
  var START_LIVES = 3;

  // Pure logic, also used by the tests
  var logic = {
    START_LIVES: START_LIVES,

    // Pixels per second a star falls: faster the longer you play (with a limit)
    fallSpeed: function (seconds) {
      return Math.min(420, 150 + seconds * 5);
    },

    // Seconds between new stars: also shrinks over time
    spawnGap: function (seconds) {
      return Math.max(0.55, 1.1 - seconds * 0.01);
    },

    // Does a star (centre x, y, radius r) land in the basket (centre x, top y)?
    caught: function (star, basketX, basketY, basketW) {
      return star.y + star.r >= basketY &&
        star.y - star.r <= basketY + BASKET_H &&
        Math.abs(star.x - basketX) <= basketW / 2 + star.r * 0.5;
    },

    // Has the star fallen past the bottom of the screen?
    missed: function (star, height) {
      return star.y - star.r > height;
    }
  };

  if (typeof module === 'object' && module.exports) { module.exports = logic; return; }

  // ---------- Game state ----------
  var basketX, stars, spawnTimer, lives, left, right, target, sparks, bg = [];
  var livesEl = document.getElementById('lives');

  function setLives(n) {
    lives = n;
    livesEl.textContent = n;
  }

  function reset() {
    basketX = W / 2;
    stars = [];
    sparks = [];
    spawnTimer = 0.4;
    left = right = false;
    target = null;
    setLives(START_LIVES);
    if (!bg.length) {
      for (var i = 0; i < 40; i++) bg.push({ x: Math.random() * W, y: Math.random() * H, r: 0.6 + Math.random() * 1.4 });
    }
  }

  function update(dt, game) {
    // Keyboard moves the basket; a finger or mouse drag moves it straight to that spot
    var move = 460 * dt;
    if (left) basketX -= move;
    if (right) basketX += move;
    if (target !== null) {
      var diff = target - basketX;
      basketX += Math.max(-900 * dt, Math.min(900 * dt, diff));
    }
    basketX = game.util.clamp(basketX, BASKET_W / 2, W - BASKET_W / 2);

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer += logic.spawnGap(game.time);
      var r = 15;
      stars.push({ x: game.util.rand(r + 6, W - r - 6), y: -r, r: r, spin: Math.random() * 6 });
    }

    var speed = logic.fallSpeed(game.time);
    for (var i = stars.length - 1; i >= 0; i--) {
      var s = stars[i];
      s.y += speed * dt;
      s.spin += dt * 2;
      if (logic.caught(s, basketX, BASKET_Y, BASKET_W)) {
        stars.splice(i, 1);
        game.addScore(1);
        game.sound.point();
        for (var k = 0; k < 6; k++) sparks.push({ x: s.x, y: s.y, vx: game.util.rand(-90, 90), vy: game.util.rand(-140, -30), t: 0.4 });
      } else if (logic.missed(s, H)) {
        stars.splice(i, 1);
        setLives(lives - 1);
        game.sound.beep(200, 180, 'sawtooth', 0.1, 120);
        if (lives <= 0) { game.gameOver(); return; }
      }
    }

    for (var j = sparks.length - 1; j >= 0; j--) {
      var p = sparks[j];
      p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt;
      if (p.t <= 0) sparks.splice(j, 1);
    }
  }

  // ---------- Controls ----------
  function onKeyDown(e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { left = true; target = null; }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { right = true; target = null; }
  }
  function onKeyUp(e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') right = false;
  }
  function onPointerDown(p) { target = p.x; }
  function onPointerMove(p) { if (target !== null) target = p.x; }
  function onPointerUp() { target = null; }

  // ---------- Drawing ----------
  function starPath(ctx, x, y, r, rot) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = rot + i * Math.PI / 5 - Math.PI / 2;
      var rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }

  function draw(ctx) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#120c3a');
    g.addColorStop(1, '#3a1d6e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (var b = 0; b < bg.length; b++) {
      ctx.beginPath(); ctx.arc(bg[b].x, bg[b].y, bg[b].r, 0, Math.PI * 2); ctx.fill();
    }

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      starPath(ctx, s.x, s.y, s.r, Math.sin(s.spin) * 0.3);
      ctx.fillStyle = '#ffd23f';
      ctx.fill();
      ctx.lineWidth = 3; ctx.lineJoin = 'round';
      ctx.strokeStyle = '#ff9f1c';
      ctx.stroke();
    }

    for (var j = 0; j < sparks.length; j++) {
      ctx.globalAlpha = Math.max(0, sparks[j].t / 0.4);
      ctx.fillStyle = '#fff3a8';
      ctx.fillRect(sparks[j].x - 2, sparks[j].y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // Basket
    var bx = basketX - BASKET_W / 2;
    ctx.fillStyle = '#ff6b9d';
    ctx.beginPath();
    ctx.moveTo(bx - 6, BASKET_Y);
    ctx.lineTo(bx + BASKET_W + 6, BASKET_Y);
    ctx.lineTo(bx + BASKET_W - 8, BASKET_Y + BASKET_H);
    ctx.quadraticCurveTo(basketX, BASKET_Y + BASKET_H + 4, bx + 8, BASKET_Y + BASKET_H);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffa8c8';
    ctx.fillRect(bx - 8, BASKET_Y - 4, BASKET_W + 16, 8);
  }

  Arcade.createGame({
    id: 'stars',
    width: W,
    height: H,
    reset: reset,
    update: update,
    draw: draw,
    onKeyDown: onKeyDown,
    onKeyUp: onKeyUp,
    onPointerDown: onPointerDown,
    onPointerMove: onPointerMove,
    onPointerUp: onPointerUp
  });
})();
