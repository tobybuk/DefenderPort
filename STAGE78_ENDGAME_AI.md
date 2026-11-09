# Stage 78 — AI endgame: the long way round, Baiters, the last human

Three reported problems with the attract AI, each measured with a new probe, `tools/stage78-endgame-probe.mjs`. The probe runs seeded AI games on the unmodified engine and records what happens when a wave is nearly finished, or when one human is left.

## 1. "It goes the long way round to the last enemies"

**Cause.** The AI built its enemy list only from the active object list `OPTR`. In the original, `OSCAN` moves every object outside a 500-pixel band around the screen onto the inactive list `IPTR`, and `ISCAN` moves them back as they come near. The world is 2,048 pixels wide, so about three-quarters of the planet was invisible to the AI.

With the last enemies parked on `IPTR`, the AI chased whatever it could see, or patrolled in an arbitrary direction. Often that was the long way round the planet. A player sees every enemy on the scanner, so the AI should too.

**Fix.** The pilot now reads both lists. Objects on `IPTR` count as off screen (no laser shot, no visibility bonus). The existing shortest-way-round distance then picks the right direction.

## 2. "With one enemy left, a Baiter arrives and the AI fights the Baiter"

A wave ends when its last enemy dies. A Baiter only makes it longer, and more Baiters keep arriving. Before this change the AI targeted the Baiter 54% of the time a Baiter was present during a wave's last enemies.

**Fix.** In the endgame the AI hunts the remaining wave enemies first, wherever they are. The endgame means no Landers left in reserve, at most `endgameEnemies` (2) wave enemies, and fewer than `baiterSwarm` (3) Baiters. A Baiter that is not close (`baiterCloseCols`, 24 columns) gets a large penalty (`endgameBaiter`, −260).

A close Baiter is still treated as a threat: the stand-off manoeuvre, the collision shield and the opportunistic gun still deal with it. Removing that response did not make endgames faster, so it was kept.

## 3. "Protect the last human"

The probe showed that most last humans were lost while the ship was 200–500 columns away fighting something else. An abduction takes about 116 ticks, which is too short to cross the planet once it starts.

**Fix.** With one human left, the original `GTARG` sends every Lander towards him. So:
- Every Lander's priority rises with how close it is to **him**, not to the ship. There are extra bonuses within 150 columns of him, and when it's descending within 60 columns.
- With nothing to hunt, the AI holds station over him at mid-height (`GUARD LAST HUMAN`) instead of patrolling.

The existing rescue, intercept and keep-carry tactics still apply.

## Results

The endgame probe uses seeds 8–15, which were not used for tuning. Each run is 8 games of 20,000 ticks.

| | Stage 77 | Stage 78 |
|---|---|---|
| Endgame time travelling away from the nearest wave enemy (>60 columns) | 13.6% | 2.3% |
| Endgame time targeting a Baiter | 54% | 3.8% |
| Mean endgame length (ticks) | 837 | 503 |
| Last human lost, per 10k ticks with one human left | 17.7 | 13.3 |

The full benchmark (`tools/stage74-benchmark.mjs`) uses 32 games of 30,000 ticks, seeds 0–31:

| | Stage 77 | Stage 78 |
|---|---|---|
| Mean score | 74,286 | 77,700 |
| Waves per 10k ticks | 2.18 | 2.33 |
| Planet destroyed (share of time) | 64% | 56% |
| Deaths per 10k ticks | 1.58 | 1.72 |

Deaths per 10k ticks rose about 9%. Variants with and without the endgame rule die at the same rate (1.71–1.72), so the rise comes from the AI now flying out to enemies it previously could not see. Deaths per wave cleared are almost unchanged (0.73 → 0.74).

## Tests

- New: `tests/stage78-endgame-ai.test.mjs` (4 tests):
  - An enemy on `IPTR` is targeted and approached the short way, in both directions.
  - A Baiter does not draw the AI from the last Lander.
  - The Lander nearest the last human is hunted before one near the ship.
  - With nothing to hunt, the AI guards the last human.
- `npm test`: 657 tests pass, plus the source guardrail.
