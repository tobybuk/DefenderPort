# Stage 26 — source REV, SBOMB and persistent no-terrain waves

## Original-source provenance

Pinned Williams Defender Red Label assembly: mwenge/defender commit `e74006344b16d19245510b5e55780f90d7606bb8`.

- `src/defa7.src` lines 3153–3169: `REV → REV1 → REV2 → REVX1`, negates `PLADIR` into `NPLAD` and waits for release before allowing another reversal.
- `src/defa7.src` lines 3171–3207: `SBOMB → SBMB00 → SBMBX0 → SBMBX1 → SBX10 → SBX1A → SBX2A`, original process sleep and button-release debounce.
- `src/defa7.src` lines 1141–1147: startup ammunition defaults from original `NSHIP` operator setting (default 3) to `P1SBC` and `P1LAS`.
- `src/defa7.src` lines 1316–1323: `STCHK` computes no-terrain status (bit $02) from `ASTCNT` after `PLRES`.
- `src/defa7.src` lines 1846–1863: `GETWV` restores ten astronauts every `GA4` waves, operator default 5.
- `src/defa7.src` lines 1207–1314: new-player/wave setup; original `BGINIT` runs each wave but the video IRQ checks STATUS bit $02 before displaying the ground.
- `src/phr6.src` object type flags: 0 normal, 1 carrying Lander, 2 appearing, $10 nonbombable astronaut.

## Changes and exact boundaries

1. `demo/flight-harness.js` wires `REV/REV2/REVX1` into the real cooperative process list using `original/defa7-rev.js`. The player's actual `PLADIR` changes on the existing translated `PRDISP` path, not by directly flipping sprites in the browser. Reverse-switch state is encoded as PIA21 bit $40, including held-button debounce.
2. `original/defa7-smart-bomb.js` is a new source-named transliteration. `SBOMB` reads `PSBC` relative to `PLRX`, checks `SBFLG`, consumes one charge, invokes the sound/HUD hooks, walks the **real** `OPTR` chain, and dispatches each *visible* enemy's stored `OCVECT`. The traversal restarts at OPTR when an enemy was killed/unlinked; invisible and `OTYP >= 2` objects are skipped. The `PCRAM` colour complement and the original 4×2-tick flash and 10+10-tick release/debounce continuations are translated. The initial 3 charges are set from the original NSHIP operator default. No fake generic “kill all enemies” function was introduced.
3. `RESET(restored)` no longer draws terrain when `PTARG=0`. After `PLRES_ASTROS`, `STATUS` is assigned based on `ASTCNT` as `STCHK` does. Original IRQ `BGOUT` and scanner `MT1` already respect this bit. The planet remains absent in waves 2–4 after all astronauts die; the `GETWV` default GA4=5 operator setting recreates ten astronauts on wave 5, when terrain reappears intentionally. This is **not** a generic terrain toggle: it tracks the original player-data target count.
4. `browser/flight.js` adds keyboard R / S and touch/pen/mouse buttons, including long-press suppression. `INPUT` encodes the real PIA21 switch bits and `STEP` runs the same source process continuations. The game HUD above the canvas reads bombs from `PSBC`, and text diagnostics show destroyed/intact planet and reversal flag.
5. The source's `SBDISP` icon ROM glyph `SBPIC` is not yet mapped into the existing original graphics/font loader. The standalone adapter logs that exact missing ROM glyph as a display dependency; it does **not** invent a picture. The number of remaining bombs is instead displayed as plain UI text from source RAM. `SBOMB` updates `PCRAM` for the flash, but `browser/video-presenter.js` still uses a diagnostic rather than hardware-programmed palette, so a fully accurate visual flash is **not** claimed. Sound commands also reach the source sound bus without complete original sound-board synthesis.

## Verification

`npm run build && npm test`: 349/349 passing (seven additional Stage 26 tests). Tests cover 3 original charges, PIA bits, double reversals and release debounce, original-kill-vector scoring, astronaut exemption, appearance-state exemption, ammunition exhaustion, the no-terrain state through three consecutive wave transitions, source GA4=5 astronaut/terrain restoration on wave 5, and standalone-HTML syntax/boot/mobile-pointer event dispatch. Both an unmodified 10,000-update simulation and a 10,000-update simulation with repeated laser, Reverse and Smart Bomb actions ran without a process exception. Chrome screenshot capture timed out in this environment, so independent graphical validation is not claimed.

## Further limitations

`PLEND` ship death, automatic source player contact collisions, several HUD graphics, score-threshold awarded smart bombs/extra lives, precise arcade IRQ timing and original sound-board synthesis remain incomplete. Stage 26 does not claim overall game or cycle fidelity. Source-wiring additions must continue to preserve one-to-one source function names and real source object records.
