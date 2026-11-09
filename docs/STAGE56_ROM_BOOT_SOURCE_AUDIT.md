# Defender Stage 56 — ROM-derived power-on and diagnostic display

## What was wrong in Stage 55

Stage 55 invented the start-up artwork and wrote `INITIAL TESTS OK` as a browser message rather than executing the source drawing path. The coloured-dot display was not derived from the ROM's actual pseudo-random RAM-test writes. The first-start sound was deferred until after boot/attract, rather than issued at the cabinet's power-on boundary. This was not an acceptable source-first implementation.

## Pinned original source

- [ROMF8.SRC, reset, RAM test, ROM test, GAMEOV](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/romf8.src): `RESET`/`RESET1` lines 62–88; `RAM2`/`RAM3`/`RAM4`/`RAM5`/`RAM6`/`RAM7` lines 92–204; `ROM0` lines 231–281; `IDIS1` lines 284–292; `GAMEOV` later in file.
- [ROMC0.SRC, RORAOK](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/romc0.src): lines 78–92. `NEWTST`, palette `#$7A`, `VINITT` at `$2870`, `VUNIOK` at `$4090`, LED flash, `DELAY 3000`.
- `VSNDRM1.SRC` sound-board `QUASAR` command via original `$C0` input / `$1F` decoded command; the existing approved Stage47/49 synthesis is reused without changing waveform or pitch.
- [Williams Defender operator booklet](https://www.mamechannel.it/files_free/arcade_manuals_unpacked/defndjeu.pdf): power-on sound, random RAM video patterns, game-over after checks.

## Native JS equivalents added / changed

| Source | Stage 56 behaviour |
| --- | --- |
| `RESET` + `RESET1` | Initialise the sixteen original colour latches via high-byte `A * $B5`, seed `$C0`. |
| `RAM2` | Seven RAM-test passes and the original full 48K address range, separate write and comparison passes. |
| `RAM3`/`RAM4`/`RAM5` | Translate 8-bit COMB, BITB, RORA, RORB, LSRA and carry semantics locally in `ram3NextWord`, **not** a 6809 emulator. |
| `RAM6` | Writes each generated word into the RAM object; video addresses also write to original column-major video memory. No hand-drawn random-dot canvas. |
| `RAM7` | Recomputes and verifies each word in the JavaScript memory backing. This is an algorithmic check, not a test of the physical cabinet RAM chips. |
| `IDIS1` → `ROMC0.RORAOK` | Uses the original `ROMF8.CWRIT` source-based text routine and glyph descriptors; green `$7A`, `INITIAL TESTS INDICATE` at `$2870`, `UNIT OK` at `$4090`; holds 3 s. |
| `GAMEOV` | Clears video and prints source `GAME OVER` at `$3880` with source colour `$A5` before an adapted browser-to-attract transition. |
| Power switch and sound PIA | A real browser user gesture called **POWER ON** unlocks Web Audio and plays the Stage47 source-derived QUASAR (`$1F`). Browser autoplay policy prevents genuinely automatic audio immediately when opening the HTML. |

The canvas uses the same `presentFrame` hardware-palette and original column-major video-memory path used by normal gameplay. The original title-animation, gameplay, keyboard bindings (Enter = Fire), credits, sound engine and high-score entry are retained.

## What is **not** yet source-equivalent

**This is not a full boot-ROM execution.** In particular:

1. `ROM0` to `ROM9` physical ROM checksumming and map/banking are **not** implemented. The `UNIT OK` screen is displayed after a successful JavaScript memory test, without proving ROM integrity.
2. Detailed bad-RAM map/status flags (`DP`, `CC`, RAM10–RAM19) and initial RAM/ROM failure displays are not reproduced. Physical RAM chips, PIA ports, watchdog resets, switch sampling and LED flashes are not simulated.
3. `RORAOK`'s text and approximate three-second hold follow the source, but RAM-test execution timing is bounded at 440 words per display update for browser presentation—not measured instruction-cycle timing.
4. `GAMEOV`'s infinite cabinet switch-polling and bank changes are not fully translated. For the playable single-file browser app the screen hands over to the existing attract-mode engine after a short adapter delay.
5. Service screens in the menu are non-original references; they now explicitly state ROM/RAM/CMOS tests are **not executed**. Reproducing the diagnostic ROM's full service mode remains future work.
6. No independent frame-by-frame capture/trace from an original Red Label cabinet has been used to certify pixel-perfect timing, colours or QUASAR acoustic characteristics. The boot sound itself is the previously user-approved source-derived JavaScript version.

Thus Stage 56 replaces *invented artwork and messages* with source-derived framebuffer output, but **do not claim 100% faithful ROM boot execution**.

## Test coverage and verification

- All 526 automated tests pass, including new ROMF8 reset colour, RAM3 sequence, ROMC0 text address and source-based boot-phase tests.
- Browser tested using Chromium with self-contained HTML via `set_content` (managed browser policy blocks `file://` navigation). Desktop 1280px and mobile 390px viewports; `POWER ON` resulted in `$1F` QUASAR on the sound adapter, RAM rug, green result, GAME OVER and attract-mode handoff. No page script errors.
- Retained game start with the coin gate and existing UI.
