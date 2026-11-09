# Stage 7 source translation audit — pinned e740063

This checkpoint is a source-level transliteration, NOT a game remake and NOT a 6809 CPU emulator.

Upstream source revision: `e74006344b16d19245510b5e55780f90d7606bb8` from `mwenge/defender`.

## Modules and verified mappings

### `original/defa7-irq.js`

Source `src/defa7.src` near lines 1928–2068:

- `IRQ`, `I0`, `IRQ1`, `IRQ2`, `IRQX`: normal 128-scanline phase split, `IFLG` latch, `TIMER` update, watchdog, `SNDSEQ`/`PLAYER`/`STOUT`, and two-phase display/object calls in the original order.
- `IRQB`, `IRQB2`, `IB0`, `IB01`: inverted cocktail scanline threshold, source `COMA` boundary, reversed subroutine order, and source watchdog value.
- `PCRAM` -> `CRAM` on original near-vblank threshold via the same final 16 data bytes as the 6809 `PSHU` groups.
- Required original dependent routines are never replaced. Missing `OPROC`, `SHELL`, `BGOUT`, etc. throw.
- 6809 stack/register restoration and PIA device signalling are hardware-facing interfaces rather than emulated instructions. No claim of cycle equivalence.

### `original/defa7-init.js`

Source `src/defa7.src` around lines 969–1063 and 1176–1203:

- `SINIT`: PIA initialisation table and write order, 9C00–BFFF clear, original CMOS credit check, seed, flags and call order. Cannot run standalone without all original dependencies.
- `INIT20`: exact original CRINIT, FISS, STINIT, OINIT, FBINIT, THINIT dispatch order.
- `CRINIT`: exact 16-byte copy from source `CRTAB`, supplied as user-extracted data, never an invented palette.
- `P1SW`/`P2SW`/`PSW1`: original upright/cocktail bit, IRQ vector JMP bytes, watchdog and PIA writes, preserved MAPCR state. Exact assembled IRQ addresses must be provided; not fabricated.

### `original/amode1-scanner.js`

Source `src/amode1.src` around lines 1159–1255:

- `SCNR`: source linked-list erase and redraw flow for old object and player blips; SETAB/SETEND entry management; writes into original framebuffer.
- `SCNR10`/`SCNR2`/`SCNR3`: source OX16 / OY16 / OBJCOL RAM variables; source bytewise shifts, signed world subtraction modulo 16 bits, 2-byte video blips.
- `MT1`/`MTLP`: source 64-column and 3-bytes-per-column mini-terrain rendering, old address erase list STETAB, and source `$6D40` origin arithmetic.
- `MTX`: original 0x9090/0x0909 scanner bezel bytes.
- Source `MTERR` data is **not** distributed. `tools/extract-mterr.mjs` can extract the exact 384 data bytes from a checked-out, SHA-verified original. No placeholder terrain is ever shown as original.
- Stage 7 standalone diagnostic offers a labelled scanner player-blip test, using source STATUS bit 1 (terrain off) only for that test. The actual scanner system is not yet integrated in the original scheduler.

## Verification

`npm test` reports **145/145** tests passing, including Stage 1–6 regressions and the new raster IRQ normal/inverted paths, exact startup call order, scanner byte movement, link traversal, erasure and parser errors.

In-memory Chromium smoke check: standalone HTML loaded, simulated frames advanced, scanner test, scoring test, pause, single-step, and no page JavaScript errors. Direct file URLs are blocked by the browser in this environment, so the browser check uses HTML content injection.

**No differential reference verification against real Defender MAME traces has been performed.** Passing these tests is not evidence that the complete game has been ported or that video and sound are arcade-accurate. Not yet translated: full object process and framebuffer scheduling, terrain source install, explosions, enemies and DAC synthesis.

## Building the source-origin scanner table locally

1. `npm run source:fetch` — clones the exact pinned source revision, where network access permits.
2. `npm run source:extract-mterr` — verifies the checkout's Git SHA and creates `original/amode1-mterr.generated.js` containing the unmodified table.
3. Import that local table into a consumer of `createAmode1ScannerRoutines(...,{MTERR})`. The standalone diagnostic is deliberately kept independent of it until source data and full original initialization are ready.
