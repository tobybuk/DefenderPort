# Stage 28 — Original BLK71 player-explosion translation

## Pinned assembly and mapping

- Exact source repository: `mwenge/defender`, Red Label at commit `e74006344b16d19245510b5e55780f90d7606bb8`.
- `src/defa7.src` L1325–1429: `PLEND → PDTHL → PDTH2 → PDTH5 → PXVCT → PLE01/PLE2`. `PDTH5` now starts `PLEX`, and the existing original process scheduler resumes `PX1A` at the source `NAP 1` cadence before any lives are debited or the game is restarted.
- `src/blk71.src` L562–670: `PLEX`, `PINIT1`, `PINIT2`, `PINIT3`, `PINIT4`, `PX1`, `PX1A`, `PX2`–`PX8`, and the exact `PXCOL` data.

The source translation is in `original/blk71-player-explosion.js` and uses the existing `VideoMemory` framebuffer. There are **128 source TABLE entries of ten bytes each**. Original packed-bitmap pixel patterns `$BBBB`, `$0B0B` and `$B0B0` are written directly to video bytes; no Canvas particle system exists. Velocities are generated through the original two seed streams (`$0808`, `$1732`), including the four-corner speed rejection test. The initial player centre is `NPLAXC + $0403`.

## Timing and life handling

`PXCOL`: `FF 7F 3F 37 2F 27 1F 17 07 06 05 04 03 02 00`. The first colour runs for 56 steps; the remaining 13 non-zero colours run for four steps each (108 animation updates). The following zero-colour step ends `PX8` and returns to the player's existing game-over/respawn continuation. One source NAP is represented by one diagnostic game tick, not a claim of verified cabinet timing.

The original `CLR SNDTMR; SNDOUT $13` after `PXVCT` is now passed through the sound-command sequencer. No sound waveform or sample synthesis has been invented.

The original `PX8` does **not** remove its fragment bytes from framebuffer video RAM: it sets colour slot B to zero, making the pieces black on the original hardware. The diagnostic browser does not yet have the original hardware palette, so `FINISH_DISPLAY` is an *explicit host presentation compatibility step after PX8* to clear the now-invisible bytes. It is not part of the source `PX1A` implementation. This separation is tested and documented.

## Tests and checks

- Source code syntax and standalone HTML compilation.
- 365/365 automated tests, including seven new tests for seed shifts, 128 record allocation, original colour table timing, packed-byte pattern and erasure, determinism, real scheduler integration and respawn preserving the unlimited Smart Bomb setting.
- Two stress scenarios of 5,000 updates each: natural losses/game-over resets and active Reverse/laser/unlimited bomb use. No runtime exceptions.
- HTML simulated-DOM boot in existing regression suite.
- Direct source framebuffer render captured during player explosion in `Defender_Source_Stage28_Framebuffer_Preview.png` (standalone screenshot generated from game video RAM, not a Chromium capture).
- Chromium's headless screenshot attempt timed out. **A successful interactive browser rendering test is not claimed.**

## Outstanding work

The original programmable-colour RAM and DAC palette display is not fully translated; explosion colour transitions only update the original palette register bytes, while the current browser shows the diagnostic palette. The full original game-executive startup, cabinet-accurate frame timing, score/HUD glyphs, and original separate sound-board firmware/DAC remain work in progress. Do not interpret the automated tests as original 6809 differential verification.
