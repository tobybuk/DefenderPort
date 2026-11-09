# Stage 10 source audit — original IRQ handoff and DEFB6 bank / object-erasure entry points

## Immutable source reference

- Repository: https://github.com/mwenge/defender
- Commit: `e74006344b16d19245510b5e55780f90d7606bb8`
- Game source: [`src/defa7.src`](https://raw.githubusercontent.com/mwenge/defender/e74006344b16d19245510b5e55780f90d7606bb8/src/defa7.src), `IRQ` and `IRQB` around lines 1928–2068
- Bank/erasure source: [`src/defb6.src`](https://raw.githubusercontent.com/mwenge/defender/e74006344b16d19245510b5e55780f90d7606bb8/src/defb6.src), `KILOFF`/`OFSHIT` lines 1149–1159 and `BGI`/`MAPCH*` lines 1284–1300
- Translation category for each new routine: **translated-unverified**. No original-ROM versus native-JavaScript differential trace is available.

## Newly translated original entry points

| Assembly | JavaScript module and function | Behaviour |
|---|---|---|
| `MAPCHG` | `original/defb6-banking-object.js` `MAPCHG` | Store one-byte bank selection to source `MAPCR`, then hardware-select register `MAPC` |
| `MAPCH7` | `original/defb6-banking-object.js` `MAPCH7` | Dispatch literal bank `7` to `MAPCHG` |
| `MAPCH2` | `original/defb6-banking-object.js` `MAPCH2` | Dispatch bank `2` to `MAPCHG` |
| `MAPCH3` | `original/defb6-banking-object.js` `MAPCH3` | Dispatch bank `3` to `MAPCHG` |
| `MAPCH1` | `original/defb6-banking-object.js` `MAPCH1` | Dispatch bank `1` to `MAPCHG` |
| `BGI` | `original/defb6-banking-object.js` `BGI` | Select bank 7 and invoke translated original `BGINIT` |
| `OFSHIT` | `original/defb6-banking-object.js` `OFSHIT` | Select bank 2; read `OBJX` and `OPICT` from original object record; invoke descriptor's `OBJDEL` pointer |
| `KILOFF` | `original/defb6-banking-object.js` `KILOFF` | Direct call to original object-list delete routine `KILLOB` |

The source uses `PSHS`/`PULS` to preserve registers. JavaScript locals/arguments have the same non-destructive effect on the original RAM records. No CPU instruction decoding is present. The original indirect descriptor still requires a real picture descriptor. The diagnostic offers **one explicitly labelled fixture descriptor** for the existing original `PLAPIC` bitmap; all other unknown descriptors fail visibly.

## Real IRQ call sequence now integrated

`demo/flight-harness.js` creates `createDefa7IrqRoutines` using original-named callback functions, rather than invoking `PLAYER`, `BGOUT` and `STOUT` from a substitute browser update algorithm. The exact normal-upright source order is:

- Upper half: `SNDSEQ`, `PLAYER`, `STOUT`, `OPROC`, `PRDISP`, `SHELL`.
- Lower half: `CSCAN`, conditionally `BGOUT`, `PRDISP`, `OPROC`, `VELO`.

**Hardware-only input boundary:** the diagnostic supplies `VERTCT=0x90` followed by `VERTCT=0x08`, one upper and one lower raster sample, through the original virtual register address `$C800`. This is an explicitly labelled laboratory stimulus, **not** a claim to emulate real monitor timing or the 6809. Coin ports return their idle values. The translated `IRQ` determines all game-visible routine order and drives the 60Hz diagnostic.

`PRDISP` accepts the original 16-bit `D` as separate original `A` and `B` parameters in JavaScript; the harness converts `D>>>8` and `D&0xff` without changing branch logic. In source, `BGOUT` is bank 7 and `OPROC` is bank 2. The existing source modules already maintain their documented bank separation. Stage 10's `MAPCH*` functions are now available independently for other original call chains, not substituted into the existing source IRQ.

An error was also fixed in `original/defa7-exec.js`: the `EXEC` overload branch now passes the original `X` object pointer into `OFSHIT` instead of calling it with no argument. A test confirms the original `X` flows through the callback, and the object's list transition remains source-managed.

## Test coverage

- Eight bank-selection and source erasure invariants (including actual original-bitmap pixel clearing).
- Real `IRQ` pair reaches original `PLAYER`, terrain, object, shell and scan routines; increments `TIMER` once and restores `IFLG`.
- Holding thrust for 24 source pairs changes the fixed-point velocity and world position without a custom physics loop.
- Diagnostic object is processed through original `OPROC` under interrupt clipping.
- Original `EXEC` overload branch forwards correct object pointer to `OFSHIT`.
- Standalone offline HTML checked in Chromium with pause, thrust, scanner, `BGOUT`, `OPROC`, `OFSHIT`, fireball, scoring and reset actions. No JavaScript page exceptions were observed.

## Explicit remaining limitations

1. **Not yet playable Defender.** The full `SINIT`/`EXEC` cooperative process cycle and original enemy creation / movement processes remain disconnected. Only the original raster interrupt routines are integrated into the input-driven flight diagnostic.
2. **Hardware input is diagnostic.** `VERTCT` and idle coin-port values are lab stimuli; real IRQ edge timing, bank-selection side effects and shared data-bus behaviour have not been tested on hardware.
3. **Picture descriptors.** Only the diagnostic object's `PLAPIC` descriptor is bound; unresolved original game descriptors throw rather than substituting artwork.
4. **Sound.** `SNDSEQ` dispatches original command bytes; the original 6800/DAC sound firmware is not yet translated. There is no audible sound.
5. **Palette.** Browser view still uses a diagnostic palette. No claim of bit-exact rendered colours.
6. **Differential verification absent.** The test suite is source-derived, not a demonstration of parity with MAME or the original machine. The source image was reviewed via published pinned text, but the build container could not clone the pinned repository for complete automatic annotation / symbol auditing.

The original upstream source does not state a permissive redistribution licence; the downloadable project links to the corresponding source listings and includes an annotation generator for a user-provided original checkout rather than redistributing the entire assembly.
