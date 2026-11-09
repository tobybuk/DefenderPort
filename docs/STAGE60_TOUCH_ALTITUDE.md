# Stage 60 — positional left-thumb altitude control

## Requested behaviour

The complete vertical extent of the touch pad maps linearly to the ship's
original playable altitude range (`YMIN + 1` = 43 to 238). The thumb does
not command a perpetual up/down input. Its absolute Y position sets the
*target* altitude. The ship flies there and stops while the thumb stays down.
Dragging the same thumb immediately changes that target. Horizontal motion
still requests original REV when the desired facing differs from PLADIR,
and applies automatic THRUST independently of altitude.

## Source-first boundaries

The browser-only `createAltitudeController` reads the original `PLAY16`
(8.8 fixed-point Y) and signed `PLAYV` every executive input sample. Its
`altitudeSourceSwitches` predicts the next change according to the
translated `DEFA7.PLAYER/PYV1` rule: first movement ±256/256 px, then
acceleration ±8/256 px per held update up to ±512/256 px. It chooses Up/Down
only if the next original movement would reduce the target error. Releasing
Up/Down makes original PLAYER set PLAYV to zero, removing drift and allowing
a lower-speed final adjustment. This is an INPUT adapter, not a change to
PLAYER or any source routine. Endpoint mapping uses source YMIN=42 and
PLAYER's down boundary 238. The resulting stop error is at most about half
an original game pixel when a target is reachable.

Mouse/touch pointer tracking uses the full pad height, clamps outside-pad
positions, and preserves the same pointer through continuous drags using
pointer capture. The right-hand Fire, manual Thrust, Smart Bomb and Hyper-
space controls remain separate pointer IDs. Keyboard Up/Down overrides the
automatic altitude controller when held. Hall of Fame initials retain their
previous relative Up/Down thumb gesture.

## Display

The cyan TARGET line shows the requested altitude; the dashed gold SHIP line
tracks live PLAY16. The floating knob now illustrates horizontal thrust /
facing input only; it does not use vertical drag displacement. These are
browser UI elements and never change the original framebuffer.

## Verification

- Eight new source-motion and input regression tests.
- Entire existing suite: 556 tests passing.
- Headless Chromium, native multi-pointer touch on landscape and portrait:
  target reached with PLAYV=0, Fire held independently, input cleaned on release.
- Landscape fullscreen: original 292×240 framebuffer object-fit=contain;
  horizontal Reverse changed source PLADIR while absolute altitude stayed fixed;
  vertical target reached and ship stopped.
- The player's vertical physics and display-frame scheduling are unchanged.
