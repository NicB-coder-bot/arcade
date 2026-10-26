/* Memory Match: flip two cards at a time and find all the pairs. */
(function () {
  'use strict';

  var SYMBOLS = ['🐶', '🍕', '🚀', '🎸', '🌈', '🐙', '⚽', '🍩'];
  var POINTS_PER_MATCH = 10;
  var BEST_KEY = 'arcade.memory.best';

  // Pure game rules, also used by the tests
  var logic = {
    SYMBOLS: SYMBOLS,
    POINTS_PER_MATCH: POINTS_PER_MATCH,

    // Fisher-Yates shuffle (rng is a function that gives a number from 0 up to 1)
    shuffle: function (list, rng) {
      var a = list.slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor((rng || Math.random)() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    },

    // A fresh round: every symbol twice, mixed up, all face down
    newGame: function (rng) {
      var symbols = logic.shuffle(SYMBOLS.concat(SYMBOLS), rng);
      return {
        cards: symbols.map(function (s) { return { symbol: s, faceUp: false, matched: false }; }),
        first: -1,      // index of the first card flipped in this turn, or -1
        pending: null,  // [a, b] when two cards are showing and don't match
        score: 0,
        moves: 0,
        won: false
      };
    },

    // Flip one card. Returns 'ignored', 'first', 'match' or 'miss'.
    flip: function (game, i) {
      var card = game.cards[i];
      if (!card || game.won || game.pending || card.faceUp || card.matched) return 'ignored';
      card.faceUp = true;
      if (game.first < 0) { game.first = i; return 'first'; }

      var a = game.first;
      game.first = -1;
      game.moves++;
      if (game.cards[a].symbol === card.symbol) {
        game.cards[a].matched = card.matched = true;
        game.score += POINTS_PER_MATCH;
        game.won = game.cards.every(function (c) { return c.matched; });
        return 'match';
      }
      game.pending = [a, i];
      return 'miss';
    },

    // Turn a wrong pair face down again
    hideMiss: function (game) {
      if (!game.pending) return;
      game.pending.forEach(function (i) { game.cards[i].faceUp = false; });
      game.pending = null;
    }
  };

  if (typeof module === 'object' && module.exports) { module.exports = logic; return; }

  // ---------- Page code ----------
  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $('board'), scoreEl = $('score'), movesEl = $('moves'), bestEl = $('best');
  var winEl = $('winScreen');
  var game, buttons = [], missTimer = null, winTimer = null, best = 0;

  function readBest() {
    try { best = parseInt(window.localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) { best = 0; }
  }
  function saveBest() {
    try { window.localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* storage blocked */ }
  }

  function build() {
    boardEl.innerHTML = '';
    buttons = game.cards.map(function (card, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tile';
      b.innerHTML = '<span class="tile-inner"><span class="tile-face tile-back">?</span>' +
        '<span class="tile-face tile-front">' + card.symbol + '</span></span>';
      b.dataset.index = i;
      boardEl.appendChild(b);
      return b;
    });
    render();
  }

  function render() {
    game.cards.forEach(function (card, i) {
      var b = buttons[i];
      b.classList.toggle('up', card.faceUp);
      b.classList.toggle('done', card.matched);
      b.setAttribute('aria-label', card.faceUp ? card.symbol : 'Hidden card ' + (i + 1));
    });
    scoreEl.textContent = game.score;
    movesEl.textContent = game.moves;
    bestEl.textContent = best || '-';
  }

  function onTap(i) {
    var result = logic.flip(game, i);
    if (result === 'ignored') return;
    if (result === 'miss') {
      missTimer = setTimeout(function () { missTimer = null; logic.hideMiss(game); render(); }, 900);
    } else if (result === 'match' && game.won) {
      win();
    }
    render();
  }

  // "Best" is the fewest moves it took to finish (the score is the same every win)
  function win() {
    var isNewBest = best === 0 || game.moves < best;
    if (isNewBest) { best = game.moves; saveBest(); }
    $('finalScore').textContent = game.score;
    $('finalMoves').textContent = 'You finished in ' + game.moves + ' moves';
    $('newBest').hidden = !isNewBest;
    winTimer = setTimeout(function () { winEl.hidden = false; $('againBtn').focus({ preventScroll: true }); }, 700);
  }

  function startGame() {
    // A restart must cancel anything still waiting to happen from the last round
    clearTimeout(missTimer);
    clearTimeout(winTimer);
    missTimer = winTimer = null;
    winEl.hidden = true;
    game = logic.newGame();
    build();
  }

  // One listener for the whole board instead of one per card
  boardEl.addEventListener('click', function (e) {
    var tile = e.target.closest('.tile');
    if (tile) onTap(Number(tile.dataset.index));
  });

  readBest();
  $('againBtn').addEventListener('click', startGame);
  $('restartBtn').addEventListener('click', startGame);
  startGame();
})();
