/* Ski: steer left and right to dodge trees, rocks and other skiers. */
(function () {
  'use strict';

  var W = 400, H = 600;
  var SKIER_Y = 170;
  var SKIER_R = 9;          // hitbox
  var START_SPEED = 220;    // pixels per second down the hill
  var MAX_SPEED = 640;
  var LANES = 8;
  var LANE_W = W / LANES;

  // Hitbox sizes for each kind of obstacle
  var KINDS = {
    tree: { r: 13 },
    rock: { r: 14 },
    skier: { r: 10 }
  };

  // Pure logic, also used by the tests
  var logic = {
    // Speed builds up the longer you survive
    speedAt: function (seconds) {
      return Math.min(START_SPEED + seconds * 14, MAX_SPEED);
    },
    // Picks which lanes get an obstacle in a new row. Never fills
    // more than half the lanes, so there is always a way through.
    pickLanes: function (count, random) {
      count = Math.max(0, Math.min(count, LANES / 2));
      var lanes = [];
      for (var i = 0; i < LANES; i++) lanes.push(i);
      var picked = [];
      for (var k = 0; k < count; k++) {
        var idx = Math.floor(random() * lanes.length);
        picked.push(lanes.splice(idx, 1)[0]);
      }
      return picked;
    },
    LANES: LANES
  };

  if (typeof module === 'object' && module.exports) { module.exports = logic; return; }

  // ---------- Game state ----------
  var skier, obstacles, tracks, distance, nextRow, trackTimer, crashed, keys, pointers, snowDots;

  function reset() {
    skier = { x: W / 2, vx: 0, lean: 0 };
    obstacles = [];
    tracks = [];
    distance = 0;
    nextRow = H + 60;
    trackTimer = 0;
    crashed = false;
    keys = { left: false, right: false };
    pointers = {};
    // A few rows of trees at the sides so the slope never looks empty
    for (var y = 260; y < H + 40; y += 110) {
      obstacles.push({ kind: 'tree', x: 20 + Math.random() * 25, y: y, vx: 0 });
      obstacles.push({ kind: 'tree', x: W - 20 - Math.random() * 25, y: y + 50, vx: 0 });
    }
  }

  snowDots = [];
  for (var i = 0; i < 40; i++) snowDots.push({ x: Math.random() * W, y: Math.random() * H });

  // Which way the player wants to go: -1 left, 0 straight, 1 right
  function steering() {
    var dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    var newest = null;
    for (var id in pointers) if (!newest || pointers[id].t > newest.t) newest = pointers[id];
    if (newest) dir = newest.x < W / 2 ? -1 : 1;
    return dir;
  }

  function spawnRow(speed) {
    // More obstacles per row as you go faster
    var level = (speed - START_SPEED) / (MAX_SPEED - START_SPEED); // 0 to 1
    var count = 1 + (Math.random() < 0.35 + level * 0.5 ? 1 : 0) + (Math.random() < level * 0.5 ? 1 : 0);
    var lanes = logic.pickLanes(count, Math.random);
    for (var i = 0; i < lanes.length; i++) {
      var roll = Math.random();
      var kind = roll < 0.55 ? 'tree' : roll < 0.8 ? 'rock' : 'skier';
      obstacles.push({
        kind: kind,
        x: lanes[i] * LANE_W + LANE_W / 2 + (Math.random() - 0.5) * 16,
        y: H + 40 + Math.random() * 30,
        vx: kind === 'skier' ? (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 40) : 0
      });
    }
  }

  function update(dt, game) {
    var speed = logic.speedAt(game.time);

    // Steering: ease toward the target sideways speed so it feels smooth
    var dir = steering();
    var maxSide = 230 + speed * 0.35;
    var target = dir * maxSide;
    skier.vx += (target - skier.vx) * Math.min(1, dt * 8);
    skier.x += skier.vx * dt;
    if (skier.x < 14) { skier.x = 14; skier.vx = 0; }
    if (skier.x > W - 14) { skier.x = W - 14; skier.vx = 0; }
    skier.lean = skier.vx / maxSide;

    // Everything moves up the screen as we ski down
    var move = speed * dt;
    distance += move;
    nextRow -= move;
    if (nextRow <= H + 40) {
      spawnRow(speed);
      nextRow += Math.max(110, 150 - (speed - START_SPEED) * 0.08);
    }

    for (var i = obstacles.length - 1; i >= 0; i--) {
      var o = obstacles[i];
      if (o.kind === 'skier') {
        // Other skiers go a bit slower than you and drift side to side
        o.y -= move * 0.65;
        o.x += o.vx * dt;
        if (o.x < 16 || o.x > W - 16) o.vx = -o.vx;
      } else {
        o.y -= move;
      }
      // Trees are hit at the trunk, not the branches high above
      var hy = o.kind === 'tree' ? o.y + 6 : o.y;
      if (Arcade.util.circlesHit(skier.x, SKIER_Y, SKIER_R, o.x, hy, KINDS[o.kind].r)) {
        crashed = true;
        game.gameOver();
        return;
      }
      if (o.y < -60) obstacles.splice(i, 1);
    }

    // Ski tracks in the snow
    trackTimer -= dt;
    if (trackTimer <= 0) {
      trackTimer = 0.02;
      tracks.push({ x: skier.x, y: SKIER_Y + 14 });
      if (tracks.length > 80) tracks.shift();
    }
    for (var t = 0; t < tracks.length; t++) tracks[t].y -= move;

    for (var s = 0; s < snowDots.length; s++) {
      snowDots[s].y -= move;
      if (snowDots[s].y < 0) { snowDots[s].y += H; snowDots[s].x = Math.random() * W; }
    }

    var meters = Math.floor(distance / 20);
    if (meters !== game.getScore()) {
      if (meters > 0 && meters % 100 === 0) game.sound.point();
      game.setScore(meters);
    }
  }

  // ---------- Controls ----------
  function onKeyDown(e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
  }
  function onKeyUp(e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
  }
  function onPointerDown(p) { pointers[p.id] = { x: p.x, t: performance.now() }; }
  function onPointerMove(p) { if (pointers[p.id]) pointers[p.id].x = p.x; }
  function onPointerUp(p) { if (pointers) delete pointers[p.id]; }

  // Let go of every key and finger when the game pauses
  window.addEventListener('blur', function () { if (keys) { keys.left = keys.right = false; pointers = {}; } });

  // ---------- Drawing ----------
  function draw(ctx, game) {
    ctx.fillStyle = '#eef5fc';
    ctx.fillRect(0, 0, W, H);

    // Snow sparkles
    ctx.fillStyle = '#d8e6f4';
    for (var s = 0; s < snowDots.length; s++) ctx.fillRect(snowDots[s].x, snowDots[s].y, 3, 2);

    // Tracks
    if (tracks.length > 1) {
      ctx.strokeStyle = '#c3d5e8';
      ctx.lineWidth = 2.5;
      for (var side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.moveTo(tracks[0].x + side * 5, tracks[0].y);
        for (var t = 1; t < tracks.length; t++) ctx.lineTo(tracks[t].x + side * 5, tracks[t].y);
        ctx.lineTo(skier.x + side * 5, SKIER_Y + 14);
        ctx.stroke();
      }
    }

    // Obstacles above the skier are drawn first, then the skier, then the ones below
    for (var i = 0; i < obstacles.length; i++) if (obstacles[i].y <= SKIER_Y) drawObstacle(ctx, obstacles[i]);
    drawSkier(ctx, skier.x, SKIER_Y, skier.lean, '#4cc9f0', '#ff5470', crashed);
    for (var j = 0; j < obstacles.length; j++) if (obstacles[j].y > SKIER_Y) drawObstacle(ctx, obstacles[j]);

    // Speed meter
    if (game.state !== 'start') {
      var speed = logic.speedAt(game.time);
      ctx.fillStyle = 'rgba(20,30,60,0.55)';
      ctx.font = '700 14px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(Math.round(speed / 8) + ' km/h', W - 12, 12);
    }
  }

  function drawObstacle(ctx, o) {
    if (o.kind === 'tree') {
      ctx.fillStyle = 'rgba(0,30,60,0.12)';
      ctx.beginPath(); ctx.ellipse(o.x + 4, o.y + 14, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(o.x - 4, o.y + 2, 8, 12);
      ctx.fillStyle = '#2e8b57';
      ctx.beginPath(); ctx.moveTo(o.x, o.y - 34); ctx.lineTo(o.x + 20, o.y + 4); ctx.lineTo(o.x - 20, o.y + 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3aa96a';
      ctx.beginPath(); ctx.moveTo(o.x, o.y - 46); ctx.lineTo(o.x + 15, o.y - 16); ctx.lineTo(o.x - 15, o.y - 16); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(o.x, o.y - 46); ctx.lineTo(o.x + 6, o.y - 34); ctx.lineTo(o.x - 6, o.y - 34); ctx.closePath(); ctx.fill();
    } else if (o.kind === 'rock') {
      ctx.fillStyle = '#7d8799';
      ctx.beginPath(); ctx.ellipse(o.x, o.y, 18, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a3acbd';
      ctx.beginPath(); ctx.ellipse(o.x - 5, o.y - 4, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(o.x + 2, o.y - 9, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      drawSkier(ctx, o.x, o.y, o.vx > 0 ? 0.4 : -0.4, '#ffb020', '#7c6cff', false);
    }
  }

  function drawSkier(ctx, x, y, lean, jacket, hat, fallen) {
    ctx.save();
    ctx.translate(x, y);
    if (fallen) ctx.rotate(1.2);
    ctx.rotate(-lean * 0.35);
    // Skis
    ctx.fillStyle = '#1f2a44';
    ctx.fillRect(-8, -4, 4, 26);
    ctx.fillRect(4, -4, 4, 26);
    // Body
    ctx.fillStyle = jacket;
    ctx.beginPath();
    ctx.moveTo(-8, 8); ctx.lineTo(-8, -6); ctx.quadraticCurveTo(0, -12, 8, -6); ctx.lineTo(8, 8); ctx.closePath();
    ctx.fill();
    // Poles
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-10, -2); ctx.lineTo(-14, 16); ctx.moveTo(10, -2); ctx.lineTo(14, 16); ctx.stroke();
    // Head and hat
    ctx.fillStyle = '#ffd9b8';
    ctx.beginPath(); ctx.arc(0, -13, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hat;
    ctx.beginPath(); ctx.arc(0, -15, 6.5, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -22, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  Arcade.createGame({
    id: 'ski',
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
