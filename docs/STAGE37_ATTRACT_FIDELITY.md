# Stage 37 — Attract-mode fidelity repairs

Reference: Williams Defender Red Label `src/amode1.src` pinned at
`e74006344b16d19245510b5e55780f90d7606bb8`. All corrections stay
inside the native JavaScript source transliteration and presenter; **not a 6809
emulator**, and no replacement Canvas sprites or sounds.

## Reproduced defects and resolutions

1. **Wrong enemy showcase layout (`LEDRET`, `AMOD11`, `OPON`)**. Stage 36
   incorrectly used `OX16 >>> 8` as the sprite's video byte-column, and
   used `OX16 & $80` for the odd-pixel phase. Original `OPON` subtracts `BGL`
   from world X and shifts left twice (`ASLB/ROLA` twice). On the fixed
   attract-screen world (`BGL=0`), `videoX = ((OX16 << 2) & $FFFF) >>> 8`.
   For instance, the Lander's `$0900` showcase X becomes the 36th byte-column,
   aligned above its `TEXTAB` caption at `$1C70`; before this correction it
   appeared in byte-column 9, at the far left. The original odd-phase carry
   is bit 7 of the shifted low byte.

2. **Incorrect logo acceleration (`LOGO0`, `LOGO10`, `LGOTAB`)**. Stage 36
   changed its decode rate at elapsed tick 100, midway through the first
   Williams tracing. The assembly starts with `LGOFLG=3` source data bytes
   per `LOGO0` invocation, sleeping two ticks between invocations. **Only
   after the complete `LGOTAB` pass encounters `QUIT ($FD)`** does `LOGO10`
   set `LGOFLG=10`, reset the table pointer and launch the parallel `PRES`
   continuation. The updated decoder follows that rule; the faster second
   tracing is not introduced arbitrarily midway through the first drawing.
   `PRES` text and `DEFEND` title begin at their original relative $30-tick
   offset. The subsequent large-title appearance and end-to-end cabinet
   scheduling remain approximate.

3. **Incorrect demonstration laser (`LASRS`, `LASRR`, `LAS0`, `LAS1`–`LAS4`,
   `KLASUB`)**. Stage 36 drew a static line growing by `(tick & 31)` with
   a maximum length of 28 video columns. Instead, the original routine writes
   **four consecutive `$11` bytes and a `$99` head**, advances `PD` by
   `4 * $100`, writes three consecutive original `FISTAB` bytes at the tail,
   advances `PD+2` by `3 * $100`, and clears one old byte through `LSTATE`.
   We now model those three distinct source pointers, initialise `FISTAB`
   through the existing original `FISS`/`RAND` translation and erase active
   beam bytes when `KLASUB` finishes. A moving beam remains correctly displayed
   when nearby scripted sprites are erased/redrawn.

4. **Attract presentation on mobile**. Development counters and non-attract
   game controls are hidden during the presentation, leaving the original
   framebuffer as the focal content. START GAME and WATCH DEMO remain visible.
   On starting the game, the normal controls/readouts return. Original mobile
   long-press protection is preserved.

## Verification

- 436 / 436 Node test cases passing, including five new source-register and
  **video-byte** regressions for the reported faults.
- Full standalone HTML successfully booted and rendered in real headless
  Chromium at desktop and mobile-touch viewports, with no page errors.
- Browser `Canvas` RGB was directly sampled at the `$99` laser head and
  matched the original hardware colour-RAM palette output.
- Browser screenshots show six sprite pictures aligned above their matching
  captions; the demonstration laser no longer grows from a synthetic length.
- Enter/START GAME still begins the existing five-Lander opening wave, and
  unlimited Smart Bombs remain enabled in the playable game.

Sound remains deliberately deferred. The original 6809 cycle counts, some
scripted-demo appearance/erasure processes, high-score CMOS and full raster
scheduler remain untranslated or not independently verified against cabinet
or MAME traces. These fixes establish source-based behaviour at the three
reported boundaries, not full attract-mode cycle accuracy.
