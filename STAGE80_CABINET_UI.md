# Stage 80 — Cabinet controls, sound checks, a calmer AI demo

## 1. START needs a credit

Stage 77 made START drop a coin in by itself when there was no credit. START now behaves as on the cabinet:
- With no credit it does nothing, and the START button is greyed out.
- The status line says to insert a coin first.
- Free Play (operator function 17) still allows START without a coin.

## 2. One sound control, always visible

The menu's Sound section is gone. The toolbar has one control instead: a speaker button (mute and unmute, also the **M** key) next to a volume slider.
- The volume starts at **100%** (it was 45%).
- Volume and mute are saved in the browser's local storage (`defender.audio.v1`), where storage is available.
- Moving the slider unmutes.
- The speaker button only mutes. It no longer switches the cabinet on; POWER ON does that.
- The AI demo is still always silent.

## 3. The start sound: checked against the original ROM code

The report was a "rhythmic artifact" in the start sound. To check it properly, `tools/m6800-reference.mjs` now does two things:
- **Assembles the original `vsndrm1.src`** with a small two-pass 6800 assembler.
- **Runs it on a cycle-counting 6800 emulator.** This emulator models the 6821 PIA: the data-direction register, and reading the DAC latch back for `COM SOUND`.

Then, for every board command 1–31, every DAC write of the port's translated board is compared with the original code's write: value and E-clock cycle.

Results:
- **Command $0A, the start sound (`ST1SND`), matches exactly:** all 18,432 writes, value and cycle.
- **Every other command also matches**, within 6 cycles.
- **The one exception is BG1 and THRUST.** These take their first sample count from whatever the X register held at dispatch. On the board, X holds the routine's ROM address; the translation's ROM layout differs. The effect is one skipped DAC write roughly every 65,000 samples, which is inaudible.

So the pulsing is in the original sound program. ST1SND plays SVTAB entry 10 (`SV3`), whose echo count is 0. `DEC GECNT` therefore wraps, giving **256 echoes** of the 72-sample `GS72` wave:
- Between echoes, `WVDECA` takes 1/16 of each ROM sample off the wave, with 8-bit wrap-round. The volume therefore pulses in a repeating cycle instead of fading.
- During each `WVDECA` (about 6 ms) the DAC holds still. This gives the ~80 Hz throb.

The sound lasts 3.13 s, unless the game sends another command first.

What the comparison can't cover:
- The board's analogue stage (the MC1408 DAC and the output filter). It's modelled only as a DC-blocking high-pass.
- How the browser plays the samples. In testing, Chromium's audio callbacks ran a steady 23 ms apart, with no gaps.

## 4. Power-on sound (QUASAR)

QUASAR also matches the original exactly, and it played in testing. Two things could still lose it:
- **The demo sound gate.** Leaving the AI demo power-cycled the sound board on the *next* frame, which wiped any sound queued in the meantime. That meant QUASAR after POWER CYCLE from the demo, and ST1SND after pressing START during the demo. Those paths now clear the gate before sending their sound.
- **Audio start-up.** POWER ON now waits until the browser's audio output is actually running (at most 0.4 s) before sending QUASAR, so the start of it isn't lost.

## 5. Escape returns to the attract mode

Escape ends the game in progress (or the game-over wait, or the AI demo) and returns to the attract mode. As before, Escape first closes an open menu, the keyboard dialog or faux fullscreen. Initials entry is not interrupted, so a high score is still recorded.

## 6. The DEMO label

"DEMO MODE ACTIVE", which flashed for five seconds at the start of a demo, is replaced by **DEMO**:
- It shows for the whole AI demo.
- It flashes as before (400 ms on, 200 ms off), at **20% opacity**.
- It sits above the spare ships in the panel left of the scanner: canvas x 25–55, y 3–9, centred over the panel.
- It uses the same MESS0 glyphs and RORAOK colour. It is drawn over the picture, never into game video memory.

## 7. Page clean-up

- **Project notes & source diagnostics** is removed from the page. Its process, enemy and Lander workbenches still exist in code, and their writers run harmlessly without the elements.
- **Developer tools and test controls** moved into the menu, under *Developer tools and tests*.

## 8. Calmer AI demo: fewer quick turn-rounds

Each reversal flips the scrolling landscape, so rapid back-and-forth turning is uncomfortable to watch. `tools/stage80-reversal-probe.mjs` measured the old AI: **77 turns a minute, 54% of them within half a second of the previous turn.**

Changes:
- **Minimum gaps between turns:**
  - Ordinary turns: 45 ticks (0.75 s) after the last turn.
  - Mutant duel turns (separate, then turn to shoot): 30 ticks.
  - Collision dodges by the shield: 24 ticks. The shield's planner models this wait.
- **The shield prefers not to turn.** Among collision-free inputs, the shield picks one that keeps the ship's facing, unless the intended input was itself a turn. Without this, the gaps alone cut waves cleared by about 20%, because the ship coasted while waiting to turn.

Results from the reversal probe: 16 games of 10,000 ticks each, seeds 200–215.

| | Stage 79 | Stage 80 |
|---|---|---|
| Turns per minute | 76.8 | 41.8 |
| Turns under 0.5 s after the last | 53.9% | 1.1% |
| Turns under 1 s after the last | 74.3% | 44.3% |
| Deaths per 10k ticks | 1.06 | 1.00 |
| Waves per 10k ticks | 2.81 | 2.69 |
| Mean score | 25,383 | 24,941 |

## Tests

- New `tests/stage80-cabinet-ui.test.mjs`, 8 tests:
  - The page layout.
  - Volume defaults to 100% and is saved.
  - Escape returns to the attract mode from a game and from the demo.
  - The demo sound gate is cleared at START.
  - The DEMO label's position.
  - The AI's turn gaps.
  - All 31 sound commands match the original code on the 6800 emulator.
  - ST1SND is exactly the 256-echo SV3 GWAVE.
- Updated:
  - `stage55-operator-boot`: START needs a credit.
  - `stage11-standalone`: the workbench buttons are gone.
  - `stage77-sound-board`: START is enabled by `canStart`.
- `npm test`: 671 tests pass, plus the source guardrail.
