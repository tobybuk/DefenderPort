# Stage 52 — source-driven high-score entry and approved THRUST synthesis

## Scope and baseline

Stage 51 readable native JavaScript baseline. This revision **does not change title timing**. It keeps the 6809 assembly call/routine names and the existing browser adapter; it is not a 6809 or 6808 emulator.

Original pinned Red Label assembly: `mwenge/defender@e74006344b16d19245510b5e55780f90d7606bb8`.

- Game-over source: [`DEFA7.SRC` PLE2/PLE3](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/defa7.src#L1422-L1431)
- High-score state and algorithms: [`AMODE1.SRC` HALLOF, HALL4, CPXCY, HOFIN, HOFUL, HOFAS, HOFMD, HOFST, HOFBL, HOFUD](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/amode1.src#L112-L365)
- Text messages: [`MESS0.SRC` HOF, INITSS, HALLD and HALEN](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/mess0.src#L298-L326)
- Factory scores and persistence: [`ROMC8.SRC` DEFALT, RHSTD, RHSTDS](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/romc8.src#L690-L711)
- Approved audio fix: [`VSNDRM1.SRC` FNOIS3/FNOIS4/ FNOIS5](https://github.com/historicalsource/williams-soundroms/blob/main/VSNDRM1.SRC), compared with the approved standalone Stage 49 sound-test source.

## THRUST audio integration

`original/VSNDRM1-synth.js`: replaced the faulty FNOISE ramp logic with the approved FNOIS3/FNOIS4 arithmetic. `FNOISE_ADDB_ADCA` and `FNOISE_SUBB_SBCA` return the carry after the **high** byte as the 6808 BCS requires. `randomFromSound` takes the current accumulator A, not the previous DAC latch, and the FNOIS5 exit restores A from LO. The source command values `$16` and `$0F` are unchanged. BG1 and CANNON share this corrected synthesis path.

## High-score flow

| Source | Native JS equivalent | Behaviour |
|---|---|---|
| DEFA7.PLE2 | browser `game-over` state | Display final score, wait 40 ticks after last player death |
| AMODE1.HALLOF/HALL1 | `createAmode1HallOfFame.HALLOF` | Compare player's 3-byte BCD score with today's eighth place |
| CPXCY | `CPXCY` | Strict greater-than; ties with eighth place do not qualify |
| HALL2 | `playHallOfFameTune` | `$3E` PHANTOM for ordinary qualification, `$3D` TOCCATA if above today's top score, via original `$24` organ select |
| HOFIN | `HOFIN` | Use original MESS0 glyphs and video memory at `$46AC` |
| HOFUL | `HOFUL` | Three original video-memory underlines at `$45B7`, `$4DB7`, `$55B7` |
| HOFBL | `HOFBL` | Blink palette slot `$D` in 15-tick steps |
| HOFUD | `HOFUD` | Up/Down letter cycling with source delay/ramp, ASCII `$40..$5A` including blank |
| HALL4 | `HALL4` | Five FIRE-open ticks to arm; pressing FIRE confirms one initial |
| HOFST | `HOFST` | 40-second first initial, then 20 seconds for each subsequent initial |
| HALL6/HOFAS/HOFMD | matching native functions | Insert into today's ranking; insert in all-time if separately qualified |
| HALDIS | existing attract renderer updated for two tables | Show original two-column Hall of Fame |

No source-defined alternate browser initials UI is invented. The on-screen Up/Down/Fire controls simulate the corresponding cabinet switch bits; keyboard Up/Down and F/Enter also work. A separate development-only "Test Hall of Fame entry" shortcut selects a qualifying score to make testing convenient. This shortcut is **not** part of original gameplay and does not affect actual player scores.

## Original source decisions retained

- On a fresh page load, the today's table is seeded from ROMC8 factory defaults; the all-time table is recovered from persistent storage.
- All-time records use `localStorage`, standing in for CMOS. Browser storage may be unavailable for some `file:` contexts or privacy settings; then records remain in the current session only.
- This Stage 52 game currently has only a **single player**; the original HALLOF checks both player scores, which can be completed when two-player gameplay is implemented.
- The entire `MESS0` cursor bytecode (e.g. RLF/HMC/RTC) remains partially translated. The entry text uses source words, MESS0 glyph descriptors and explicit source-line spacing in the existing video writer. This is a documented translation boundary, not a claim of pixel-identical ROM text layout.
- The original PIA organ-selector handshake is represented as an explicit high-score music command in the browser adapter. Audio rendering still uses our original-source-derived organ model, not a 6808 emulator.
- The actual 6809 cooperative scheduler and IRQ timing remain those of Stage 51; high-score entry uses separate host-driven source process sleeps.

## Testing

- `npm test`: 490 existing tests plus new Stage 52 regression cases. Included sound flag/long-duration tests, BCD parsing, strict qualification, score insertion and displacement, initials wrap, 5-tick FIRE debounce, blink, stall countdown and timeout.
- Chromium: desktop and mobile high-score entry, three FIRE confirms, resulting Hall table, game restart.
- Chromium: actual game-over on final lost ship, 40-tick delay, score qualification and original `$3D` tune; non-qualifying score waits `$FF` source ticks and transitions to Hall table.
- No JavaScript runtime errors in final browser checks.
