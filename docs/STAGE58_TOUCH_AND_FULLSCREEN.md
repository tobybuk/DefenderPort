# Stage 58 — Touch cabinet controls and fullscreen

## Scope and source boundary

Stage 58 changes only browser presentation and input routing. The original DEFA7.SSCAN/SWP/LFIRE and the native gameplay/sound routines are unchanged. It builds directly on the Stage 57 boot, credit, audio and random-state fixes. The additional module is `browser/touch-controls.js`, which maps seven on-screen controls to existing logical source-input names.

## Touch controls

- Left: vertical analog-style **two-direction digital joystick**. Drag upwards or downwards to hold the original UP/DOWN switch; a neutral gap avoids unintended direction changes.
- Lower left: REVERSE. Right: FIRE, THRUST, HYPERSPACE and SMART BOMB.
- Multi-touch is supported. FIRE and THRUST can be held simultaneously while another finger uses the directional pad. Pointers are captured and released on pointerup/pointercancel/lostpointercapture/blur.
- Very short touches retain a one-tick press edge until the next source-frame input scan. Separate touch pointers do not modify physical-key state.
- Touch controls appear by default with coarse-pointer/mobile input. The menu's SHOW/HIDE TOUCH CONTROLS toggle works on other devices and saves where localStorage is allowed.
- Existing keyboard binding defaults and Enter=FIRE are unchanged. Coin and START remain actual cabinet controls: on-screen gameplay buttons cannot bypass the credit gate.

## Fullscreen and aspect ratio

- FULLSCREEN (in the cabinet toolbar) requests fullscreen on the entire arcade shell, including coin/start/menu/touch controls; EXIT FULLSCREEN returns normally.
- On browsers that don't expose Element.requestFullscreen (including some iOS Safari configurations), a fixed-position full-screen CSS fallback is provided. Fallback is **not** guaranteed to hide browser chrome.
- The original canvas remains precisely **292 × 240** pixels. CSS object-fit: contain always preserves its aspect ratio; on landscape phones the extra space at the sides accommodates controls, and on portrait phones the controls move to a separate strip beneath the game.
- Pointer input does not call any native game drawing logic and does not scale coordinates into world-space.

## Verification

`npm run build && npm test` plus Chromium mobile portrait, landscape and desktop checks, including simultaneous held pointers, fullscreen request and Start Game. Exact CSS rendering can differ slightly by mobile browser.
