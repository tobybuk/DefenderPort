# Stage 16 — original scanner integrated into the shared display

## Defect confirmed
Stage 15 put three source-derived enemy bitmap fixtures on the main playfield, but the original scanner routine `SCNR` was only reachable from a manual **Test scanner** button. Consequently, enemies never appeared on the miniature scanner during the normal animation loop.

## Fix
`demo/flight-harness.js` now invokes the already translated `AMODE1.SRC` `SCNR` at `RESET` and after each two-part source IRQ update (`VELO`). Scanner source `SCNR3` traverses the real original `OPTR` and `IPTR` linked lists, reads source `OX16`, `OY16`, `OBJCOL` records and writes the source 16-bit coloured blips directly into the SAME column-major video memory consumed by the browser presenter. `SETAB`/`SETEND` track prior pixels for erasure. No second Canvas scanner or made-up enemy markers were introduced.

## Scope limits
The 3 visible enemies are still seeded diagnostic world-coordinate/velocity fixtures, **not original wave spawning or AI scheduling**. The timing of original `SCNRV` process relative to physical raster hardware has not yet been verified and is represented by one update after each synthetic two-phase IRQ pair. Display palette and cabinet-timing equivalence are not established. Full enemy wave spawning, collisions, AI, sound remain incomplete.

## Regression
Four new tests exercise blips on initial frame, moving pointers/stale colour removal, immediate reset and both OPTR/IPTR sources. Existing tests and source guardrail continue to pass.
