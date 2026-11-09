# Stage 32 — Source inter-wave bonus and gameplay continuation

## Corrected defect

Stage 31 performed all human-survival points as one hidden bulk update, then
waited 128 host updates. That was not the actual Defender between-wave
presentation. The player saw no "ATTACK WAVE ... COMPLETED" or "BONUS X" and
had no indication that ten surviving astronauts were scored individually.

## Pinned original routines

The translation follows the Red Label assembly snapshot
`e74006344b16d19245510b5e55780f90d7606bb8`:

* `DEFA7.SRC:1785–1844`: `BONUS`, `BON1`, `BCLP`, `BCLPA`, `BC1`, `BC2`, `BC3`.
* `DEFA7.SRC:1646–1665`: `GEXEC/GEX0`: `WVCHK → GNCIDE → PLSAV → BONUS → PLSTR0`.
* `DEFA7.SRC:1769–1783`: `HEXBCD` wave-number conversion.
* `DEFA7.SRC:1846–1926`: `GETWV` next-wave configuration.
* `MESS0.SRC:165–174, 288–296`: `ATWV`, `COMPV`, `BONSX`, `ATW`, `COMP`, `BX`.
* `MESS0.SRC:439–650, 740–816`: source character FDB picture tables,
  terminator `/` as a blank space, descriptor widths and `CHARSP`.

`BONUS()` clears only source playfield video through `SCLR1`, writes the
original words using source `ROMF8.CWRIT`, writes the ASCII-number glyphs
through the existing ROMF8 numeral tables and draws an original `ASTP3`
figure at `$3CA0` for each living astronaut. For each figure the original
`SCORE(1, min(PWAV,5) << 4)` adds 100 × wave multiplier. Each figure follows
a four-tick delay; once all figures are drawn, `BC2` invokes source `GETWV`,
then `BC3` follows a 128-tick wait before `PLSTR0` starts the next wave.

The source MESS0 glyph bitmaps and `ASTP3` are installed at *documented new
JavaScript-only relocation addresses* `DA00/DB00`, not claimed to be ROM
addresses on the original arcade board. The host implements the source bonus
process as an IRQ-tick continuation rather than 6809 stack manipulation.
All visible bonus text and figures are written to the source video framebuffer;
no browser text is painted over the game canvas. The external progress label
is a development-only aid.

## Scoring examples

| Completed wave | Per survivor | 10 survivors | 0 survivors |
|---|---:|---:|---:|
| 1 | 100 | 1,000 | 0 |
| 2 | 200 | 2,000 | 0 |
| 3 | 300 | 3,000 | 0 |
| 4 | 400 | 4,000 | 0 |
| 5+ | 500 | 5,000 | 0 |

Score bytes remain the original packed BCD fields and are rendered to the
original game HUD as each survivor is counted. The fifth-wave planet
restoration does not itself award any retroactive bonus; the finished wave's
survivor count controls its own tally.

## Regression validation

1. `npm run build && npm test`: all source and standalone tests plus guardrail.
2. `python tools/verify-stage32-bonus-browser.py`: real Chromium desktop
   validation of original bonus screen, source video memory, 4-frame cadence,
   next-wave score and correct starting wave; mobile unlimited Smart Bomb
   and long-press context menu prevention.
3. `node tools/verify-stage32-gameplay.mjs`: 12,000 source updates with
   live control input and wave-completion scenarios.

`tests/stage32-bonus-fidelity.test.mjs` validates original glyph content,
source bonus video pixels, per-survivor timing, 128-tick pause, score
multiplier cap, zero-survivor awards, source player movement/laser after
transition, five successive waves, fifth-wave restoration, and bundled HTML
syntax.

## Remaining fidelity boundaries

The host still uses an IRQ-pair and game-queue adapter rather than executing
6809 instructions one at a time. This implementation establishes source
**process-order, per-update cadence and arithmetic**, not an exact 6809
instruction-cycle/raster trace. Enemy behaviour, collision hitboxes and
acceleration are covered by existing source-directed tests but have not been
differentially validated against an instrumented physical Defender machine.
The seven-tick browser hold-to-fire pulse is a convenience, not an original
input repeat. **Original audio synthesis is intentionally deferred** and
**unlimited Smart Bombs remain an explicit development option**.
