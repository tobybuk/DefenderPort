# Stage 50 — DEFENDER implosion CPU workload pacing audit

## Findings

Stage 49 interpreted a `DEF2 NAPP $2E,DEF33` timer as 46 physical display
frames. This ignores the fact that every `EXEC` does an `XUVCT` call *before*
`DISP`, and `EXPU` loops through up to sixteen SAMEX slots, erases old
fragments and writes each new expanded picture. The source explicitly
increments TIMER in the raster IRQ and uses it in EXEC. An EXEC pass is
**not** guaranteed to fit inside one frame.

The 1 MHz M6809 has 16,640 clock cycles per nominal 60.096 Hz video frame.
The new native-JavaScript-only cycle ledger uses the original execution
paths and the 1981 Motorola MC6809 Programming Manual appendix F. The
strongest directly counted contributions are:

| Original code | Cycle accounting | Cost per block |
| --- | --- | --- |
| SAMEXAP7 `EERAS1` | `STD [,X++]` + `CMPX DATPTR` + `BNE EERAS1` | 20 CPU cycles |
| SAMEXAP7 `STRTxx` | `STD ,--U` + `LDY ,X++` + `STY [,U]` + `ADDB DSIZE` + `BCS` | 33 CPU cycles |
| ROMF8 `CWRT0` | `LDU B,Y` + `STU B,X` + `SUBB #2` + `BPL CWRT0` | 19 CPU cycles/pair |

The ledger also includes estimated fixed and per-column setup costs from the
corresponding source routines, clearly separated in
`original/samexap7-cycle-ledger.js`. The `DEF50/CWRIT` even-height path is
60 columns by 24 bytes and thus has 720 16-bit pair copies, plus column
setup and function entry/exit. This alone is around 15,225 CPU cycles.

## Deterministic source measurements

Attract page `DEFENS` creates the 15 original `APST` slots (`$AF00`).
Sampling the existing JavaScript implementation with this source instruction
ledger for the first 50 `EXPU` passes gives approximately **1,126,914 CPU
cycles**, excluding `CWRIT`, LOGO0 and the rest of the main IRQ/EXEC work.
That is a workload estimate, not a measured original-ROM trace.

**Before** — Stage 49 (`STEP()` once per display frame):

- `DEFENS`: video frame 274 in the deterministic harness, zero-based index 273.
- `DEF33/DEF50`: video frame 320, zero-based index 319.
- 46 display intervals, or **765.4 ms**, from first APST allocations to
  whole-word restore.

**After** — Stage 50 (`DISPLAY_STEP()` with CPU cycle budgeting):

- `DEFENS`: video frame 274, zero-based index 273.
- `DEF33/DEF50`: video frame 338, zero-based index 337.
- 64 display intervals, or **1,065.0 ms**, between those same two events.
- `EXPU` at appearance age 30 costs approximately 27,509 modelled cycles;
  the simultaneous age-46 full-word restore costs approximately 42,734.

The source PTIME values, 15 descriptors, RSIZE sequence, fragment arithmetic,
source images, palette, audio commands and CWRIT implementation are unchanged.
The integration does **not** divide the CPU cost by a chosen speed factor.
Instead `runtime/source-cpu-budget.js` grants the native source EXEC a 16,640
cycle budget each display frame and accumulates timer credit while the
source work overruns. This models the source-side possibility that an
executive pass spans more than one IRQ refresh without a CPU interpreter.

## Boundaries and remaining uncertainty

This is a **source-path cycle budget**, NOT a measured original cabinet, not
fully branch-cycle-accurate, not a 6809 emulator and not a claim that the
title animation is now 100% equivalent. Unknown overhead still includes the
full `LOGO0`, `PRES1`/MESS0 text-path and two raster IRQ halves; video output
writes within an overlong EXEC are currently committed atomically in native
JS rather than at individual machine-cycle boundaries. These omissions
mean exact cabinet timing may differ in either direction. A Red Label MAME
or original-ROM frame/CPU trace would be necessary to certify the result.

The browser deliberately caps catch-up presentation to one frame; this can
make background-tab or dropped-frame playback slower than real-time, rather
than jumping over visual states. Unlike Stage 49, the normal 60 Hz path now
properly accounts for counted overlong CPU work.

## Verification

- `tests/stage50-title-cpu-pacing.test.mjs`: five tests covering cycle
  counts, TIMER-like credit/debt, process sleep constants, workload-dependent
  pacing and the unchanged `STEP()` source semantics.
- All **484** full project tests pass including existing gameplay/sound tests.
- Chromium standalone HTML exercised at phone width: title process and
  46th-age frame compared with Stage 49 at the same display frame;
  `START GAME` and `WATCH DEMO` worked without page errors.

## References

- [AMODE1.SRC DEFENS/DEF33/DEF50 lines 791–890](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/amode1.src#L791-L890)
- [DEFA7.SRC raster IRQ and EXEC lines 1959–1994 and 3042–3126](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/defa7.src#L3042-L3126)
- [SAMEXAP7.SRC EXPU/EERASE/EWRITE lines 121–376](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/samexap7.src#L121-L376)
- [ROMF8.SRC CWRIT lines 405–439](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/romf8.src#L405-L439)
- [Motorola MC6809 Programming Manual appendix F](https://www.maddes.net/m6809pm/appendix_f.htm)
