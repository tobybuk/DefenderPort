# Stage 31 source input, scanner and executive audit

## Scope

This milestone repairs source-level scheduling and input semantics in the shared
playable harness without changing sound synthesis or the temporary unlimited-bomb
setting. Source version remains pinned to the Red Label assembly used throughout
the project. Reference entry points: `DEFB6.SRC` `SWTAB` lines 1844–1859,
`DEFA7.SRC` `SSCAN` lines 758–805, `EXEC/SWP/DISP` lines 3042–3126, and
`SCPROC/SCP1/SCP2` lines 3294–3305.

## Changes

- Added `original/defb6-switch-table.js`: all eight four-byte switch records
  in source bit order. Process relocation handles refer to native JS bindings;
  credit/start switches remain unbound in the browser fixture.
- Added original switch sampling to both translated IRQ passes and connected
  `SWP` processing through the source process queue. The original status mask
  is applied to the **low byte** of `SWP` data, as the assembly uses `ANDB`.
- Connected `createDefa7Executive.EXEC` to player collision checking, source
  explosion update, random advance, queued-switch processing and process dispatch.
  This fixes the former post-dispatch collision ordering.
- Preserved the existing legacy diagnostic harness via `sourceCabinetInput:false`
  while enabling source cabinet mode in the browser game.
- Removed unconditional playfield scanner redraw from every `STEP`; the original
  `SCPROC→SCP1→SCP2` chain now calls `SCNRV` on its own tick cadence.
- Added a one-frame `pendingTaps` latch for short keyboard/mobile button taps.
  Hold-to-fire emits a seven-tick source-button pulse (browser convenience)
  rather than directly invoking `LFIRE`. There is no claim that this exact
  input repetition rate was present on the cabinet.
- No sound-board synthesis was added. Unlimited Smart Bombs remain enabled.

## Tests and observed results

- 400/400 Node tests pass, including 13 new source table, IRQ input, priority,
  switch debounce, scanner cadence, EXEC callback order, wave and bundle tests.
- Browser `tools/verify-stage30-browser.py`: six desktop/mobile checks passed;
  source first wave, unlimited bombs, Hyperspace, held Fire, long-press prevention.
- Browser additional Stage 31 short mobile tap checked in real Chromium: a
  pointer-down immediately followed by pointer-up reaches the original queued
  Hyperspace process. Standalone JavaScript has no page errors.
- Two 10,000-step simulation scenarios completed without exceptions, with one
  scenario reaching wave two. Normal-player deaths and resets were exercised.

## Known boundaries

The cabinet IRQ source calling site, clock/cycle phase and raster/beam effects
are not proven exact. The higher-level source process semantics are preserved
where implemented. Remaining hardware differences (including sound synthesis)
need hardware or ROM execution differential validation. The 7-tick held-fire
repeat remains a host adapter, and credit/START controls are not included.
