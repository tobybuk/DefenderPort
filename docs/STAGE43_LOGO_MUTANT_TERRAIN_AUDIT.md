# Stage 43 source audit — Williams title, mutant, and demonstration terrain

Pinned upstream: `mwenge/defender` commit `e74006344b16d19245510b5e55780f90d7606bb8` (Red Label).

## Observed faults in Stage 42

1. **WILLIAMS letters developed holes during `DEFENS`.** `SAMEXAP7.EXPU/EERASE` can zero video bytes containing pixels already drawn by `AMODE1.LOGO0`. Stage 42 translated the eventual `WILLIR` fast redraw but its cooperative/browser update order exposed damaged pixels before the next `LOGO0` traversal.
2. **MUTANT looked unanimated.** Both `AMOD12` and `AMOD11` already started the correct `APVCT` materialisation, but `AMODE1.LEDRET` also starts `NEWP CBOMB,AMTYPE`. Stage 42 omitted **that process on the instructions page**, leaving palette slot `$C` constant. The original `SCZP1` image contains `$C` pixels; its visibly cycling colour requires that process.
3. **Explosion erasures created persistent gaps in the ground.** `SAMEXAP7.EERASE` writes zero into prior expansion positions. Stage 42 executed `BLK71.BGINIT/BGOUT` only once at `SCINIT`, then continued to erase landscape bytes as the exploded enemies moved/expanded.

## Corrections

- Preserve `LOGO0`'s original `LGOTAB` cursor, nibble positions and incremental drawing. A **browser presentation-only restoration** records the address/nibble set by actual `LOGO0` writes, and reapplies *only those original source-traced nibble values* after `EXPU`. This avoids replacement art, extra text sprites or clearing an entire rectangular region. It is explicitly **not** a claim of cycle-accurate process scheduling. Source `DEF50`/`WILLIR` remain unchanged.
- Activate the existing `CBOMB`/`CBMB1` source colour-process translations on entry to `LEDRET`, matching `AMODE1.SRC` source order. Their palette updates continue to flow through `PCRAM` and the original latch. Do not add any mutant-specific made-up motion.
- Run the already translated `BLK71.BGOUT` at the end of each browser-attract tick after `EXPU`, object updates and other video writers. This uses the original `STBL` and terrain-flavour tables to reconstruct the unchanged ground. This is a scheduling restoration: the original raster/task interleaving is not fully implemented, so exact per-scanline occlusion is still unverified.

## Source locations

- `src/amode1.src`: `LOGO/LOGO0/LOGO7/LOGO8/LOGO9`, `DEFEND/DEFENS/DEF50`, `WILLIR/WILR1`, `LEDRET` (`NEWP CBOMB,AMTYPE`), `AMOD12` (`JSR APVCT`), `AMOD11` (`JSR APVCT` again).
- `src/samexap7.src`: `APST`, `EXPU4..EXPU9`, `EERASE`, `EWRITE`.
- `src/defb6.src`: `SCZP1` source picture (palette nibble C), `CBOMB/CBMB1`.
- `src/blk71.src`: `BGINIT`, `BGOUT`, `STBL`, terrain-flavour tables.

Links:
- https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/amode1.src
- https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/samexap7.src
- https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/defb6.src
- https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/blk71.src

## Regression coverage

`tests/stage43-title-mutant-terrain.test.mjs`:

- `CBOMB` palette entry C both zero and multiple nonzero states throughout LEDRET.
- Two source `APVCT` invocations for MUTANT, with persistent original image nibble `$C` at `$4660` and cycling palette while the sprite is stationary.
- Original terrain source pixels remain nonzero after several normal and scripted `XSVCT/EXPU/EERASE` phases, including later Bomber/Pod sequences.
- Source-traced Williams pixels remain intact through the 15 `DEFENS` APST slices.

## Remaining boundaries

This remains a **native JavaScript transliteration**, not a 6809 emulator. Complete original `EXEC` dispatch, raster IRQ interleaving, MESS0 generic text interpreter, real cabinet inputs, faithful high-score persistence, and per-frame validation against a Red Label ROM execution trace are incomplete. Sound is deliberately deferred. A passing source regression suite is not certification of 100% ROM-equivalent attract-mode animation.
