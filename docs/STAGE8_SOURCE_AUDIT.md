# Stage 8 source-transliteration audit — pinned Red Label e740063

**Source:** `mwenge/defender`, fixed commit `e74006344b16d19245510b5e55780f90d7606bb8`, `src/defa7.src`. No earlier JavaScript arcade recreation or 6809 instruction emulator has been used.

## Directly translated original entry points

| Original assembly labels | Native JavaScript | Original line range | Semantics retained |
|---|---|---|---|
| `OPROC`, `OPLP0`, `OPON`, `OPLP` | `original/defa7-object-process.js` | 2500–2545 | Source OLINK walk, raster Y intervals, erase-before-redraw, unsigned viewport/width limits, 2-bit coordinate shift, fractional phase carry and OBJX display address |
| `GETSHL`, `STSHX` | `original/defa7-shells.js` | 2547–2601 | 20-projectile limit, screen test, OFREE allocation, SPTR insertion, OBJID and six-byte inline descriptor data, 20-count lifetime |
| `SHELL`, `SHELL1`, `SHELLP`, `SHELLX`, `SHBD` | same | 2603–2641, 2661–2667 | Original scroll compensation, 16-bit fixed-point X/Y increments, YMIN and $98 limits, old-position erase and output via OBJCOL |
| `BMBOUT`, `SHB1`, `FBOUT`, `SHFB1` | same | 2642–2696 | Original two-column, three-byte bitmap and odd/even nibble masks, with source BAX/FBX tables |
| `SHSCAN`, `SHSC1`, `SHSCK`, `SHSCLP` | same | 2738–2757 | Original shell lifetime, active-list unlink, OFREE insertion, OFSHIT requirement, BMBCNT decrement |
| `FBINIT`, `FBI0`, `FBI1`, `FBI2`, `FBIL` | `original/defa7-fire-tables.js` | 2720–2736 | RAND, BMI, LSRA/BCS and 8-bit arithmetic filling original FBTAB |
| `FISS`, `FISS0`, `F1`, `F2` | same | 2887–2900 | RAND and carry-bit selection filling original FISTAB |

The JavaScript has one function per original *callable* routine (including `SHBD`, which is a source internal entry point). Shared internal branch labels are documented inside their respective source-named functions and do not become independent schedulers.

### Hardware-facing interface adaptations (no gameplay rules)

`OPROC` obtains `OBJW`, `OBJDEL` and `OBJWRT` through a strict original-picture-descriptor resolver. `SHELL` obtains the original `OBJCOL` target by address from a strict resolver. This corresponds to source indirect JSR/JMP into original descriptors, **not a 6809 emulator**. The exact original picture descriptor addresses/data have not yet been extracted, so production IRQ cannot use these translations until they are available.

`GETSHL` accepts the three inline source words that follow the original callsite, rather than parsing a 6809 return address. Return `null` corresponds to a failed allocation. Both are explicitly documented control-transfer adaptations; shared-RAM writes and links remain source-defined.

The new runnable diagnostic has optional **Test OPROC drawing** and **Test FBOUT fireball** buttons. The OPROC fixture intentionally draws the **original PLAPIC ship graphic** through an explicitly diagnostic object pointer; it is not claiming the ship was an enemy in the original game. The fireball diagnostic generates the genuine source `FBTAB` through translated `RAND`/`FBINIT` and passes it through `SHELL`/`FBOUT`. Neither test is wired into an invented global frame scheduler.

### Incomplete translation boundaries

- **Original object picture data/descriptor tables:** still required for real OPROC calls; no guessed addresses or silhouettes are installed.
- **OFSHIT:** still untranslated. `SHSCAN` explicitly throws if a shell needs erasing and the required routine has not been provided.
- **BGOUT:** still untranslated, so the original IRQ still cannot run through an entire frame.
- **Enemy process AI, terrain, full collision processing, explosions and original sound-board DAC firmware:** not yet translated.
- **Source differential tests:** no original executable trace or MAME reference comparison performed. Status is `translated-unverified`, not `verified`.

The original assembler can be locally prepended to the matching JavaScript functions using `npm run source:fetch && npm run source:annotate`, when the pinned source is accessible; this archive does not redistribute the complete copyrighted original source. See `docs/TRANSLATION_RULES.md`.

## Tests

Stage 8 adds 17 direct arithmetic/linked-list/pixel-output tests to the earlier 145 regression checks, for **162 passing tests**. Additional browser checks exercise both new buttons, the previous scanner/score controls, pause, step and reset in Chromium via in-memory HTML loading (local file URL restrictions apply). Passing tests do not imply arcade accuracy.
