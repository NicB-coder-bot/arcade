/* Stack: drop the sliding block on the tower. Overhang is cut off. */
(function () {
  'use strict';

  var W = 400, H = 600;
  var BH = 30;              // block height
  var GROUND_Y = H - 70;    // screen y of the bottom of the tower (before the camera moves)
  var BASE_W = 200;
  var PERFECT = 5;          // drops this close to perfect snap into place

  // Pure logic, also used by the tests
  var logic = {
    BASE_W: BASE_W,
    PERFECT: PERFECT,
    // top and moving are { x, w }. Works out what stays and what falls off.
    drop: function (top, moving) {
      if (Math.abs(moving.x - top.x) <= PERFECT) {
        return { miss: false, perfect: true, placed: { x: top.x, w: top.w }, cut: null };
      }
      var start = Math.max(top.x, moving.x);
      var end = Math.min(top.x + top.w, moving.x + moving.w);
      var overlap = end - start;
      if (overlap <= 0) return { miss: true, perfect: false, placed: null, cut: { x: moving.x, w: moving.w } };
      var cut = moving.x < top.x
        ? { x: moving.x, w: top.x - moving.x }
        : { x: top.x + top.w, w: moving.x + moving.w - (top.x + top.w) };
      return { miss: false, perfect: false, placed: { x: start, w: overlap }, cut: cut };
    },
    // The sliding block gets faster as the tower grows
    slideSpeed: function (level) {
      return Math.min(150 + level * 6, 420);
    }
  };

  if (typeof module === 'object' && module.exports) { module.exports = logic; return; }

  // ---------- Game state ----------
  var tower, moving, debris, cam, camTarget, combo, flashes, hue0;

  function reset() {
    hue0 = Math.floor(Math.random() * 360);
    tower = [{ x: (W - BASE_W) / 2, w: BASE_W }];
    debris = [];
    flashes = [];
    combo = 0;
    cam = camTarget = 0;
    newMovingBlock();
  }

  function newMovingBlock() {
    var level = tower.length;
    var top = tower[tower.length - 1];
    var fromLeft = level % 2 === 1;
    moving = { x: fromLeft ? 0 : W - top.w, w: top.w, dir: fromLeft ? 1 : -1 };
    camTarget = Math.max(0, 220 - (GROUND_Y - (level + 1) * BH));
  }

  function colorFor(level, light) {
    return 'hsl(' + ((hue0 + level * 9) % 360) + ', 75%, ' + (light || 62) + '%)';
  }

  function screenY(level) { return GROUND_Y - (level + 1) * BH + cam; }

  function dropBlock(game) {
    var level = tower.length;
    var top = tower[tower.length - 1];
    var r = logic.drop(top, moving);

    if (r.miss) {
      debris.push({ x: moving.x, w: moving.w, y: screenY(level), vy: 0, rot: 0, spin: moving.dir * 1.5, level: level });
      moving = null;
      game.gameOver();
      return;
    }

    var placed = r.placed;
    if (r.perfect) {
      combo++;
      // Three perfect drops in a row make the block a little wider again
      if (combo >= 3 && placed.w < BASE_W) {
        var grow = Math.min(10, BASE_W - placed.w);
        placed = { x: Math.max(0, Math.min(W - placed.w - grow, placed.x - grow / 2)), w: placed.w + grow };
      }
      flashes.push({ level: level, x: placed.x, w: placed.w, t: 0 });
      game.sound.beep(520 + Math.min(combo, 12) * 70, 140, 'sine', 0.14);
    } else {
      combo = 0;
      debris.push({ x: r.cut.x, w: r.cut.w, y: screenY(level), vy: 0, rot: 0, spin: (r.cut.x > placed.x ? 1 : -1) * 1.2, level: level });
      game.sound.beep(330, 90, 'triangle', 0.12, 260);
    }

    tower.push(placed);
    game.addScore(1);
    newMovingBlock();
  }

  function update(dt, game) {
    if (moving) {
      moving.x += moving.dir * logic.slideSpeed(tower.length) * dt;
      if (moving.x <= 0) { moving.x = 0; moving.dir = 1; }
      if (moving.x + moving.w >= W) { moving.x = W - moving.w; moving.dir = -1; }
    }
    animate(dt);
  }

  // Falling pieces and the camera keep moving even after game over
  function animate(dt) {
    var oldCam = cam;
    cam += (camTarget - cam) * Math.min(1, dt * 6);
    for (var i = debris.length - 1; i >= 0; i--) {
      var d = debris[i];
      d.vy += 1400 * dt;
      d.y += d.vy * dt + (cam - oldCam);
      d.rot += d.spin * dt;
      if (d.y > H + 120) debris.splice(i, 1);
    }
    for (var f = flashes.length - 1; f >= 0; f--) {
      flashes[f].t += dt;
      if (flashes[f].t > 0.45) flashes.splice(f, 1);
    }
  }

  function idle(dt, game, state) {
    if (state !== 'paused') animate(dt);
  }

  // ---------- Drawing ----------
  function draw(ctx, game) {
    var height = tower.length;
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, 'hsl(' + ((hue0 + height * 9 + 200) % 360) + ', 45%, 20%)');
    bg.addColorStop(1, 'hsl(' + ((hue0 + height * 9 + 240) % 360) + ', 45%, 32%)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Big faint score behind the tower
    if (game.state !== 'start') {
      ctx.fillStyle = 'rgba(255,255,255,0.13)';
      ctx.font = '900 120px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(game.getScore()), W / 2, 120);
    }

    // Ground
    var gy = GROUND_Y + cam;
    if (gy < H) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, gy, W, H - gy);
    }

    // Tower (only the blocks on screen)
    for (var i = 0; i < tower.length; i++) {
      var y = screenY(i);
      if (y > H || y < -BH) continue;
      drawBlock(ctx, tower[i].x, y, tower[i].w, i);
    }

    // Perfect drop flash
    for (var f = 0; f < flashes.length; f++) {
      var fl = flashes[f], grow = fl.t * 40;
      ctx.strokeStyle = 'rgba(255,255,255,' + (1 - fl.t / 0.45) + ')';
      ctx.lineWidth = 3;
      roundRect(ctx, fl.x - grow, screenY(fl.level) - grow, fl.w + grow * 2, BH + grow * 2, 6 + grow / 2);
      ctx.stroke();
    }

    // Sliding block
    if (moving && game.state !== 'start') drawBlock(ctx, moving.x, screenY(tower.length), moving.w, tower.length);

    // Falling pieces
    for (var d = 0; d < debris.length; d++) {
      var p = debris[d];
      ctx.save();
      ctx.translate(p.x + p.w / 2, p.y + BH / 2);
      ctx.rotate(p.rot);
      drawBlock(ctx, -p.w / 2, -BH / 2, p.w, p.level);
      ctx.restore();
    }

    if (game.state === 'playing' && tower.length === 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Tap or Space to drop', W / 2, GROUND_Y + 40 + cam);
    }
  }

  function drawBlock(ctx, x, y, w, level) {
    ctx.fillStyle = colorFor(level);
    roundRect(ctx, x, y, w, BH, 5);
    ctx.fill();
    ctx.fillStyle = colorFor(level, 72);
    ctx.fillRect(x + 4, y + 3, Math.max(0, w - 8), 4);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x + 3, y + BH - 5, Math.max(0, w - 6), 3);
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  Arcade.createGame({
    id: 'stack',
    width: W,
    height: H,
    reset: reset,
    update: update,
    idle: idle,
    draw: draw,
    onPress: dropBlock
  });
})();
