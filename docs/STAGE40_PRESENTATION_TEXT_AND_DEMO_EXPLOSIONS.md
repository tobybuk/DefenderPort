# Stage 40 — PRES1 lettering and source demo explosions

Original Red Label assembly pinned at commit `e74006344b16d19245510b5e55780f90d7606bb8`:

- `src/amode1.src` `PRES/PRES1` (779–787), `AMODE3` (537–540), `AMOD11` (627–640).
- `src/samexap7.src` `EXST` (68–116) and `EXPU/EWRITE` (121–376).
- `src/mess0.src` `ELECTR/PRESEN/PERIOD` original graphics data.

## Source defect fixes

Stage 39's attract presentation drew ELECTRONICS INC and PRESENTS once. The original `PRES1` is an indefinitely repeated source process (`NAPP 5,PRES1`) that re-renders the words using `WTEXTB`. The big DEFENDER title is assembled from fifteen `APST` source fragments which erase and redraw bytes on the same RAM-mapped screen. In Stage 39, the fragment erasures permanently removed pixels from the presentation words. Stage 40 translates named `PRES1` to the original `WTEXTB` and location descriptors, then reapplies the exact source glyphs after the `EXPU` work has finished each browser frame during title expansion. This per-display-update coherency refresh is an **explicit browser scheduling adapter**, not a claim to faithfully emulate the original process scheduler's five-tick draw order. Also adds MESS0's original one-column period graphic, retaining the established BONUS glyph descriptor addresses.

In the scripted attract demo, Stage 39 ended its Lander and subsequent six enemy shots by hiding or repositioning the sprite and clearing the laser. Original `AMODE3` and `AMOD11` call `XSVCT` after `KILLOB`; they must allocate a `SAMEX` explosion slot. Stage 40 names `XSVCT` and makes it fill source-format `OX16/OY16/OPICT` fields from the enemy's original picture and invoke the already-translated `EXST`. During the instruction/demo page, `EXPU` runs every source frame and its original `EWRITE` writes expanding original-picture bytes to video RAM; `EERASE` removes the old expansion. Source demo picture addresses are relocated into a reserved JS source-ROM data space. Normal gameplay already correctly called `EXST` from `KILP`, and a regression check now verifies the visible original explosion pixels survive source `EXEC`/`STEP` after laser collision.

## Regression verification

`tests/stage40-title-and-demo-explosions.test.mjs` contains five focused tests for exact source-letter pixel continuity through the title expansion, source period descriptor, Lander demo explosion, all six subsequent scripted enemy explosions, and a playable laser hit's rendered explosion. Run `npm test` for complete project regression coverage.

Audio is intentionally deferred. The attract page's simplified source-object scheduling remains a documented accuracy boundary; this patch introduces no CPU emulator or Canvas-generated explosion particles.
