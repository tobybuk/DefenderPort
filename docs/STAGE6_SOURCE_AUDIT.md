# Stage 6 — original-source translation audit

Pinned **e74006344b16d19245510b5e55780f90d7606bb8** (`mwenge/defender`, Red Label).

## Files translated and source correspondence

| Original assembly labels | Native JS module | Relevant source | Notes |
| --- | --- | --- | --- |
| `SCORE`, `SCR1`, `SCR2`, `SCRX`, `SCRXX`; `RCHK` | `original/defa7-score.js` | `src/defa7.src`, SCORE through RCHK | Original byte arithmetic, packed BCD, four-step scaling, `DAA` correction and replay branch; original `SCRTRN` called through a required interface |
| `SCRTRN`, `SCRTR0`, `SCT1`, `SCT2`, `SCTLP`, `SCT3`, `SCT3A`, `SCT40`, `SCT4` | `original/defa7-score-display.js` | `src/defa7.src`, SCRTRN through HSRES | Source leading-zero blanking and alternating BCD nibble phase; full original glyph descriptors still missing |
| `LDISP`, `LDSP`, `TDISP`, `TD1`, `SBDISP`, `SBDSP` | `original/defa7-hud.js` | `src/defa7.src`, LDISP through BORDER | Source function order, reserves caps, byte column/row increments; requires P1LAT/P2LAT, glyph and bitmap data |
| `SSCAN`, `SSC00`, `SSC0A`, `SSC0B`, `SSC0C`, `SSC0`, `SWITCH`, `SW0`, `SWTCH2`, `CSCAN`, `CSC1` | `original/defa7-switches.js` | `src/defa7.src`, switch scan through LDISP | Sample history, debounce counters and two-deep `SWPROC`; needs original SWTAB/SWTAB1 and PIA hardware adapter |
| `CWRIT`, `CWRT00`, `CWRT0`, `CWRT1`, `CWRT2`, `CWRT3`, `COFF`, `COFFA`, `COFF00`, `COFF0`, `COFF1`, `COFF2`, `COFF3`, `BLKCLR`, `SCRCLR` | `original/romf8-graphics.js` | `src/romf8.src`, CWRIT through SCRCLR | Original descriptor layout and column-major writes, odd/even byte counts; no Canvas drawing inside translation |

Useful original source links:

- https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/defa7.src
- https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/romf8.src

## Original file structure

The new modules are kept in `original/` and their functions preserve source labels. Shared source tails are represented using functions such as `COFFA`, while internal control-flow labels remain documented in module headers. `runtime/` remains memory and integer utilities only; `browser/` performs presentation and diagnostic UI. No 6809 instruction decoder/emulator is present.

## New validation

- `SCORE` / `RCHK`: three-byte comparisons, BCD carry propagation, score exponents, P1/P2 selection, replay threshold arithmetic, bonus increment and required reward hook order.
- `SCRTR0`: six output digits, alternating packed-BCD halves, leading-zero blanking, 1P/2P selection, preservation of `MAPCR`.
- `TDISP`: original clear/border/reserves/scores order; `LDSP` and `SBDSP` caps and source pointer arithmetic.
- `SSCAN`/`CSCAN`: original debounce-counter order, PIA snapshots, stable coin confirmation and `SWPROC` queue layout.
- `CWRIT`/`COFF`/`BLKCLR`/`SCRCLR`: descriptor parsing and exact byte-position write/erase bounds, including odd-height pictures.
- `tools/source-data-core.mjs`: strictly parsed literal `FCB`/`FDB` data, rejecting unrecognised source expressions. `npm run source:data-check` compares all copied sound tables to the pinned checkout when one is available.
- Stage 5 diagnostic still runs unchanged player movement and starfield, with a new explicit `SCORE` RAM test button.

## Accuracy boundaries — not yet complete

The test suite is **internal source-derived tests, not differential verification** with original assembled ROM execution. Do not promote routine status beyond `translated-unverified` without original-reference traces. The pinned source cannot be downloaded in this container (network DNS blocked), although the specific routines were inspected in GitHub's source view.

The original sprite/score-digit ROM data, scanner miniature-terrain and blip tables, sound-board 6800 program, full `EXEC`/IRQ scheduler and game startup are not converted yet. This is still a **flight and scoring diagnostic**, not the full playable Defender game. There are no placeholder enemies, graphical digits, sounds or scanner blips. When a source routine requires an unported data table, rendering primitive or hardware event, it throws an explicit error. A diagnostic-only `SCRTRN` hook logs a deferred request; it does not pretend to draw the score.

## Original annotation instructions

With a locally checked-out pinned source, run `npm run source:prepare` followed by `npm run source:annotate`; the resulting generated copies embed the assembly above the matching JavaScript functions for side-by-side review. The original assembly is not bundled with this archive. Attribution and copyright remain with the original rights holders.
