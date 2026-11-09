# Stage 38: Williams/DEFENDER colour and Hall of Fame fidelity

## Source

Pinned original Williams Defender Red Label assembly (repository commit `e74006344b16d19245510b5e55780f90d7606bb8`): `AMODE1.SRC` (AMODES/LOGO0/PRES/DEFEND/DEFENS/DEF50/DEF44/CBOMB/HALDIS/COPYRT); `DEFA7.SRC` (COLR/COLTAB); `DEFB6.SRC` (TIECOL/TCTAB); `ROMC8.SRC` (DEFALT). The local source files are pinned in the source-manifest of the ZIP. The screenshots provided by the user were used as visual layout references rather than substituted raster images.

## Changes

- `AMODES` starts source colour processes during attract mode. `COLR` writes `PCRAM+1` on its two-tick source schedule; `TIECOL` applies three-phase `TCTAB` to hardware colour register `F`. Both are latched into the browser-visible $C000–$C00F colour-RAM path, so Williams' original colour-nibble pixels actually animate.
- After the complete slow logo traversal, `PRES` writes its two source message lines. The `DEFEND` process starts on the original delay, and `DEFENS` builds 15 source `APST` objects with original 4×12 sprite descriptors, feeding the existing `EXPU` transition. `DEF50` restores the full 60×24 source `DEFNNN` title before `DEF44` enables the `CBOMB` palette cycling.
- Original `CPRTAB` copyright bitmap is written through the source framebuffer. The Hall of Fame renders both score lists from `ROMC8.DEFALT`: DRJ 21270, SAM 18315, LED 15920, PGD 14285, CRB 12520, MRS 11035, SSR 8265, TMH 6010.
- Start Game and Watch Demo maintain their previously tested state transitions.

## Not yet arcade-exact

The `ROMC8.DEFALT` scores are factory defaults, **not** persistent high scores; CMOS editing and coin input are deferred. The original source-process steps are translated, but no instruction-cycle/raster-perfect independent-machine comparison is claimed. Sounds remain intentionally deferred. Unlimited Smart Bombs remain a development option in playable mode.

## Regression coverage

`tests/stage38-presentation-colour-animation.test.mjs` verifies palette byte timing, actual RGB for Williams colour F, 15 appearance slots, delayed `DEF50`, `CBOMB` changing visible colour C, source copyright and multiline text pixels, and both default factory score columns.
