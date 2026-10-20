# Research: Arcade website with 4 games

## Goal
A no-build, no-library website (open `index.html` directly) with a home page of 4 game cards and 4 game pages (Flappy, Snake, Ski, Stack), all sharing one look, all working on laptop and phone.

## What exists today
- Repo only has `README.md` (one line) and one commit. No code, no tests, no config. Everything is new.

## Key facts (with links)
- **Opening via `file://` works only if nothing needs a server.** Avoid `fetch()`, ES module `<script type="module">` and `import` (browsers block modules on `file://` because of CORS). Use plain `<script src="...">` tags. Relative links only. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules
- **Canvas 2D** is the right tool for all four games and for the card preview drawings (draw the previews with small canvases or inline SVG, no images). https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
- **Game loop:** use `requestAnimationFrame` and a time delta (`dt` in seconds) so speed is the same on 60Hz and 120Hz screens. Clamp `dt` (e.g. max 0.05s) so a tab switch doesn't make things teleport. https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
- **Sharp canvas on phones:** size the canvas backing store by `devicePixelRatio` (cap at 2 for speed) and scale the context; keep game logic in a fixed "logical" size. https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
- **Touch/mouse in one code path:** use Pointer Events (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`). Set CSS `touch-action: none` on the canvas so the browser doesn't scroll/zoom while playing. https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events and https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
- **Sound with no files:** Web Audio API `OscillatorNode` + `GainNode` makes beeps. Browsers keep audio locked until a user gesture, so create/resume the `AudioContext` on the first tap/click/key (the Play button is perfect). https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API and https://developer.mozilla.org/en-US/docs/Web/Media/Autoplay_guide
- **Saved best score:** `localStorage` (works on `file://` in Chrome/Safari/Firefox, but wrap in try/catch because private mode or blocked storage throws). Note: on `file://` Chrome shares storage per-file-origin, so use unique key names like `arcade.flappy.best`. https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
- **Pause when tab hidden:** listen to `visibilitychange` and auto-pause. https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event
- **Phone layout:** `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, use `100dvh` (not `100vh`, which is wrong behind mobile browser bars), and `env(safe-area-inset-*)` padding. https://developer.mozilla.org/en-US/docs/Web/CSS/length#dynamic_viewport_units
- **Swipe detection:** record `pointerdown` x/y, on `pointerup` (or when movement passes ~24px) compare `dx` and `dy`; larger axis wins. Works the same for mouse drags.
- **Reduced motion / accessibility:** respect `prefers-reduced-motion` for page transitions; make buttons real `<button>`/`<a>` with focus outlines and 44px+ touch targets.

## Recommended approach

### File layout (flat and simple)
```
index.html            home: 4 cards
flappy.html  snake.html  ski.html  stack.html
css/style.css         shared look (cards, buttons, overlays, HUD)
js/common.js          shared helpers (see below), loaded by every page
js/flappy.js  js/snake.js  js/ski.js  js/stack.js
```
No JS modules; each game page loads `common.js` first, then its own script. Keep one global namespace object (e.g. `window.Arcade`).

### Shared helpers in `common.js` (so all games behave identically)
- `Arcade.setupCanvas(canvas, logicalW, logicalH)` – resize + DPR + letterbox on window resize/rotate.
- `Arcade.loop(update, draw)` – rAF loop with clamped `dt`; supports pause/resume.
- `Arcade.storage.getBest(game)` / `setBest(game, n)` – safe localStorage.
- `Arcade.sound` – `beep(freq, ms, type)`, `isOn()`, `toggle()`; mute state saved in localStorage (shared across games). Make the mute toggle work even before the audio context exists.
- `Arcade.ui` – wires the standard overlays/buttons: start screen, game-over screen ("Play again"), pause button + paused overlay, sound toggle, score / best display. Each game just calls `onStart`, `onReset`, and reports `setScore(n)` / `gameOver()`.
- Keyboard: `P` or `Esc` toggles pause, `Enter`/`Space` starts. Prevent default on arrows and Space so the page doesn't scroll.

### Shared page markup
Every game page: header bar (Back to arcade link, game title, score, best, pause button, sound button), a centered `<canvas>`, and overlay `<div>`s for start / paused / game over. Use CSS variables for colors, radius, spacing so the whole site is one theme (dark navy background, bright accent per game, large rounded corners, system font stack, no web fonts to download).

### Home page
CSS grid: 2x2 on laptop, 1 column (or 2 narrow) on phones, `grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))`. Each card: rounded (~24px), a small preview (inline SVG or a tiny canvas drawing each game's look), name, and a "Play" link styled as a button. Optionally show the saved best score on the card (reads localStorage).

### Per-game design notes
- **Flappy:** fixed logical size (e.g. 400x600). Gravity ~1400 px/s², flap sets velocity to about -420 px/s. Pipe speed ~150 px/s, gap ~150-170px, new pipe every ~1.5s; random gap center kept away from edges. Input: Space, click, tap (pointerdown) all call flap. Score +1 when the bird passes a pipe. Use circle-vs-rectangle collision, shrink the hitbox slightly so it feels fair. Cap fall speed.
- **Snake:** grid (e.g. 20x20 cells). Move on a timer (tick interval starts ~140ms, decreases ~3-4ms per food, floor ~60ms), not every frame. Queue up to 2 direction inputs so quick turns aren't lost, and block 180° reversals. Arrow keys (also WASD) + swipe. Place food only on empty cells. Walls kill (simplest, clear rule); mention choice in UI.
- **Ski:** vertical scrolling world; skier at fixed y near the top third, obstacles scroll up. Steering left/right changes x velocity smoothly (ease, not instant). Speed starts ~200 px/s and ramps up with time (cap it), spawn rate scales with speed. Obstacles: trees, rocks, other skiers (these move sideways a little). Always leave a passable gap when spawning rows (check there is at least one free lane wider than the skier). Phone control: hold left half = go left, right half = go right (pointer position vs. canvas center; support multi-touch by tracking active pointers). Score = distance. Use forgiving (smaller) hitboxes. Draw all with canvas shapes.
- **Stack:** blocks slide horizontally; tap/click/Space drops. Overlap = new width; if overlap <= 0 game over; if the drop is within a few px of perfect, snap and keep the width (bonus feel, optional width regrow). Cut-off piece falls away with simple gravity animation. When the tower gets high, scroll the camera down so the top stays visible. Slide speed increases slowly. Score = number of blocks placed. Color shifts per level via HSL hue.

### Build order suggestion
1. `style.css` + `common.js` + `index.html` (cards with previews).
2. One game end to end (Flappy) to prove the shared UI/overlays/pause/sound/best-score flow.
3. Snake, Stack, Ski using the same helpers.
4. Polish: responsive checks, keyboard focus, reduced motion.

## Things to watch out for
- **No `fetch`, no modules, no external URLs** (fonts, CDNs, images). Everything must work from `file://`.
- **Pause must truly stop the game:** stop timers and the rAF update; resume must reset the "last frame time" or `dt` will be huge and cause a jump.
- **Page scrolling on phones:** arrows/Space scroll the page and touches pan/zoom unless prevented. Use `touch-action: none` on the canvas and `preventDefault()` on game keys. Also set `user-select: none` and `-webkit-tap-highlight-color: transparent`.
- **Double-firing input:** if you listen to both `touchstart` and `click`, one tap flaps twice. Use pointer events only.
- **Audio:** will be silent until a user gesture; iOS Safari also respects the silent switch for some audio. Don't crash if `AudioContext` is missing (wrap in try/catch). Muted state must persist and be respected from the first sound.
- **localStorage errors** on blocked storage: always try/catch and fall back to in-memory best score.
- **Don't let the start tap count as a flap/drop:** the tap that presses "Play" must not also trigger the first action of the game.
- **Resizing/rotation:** recompute canvas size on `resize` and `orientationchange`; keep logical coordinates fixed so game physics don't change with window size.
- **Performance on phones:** avoid creating objects every frame, cap DPR at 2, reuse arrays, no heavy shadows/blur.
- **Fairness:** generous hitboxes, guaranteed gaps (Ski, Flappy), and a short grace moment after "Play" before obstacles reach the player.
- **Reaching game over twice:** make sure "Play again" fully resets state and does not stack a second rAF loop or duplicate event listeners (the most common bug in this kind of project).
- **Best score only saved when it is beaten**; show "New best!" on game over.
- **Consistent look:** keep every color/radius/shadow in CSS variables in the one shared stylesheet; game pages must not add their own styling beyond canvas content.
- **Testing without a framework:** keep pure logic (collision, overlap cut for Stack, snake step, swipe direction) in small functions so they can be checked quickly in Node or the browser console. For the final check, open each page in a browser at a laptop size and a phone size (devtools device mode) and play each game through start -> game over -> Play again.
