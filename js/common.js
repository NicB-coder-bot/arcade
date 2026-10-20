/* ==========================================================
   Arcade shared helpers, loaded by every game page.
   Each game calls Arcade.createGame({...}) and this file takes
   care of the canvas size, the game loop, the start / pause /
   game over screens, the score, the best score and the sound.
   ========================================================== */
(function () {
  'use strict';

  // ---------- Small pure helpers (also used by the tests) ----------
  var util = {
    clamp: function (v, min, max) { return v < min ? min : v > max ? max : v; },

    rand: function (min, max) { return min + Math.random() * (max - min); },

    // Does a circle touch a rectangle?
    circleHitsRect: function (cx, cy, r, rx, ry, rw, rh) {
      var nx = util.clamp(cx, rx, rx + rw);
      var ny = util.clamp(cy, ry, ry + rh);
      var dx = cx - nx, dy = cy - ny;
      return dx * dx + dy * dy < r * r;
    },

    // Do two circles touch?
    circlesHit: function (ax, ay, ar, bx, by, br) {
      var dx = ax - bx, dy = ay - by, r = ar + br;
      return dx * dx + dy * dy < r * r;
    },

    // Turns a finger movement into 'up' | 'down' | 'left' | 'right', or null if it was too small
    swipeDirection: function (dx, dy, minDistance) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < (minDistance || 24)) return null;
      if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
      return dy > 0 ? 'down' : 'up';
    }
  };

  // Let Node load this file for the tests
  if (typeof module === 'object' && module.exports) {
    module.exports = util;
    return;
  }

  // ---------- Saved data (best scores, sound setting) ----------
  var memory = {};
  var storage = {
    get: function (key, fallback) {
      try {
        var v = window.localStorage.getItem('arcade.' + key);
        return v === null ? fallback : v;
      } catch (e) {
        return key in memory ? memory[key] : fallback;
      }
    },
    set: function (key, value) {
      memory[key] = String(value);
      try { window.localStorage.setItem('arcade.' + key, String(value)); } catch (e) { /* storage blocked: keep it in memory */ }
    }
  };

  function getBest(game) {
    var n = parseInt(storage.get(game + '.best', '0'), 10);
    return isNaN(n) ? 0 : n;
  }

  // ---------- Sound: little beeps made with Web Audio, no files ----------
  var audioCtx = null;
  var soundOn = storage.get('sound', 'on') !== 'off';

  function unlockAudio() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { audioCtx = new AC(); } catch (e) { return; }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  var sound = {
    isOn: function () { return soundOn; },
    setOn: function (on) {
      soundOn = on;
      storage.set('sound', on ? 'on' : 'off');
    },
    // beep(start pitch, length in ms, wave type, volume, end pitch)
    beep: function (freq, ms, type, volume, endFreq) {
      if (!soundOn || !audioCtx || audioCtx.state !== 'running') return;
      try {
        var t = audioCtx.currentTime;
        var dur = ms / 1000;
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, t);
        if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
        gain.gain.setValueAtTime(volume || 0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      } catch (e) { /* never let a sound break the game */ }
    },
    // A few ready-made sounds every game can share
    point: function () { sound.beep(880, 90, 'square', 0.07); setTimeout(function () { sound.beep(1320, 110, 'square', 0.06); }, 70); },
    crash: function () { sound.beep(220, 400, 'sawtooth', 0.14, 50); },
    start: function () { sound.beep(520, 90, 'triangle', 0.12); setTimeout(function () { sound.beep(780, 120, 'triangle', 0.12); }, 90); }
  };

  // Any first tap or key press unlocks sound (browsers need that)
  ['pointerdown', 'keydown', 'touchend'].forEach(function (type) {
    window.addEventListener(type, unlockAudio, { capture: true, passive: true });
  });

  // ---------- Icons for the pause and sound buttons ----------
  var ICONS = {
    pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
    soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6"/></svg>'
  };

  function $(id) { return document.getElementById(id); }

  // ---------- The main helper: sets up one game page ----------
  // options: id, width, height, reset(), update(dt), draw(ctx),
  // and optional input handlers: onPress(), onKeyDown(e), onKeyUp(e),
  // onPointerDown(p), onPointerMove(p), onPointerUp(p)
  function createGame(options) {
    var W = options.width, H = options.height;
    var canvas = $('game');
    var frame = $('frame');
    var stage = $('stage');
    var ctx = canvas.getContext('2d');

    var state = 'start'; // 'start' | 'playing' | 'paused' | 'over'
    var score = 0;
    var best = getBest(options.id);
    var overAt = 0;

    var scoreEl = $('score'), bestEl = $('best');
    var startScreen = $('startScreen'), pauseScreen = $('pauseScreen'), overScreen = $('overScreen');
    var pauseBtn = $('pauseBtn'), soundBtn = $('soundBtn');

    var game = {
      W: W,
      H: H,
      time: 0, // seconds since this round started
      sound: sound,
      util: util,
      get state() { return state; },
      setScore: setScore,
      addScore: function (n) { setScore(score + (n || 1)); },
      getScore: function () { return score; },
      gameOver: gameOver
    };

    // --- Canvas size: fit the logical game size into the space we have, sharp on phones ---
    var viewScale = 1;
    function resize() {
      var availW = stage.clientWidth - parseFloat(getComputedStyle(stage).paddingLeft) - parseFloat(getComputedStyle(stage).paddingRight);
      var availH = stage.clientHeight - parseFloat(getComputedStyle(stage).paddingBottom);
      viewScale = Math.max(0.1, Math.min(availW / W, availH / H));
      var cssW = Math.floor(W * viewScale), cssH = Math.floor(H * viewScale);
      frame.style.width = cssW + 'px';
      frame.style.height = cssH + 'px';
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
      draw();
    }
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 150); });

    // --- Score and best ---
    function setScore(n) {
      score = n;
      scoreEl.textContent = score;
    }
    function showBest() { bestEl.textContent = best; }

    // --- Screens ---
    function show(el, visible) { el.hidden = !visible; }

    function start() {
      if (state !== 'start' && state !== 'over') return;
      if (state === 'over' && performance.now() - overAt < 450) return; // stops an accidental double tap
      setScore(0);
      game.time = 0;
      options.reset(game);
      state = 'playing';
      show(startScreen, false);
      show(overScreen, false);
      show(pauseScreen, false);
      pauseBtn.disabled = false;
      sound.start();
      canvas.focus({ preventScroll: true });
    }

    function pause() {
      if (state !== 'playing') return;
      state = 'paused';
      show(pauseScreen, true);
      updatePauseButton();
      $('resumeBtn').focus({ preventScroll: true });
    }

    function resume() {
      if (state !== 'paused') return;
      state = 'playing';
      show(pauseScreen, false);
      updatePauseButton();
      canvas.focus({ preventScroll: true });
    }

    function gameOver() {
      if (state !== 'playing') return;
      state = 'over';
      overAt = performance.now();
      sound.crash();
      var isNewBest = score > best;
      if (isNewBest) {
        best = score;
        storage.set(options.id + '.best', best);
        showBest();
      }
      $('finalScore').textContent = score;
      $('finalBest').textContent = 'Best: ' + best;
      show($('newBest'), isNewBest);
      show(overScreen, true);
      updatePauseButton();
      setTimeout(function () {
        if (state === 'over') $('againBtn').focus({ preventScroll: true });
      }, 500);
    }

    function updatePauseButton() {
      var paused = state === 'paused';
      pauseBtn.innerHTML = paused ? ICONS.play : ICONS.pause;
      pauseBtn.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
      pauseBtn.title = paused ? 'Resume (P)' : 'Pause (P)';
      pauseBtn.disabled = !(state === 'playing' || state === 'paused');
    }

    function updateSoundButton() {
      var on = sound.isOn();
      soundBtn.innerHTML = on ? ICONS.soundOn : ICONS.soundOff;
      soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      soundBtn.setAttribute('aria-label', on ? 'Sound is on' : 'Sound is off');
      soundBtn.title = on ? 'Sound on (M)' : 'Sound off (M)';
    }

    function toggleSound() {
      sound.setOn(!sound.isOn());
      updateSoundButton();
      sound.beep(660, 80, 'triangle', 0.1);
      // Give the keyboard back to the game so Space doesn't press this button again
      if (state === 'playing') canvas.focus({ preventScroll: true });
    }

    $('playBtn').addEventListener('click', start);
    $('againBtn').addEventListener('click', start);
    $('resumeBtn').addEventListener('click', resume);
    pauseBtn.addEventListener('click', function () { state === 'paused' ? resume() : pause(); });
    soundBtn.addEventListener('click', toggleSound);

    // --- Keyboard ---
    var GAME_KEYS = [' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    window.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var key = e.key;
      var onButton = document.activeElement && document.activeElement.tagName === 'BUTTON';
      var onLink = document.activeElement && document.activeElement.tagName === 'A';

      if (key === 'm' || key === 'M') { toggleSound(); return; }

      if (key === 'p' || key === 'P' || key === 'Escape') {
        if (state === 'playing') pause();
        else if (state === 'paused') resume();
        e.preventDefault();
        return;
      }

      if (state === 'start' || state === 'over') {
        // Let Enter / Space work normally on the Back link and other buttons
        if (onLink || (onButton && document.activeElement.id !== 'playBtn' && document.activeElement.id !== 'againBtn')) return;
        if ((key === ' ' || key === 'Enter') && !e.repeat) {
          e.preventDefault();
          start();
        } else if (GAME_KEYS.indexOf(key) >= 0) {
          e.preventDefault();
        }
        return;
      }

      if (state === 'paused') {
        if (key === ' ' || key === 'Enter') { e.preventDefault(); resume(); }
        return;
      }

      // Playing
      if (GAME_KEYS.indexOf(key) >= 0) e.preventDefault();
      if (options.onKeyDown) options.onKeyDown(e, game);
      if (key === ' ' && !e.repeat && options.onPress) options.onPress(game);
    });

    window.addEventListener('keyup', function (e) {
      // Always pass key releases on, so a key let go during the pause isn't stuck down
      if (options.onKeyUp) options.onKeyUp(e, game);
    });

    // --- Pointer (mouse, finger and pen all in one) ---
    function toGame(e) {
      var rect = canvas.getBoundingClientRect();
      return {
        id: e.pointerId,
        x: (e.clientX - rect.left) / rect.width * W,
        y: (e.clientY - rect.top) / rect.height * H
      };
    }
    // Listen on the whole game area (not just the canvas) so taps and
    // swipes in the empty space around the game work too
    stage.addEventListener('pointerdown', function (e) {
      if (state !== 'playing') return;
      e.preventDefault();
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
      if (options.onPointerDown) options.onPointerDown(toGame(e), game);
      if (options.onPress) options.onPress(game);
    });
    stage.addEventListener('pointermove', function (e) {
      if (state === 'playing' && options.onPointerMove) options.onPointerMove(toGame(e), game);
    });
    function pointerEnd(e) {
      if (options.onPointerUp) options.onPointerUp(toGame(e), game);
    }
    stage.addEventListener('pointerup', pointerEnd);
    stage.addEventListener('pointercancel', pointerEnd);
    stage.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // Pause by itself when you switch tabs or apps
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pause();
    });
    window.addEventListener('blur', pause);

    // --- One game loop for the whole page (never started twice) ---
    var last = performance.now();
    function draw() { options.draw(ctx, game); }
    function frameLoop(now) {
      var dt = Math.min((now - last) / 1000, 0.05); // never jump after a slow frame
      last = now;
      if (state === 'playing') {
        game.time += dt;
        options.update(dt, game);
      } else if (options.idle) {
        options.idle(dt, game, state);
      }
      // While paused nothing moves, so skip redrawing (saves battery on phones)
      if (state !== 'paused') draw();
      requestAnimationFrame(frameLoop);
    }

    // --- Go! ---
    canvas.tabIndex = -1;
    options.reset(game);
    showBest();
    setScore(0);
    updatePauseButton();
    updateSoundButton();
    resize();
    requestAnimationFrame(function (now) { last = now; frameLoop(now); });
    setTimeout(function () { $('playBtn').focus({ preventScroll: true }); }, 50);

    return game;
  }

  window.Arcade = {
    util: util,
    storage: storage,
    sound: sound,
    getBest: getBest,
    createGame: createGame
  };
})();
