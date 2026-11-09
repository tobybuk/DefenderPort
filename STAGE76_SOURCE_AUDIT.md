# Stage 76 — Source audit of enemy movement and game timing

Every enemy movement routine and every process timing in the port was compared, instruction by instruction, with the pinned original source (`mwenge/defender` e740063: DEFA7, DEFB6, PHR6). The "DEMO MODE ACTIVE" banner still flashes for 5 seconds at the start of each demo game.

## Enemy movement

| Routine (original) | What it moves | Result |
|---|---|---|
| `LANDST`, `LANDS0`/`LANDSA`, `LANDG0`/`LANDG`, `LANDF`, `LNDFXA`, `SCZ00` | Lander spawn, descent, alignment, grab, climb, pull-in, mutation | Matches |
| `SCZST`, `SCZ0` | Mutant spawn, chase, homing/avoidance, random hop, shot timer | Matches, including the original `PD` shot-timer overwrite quirk |
| `MMSW`, `RANDV`, `MSWM`, `MSWLP`, `SWBMB` | Swarmer spawn, acceleration, damping, turn-back, firing | Matches |
| `UFOST`, `UFOLP`, `UFONV`/`UFONV0` | Baiter spawn, animation, re-aim, firing | Matches |
| `PRBST` | Pod spawn and drift | Matches |
| `ASTRO`, `AFALL`, `AFALL2` | Human walking, falling, being carried | Matches |
| `SHOOT`, `LSHOT`, `GETSHL`, `SHELL` | Enemy shots: aim, lead, lifetime, movement, scroll compensation | Matches |
| `VELO`, `PLAYER` | Velocity integration with Y wrap; ship drag, thrust, camera pan, speed clamp, vertical motion | Matches |
| `TIEST` | Bomber squad spacing and direction | Matches |
| **`TIE`** | **Bomber movement** | **Three differences, now fixed** |
| **`BOMBST`** | **Bomber mines** | **Missing, now restored** |
| **`MSWKIL`** | **Swarmer explosion** | **Generic kill used, now original** |

### Bomber (`TIE`) fixes in `original/defb6-tie.js`

1. **Vertical damping.** The original is `ASLB/ROLA ×3; TFR A,B; NEGB; SEX; ADDD OYV`, which adds the negated high byte of `OYV×8`. The translation complemented `OYV` before shifting, as the Swarmer's `MSWLP` does. That gives one less than the original almost every tick, so every Bomber drifted upwards by an extra 1/256 px per tick.
2. **Off-screen cruise-height correction.** The original tests the sign of `gap − $10` (`SUBA #$10; BMI TIE07`). The translation tested `gap` itself. For gaps of `$80`–`$8F`, which happens to Bombers off-screen low down, it pushed them down instead of up.
3. **On-screen tracking.** The original compares the screen row `OBJY` with `PLAYC`, and uses `OBJY` for the on-screen test. The translation used `OY16`.

### Bomber mines (`BOMBST`)

`TIE` calls `BOMBST` with a 1-in-8 chance per tick (`LSEED&7 == 0`) while a Bomber is on screen. The harness never supplied it, so **Bombers in the port never laid mines.**

`BOMBST` is now translated. It makes a stationary `BMBOUT` shell (`SHL BMBOUT,BMBP1,BKIL`), at most 10 shells in total, with a lifetime of `(SEED&$1F)+1`. The existing translated `BMBOUT` draws it from the `CBOMB`-maintained `BAX` bitmap. Across 90,000 AI-played ticks, Bombers laid mines up to the cap of 10 with no errors.

### Swarmer explosion (`MSWKIL`)

The original moves the explosion origin `$40` left and two pixels up, and uses the `SWXP1` picture. The harness used the generic `KILP` explosion. Fixed in `demo/flight-harness.js`.

## Timing

| Item | Original | Port |
|---|---|---|
| Frame rate | 1 MHz / 16,640-count frame = 60.096 Hz; `SLEEP` unit "×16 ms" | Browser clock at 60.096 Hz; one harness `STEP` per frame |
| Per-frame IRQ work | `PLAYER`, `VELO`, `SHELL` and `TIMER` once per frame; `OPROC`/`PRDISP` in both halves | Same, via the two-half `IRQ_PAIR` |
| Process sleeps | 37 `NAP`s in DEFA7/DEFB6 | Every gameplay `NAP` matches (Lander 6/1/4/1, Mutant 3, Swarmer 3, Baiter 6, Bomber 1, human 2/4/1, executive 15, scanner 2/2/4, laser 1, reverse 2/5, smart bomb 2/10/10, hyperspace 15/$28, score popup 50, thrust 4, colours 3/6/6) |
| Transitions | Bonus `NAP 4` per human then `NAP $80`; death respawn `NAP $60`; game over `NAP 40` | Same |

**Not matched: slowdown under load.** In the original, `EXEC` runs each process once per pass. If a pass takes longer than a frame, because the IRQ's drawing plus the process work exceeds 16.6 ms, `TIMER` has reached 2 or more by the next pass. Processes then tick slower than real time, while the IRQ still moves objects every frame. `OVCNT` also cuts the star count and, past a limit, teleports an object away.

The harness always gives `EXEC` exactly one tick per frame, so the port never slows down or sheds objects when the screen is busy. The arcade does. Reproducing it needs the cycle cost of every IRQ and `EXEC` pass. The project only has estimates of that for attract-mode drawing (Stages 50–51), not a cycle-exact model of gameplay.

**Also not translated: `FLPUP`.** This cosmetic process flashes the player's score display until the first score of a life. It has no effect on movement or speed.

## Tests

- New: `tests/stage76-source-audit.test.mjs` (5 tests): Bomber damping against the original instruction sequence, the cruise-correction sign, `OBJY` tracking, `BOMBST` mines, and the `MSWKIL` explosion. The three Bomber tests fail on the old code.
- `npm test`: 644 tests pass, plus the source guardrail.
