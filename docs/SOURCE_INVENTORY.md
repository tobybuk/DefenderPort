# Source-module inventory: Red Label

The original repository is pinned at commit `e74006344b16d19245510b5e55780f90d7606bb8`.

This file is the **module-level bootstrap inventory** based on the upstream README and inspected upstream source. It is NOT the complete routine inventory. That is generated from the pinned checkout with `npm run source:inventory`, and records every label, line and potential call reference without pretending each label is a separate subroutine.

| Original file | Role | This milestone |
|---|---|---|
| `phr6.src` | RAM layouts, object/process offsets, macros, vectors | Symbol parser and RAM helpers built; complete map requires pinned checkout |
| `defa7.src` | Game / process executive | 17 named process/object routines or internal labels translated, not differential verified |
| `defb6.src` | Enemy, object, player-related game code | **Not translated** |
| `amode1.src` | Attract mode and scanner | **Not translated** |
| `blk71.src` | Terrain/wave data | **Not translated** |
| `samexap7.src` | Explosion and appearance routines | **Not translated** |
| `mess0.src` | Messages / text | **Not translated** |
| `romf8.src` | Banked program routines | **Not translated** |
| `romc0.src` | Banked program routines | **Not translated** |
| `romc8.src` | Banked program routines | **Not translated** |

Sound-board assembly is a separate upstream component and will receive its own pinned inventory when that stage begins; **no provisional audio** is supplied.

## Memory-model evidence

The original program defines `PLINK`, `PADDR`, `PTIME`, `PTYPE`, `PCOD`, `PD` through `PD7`, `PSIZE=15`, `SPSIZE=PSIZE+8`, and reserves 75 normal and 5 super processes. `PINIT` constructs both linked free lists. `MKPROC` inserts the new process immediately after the link stored in `CRPROC`. `DISP` decrements each process's time byte and resumes its original stored routine when it reaches zero. These rules are translated in `original/defa7.js`.

## The original code in comments

`npm run source:annotate` generates *local* JavaScript copies containing the actual assembly block before the corresponding function. This uses the exact upstream checkout, never an LLM reconstruction of assembly. It is intended for code review and auditing. Original source isn't redistributed with this archive.

## Next implementation checkpoint

1. Derive all original symbols and inventory all source labels from the pinned upstream checkout. Run the automatic one-to-one audit against the source.
2. Translate `SINIT` and the `EXEC` / `SWP` main loop, preserving its original order and timer hand-off.
3. Make actual native-JavaScript continuations enter original translated routines; leave untranslated entries as hard failures.
4. Only then translate the player, framebuffer, enemy/object logic, scanner, explosions and sound. Do not add cosmetic approximations to simulate progress.
