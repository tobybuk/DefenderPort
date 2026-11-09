# Stage 9 source audit — BLK71 terrain and scanner table data

Upstream pinned commit: `e74006344b16d19245510b5e55780f90d7606bb8`. Source: `src/blk71.src`. No code from previous prototype gameplay implementations has been imported.

## Original-to-JavaScript routine map

| 6809 label | JavaScript function | Pinned source lines | Scope |
|---|---|---|---|
| `BGINIT` | `BGINIT` | 94–148 | Original terrain pointer rotation, 304-entry twin flavour table construction, screen pointer zeroing |
| `BGOUT` | `BGOUT` | 153–231 | Bidirectional table updates, raster column writes through `STBL` |
| `ADDL01` | `ADDL01` | 235–302 | Left-edge updates and circular flavour storage |
| `ADDR01` | `ADDR01` | 306–368 | Right-edge updates and circular flavour storage |
| `BGALT` | `BGALT` | 373–398 | 1024 altitude bytes derived from source encoded bits |
| `BGERAS` | `BGERAS` | 403–408 | Source erase via 152 saved video-memory pointers |
| `RFONL1` | `RFONL1` | 412–430 | Rotate stream forward at left pointer |
| `RFONR1` | `RFONR1` | 433–452 | Rotate stream forward at right pointer |
| `LFONL1` | `LFONL1` | 455–478 | Reverse rotated stream at left pointer |
| `LFONR1` | `LFONR1` | 480–504 | Reverse rotated stream at right pointer |

Exact source `TDATA` (256 bytes, lines 508–523) and `MTERR` (384 bytes, lines 528–559) are in `original/blk71-data.js`. `SCNR`/`MT1` from Stage 7 now use `MTERR` rather than disabling miniature terrain. An independent `npm run source:verify-terrain` compares both tables with a locally pinned upstream checkout. It does not require ROM files.

## Hardware-specific translations and unresolved differences

1. **Bank switching:** In the original game, BLK71 terrain code overlays game memory at `$A000` and uses `$B300–$BF4F` for terrain tables. A separate `terrainBank` `Uint8Array`-backed RAM instance models this bank without clobbering PHR6 game variables. `BGL` is explicitly read from game RAM.
2. **ROM-relative data pointer:** The absolute assembled address of `TDATA` cannot be established without assembling the original source. The JS bank stores a 0–255 table-relative pointer, preserving forward and backward stepping and cyclic rollover. This is a documented representation adaptation, not a generated landscape.
3. **Original patch to `TTER03`:** The pinned source uses `COMF` in place of `STX [,Y]` and comments that it was changed to match assembled ROM bytes. This implementation follows the *documented terrain erase operation* `STX [,Y]` at that location. **Do not label BGOUT byte-for-byte ROM verified** until this discrepancy has been resolved against original output frames.
4. **Diagnostic scheduling:** The browser flight fixture invokes `BGOUT` after `PLAYER` once per update. The actual game calls `BGOUT` from a raster IRQ. Our display harness is not a translation of that scheduler; the source routine itself remains separate.
5. **No fabricated objects:** There are no new enemies, lasers, explosions or sound effects. This checkpoint enables source terrain and scanner data in an explicitly labelled flight diagnostic.

## Verification completed

- Independent reference terrain-bit walk checks the whole 1024-byte `BGALT` output, not just a few screen values.
- Mirrored 456-byte flavour table and pointer ranges checked after `BGINIT`.
- Screen entries from `BGOUT` are compared to the exact table triplets selected from terrain bank memory.
- Bidirectional camera scroll, bit rotation/carry, source pointer wraparound and `BGERAS` word erasure tested.
- Original-data table lengths and landmark bytes checked; a local source comparison script is included.
- Full Stage 9 JavaScript suite plus Chromium offline bundle smoke test performed.

**Not verified:** original cabinet/MAME differential memory states, exact ROM rendering in the patched `TTER03`, full IRQ execution, original palette, enemy process integration, full sound synthesis. The diagnostic is not an arcade-accurate playable game.

To place the original assembly listings directly above each translated JavaScript function when you have a locally verified upstream checkout, run `npm run source:prepare` then `npm run source:annotate`. Original listings are not redistributed inside this package due to the upstream's missing redistribution licence.
