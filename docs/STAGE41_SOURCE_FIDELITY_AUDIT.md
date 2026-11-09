# Stage 41 — Original Red Label MESS0/AMODE1 title alignment and SAMEX appearance integration

Source pin: `mwenge/defender@e74006344b16d19245510b5e55780f90d7606bb8`.
This is a native JS transliteration, not a 6809 emulator. Sounds remain deliberately deferred.

## 1. Title alignment defect (Stage 40 source departure)

- `AMODE1.SRC`, `PRES1`, lines 781–787: call `MESS0.WTEXTB` at `$3258`, using `ELECV`.
- `MESS0.SRC`, `ELEC`, lines 283–286: `FDB ELECTR; FCB RLF,RLF,HMC,12; FDB PRESEN`.
- `MESS0.SRC`, `TEXT2`, lines 745–749: `TOPL=$3258`, `CHARSP=1`, `LINESP=$0A`.
- `MESS0.SRC`, `RLF1`, lines 855–860: return `CURSER.X` to `TOPL.X` and add one `LINESP` to Y.
- `MESS0.SRC`, `HMC1`, lines 835–839: add signed/unsigned byte `$0C` to cursor's original X BYTE COLUMN.
- Therefore, second line begins **$3E6C**, not Stage 40's invented **$456C**.
- Stage 41 `PRES1` translates the same instructions as integer source video addresses. No browser CSS positioning is involved.

## 2. Enemy materialisation omitted (Stage 40 source departure)

- `AMODE1.SRC`, LEDRET lines 489–503: `JSR APVCT` when initial Lander is created.
- `AMODE1.SRC`, AMOD12 lines 606–623: `JSR APVCT` when each of six enemy types is introduced.
- `AMODE1.SRC`, AMOD11 lines 627–640: `JSR XSVCT`, then load the target caption coordinates, then `JSR APVCT` to materialise the enemy anew.
- `SAMEXAP7.SRC`, APST lines 21–63: save original `OPICT`, replace with `NULOB`, allocate a negative `$AF00` `RSIZE` and save `OBDESC`/`OBJPTR`.
- `SAMEXAP7.SRC`, EXPU4–EXPU7 lines 160–199: subtract `$0100` per source update, read moving source coordinates, erase previous EWRITE output, draw converging bitmap; restore original `OPICT` after the appearance completes.

Stage 41 gives every scripted enemy a source-format object record, calls the already-translated `APST` at those three assembly sites, steps `EXPU` every browser source tick, and suppresses whole-object drawing while `NULOB` is active. It retains `XSVCT/EXST` from Stage 40 on death; explosions and appearances therefore coexist, as in source. There is no Canvas-generated particle animation.

## 3. Demo captions also mistranslated

Stage 40 pre-printed `SCANNER`, `LANDER` and later names at incorrect times, without score lines. `AMODE1.SRC`, lines 686–695 and 1116–1130, uses `TEXTP` from `TEXTAB` and a moving `TEXPTR` limit. `BMODE2` increments the text limit **after** each laser hit. `MESS0.SRC`, lines 264–285, defines each name, `RLF`, source `HMC`, and the point value. Stage 41 follows source entry order: `SCANNER`, `LANDER 150`, `MUTANT 150`, `BAITER 200`, `BOMBER 250`, `POD 1000`, `SWARMER 150`. Captions are no longer preprinted when an enemy appears.

## 4. Why Stage 40's 450 tests falsely passed

- The prior tests asserted the **same incorrect** `$456C` constant hard-coded in the implementation.
- They tested *presence of fragments* and *existence of an explosion slot*, not source-accurate cursor math or the absent `APST` call.
- The attract path is still an integration of translated routines inside a browser tick/finite-state workbench, not a cycle-accurate implementation of the original process scheduler. Calling some assembly routines does not guarantee all source calls were preserved.
- ROM-derived pixels alone cannot catch source-process ordering errors. Regression tests must check source values, source side effects, and visual frames for each transition.

New regression tests inspect `MESS0`-derived cursor placement, `APST` negative size and 47-tick completion, all six `AMOD12` appearances, concurrent `AMOD11` explosion/appearance slots, and `BMODE2` caption/score progression. Existing tests that asserted Stage 40's non-source initial full Lander and premature LANDER heading were updated to assert the actual assembly behaviour instead.

## 5. Explicit remaining limits

- Original `MESS0.WTEXTB` is not yet a full generic ROM word-stream/command interpreter. This release translates its relevant `ELECV` and attract-mode score control sequence using the exact source constants and glyph data. It is **not claimed to be a complete 1:1 translation of all MESS0 commands**.
- Original multitasking `NEWP`, `NAPP`, `SLEEPP` timing is represented by a browser tick workbench; scheduling is approximate, not cycle-exact.
- Some object-list and OPROC interactions in the attract mode still use a browser-side sprite bridge rather than the complete original linked-object scheduler.
- Scrolling, IRQ scanout and audio are not exact hardware emulation; audio is intentionally unchanged.

These limits should not be hidden behind test pass counts. The source-first project remains partial where a routine's entire call graph has not been translated.
