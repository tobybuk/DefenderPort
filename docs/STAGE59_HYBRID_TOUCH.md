# Stage 59 — Hybrid floating touchscreen joystick

## Scope and source fidelity

Stage 59 changes only the browser input adapter, touch-control presentation,
input tests and packaging metadata. None of the original 6809 Defender gameplay
translations or 6808 sound routines have been modified.

The original arcade panel offers UP, DOWN, THRUST and REVERSE, **not** a continuous
horizontal joystick axis. Horizontal thumb motion is therefore translated into
THRUST plus a conditional request to the ORIGINAL REVERSE switch. It does not
write PLADIR, NPLAD, player velocity, or player coordinates directly.

The original `SCANN`/`SSCAN` handler in DEFA7 processes the lowest newly asserted
switch bit. Simultaneously asserting THRUST (PIA bit 1) and REVERSE (PIA bit 6)
can lose the reverse edge, so the browser-only `createHybridReverseSequencer`
gives continuous controls a few source input samples to settle, then asserts
REVERSE separately and releases when the source `REVFLG` is active or the
source-facing direction agrees. The actual turn continues to use source
`REV`, `REV1`, `REV2`, `REVX1` and `PRDISP` routines.

## Controls

- Drag anywhere inside the **left** floating pad; the initial contact defines
  the neutral centre. Keep the thumb down to steer continuously.
- Up/down: source UP/DOWN switches; neutral returns both to off.
- Left/right: request source REV when the ship is facing away from the chosen
  horizontal direction, then hold source THRUST. Releasing to centre disengages
  the automatic THRUST switch, without reversing the ship.
- Diagonals: source vertical switch plus THRUST simultaneously.
- Right-hand **FIRE**, **THRUST**, **HS** and **SMART BOMB** are separate
  independent, multitouch-compatible targets. Right-hand thrust is optional
  for precise control while the left thumb moves vertically.
- Keyboard mapping is unchanged; ENTER remains the default FIRE key.
- In the high-score initials screen, the floating pad generates only UP/DOWN.
- Browser fullscreen/faux-fullscreen retains controls and the original game
  framebuffer ratio 292:240, letterboxed instead of stretched.

## Browser implementation

- One captured `pointerId` owns the floating pad, with independent pointer
  ownership for each right-hand action.
- `touch-action:none`, explicit event prevention and pointer capture avoid
  browser scrolling, text selection and unintended finger-cancel.
- The thumb's origin is fixed until lift; horizontal and vertical axes have
  separate 22px activation/12px release thresholds to avoid jitter.
- `setMany(pointerId, keys)` allows one contact to hold UP+THRUST or DOWN+THRUST.
  Releasing that pointer never releases the other finger's FIRE or THRUST.
- Short one-shot taps retain a queued edge for the following game input tick.
- Page blur, visibility loss, control hiding and game reset release input state.
- On short landscape screens, viewport sizing is height-constrained so control
  targets are accessible without entering fullscreen.

## Verification

- Existing full suite + ten new hybrid tests and two Reverse sequencer tests:
  **548 automated tests passing**.
- Native Chromium touchscreen event injection (two simultaneous contacts):
  UP + THRUST + FIRE held together; uninterrupted drag to DOWN/LEFT with FIRE
  still held; releasing the FIRE finger does not release the left joystick;
  releasing the joystick clears all remaining actions.
- Live Chromium source-step trace with both FIRE and hybrid joystick held:
  the ship turns from `$0300` to `$FD00`, then back to `$0300` on a continuous
  left-to-right thumb drag. These are changes made by the original REV source.
- Chromium page checks at phone portrait, landscape and desktop sizes, with
  fullscreen activated and JavaScript error collection (no uncaught errors).

## Limitations

This is a touchscreen input mapping, not an original cabinet switch or ROM
feature. Device/browser fullscreen restrictions vary (faux-fullscreen fallback).
Automated touchscreen checks ran in Chromium; **real-device ergonomics must be
assessed by playing on the intended handset**. Touchscreen physics cannot match
mechanical switches exactly. The game's previously documented incomplete
raster/executive timing is unchanged.
