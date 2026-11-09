# Stage 18: lander creation and target integration

## Source-accurate paths now connected

* Source `GEXEC/GEX2` calls `LANDST(A)` when `LNDRES > 0` and `LNDCNT < 8`.
* `LANDST` calls `RAND`, `RMAX`, `MKPROC`, `OBINIT`, `GTARG` and the
  shared `OPTR` adapter, creating a source lander object and active process.
* `GTARG` uses `ASTCNT`, `TPTR`, the original source's `TLIST+64`
  wrapped range, `PD2` and `PD4` for targeting; it does not choose a nearest human.
* `LANDS0` and pickup/flee continuations are dispatched as original processes.
* `GETALT` uses `BLK71` altitude data and `LSHOT` uses source `GETSHL`.
* Original SCNR reads source objects, even when a lander is off-screen.

## Explicit fixtures and incomplete features

One human record is seeded into `TLIST` at a fixed world coordinate. It
provides a valid original target pointer, but does **not** substitute for
full original SINIT/astronaut population. Human sprite data is not yet
registered with OPROC, so this one human intentionally remains unrendered.
Lander positions are **not forced on-screen**: source RAND selects their
world positions. This means some runs can show only a scanner blip for a
lander until the viewport scrolls. This is not an assertion of game parity.

The shared APVCT adapter still inserts linked objects into OPTR rather
than implementing the whole appearance process. Full collisions, wave
completion, sound synthesis and some enemy sprites remain to be integrated.
