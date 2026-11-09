# Stage 4 — source-first player/video conversion

Pinned original: `mwenge/defender` commit `e74006344b16d19245510b5e55780f90d7606bb8`.

## Root cause of the incorrect Stage 3 spaceship

`DEFB6.SRC` labels `PLAPIC` and `PLBPIC` contain `FCB 8,6`; the 48 data bytes in `PLD10`, `PLD11`, `PLD20`, `PLD21` are **eight video-address columns, each six raster bytes high**. Because a video byte contains two *horizontally adjacent* 4-bit pixels, the image is **16 physical pixels wide × 6 high**. Stage 3 erroneously plotted the nibbles vertically, producing an 8×12 portrait-shaped spaceship. The numeric sprite bytes were already correct, but their interpretation was not.

This was fixed at the original video-memory interface, not by rotating or scaling an image in Canvas. The browser display reads original video-address writes, rather than redrawing a special ship illustration.

## Newly translated original routines

| Original source | Original label(s) | JavaScript module | Original semantics |
|---|---|---|---|
| `defa7.src` 168–470 | `ON28/OFF28`, `ON48/OFF48`, `ON58/OFF58`, `ON34/OFF34`, `ON23/OFF23`, `ON64/OFF64`, `ON56/OFF56`, `ON66/OFF66` | `original/defa7-object-video.js` | Identical column-major rectangular source-byte copies and erasures, retaining odd-phase data selection |
| `defa7.src` 373–429 | `ON86/ON860`, `OFF86` | `original/defa7-player-video.js` | Source 8×6 graphics-byte transfers, with two HORIZONTAL pixels per byte |
| `defa7.src` 2213–2289 | `THOUT/THOUTX`, `THOUT1/THT1X`, `THOFF1`, `THOFF` | `original/defa7-player-video.js` | Original THX-based 5-byte thrust mask and extra pixels on each side of the ship |
| `defa7.src` 2293–2316 | `PRDISP/PRDSP1/PRDSP2/PRDSP3/PRDX` | `original/defa7-player-video.js` | STATUS check; scanline interval check; erase old direction; PLADIR←NPLAD; draw appropriate image and thrust |
| `defa7.src` 2320–2333 | `POUT/POUT1/POUT2`, `POFF/POFF1` | `original/defa7-player-video.js` | Original ship drawing, 1-bit image phase from PLAX16+1, previous displayed byte address |
| `defb6.src` 1959–1963, 2141–2174 | `PLAPIC`, `PLBPIC`, `PLD10/11/20/21` | `original/defb6-player-data.js` | The original unmodified 48-byte picture tables, including both facings and phases |

The source's stack-register transfers (`PSHU`, `PULS`) are translated to the **same graphics memory writes**; no 6809 CPU is emulated.

## Browser video layout

`browser/video-presenter.js` decodes the graphics memory at address `(byte_column << 8) | raster_y`, with the high nibble as the left pixel and low nibble as the right pixel. The MAME Red Label visible crop used for the diagnostic is x=12..303 (292 pixels), y=7..246 (240 pixels). This is a browser-only projection of existing framebuffer bytes. The current RGB palette is **not** the translated original palette.

## Diagnostic boundary

`createFlightHarness().STEP()` still invokes the translated `PLAYER` and `STOUT`, then invokes `PRDISP(255,0)` with a **test scanline range**. The original IRQ-driven scanline scheduling is not yet translated. This is deliberately isolated in `demo/flight-harness.js` and is *not* represented as original Defender gameplay.

`SINIT`, real interrupt processing, video colour registers/palette, scanner, terrain, all enemies, game collisions, explosions and sound-board firmware remain incomplete. This build is a runnable diagnostic, **not** the finished game.

### Verification

Stage 4's tests cover: original 48-byte picture tables; layout and odd/even source phase; full byte-for-byte ON86/OFF86 copies; POUT/POUT1; PRDISP gating, erase/direction switching; exact thrust write offsets; the additional original object output routines; and horizontal-nibble video presentation.

No MAME state/frame comparison has yet been performed; these additions remain `translated-unverified`. To embed full original assembler listings before corresponding JavaScript functions, run `npm run source:prepare && npm run source:annotate` against the pinned upstream checkout (not included in redistributed files).
