# Three tips to make a tapping game feel fun on a phone

> This replaces the older research for the arcade site (still in git history). The existing site code (`index.html`, `js/`, `css/`) has no tapping game and the report doesn't need any code, so nothing there changes.

## Short answer
Pick these three tips: (1) the game must react the instant a finger lands, (2) every tap should give a little "pop" you can see, hear and feel, and (3) make the tap area big and forgiving, ideally the whole screen. Sources agree on the first two ideas fairly well [1][2][3][5]. The third is mostly standard phone-design advice [5][6].

## Recommended approach
Build the report as one short page, in this order, using the same shape for each tip: **Title → why (1–2 plain sentences) → "What the player sees/feels" example.**

Suggested content (reword freely, keep it short and plain):

1. **React right away.**
   - Why: if the game answers late, tapping feels mushy and the player stops trusting it. Fast taps need a fast answer.
   - Example: you tap, and the number goes up and the button squishes in the same moment. No waiting.
   - Builder note (keep out of the report or in one tiny line): old phone browsers waited about 0.3 seconds after a tap [3]. Reacting to the finger touching the screen (not to the finger lifting) avoids a laggy feel [5].
2. **Make every tap pop.**
   - Why: small, quick reactions (a bounce, a tiny sound, a floating "+1", a short buzz) tell the player "that worked", which feels good again and again [1][2][7].
   - Example: the button shrinks a little and bounces back, a soft "pop" plays, a "+1" floats up and fades.
   - Warning to include: keep it small. Too many effects can turn into noise [8].
3. **Make the tap area huge.**
   - Why: when you tap fast your finger misses small targets, and a miss feels unfair. If the whole screen counts, every tap lands.
   - Example: the player taps anywhere, even with a thumb at the edge, and it always scores.
   - Builder note: stop the page from zooming or scrolling while tapping (see below) [5].

Format tips for "easy to read on a phone": short title lines, 2–3 short lines per tip, a bold "You'll see/feel:" line, no tables, no code.

## Tip 1: reacting instantly
- Phone browsers used to wait about 300–350 ms between the end of a tap and the "click" event, because they were checking for a double-tap zoom. This is now mostly gone for pages with a mobile viewport tag [3]. (Source [3] is from 2013, so it is old; the idea still explains why "react on touch" is the safe habit.)
- Pointer events cover mouse, pen and touch in one set of events, and `pointerdown` fires when the finger first touches. They have worked in all main browsers since July 2020 [5].
- If the browser thinks the touch is a scroll or zoom, it cancels the tap. The CSS `touch-action` property controls this [5]. For a tapping game, set `touch-action: none` (or `manipulation`) on the play area so fast taps are not turned into zooms [5][3].
- Note [3] says `touch-action: manipulation` was not supported in Safari when written (2013); that may have changed, so test on an iPhone.

## Tip 2: make each tap pop ("juice")
- "Juicy" design means lots of sight and sound feedback for what the player does. Researchers say the idea is popular but loosely defined, so there is no exact recipe [1].
- A 2021 phone study found that adding extra vibration feedback to what's already on screen made games more enjoyable and made players feel more involved [2]. This was a lab study, not one specific to tapping games.
- The well-known talk "Juice it or lose it" (Jonasson and Purho, 2012) shows a plain Breakout game becoming fun with wobbling, squashing, bouncing and cute sounds, with the goal of "maximum output for minimum input" [7]. I read a news write-up, not the talk itself. One blog summary adds that particles should be used sparingly [8].
- Vibration on the web: `navigator.vibrate(ms)` exists but has "limited availability" and does nothing on unsupported devices [4]. It is believed not to work on iPhones (not stated on the MDN page, so check). So make vibration a bonus; the sight and sound must work alone [2][4].
- Sound on phones only works after the player has touched the screen once (a common browser rule, also in the earlier arcade research). The "Start" tap is a good place to switch sound on.
- Too much is a real risk: a GDC talk called "Don't Juice It or Lose It" argued polish can hurt immersion [8].

## Tip 3: big, forgiving tap area
- Chrome's web.dev advice is about 48 px tap targets with about 8 px of space between them [6]. Apple's 44×44 pt and Material's 48×48 dp (about 9 mm) are the same idea [9]. Those numbers are for buttons; a tapping game can simply use the whole screen.
- WCAG (web accessibility rules) asks for at least 24×24 CSS pixels, and 44×44 for the stricter level [9].
- Because quick tapping means many touches, you also want the page to stop pinch-zooming and scrolling on the play area (`touch-action`, see Tip 1) [5].
- Layout side note for the builder: use a phone viewport tag, `width=device-width` [3]. If score and buttons are shown, keep them out of the tapping zone so a tap doesn't hit them by accident.

## Ideas left out on purpose (only three tips allowed)
- Upgrades and milestones (growing score, "x10 streak" messages). Many clicker-game articles suggest this keeps players tapping, but the pages I found were low quality, copied-looking blogs, so I didn't build a tip on them.

## What's uncertain
- ⚠️ Source [8] and the Apple/Material/WCAG numbers [9] come from search-result summaries only; I did not open them or the official Apple/Google pages. Source [7] doesn't list warnings; the "too much juice" warning comes from [8] only.
- ⚠️ "Juiciness" has no exact recipe [1]; the sizes and timings for bounces and sounds need playtesting.
- ⚠️ The vibration study [2] is about phones in general, not quick tapping games. Vibration on iPhone is unconfirmed (not on the MDN page [4]).
- ⚠️ The 300 ms tap delay article [3] is from 2013 and the delay is mostly gone; Safari details may be out of date.
- ⚠️ Tip 3 is based on general phone design guidelines [6], not on a study of tapping games. Treat it as common practice, not proven.

## Sources
1. [Good Game Feel: An Empirically Grounded Framework for Juicy Design](https://dl.digra.org/index.php/dl/article/view/936) — Hicks, Dickinson, Holopainen and Gerling, DiGRA 2018 conference paper. Defines "juicy" design; survey of 17 developers. Read the abstract page.
2. [Juicy Haptic Design: Vibrotactile Embellishments Can Improve Player Experience in Games](https://uwspace.uwaterloo.ca/items/739bca60-4670-4ea7-bc4d-c1ddd2242b26/full) — Singhal and Schneider, CHI 2021 (University of Waterloo). Two studies on phones. Read the abstract page.
3. [300ms tap delay, gone away](https://developer.chrome.com/blog/300ms-tap-delay-gone-away) — Jake Archibald, Chrome developers blog, last updated 2013-12-12. Why the delay existed and how the viewport tag removes it.
4. [Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API) — MDN Web Docs (Mozilla), undated reference page. How `navigator.vibrate()` works; limited support.
5. [Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) — MDN Web Docs (Mozilla), undated reference page. Pointer events and `touch-action`; widely available since July 2020.
6. [Accessible tap targets](https://web.dev/articles/accessible-tap-targets) — web.dev (Chrome team and experts), last updated 2020-03-31. Says ~48 px targets with ~8 px spacing.
7. [Is your game 'juicy' enough?](https://www.gamedeveloper.com/design/video-is-your-game-juicy-enough-) — Game Developer, 2013-08-23, coverage of the GDC Europe talk by Jonasson and Purho. Opened and read.
8. [Research: Making a 'juicy' game](https://rpgplayground.com/research-making-a-juicy-game/) — rpgplayground.com blog, undated summary of the juice talks, including the "Don't Juice It or Lose It" counterpoint. Seen in search results only; not opened.
9. [Touch Target Sizes and Mobile Accessibility](https://ezud.com/touch-target-sizes-mobile-accessibility/) — ezud.com blog, undated, summarising Apple 44 pt, Material 48 dp and WCAG 24/44 px. Third-party, seen in search results only; not opened.
