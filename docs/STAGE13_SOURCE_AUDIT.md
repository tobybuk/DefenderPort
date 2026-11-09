# Defender Stage 13 — Landers, humanoids and process state

Source: `mwenge/defender` at **e74006344b16d19245510b5e55780f90d7606bb8**, `src/defb6.src`.

## What was actually implemented

| Source lines | Original routine / entry | Native JavaScript module | Important source behaviour |
| --- | --- | --- | --- |
| 289–358 | `ASTRO`, `ASTR`, `ASTL*`, `ASTX` | `defb6-astronaut.js` | 16-entry walking cursor, on-screen check, sprite phase, turn-around, terrain-height adjustment, signed world displacement, NAP 2 |
| 363–379 | `GETALT` | `defb6-astronaut.js` | Six `LSRA/RORB` pairs, banked `ALTBL` index = 16-bit X >> 6 |
| 383–396 | `ASTKIL`, `ASTK1` | `defb6-astronaut.js` | Player-collision flag, list clear, switch to explosion descriptor, death sound and appearance callbacks |
| 420–435 | `ASTCLR` | `defb6-astronaut.js` | Search original target-list memory, clear pointer, decrement `ASTCNT`, allocate `TERBLO` when last astronaut dies |
| 651–685 | `LANDST` | `defb6-lander.js` | Original `NEWP`, `OBI`, seed-based spawn, ones-complement negative velocity, `GTARG` and original `APVCT` dependency |
| 690–735 | `LANDS0`, `LANDSA` | `defb6-lander.js` | Low-byte collision-vector test, terrain-relative Y steering, 3-frame picture cycle, `LSHOT`, NAP 6 |
| 737–792 | `LANDG0`, `LANDG` | `defb6-lander.js` | 0x20-quantised X alignment, 12-pixel Y offset, unsigned pickup threshold, kill-vector exchange, reversed climb velocity |
| 794–839 | `LANDF`, `LANDFX`, `LNDFXA`, `SCZ00` | `defb6-lander.js` | Escape, victim pull-up, sound command $12, counters and lander-to-mutant data transition |
| 843–900 | `SCZ0` | `defb6-lander.js` | Signed X pursuit, 16-bit close test, Y avoidance/pursuit, hop from `SEED`, original shot timer, NAP 3 |
| 904–922 | `LKIL1`, `LKILL` | `defb6-lander.js` | Destruction while carrying a humanoid creates `AFALL`, then original `KILP` macro boundary |
| 926–974 | `AFALL`, `AFALL2`, `ALAND` | `defb6-astronaut.js` | +8 falling acceleration, unsigned $0300 clamp, $00E0 fatal threshold, rescue scores through `P250`/`P500` processes |

The modules retain original routine names and source variable names; subroutine labels with fall-through are documented in comments or represented as JavaScript entry functions where process continuations require it. `u8`, `u16` and `s16` represent byte-width arithmetic, not a 6809 emulator. The annotation tool can insert full original listings from your own pinned source checkout; the archive does not redistribute the unlicensed source itself.

## Critical fidelity checks

- The source compares `OCVECT+1,Y` to the low byte of `ASTKIL` (`(ASTKIL << 8 & $FF00) >> 8`). Earlier code accidentally compared high bytes; Stage13 includes an explicit regression test.
- `LANDS0` decides descent from 6809 unsigned carry and signed compare semantics after `GETALT - 50 - Y`.
- Lander X alignment is **$20 world units per active LANDG update**, not arbitrary pixel pursuit.
- `LANDG3` applies **ones complement** to `LNDYV`, not arithmetic negation.
- `ASTRO` advances over **16 target slots**; `GTARG` uses a different 32-slot scan.
- `KILP`, `APVCT`, `SCZS0`, `ASTK1` dependencies are mandatory; missing original routines are not replaced with visual shortcuts.

## Source-connected diagnostic

`demo/lander-harness.js` seeds one lander and one humanoid in the original RAM object and process records (diagnostic *only*). It uses:

- `DISP`/`SLEEP` to execute the translated original processes.
- `VELO` for source-derived object coordinate updates.
- BLK71 `BGALT` computed from the **original `TDATA`**, via `readAltitude` (not a custom terrain-height function).
- The original `SHOOT`/`GETSHL`/`LSHOT` source projectile path; requested sound-command *IDs* are logged, but audible sound is not reproduced.

The diagnostic's interleaving of one process dispatch and one `VELO` call per button tick is a **test fixture**, not claimed to match cabinet execution cadence. The fixtures start at selected original-RAM states; they do not claim to replace `LANDST` or the missing `APVCT` appearance path. The lander is **not rendered by the original sprite descriptor pipeline yet**.

## What remains incomplete

Original `APVCT` appearance and its original picture descriptors, `KILPOS` score-and-destruction, full `SINIT`/`EXEC` integration, comprehensive original collision handling, global wave spawning, sound-board 6800 firmware translated into JavaScript sample generation, true colour palette, and verified original-machine trace comparisons. No fabricated enemy images or sound effects have been added.

## Verification

The project runs `npm test` (all historical tests plus new Stage13 source-branch and workbench tests) and `node tools/guardrail.mjs`. The standalone browser test checks the new 181-step lander workbench, old 120-step enemy/process tests and existing scanner controls. This is **not** differential original-ROM verification.
