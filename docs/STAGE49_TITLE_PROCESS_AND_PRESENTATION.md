# Stage 49 — Source-scheduled DEFENDER appearance and visible frame fidelity

## Source and why Stage 48 looked fast

Pinned Williams Defender Red Label source: `e74006344b16d19245510b5e55780f90d7606bb8`.
- [AMODE1.SRC 779–834](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/amode1.src#L779-L834): `PRES`, `DEFEND`, `DEFENS`, `DEF2`, `DEF33`, `DEF50`, `DEF44`.
- [AMODE1.SRC 879–890](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/amode1.src#L879-L890): `DEF50` draws the full word and checks the first two RSIZE high bytes, then starts `WILLIR`.
- [AMODE1.SRC 973–980](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/amode1.src#L973-L980): `WILLIR` fast pass lasting two process ticks.
- [DEFA7.SRC 7–14 and 3042–3126](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/defa7.src): `SLEEP`, `EXEC`, `XUVCT`, `DISP`, `DISP1/2`.
- [SAMEXAP7.SRC 13–63](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/samexap7.src): `APST` starts at `$AF00`, `XUVCT` updates effects.

The original ROM itself specifies a **46-tick** wait between starting fragment appearances and spawning the full-word restore process. We **do not** claim that a longer duration is authentic, and have not added arbitrary timing multipliers. Stage 48 incorrectly coupled independent process continuations to one `defenderAge` counter and updated `EXPU` during the very tick that initialized the fragments, even though the original `EXEC` calls `XUVCT` *before* process dispatch. It also let up to six simulation ticks occur before one `requestAnimationFrame` paint, hiding intermediate appearances when the browser was delayed.

## Translation

`runtime/source-attract-processes.js` expresses the relevant `MKPROC`/`PTIME`/`SLEEP`/`DISP` semantics: linked insertion after the current process, initial PTIME=1, unsigned 8-bit sleep countdown, executable source-named continuations and `SUICIDE`. This is an isolated native JS translator of the title's *process scheduling*, **not** a 6809 emulator.

`original/amode1-attract.js` now has individual original-named `DEFEND`, `DEFENS`, `DEF33`, `DEF50`, `DEF51`, `DEF44`, `WILLIR`, and `WILR1` entry points. The source waits remain `$30`, `$2E`, `$28`, `1` and `2` ticks. The following timeline is measured relative to the first `PRES` scheduler tick; the source emits the first APST writes at tick 49, and `XUVCT` advances them at tick 50, rather than both happening at tick 48.

| PRES tick | Source continuation/event |
| --- | --- |
| 1 | `DEFEND` enters and sleeps `$30` |
| 49 | `DEFENS`, fifteen APST records at `$AF00`; sleep `$2E` |
| 50 | First `XUVCT` decrements APST records to `$AE00` |
| 95 | `DEF33`, initializes whole-word descriptor; spawns `DEF50`, first `CWRIT`; begins `$28` sleep |
| 97 | First two appearance slots cleared; `DEF50` spawns `WILLIR` |
| 99 | `WILR1` resets logo drawing rate to 10 |
| 135 | `DEF44` starts title `CBOMB` and falls through to `COPYRT` |

The standalone browser now uses `createSourceFrameClock({maxCatchUp:1})` **only in attract mode**. When a browser frame is missed, elapsed wall time is dropped instead of performing multiple invisible title steps during one paint. Gameplay retains the original catch-up limit. This choice favours displaying all source states and may slow presentation in a severely overloaded browser rather than skip them. No source numeric waits or effects have been stretched.

## Source-fidelity boundary

This is more faithful *local scheduling* for the title processes, not a cycle-accurate rendition of the complete original linked-list EXEC, raster IRQ, LOGO0 task or CRT refresh. `PRES1` and `LOGO0` still have documented presentation adapters, and the separate attract-page lifetime after `COPYRT` is provisional. The 46-tick complete-word appearance remains abrupt **by source design**. A calibrated original-ROM frame-by-frame comparison is still needed to claim exact arcade fidelity.

## Verification

`tests/stage49-defender-process-timing.test.mjs` checks source-defined sleep counts, linked process insertion, RSIZE initial/decrement values, independent `DEF50`, the WILLIR two-tick reset, and prevention of missed attract-frame updates. All legacy Stage 48 tests continue to run.
