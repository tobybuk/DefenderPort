# Stage 29: Williams Defender programmable colours, ROM HUD and host frame budget

## Scope and source provenance

Original pin: `mwenge/defender` at `e74006344b16d19245510b5e55780f90d7606bb8`.

| Area | Original source | Native JavaScript |
|---|---|---|
| Palette initialisation | `DEFB6.SRC CRTAB` data, `DEFA7.SRC CRINIT` | `original/defender-hud-data.js`, `original/defa7-init.js` |
| Wave terrain colour | `DEFA7.SRC WCTAB`, `PLSTR3` | `demo/flight-harness.js` writes PCRAM+5 |
| Palette latch | `DEFA7.SRC IRQ`, `PCRAM → $C000` | `original/defa7-irq.js`, `browser/defender-palette.js` |
| Laser-colour cycle | `DEFA7.SRC COLR`, original `NAP #2` | `original/defa7-process-tasks.js`, shared `DISP` |
| Numerals | `MESS0.SRC NUMBR0..NUMBR9`, `N0V` | `original/defender-hud-data.js`, `original/defa7-score-display.js` |
| Mini-ship / bomb pictures | `DEFB6.SRC PLAM0/SBD10` | `original/defender-hud-data.js`, `original/defa7-hud.js` |
| Graphics writer | `ROMF8.SRC CWRIT/COFF/BLKCLR` | `original/romf8-graphics.js` |
| Timing reference | Defender video counter, 1 MHz, 16,640 counts/frame | `browser/source-clock.js` |

### Source-data addresses

The exact original glyph **bytes** and four-byte descriptor format are preserved. Their image tables are installed at JS-memory **relocations** `$D700/$D740/$D744`, with bitmap data from `$D800`; these are not claimed to be literal original ROM addresses. The original CWRIT routine reads the relocated descriptor records and writes into the original column-major 4-bit-pixel video RAM.

The original player score positions `P1DISP=$0F1C`, digit step `$0400`, spare ships at `P1LAT=$0F14` and bombs at `P1SBD=$291B` are used. Original HUD bitmap data is not replaced by Canvas fonts or icons.

### Palette

The sixteen bytes from `CRTAB` initialise `PCRAM`, while `$C000` contains the separate hardware colour latch. The original two-phase IRQ translation copies the staged table at the source raster branch. `COLR` cycles PCRAM+1 on its original scheduled delay. The browser reads `$C000` for each output frame and interprets bits 0..2 as red, 3..5 as green and 6..7 as blue. This simulates the board's digital RGB selection, not analogue CRT gamma or resistor response. Smart Bomb's palette flashing now shows through the same memory path.

### Timing fidelity and limits

A video counter clock at 1 MHz and a 16,640-count frame imply 60.096153846 Hz (16.64 ms). `createSourceFrameClock` accumulates browser `requestAnimationFrame` deltas, performs whole source updates, limits each callback to six, drops background-tab time and resets on pause. It does **not** emulate the CPU. The main `STEP()` remains a host boundary calling two source IRQ halves using fixed diagnostic `VERTCT` values, one `DISP` continuation and one expansion update per frame. Source-level NAP and process timeouts remain translated, but full arcade cycle/raster scheduling and interrupt timing have not been proven against an original-machine trace.

### Deferred / not claimed

**Sound** remains outside this release, as requested. Full acoustic reproduction, external sound-board instructions and waveform synthesis have not been added. Source software sound-command bytes and their existing tests are unchanged. The bundled standalone version is subject to its existing gameplay limitations and is not yet certified as an exact arcade-machine implementation.
