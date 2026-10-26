// Beat Maker: 8 drum pads and a 16-step loop.
// All sounds are made with the Web Audio API, no sound files needed.
(function () {
  'use strict';

  // ---------- Rules (plain functions, checked in tests/logic.test.js) ----------
  var logic = {
    TRACKS: [
      { id: 'kick',    name: 'Kick',    key: '1' },
      { id: 'snare',   name: 'Snare',   key: '2' },
      { id: 'hihat',   name: 'Hi-hat',  key: '3' },
      { id: 'clap',    name: 'Clap',    key: '4' },
      { id: 'tom',     name: 'Tom',     key: '5' },
      { id: 'cymbal',  name: 'Cymbal',  key: '6' },
      { id: 'cowbell', name: 'Cowbell', key: '7' },
      { id: 'shaker',  name: 'Shaker',  key: '8' }
    ],
    STEPS: 16,
    MIN_BPM: 60,
    MAX_BPM: 180,
    DEFAULT_BPM: 100,

    clampBpm: function (bpm) {
      bpm = Math.round(Number(bpm));
      if (!isFinite(bpm)) return logic.DEFAULT_BPM;
      return Math.min(logic.MAX_BPM, Math.max(logic.MIN_BPM, bpm));
    },
    // Each step is a 16th note: four steps per beat.
    stepSeconds: function (bpm) {
      return 60 / logic.clampBpm(bpm) / 4;
    },
    emptyPattern: function () {
      return logic.TRACKS.map(function () {
        var row = [];
        for (var i = 0; i < logic.STEPS; i++) row.push(false);
        return row;
      });
    },
    isEmpty: function (pattern) {
      return pattern.every(function (row) { return row.indexOf(true) === -1; });
    },
    // A simple starter beat so pressing Play does something right away.
    starterPattern: function () {
      var p = logic.emptyPattern();
      [0, 8].forEach(function (s) { p[0][s] = true; });            // kick
      [4, 12].forEach(function (s) { p[1][s] = true; });           // snare
      for (var s = 0; s < 16; s += 2) p[2][s] = true;              // hi-hat
      p[3][12] = true;                                              // clap
      return p;
    },
    // Turn saved text back into a pattern. Anything broken gives null.
    readPattern: function (text) {
      try {
        var data = JSON.parse(text);
        if (!Array.isArray(data) || data.length !== logic.TRACKS.length) return null;
        for (var t = 0; t < data.length; t++) {
          if (!Array.isArray(data[t]) || data[t].length !== logic.STEPS) return null;
        }
        return data.map(function (row) { return row.map(function (v) { return v === true; }); });
      } catch (e) {
        return null;
      }
    }
  };

  if (typeof module === 'object' && module.exports) { module.exports = logic; return; }

  // ---------- Saving on this device ----------
  var SAVE_KEY = 'arcade.beats.pattern';
  var TEMPO_KEY = 'arcade.beats.tempo';
  function load(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function save(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }

  var pattern = logic.readPattern(load(SAVE_KEY)) || logic.starterPattern();
  var bpm = logic.clampBpm(load(TEMPO_KEY) || logic.DEFAULT_BPM);

  // ---------- Sounds ----------
  var ctx = null, master = null, noise = null;

  function audio() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(ctx.destination);
      // One second of white noise, reused by every noisy drum
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var data = noise.getChannelData(0);
      for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function envelope(t, peak, length) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    g.connect(master);
    return g;
  }
  function tone(type, t, from, to, slide, peak, length) {
    var o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    if (to !== from) o.frequency.exponentialRampToValueAtTime(to, t + slide);
    o.connect(envelope(t, peak, length));
    o.start(t);
    o.stop(t + length + 0.05);
  }
  function hiss(t, filterType, freq, peak, length) {
    var src = ctx.createBufferSource();
    src.buffer = noise;
    var f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    src.connect(f);
    f.connect(envelope(t, peak, length));
    src.start(t);
    src.stop(t + length + 0.05);
  }

  var drums = {
    kick: function (t) { tone('sine', t, 160, 42, 0.12, 1, 0.45); },
    snare: function (t) { tone('triangle', t, 220, 160, 0.08, 0.5, 0.12); hiss(t, 'highpass', 1200, 0.6, 0.18); },
    hihat: function (t) { hiss(t, 'highpass', 7500, 0.45, 0.05); },
    clap: function (t) {
      [0, 0.012, 0.024].forEach(function (d) { hiss(t + d, 'bandpass', 1400, 0.8, 0.03); });
      hiss(t + 0.036, 'bandpass', 1400, 0.7, 0.16);
    },
    tom: function (t) { tone('sine', t, 230, 110, 0.25, 0.9, 0.35); },
    cymbal: function (t) { hiss(t, 'highpass', 5500, 0.4, 1.2); tone('square', t, 810, 810, 0, 0.04, 0.6); },
    cowbell: function (t) { tone('square', t, 540, 540, 0, 0.18, 0.28); tone('square', t, 800, 800, 0, 0.14, 0.28); },
    shaker: function (t) { hiss(t, 'bandpass', 6000, 0.35, 0.09); }
  };

  function playDrum(track, when) {
    if (!audio()) return;
    drums[logic.TRACKS[track].id](when || ctx.currentTime);
  }

  // ---------- Pads ----------
  var padEls = [];
  var padGrid = document.getElementById('pads');

  function flash(el) {
    el.classList.remove('hit');
    void el.offsetWidth; // restart the glow animation
    el.classList.add('hit');
  }
  function hitPad(track) {
    playDrum(track);
    flash(padEls[track]);
  }

  logic.TRACKS.forEach(function (tr, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pad pad-' + tr.id;
    b.innerHTML = '<span class="pad-name">' + tr.name + '</span><span class="pad-key">' + tr.key + '</span>';
    b.setAttribute('aria-label', 'Play ' + tr.name);
    // pointerdown is instant on phones, and lets two fingers drum at once
    b.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      e.preventDefault();
      hitPad(i);
    });
    // Keyboard Enter on a focused pad (mouse and touch already played on pointerdown)
    b.addEventListener('click', function (e) { if (e.detail === 0) hitPad(i); });
    b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    padGrid.appendChild(b);
    padEls.push(b);
  });

  // ---------- 16-step loop grid ----------
  var stepEls = [];
  var seqGrid = document.getElementById('sequencer');

  logic.TRACKS.forEach(function (tr, t) {
    var row = document.createElement('div');
    row.className = 'track track-' + tr.id;
    var label = document.createElement('div');
    label.className = 'track-name';
    label.textContent = tr.name;
    row.appendChild(label);
    var cells = document.createElement('div');
    cells.className = 'steps';
    stepEls.push([]);
    for (var s = 0; s < logic.STEPS; s++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'step' + (Math.floor(s / 4) % 2 ? ' alt' : '');
      b.setAttribute('aria-label', tr.name + ' step ' + (s + 1));
      b.dataset.track = t;
      b.dataset.step = s;
      cells.appendChild(b);
      stepEls[t].push(b);
    }
    row.appendChild(cells);
    seqGrid.appendChild(row);
  });

  function drawPattern() {
    for (var t = 0; t < stepEls.length; t++) {
      for (var s = 0; s < logic.STEPS; s++) {
        stepEls[t][s].classList.toggle('on', pattern[t][s]);
        stepEls[t][s].setAttribute('aria-pressed', pattern[t][s] ? 'true' : 'false');
      }
    }
    clearBtn.disabled = logic.isEmpty(pattern);
  }
  function savePattern() { save(SAVE_KEY, JSON.stringify(pattern)); }

  seqGrid.addEventListener('click', function (e) {
    var b = e.target.closest('.step');
    if (!b) return;
    var t = +b.dataset.track, s = +b.dataset.step;
    pattern[t][s] = !pattern[t][s];
    // Let you hear the sound you just switched on (unless the loop is playing it anyway)
    if (pattern[t][s] && !playing) playDrum(t);
    hideUndo();
    drawPattern();
    savePattern();
  });

  // ---------- Playing the loop ----------
  // A small "look ahead" timer schedules sounds slightly early so the beat stays steady.
  var playing = false, timer = null, nextStep = 0, nextTime = 0;
  var shown = []; // { step, time } waiting to be lit up on screen
  var playBtn = document.getElementById('play');

  function schedule() {
    while (nextTime < ctx.currentTime + 0.12) {
      for (var t = 0; t < pattern.length; t++) {
        if (pattern[t][nextStep]) playDrum(t, nextTime);
      }
      shown.push({ step: nextStep, time: nextTime });
      nextTime += logic.stepSeconds(bpm);
      nextStep = (nextStep + 1) % logic.STEPS;
    }
  }

  var litStep = -1;
  function light(step) {
    if (step === litStep) return;
    for (var t = 0; t < stepEls.length; t++) {
      if (litStep >= 0) stepEls[t][litStep].classList.remove('now');
      if (step >= 0) {
        stepEls[t][step].classList.add('now');
        if (pattern[t][step]) flash(padEls[t]);
      }
    }
    litStep = step;
  }
  function animate() {
    if (!playing) return;
    while (shown.length && shown[0].time <= ctx.currentTime) light(shown.shift().step);
    requestAnimationFrame(animate);
  }

  function start() {
    if (playing || !audio()) return;
    playing = true;
    nextStep = 0;
    nextTime = ctx.currentTime + 0.06;
    shown = [];
    schedule();
    timer = setInterval(schedule, 25);
    requestAnimationFrame(animate);
    playBtn.classList.add('playing');
    playBtn.querySelector('.label').textContent = 'Stop';
    playBtn.setAttribute('aria-label', 'Stop the loop');
  }
  function stop() {
    if (!playing) return;
    playing = false;
    clearInterval(timer);
    shown = [];
    light(-1);
    playBtn.classList.remove('playing');
    playBtn.querySelector('.label').textContent = 'Play';
    playBtn.setAttribute('aria-label', 'Play the loop');
  }
  playBtn.addEventListener('click', function () { playing ? stop() : start(); });

  // Browsers slow timers in hidden tabs, which makes the beat stumble, so stop instead.
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); });

  // ---------- Tempo ----------
  var tempo = document.getElementById('tempo');
  var tempoOut = document.getElementById('tempo-value');
  tempo.min = logic.MIN_BPM;
  tempo.max = logic.MAX_BPM;
  tempo.value = bpm;
  tempoOut.textContent = bpm;
  tempo.addEventListener('input', function () {
    bpm = logic.clampBpm(tempo.value);
    tempoOut.textContent = bpm;
    save(TEMPO_KEY, String(bpm));
  });

  // ---------- Clear (with a short chance to undo) ----------
  var clearBtn = document.getElementById('clear');
  var undoBar = document.getElementById('undo-bar');
  var undoBtn = document.getElementById('undo');
  var saved = null, undoTimer = null;

  function hideUndo() {
    clearTimeout(undoTimer);
    undoBar.hidden = true;
    saved = null;
  }
  clearBtn.addEventListener('click', function () {
    saved = pattern;
    pattern = logic.emptyPattern();
    drawPattern();
    savePattern();
    undoBar.hidden = false;
    clearTimeout(undoTimer);
    undoTimer = setTimeout(hideUndo, 6000);
  });
  undoBtn.addEventListener('click', function () {
    if (saved) pattern = saved;
    hideUndo();
    drawPattern();
    savePattern();
  });

  // ---------- Keyboard: 1-8 play pads, Space plays / stops ----------
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === ' ') {
      e.preventDefault();
      if (!e.repeat) playing ? stop() : start();
      return;
    }
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= 8 && !e.repeat) hitPad(n - 1);
  });

  drawPattern();
})();
