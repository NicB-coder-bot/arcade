# Arcade

Four quick games in plain HTML, CSS and JavaScript. No libraries, no images, no setup:
just open `index.html` in a browser.

| Game | Laptop | Phone |
| --- | --- | --- |
| **Flappy** | Space or click to flap | Tap to flap |
| **Snake** | Arrow keys (or W A S D) | Swipe |
| **Ski** | Left / right arrow keys | Hold the left or right side of the screen |
| **Stack** | Space or click to drop | Tap to drop |

Every game has a start screen, a pause button (or **P** / **Esc**), a sound on/off button (or **M**),
a score, a best score saved on your device, and a game-over screen with **Play again**.

## Beat Maker

`beats.html` is a drum machine (linked from the bottom of the home page). It has 8 neon pads
(kick, snare, hi-hat, clap, tom, cymbal, cowbell, shaker): tap them, or press **1** to **8**.
Below them is a 16-step loop: switch squares on and off, press **Play** (or **Space**),
and change the speed with the tempo slider. **Clear** empties the beat (with a quick **Undo**).
Your beat and tempo are saved on your device. All sounds are made in the browser, no sound files.

## Files

- `index.html`: the home page with the four game cards
- `flappy.html`, `snake.html`, `ski.html`, `stack.html`: one page per game
- `css/style.css`: the one shared look (all colors are variables at the top)
- `js/common.js`: shared code for every game (screens, game loop, score, sound, controls)
- `js/<game>.js`: the rules and drawing for each game
- `beats.html`, `css/beats.css`, `js/beats.js`: the Beat Maker page
- `tests/logic.test.js`: quick checks of the game rules

## Tests

```
npm test
```
(needs Node.js; it only runs the rule checks, nothing gets installed)

Made with agentbox by Sam
