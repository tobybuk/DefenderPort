# Stage 73 — Symmetric Mutant duel and collision shield

## Problem

The attract AI dealt badly with Mutants, which repeatedly approached from above or below and collided with the ship. Only `createAttractPilot()` in `browser/flight.js` was changed. As in earlier stages, it reads source RAM and acts only through ordinary `lab.INPUT()` switches. No translated original routine, collision, weapon, enemy behaviour, scoring or resource rule was modified.

## Root causes found in Stage 72

Measured over 64 seeded full games on the real engine, Mutants caused 77 of 237 deaths (32%), the largest single cause.

1. **Mutant handling only looked upward.** All three Mutant triggers (immediate dive, far-overhead candidate, generic threat) required the Mutant to be above the ship. 47 of the 77 Mutant deaths came from below. In 60 of them the Mutant tactics never engaged, and only the generic ±23px dodge ran.
2. **The Mutant tests used the easiest possible Mutant.** The Stage 67–72 arenas placed Mutants only above the ship, immediately after `RESET`, so with wave-1 starting speeds (`SZXV` 12, `SZYV` 0.38px/tick). In real games `SZXV`/`SZYV` grow during each wave (measured: 44–84 and 0.9–1.16px/tick in waves 2–3). The arenas also read `PLABX` before the first `PLAYER` pass, when it is stale by `$800`, so every Mutant sat 32 columns further left than intended.
3. **The dodge moved only vertically and trapped itself at the screen edge.** A homing Mutant follows a vertical escape, the ship reaches the top or bottom limit, and the dodge weights then preferred crossing the threat's height. At impact the dodge was steering towards the Mutant in 50 of 77 deaths.
4. **It hunted a Mutant by flying to its height, even directly above or below it,** where the horizontal laser cannot hit. When the Mutant passed underneath, the hunt reversed and the ship hovered over it. Mean horizontal speed in the 20 ticks before a Mutant death was 39, slower than the Mutant chasing it.

## Source facts the new logic relies on

From `SCZ0` (`original/defb6-lander.js`) and `PLAYER`/`VELO` (`original/defa7-player.js`), confirmed in the engine:

- Every 3 ticks a Mutant sets `OXV = ±SZXV` towards `PLABX`, so it always chases horizontally.
- It homes on the ship's height (`OYV = ±SZYV`) only while `PLABX − OX16 + 380 ≤ $700`: from **22 columns left** of the ship's left edge to **5 columns right** of it. Elsewhere it holds itself more than 8px off the ship's line.
- Ship thrust adds about 3 world units/tick per tick with 1/64 drag (top speed ~190 in practice). Vertical speed starts at 1px/tick and rises to 2px/tick, with no inertia on release. `REV` needs the switch released for about 7 ticks before another reverse.

`tests/stage73-mutant-duel.test.mjs` asserts the homing window, so the AI's assumption fails loudly if the translation changes.

## Implementation

- **Duel (`duelPhase`: `SEPARATE` → `SHOOT`).** Engages the most urgent Mutant within 36 columns, or one whose simulated coast-and-hold trajectory collides within 40 ticks. Mutants above and below are treated identically. `SEPARATE` faces away and thrusts until there are 18 clear columns and the ship is opening faster than the Mutant chases. While overlapping, the ship moves away vertically, never towards the Mutant. `SHOOT` reverses to face the Mutant and coasts, so momentum keeps carrying the ship away. It aims the beam at the Mutant's centre, led by laser flight time, and returns to `SEPARATE` when the gap falls below 6 columns or a collision is forecast within 10 ticks.
- **Collision shield.** Each tick the chosen inputs are simulated 40 ticks ahead. Mutants follow the source `SCZ0`/`VELO` rules; shells and other enemies keep their current velocity. If the inputs collide with anything within 24 ticks, the shield substitutes the thrust-direction × vertical combination that stays clear longest. Among collision-free choices it picks the one closest to the intended input. A substitution is held for 6 ticks so the ship commits. The shield also runs while carrying a human.
- **Emergency smart bomb** only when no input avoids an on-screen Mutant within 6 ticks (at most once per 90 ticks).
- Mutants are excluded from the old generic `EXTEND`/`TURN_FIRE` combat and from the old ±23px dodge, both of which still handle other enemies with their original weights. The overhead-only triggers, `deepDive` and the Stage 71 top-row override were removed. The duel may use the legal top row directly.
- `state()` adds `duelPhase`, `duelId`, `duelShots`, `shieldTriggers`, `emergencyBombs`. `mutPhase`/`mutId`/`mutShots` mirror the duel.

## Results

Full games: 64 seeds (the `benchmark16` seed formula extended to 64), capped at 40,000 ticks. Stage 72 games all ended by game-over well before the cap.

| Metric | Stage 72 | Stage 73 |
|---|---:|---:|
| Mean survival (ticks) | 7,417 | ≥ 32,790 (31 games still alive at the cap) |
| Player deaths per 10,000 ticks | 4.99 | 2.45 |
| Mutant deaths per 10,000 ticks | 1.62 | 0.19 |
| Mean score | 13,272 | 71,775 |
| Mean furthest wave | 2.56 | 7.11 |
| Laser hits per game | 49.6 | 254.7 |
| Humans lost per 10,000 ticks | 9.88 | 5.79 |

Wave-1 opening, 3,000 ticks × 16 seeds: mean hits 5.75 → 11.75, player deaths 8 → 0.

Mutant arena (`npm run mutant:arena`, 12 encounters per cell, corrected placement):

| Mutant speed | Stage 72 kills / deaths | Stage 73 kills / deaths |
|---|---:|---:|
| Wave-1 start | 46 / 1 | 48 / 0 |
| Wave-2 start | 33 / 10 | 44 / 0 |
| Late wave 2–3 | 23 / 22 | 46 / 0 |
| Later waves | 19 / 22 | 40 / 1 |

At late-wave speed, Stage 72 lost 22 of 24 encounters that started below the ship; Stage 73 lost none.

The shield and duel were selected by A/B runs on the same 64 seeds. Settings compared:
- Shield triggering on Mutants only versus any collision within 8/12/16/24 ticks.
- Stage 73 dodge weights versus the original ones; the originals were kept.
- Shield off versus on while carrying.
- Maximum-clearance versus minimal-intervention choice among safe inputs.

## Tests

- New: `tests/stage73-mutant-duel.test.mjs` (8 tests). It covers the source homing window, real-engine encounters from above and below at late-wave and fastest speeds, and no smart bombs in ordinary encounters. It also checks the ship never moves vertically towards a Mutant it overlaps, and survival when pinned at the top limit.
- Adapted: the Stage 66 test "overhead approaching mutant triggers accelerate-away THEN reverse-to-fire phases" now checks `duelPhase` `SEPARATE` then `SHOOT`. Its intent is unchanged.
- Retired: seven Stage 67–70 tests that asserted internal states of the old overhead-only tactics (`combatPhase` `EXTEND` for a Mutant, `deepDive`, trigger distances). They are kept for reference in `tests/stage67-70-mutant-tactics.legacy.txt`, following the Stage 63 precedent.
- `npm test`: 622 tests pass, plus the original-source guardrail.

## Limitations

- Mutants still cause some deaths (39 in 64 long games), mainly in later waves where they are almost as fast as the ship.
- Enemy shells are now the largest cause of death (264 of 515), followed by Baiters (107). The shield treats Baiters, Swarmers and shells as straight-line movers, which is only an approximation for chasing enemies.
- The older `tools/mutant-*.mjs` arenas keep their 32-column placement offset, to stay comparable with earlier stages' published figures.
- These are deterministic samples, not proof of optimal play. Prolonged browser viewing is less thoroughly checked than the engine runs.
