# Defender Stage 59 — Hybrid floating joystick

## Play

Open `play.html` in a desktop or mobile browser. On a phone, landscape
fullscreen is recommended. The standalone `Defender_Stage59_Hybrid_Touch.html`
copy distributed alongside this ZIP includes all scripts, styles and sounds.

Coin insertion and the original-start gate are unchanged. On a touch device,
the left control area is a floating joystick: first contact determines the
neutral centre, move up/down to climb/descend and left/right to select facing
and automatically thrust. Keep the left thumb down while moving in any direction.

The right-hand FIRE, optional THRUST, HS and SMART BOMB targets accept separate
simultaneous fingers. On-screen TOUCH CONTROLS can also be toggled under MENU.

## Source structure

- `browser/touch-controls.js` — pointer ownership, axis hysteresis, hybrid
  switch mapping and original-SSCAN-compatible Reverse input sequencing.
- `browser/flight.js` — only browser input wiring; no original gameplay edits.
- `style.css` and `index.html` — touch and fullscreen UI.
- `original/` — unchanged translated Williams Defender routines.
- `tests/stage59-hybrid-joystick.test.mjs` — new regression tests.
- `docs/STAGE59_HYBRID_TOUCH.md` — detailed behaviour and verification.

## Tests

Run `npm test` (Node.js 22+). Build standalone using `npm run build`.
The release tests passed with 548 tests; real multi-touch was exercised with
Chromium CDP touch events in landscape fullscreen. Controls must still be
assessed for ergonomics on the actual phone.
