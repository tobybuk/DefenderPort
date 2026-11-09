# Stage 51 — Deep timing audit of Williams Defender Red Label

## Scope and verdict

This audit compares the readable Stage 50 native-JavaScript translation with
pinned Williams Red Label source, `mwenge/defender@e74006344b16d19245510b5e55780f90d7606bb8`.
The goal is source behaviour, **not** a visually selected slowdown. The game
still contains no 6809 emulator. Stage 51 corrects two measurable architectural
timing mistakes, but it is **not** a verified original-ROM timing translation.

**Key finding:** In the deterministic title scene, the Stage 51 changes alone
*do not change* the first complete DEFENDER redraw's elapsed time. Both
Stage 50 and Stage 51 reach appearance age 46 at physical frame **338**
(relative to reset). The older Stage 49 unbudgeted path reached it at frame
320. The title's measured interval from first `DEFENS` allocation to `DEF50`
remains 64 nominal video periods, or **1.065 seconds**. Claims that the
correction alone makes the animation match a cabinet would be unsupported.

## Original source: three clocks that must not be conflated

1. **Physical video:** 8 MHz pixels, 512 clocks × 260 total scanlines per
   frame gives 16,640 E-clock periods at 1 MHz, or 60.096153846 Hz. This
   clock runs irrespective of browser paints and executive load.
2. **Raster IRQ (DEFA7 lines 1928–1994):** at/above vertical counter 128,
   `IFLG` gates the high-raster half. It invokes `SNDSEQ`, `PLAYER`, `STOUT`,
   `OPROC`, `PRDISP`, `SHELL`. On the low-raster side, the interrupt clears
   `IFLG`, executes **`INC TIMER`**, and performs scanner/background and
   velocity output. The inverted/cocktail IRQB has a different order.
   Only the once-per-frame count is modelled by the new attract scheduler;
   its full callbacks and time consumption remain outside this implementation.
3. **Executive and cooperative processes (DEFA7 lines 3042–3126):** `EXEC0`
   loads `A=TIMER` and **clears TIMER once**. `EXEC1` calls `XUVCT`, `RAND`,
   then `DISP`. `DISP1` decrements the `PTIME` of each linked active process
   **once per executive pass**, regardless of how many video IRQs accumulated
   during the previous long pass. `SLEEP` writes `PTIME` and `PADDR`, not
   a wall-clock timer.

Note: the pinned text at `EXEC0` has a documented `FCB $11,$13` repair marked
`Fixme was BEQ EXEC0`; we use its surrounding program contract and do not
claim those two raw bytes are a verified exact spin-wait instruction sequence.

## Bugs in Stage 50, corrected here

### A. A queue of fictional executive calls

The old `createSourceCpuBudget` added one `pendingTimer` for each physical
frame, then ran one full `STEP` to satisfy each item. But the original uses a
**single unsigned 8-bit counter**, not a queue. If one pass spans four IRQ
periods, `EXEC0` reads `TIMER=4`, clears it and dispatches processes **once**.
Stage 51 models that register, its byte overflow, and the single read/clear.
It exposes the actual number read in `state.execTimerRead` and a source-
cycle timing trace. This matters for longer overruns and for overload policy.

### B. Browser paint rate incorrectly slowed the physical video clock

Stage 49/50 set the attract `createSourceFrameClock({maxCatchUp:1})`, which
could simulate only *one* 16.64 ms hardware frame per `requestAnimationFrame`.
On a 30 Hz browser that ran the source at **30 Hz**, rather than 60.096 Hz.
Stage 51 permits up to six catch-up periods, the same as gameplay. A browser
with a 30 Hz screen necessarily samples some intermediate images rather than
displaying all 60, but the source time does not stop or slow down. Extreme
background-tab gaps are intentionally discarded to avoid multi-second jumps.

### C. Transparent timing observability

`npm run timing:trace` now writes physical-frame, EXEC, TIMER read, title
age and estimated CPU-cycle data to `docs/STAGE51_VIDEO_CPU_TRACE.csv` and
`docs/STAGE51_VIDEO_CPU_SUMMARY.json` for comparison. These expose precisely
what is measured rather than substituting a fixed speed percentage.

## What the Stage 51 trace actually says

For the deterministic source title fixture with 520 nominal video frames:

| State | Video frame | Executive passes | Approx. elapsed since DEFENS |
| --- | ---: | ---: | ---: |
| First 15 appearance allocations (`DEFENS`) | 274 | 274 | 0 ms |
| Fragment age 15 | 291 | 289 | 283 ms |
| Fragment age 30 | 312 | 304 | 632 ms |
| Fragment age 45 | 337 | 319 | 1,048 ms |
| Whole-word restore starts (`DEF50`, age 46) | 338 | 320 | 1,065 ms |

At frame 520: 520 IRQ-timer increments and 498 executive passes. The trace
retains the most recent 256 executive pass records; 21 of those read TIMER
values greater than one. This illustrates the different clocks, **not**
verified original arcade speed. It agrees with Stage 50's frame-338 position
in this particular scene. No additional source-defined slowdown is justified
by this evidence alone.

## Exact source routines still *not* time-accounted

| Priority | Hardware/source path | Current omission | Needed for source accuracy |
| --- | --- | --- | --- |
| Critical | Full `IRQ` / `I0` / `IRQB` plus `SNDSEQ`, `PLAYER`, `STOUT`, `OPROC`, `PRDISP`, `SHELL`, `CSCAN`, `BGOUT`, `VELO` | Attract timer count is generated, but the source IRQ is not an independently charged, interrupting task. Gameplay has its own once-per-browser-frame composite update. | Move original IRQ halves to independently scheduled native JS continuations, instrument their instruction paths and charge actual cycles against the same CPU timeline. |
| Critical | `EXEC1` / `COLCHK` / `SWP` / `DISP` plus game processes | The Stage 50 ledger counts mainly `EXPU` and `DEF50`; it does not measure an entire source pass. | Add per-routine path-dependent cycle accounting with branch, indexed-address, memory-map and stack timings; no generic estimated flat delay. |
| High | `LOGO0`, `PRES1` / `MESS0` `WTEXTB`, `COPYRT`, `WILLIR` | They execute as host actions without 6809 cycle charges; synthetic redraw adapters also write pixels outside original task cadence. | Translate/cost source text interpreter and logo process, remove host restoration after correct `WILLIR`/IRQ interleaving is available. |
| High | `EXPU` / `EWRITE` / `EERASE`, `CWRIT` | Some inner loops are instruction-counted, but branch/clipping paths have estimated constants; whole routine mutates video atomically in JS. | Instrument branch-specific 6809 cycles and timestamp each framebuffer write while retaining native JS routines. Run a cycle-stamped video event queue rather than instant full-frame writes. |
| High | `DEFENS/APST` x15 allocations | Initial explosion allocations currently have no CPU cost in the ledger. | Measure each `APST` allocation, RAM list walk, and source field mutation. |
| High | Original main-game `EXEC` vs IRQ | Gameplay `lab.STEP()` still bundles work into nominal 60.096 Hz updates without costed preemption. | Reuse one physical timeline for gameplay and attract; separate source IRQ and executive tasks. |
| Medium | `EXEC00` overload branch (`OVCNT`, `STRCNT`, `OFSHIT`) | Current host records timer values but does not reproduce the original overload policy in the attract controller. | Translate `STATUS`-dependent overload decisions; preserve 8-bit signed arithmetic and original active-object removal. |
| Medium | Screen presentation | Browser `requestAnimationFrame` presents the latest complete JS buffer rather than 6809-era raster scanline state. | Timestamp video RAM/palette changes and capture scanout at source raster position; physical CRT phosphor characteristics remain outside digital fidelity. |
| Medium | Sound-board timing | Standalone VSNDRM1 synthesiser exists, but shared PIA/IRQ hand-off is not fully instruction-cycle-accounted. | Keep the separate 6808 timing trace synchronized with main board PIA writes. |

A useful distinction: BLK71 `BGOUT` is **not** a generic always-on penalty.
The original IRQ conditionally skips it when `STATUS & 2` is set; the title
uses `$FB` (the bit selected by mask $02 is set), so charging the whole
terrain renderer on every title IRQ would invent a large slowdown. Exact
`STATUS`/`VERTCT` gating must be implemented before including the cost.

## A rigorous verification approach before calling timing complete

1. Produce an independent golden trace from the pinned assembled Red Label
   ROM (MAME debugger or physical hardware logic analyser), for physical
   video frame, IRQ phase, `TIMER`, `EXEC0`, `DISP`, `DEFENS`, each `EXPU`,
   `DEF33` and `DEF50`. A *reference-only* MAME trace is compatible with
   shipping the game as native JavaScript, not a 6809 emulator.
2. Instrument each native-JS source routine to log its RAM/video writes,
   branch path and counted cycles. Compare source register states and event
   timing against the golden trace, not only the final screenshot.
3. Make each translated task resumable at interruptible source boundaries,
   preserving the original routine names and ordering. This is how a native
   JS implementation can respect IRQ preemption without CPU emulation.
4. Maintain separate physical video, IRQ and executive clocks in tests;
   test real-time rates at 30/60/120Hz browser paints with fixed elapsed time.
5. Verify wave, thrust, lasers, sound priority and title composition across
   display frames. Do not add a constant slowdown until independent evidence
   supports it.

## Known release guarantees and limitations

**Stage 51 delivers** a real byte-counter timing contract, correct one-pass
TIMER consumption, repeatable trace, correct browser clock use, and original
sleep constants. No visual asset or sound command is intentionally altered.

**Stage 51 does not deliver** a cycle-exact 6809 executive, fully interruptible
`EXPU`, precise mid-frame video writes, fully costed raster IRQ, or proof
of cabinet-identical title speed. In the deterministic title trace, the
visible completion frame has **not moved** relative to Stage 50. It would be
misleading to advertise this as a speed fix; it is a necessary timing
architecture repair and a source-led specification for the remaining work.

## Primary source pointers

- [DEFA7.SRC IRQ/I0 1928–1994](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/defa7.src#L1928-L1994)
- [DEFA7.SRC EXEC/SWP/DISP 3042–3126](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/defa7.src#L3042-L3126)
- [AMODE1.SRC LOGO0/PRES/DEFENS/DEF50 711–890](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/amode1.src#L711-L890)
- [MESS0.SRC WTEXTB/TEXT3 714–871](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/mess0.src#L714-L871)
- [SAMEXAP7.SRC EXPU/EWRITE 121–376](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/samexap7.src#L121-L376)
- [BLK71.SRC conditional BGOUT 153–231](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/blk71.src#L153-L231)
- [Sean Riddle on Williams 6809 hardware](https://seanriddle.com/willhard.html)
