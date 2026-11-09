# Stage 11 source-level audit — wave executive and cooperative-process workbench

## Source and method

Pinned Red Label upstream: https://github.com/mwenge/defender/tree/e74006344b16d19245510b5e55780f90d7606bb8 . The source text consulted:

- `src/defa7.src`, GEXEC and labelled branches, lines **1641–1730**; RMAX/WVCHK/BCDHEX/HEXBCD **1732–1783**.
- `src/defa7.src`, GETWV/WDELT, lines **1846–1926**.
- `src/defa7.src`, COLR/COLTAB, **3020–3040**, THPROC **3278–3292**, SCPROC **3294–3305**.
- `src/blk71.src`, WVTAB **672–721**, 23 rows × 8 bytes.

Category for all new entries: **translated-unverified**. They have source-directed tests and are not independently validated with MAME state traces. Original subroutine names and entry labels are retained. CPU width/carry/borrow is explicitly represented by masked integer operations, not a 6809 interpreter. No gameplay algorithm, sound effect or sprite is invented.

## Implemented code and exact boundaries

| Entry / data | JavaScript | Source-dependent behaviour | Status |
|---|---|---|---|
| `GEXEC`,`GEX0`,`GEX00`,`GEX002`,`GEX11`,`GEX2`,`GEX3`,`GEX6` | `original/defa7-wave-exec.js` | `PD` timer, `UFOTMR`, `WAVTMR`, count gates, source callbacks, 40-call `WDELT`, `NAP 15` | translated-unverified |
| `WVCHK` | same | Exactly the seven original enemy counters; no UFO count | translated-unverified |
| `RMAX` | same | Repeated 6809 unsigned right shifts and +1 | translated-unverified |
| `BCDHEX`,`HEXBCD` | same | 8-bit BCD arithmetic and decimal adjustment | translated-unverified |
| `GETWV`,`WDELT` | `original/defa7-wave-params.js` | 23-row bank-7 WVTAB, bounded addition, signed deltas via 8-bit carry; current player selection | translated-unverified |
| `COLR`,`COLRLP` | `original/defa7-process-tasks.js` | Original `COLTAB` bytes and sleep of 2 ticks | translated-unverified |
| `SCPROC`,`SCP1`,`SCP2` | same | Original `ISCAN`, `OSCAN`, `SHSCAN`, `MAPCH1`, `SCNRV` JSR ordering and `NAP` 2/2/4 | translated-unverified |
| `WVTAB` | `original/blk71-wave-data.js` | Original data bytes, including two's-complement negative deltas | source-extracted / unverified on cabinet |

`GEXEC` calls to `LANDST`, `UFOST`, `GNCIDE`, `PLSAV`, `BONUS`, `PLSTR0`, `AUDIT` are required original dependencies and throw if absent. `GETWV` requires nonvolatile CMOS access `RCMOSA` and `RCMOSD` from a hardware adapter; no fictitious values have been inserted into the port. Test fixtures supply explicit inputs only. `SCNRV` and other scanner functions are likewise not silently implemented.

## Source process workbench

`demo/process-harness.js` creates original shared RAM and uses already translated `PINIT`, `OINIT`, `MKPROC`, `DISP`, `SLEEP`, `REV`, `THPROC` and `WDELT`, as well as new `GEXEC` and `COLR`. It uses a non-game *diagnostic* adapter with synthetic function dispatcher keys; these are intentionally **not claimed to be compiled ROM addresses**. `STATUS` bit 3 takes the **existing original dead-player branch**, avoiding unsupported enemy creation rather than implementing substitute AI. The workbench's `STEP` advances one original `DISP`/`SLEEP` scheduling tick and `RUN` repeats this test; it is **not** the arcade's original full `EXEC` loop.

The existing original two-phase IRQ flight/terrain/display diagnostic remains independent. This avoids implying the entire `SINIT`/`EXEC` boot-to-play path works.

## Testing / validation

- 215/215 Node source-level tests pass after Stage 11 changes; 28 tests were added.
- Process tests verify multiple active process records, independent sleep timers, saved continuations, `GEXEC` launch, 40-call cadence, `COLR` phase, `REV` debounce and self-kill, and required missing-dependency errors.
- Wave tests verify 184 WVTAB bytes, bank selection, min/max caps, carry and signed delta handling, player record offsets, CMOS-dependent GETWV and highest-wave clamping.
- Chromium standalone page was tested with 120- and 600-tick process runs, reverse/clear, reset, original scanner control and player single-step, with 0 JavaScript page errors. Browser used in-memory HTML because the sandbox blocks direct `file:` navigation; the same generated `play.html` bytes were loaded.
- There has been **no full original-versus-JavaScript execution trace**, gameplay accuracy or audio comparison; this stage is not an arcade-accuracy claim.

## Next original dependencies

Original complete EXEC startup/dispatch handoff, game switch process, `LANDST`/`UFOST` and other source enemy process routines, original picture descriptors, explosion expansion and sound-board sample generator. We must not fake these or claim finished gameplay before their direct translations are available.
