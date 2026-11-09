# Stage 65 — Tactical attract-mode AI: interceptions, fly-bys and human defence

## Request addressed

Stage 64 visibly wandered around live enemies, passed targets without firing, and failed to protect human astronauts. Stage 65 replaces its steering and target selection with a tactically coordinated controller while leaving the source-derived gameplay untouched.

## Source separation and permissions

Only the **browser adapter** `browser/flight.js::createAttractPilot` makes gameplay decisions. Its `sample()` method reads the ordinary source game snapshot, `OPTR` enemy object list, `SPTR` shell list, and original astronaut collision states, and returns the normal seven `lab.INPUT()` player switches: `up`, `down`, `thrust`, `reverse`, `fire`, `smartBomb`, `hyperspace`. It **never writes source RAM** or calls a gameplay routine to create kills, teleport, rescue, spawn, amend scores, provide ammunition or protect the player.

All source modules under `original/`, runtime modules under `runtime/` and game harness physics/collision routines remain unmodified from Stage 64. The AI still experiences real deaths and game-over; the external attract controller restarts another unmodified game when it finishes.

## Controller changes

1. **Stabilised altitude:** the pilot estimates each enemy's vertical velocity over a multi-update sample window rather than treating a 1-pixel flicker as real upward/downward motion. It selects a predicted laser-intercept altitude and controls the game's original up/down switches through a Schmitt-type band, suppressing rapid sign changes.
2. **Deliberate hunting:** objects receive a tactical score from distance, vertical separation, opportunity for an immediate laser hit, Lander status, whether they are carrying an astronaut, and an existing target commitment. A 22-update target commitment discourages unproductive switching, but high-value rescues/fly-bys can pre-empt it.
3. **Shoot on the way past:** an independent laser opportunity scan tests **every live, visible enemy**, even if it isn't the selected strategic target. It estimates laser travel using original four-display-column-per-update movement, camera-relative movement and the sprite's actual screen Y and height. FIRE is emitted as short legal source switch pulses (not held continuously); reversing the gun when the enemy is behind can create a new shot opportunity.
4. **Recover falling people:** look at original astronaut `OCVECT=AKIL1` ($E234), original world position and 8.8 falling velocity. Reject astronauts still attached to carrying Landers; predict an interception height, check reachability against remaining falling time and commit to a nearby feasible rescue. This is attempted using ordinary ship movement; a successful pickup depends entirely on source collisions.
5. **Stop abductions:** source `LKIL1` ($E22A) identifies carrying Landers, which receive major priority, especially as they rise towards the top. The controller can fire at unrelated aligned enemies during the interception journey.
6. **Genuine imminent evasion:** forecasts hostile source `SPTR` projectiles and `OPTR` collision paths from either vertical direction. Evasive choices are latched rather than recalculated into frame-to-frame zigzags. It avoids thrusting into an immediate frontal collision.
7. **Emergency resource discipline:** no smart bomb for 13 scattered or ordinary visible enemies. Requires at least 15 visible live objects, or 12 including at least 3 actual abductors; retains the last smart bomb, caps usage at one per wave, enforces a 5,000-update cooldown. Hyperspace requires at least three imminent projectiles plus almost no remaining vertical escape space. Both resources follow unmodified original gameplay logic.

The `WATCH AI PLAY` shortcut and the automatic post-showcase hand-off remain present.

## Real-source-engine benchmark

Deterministic comparisons run with `tools/benchmark-pilot.mjs` against *the actual translated engine*, with player collisions, finite bombs, source cabinet switches, wave spawns and real game-over. Four source-random initial states, up to 12,000 game updates each. Both Stage 64 and Stage 65 were evaluated against the **same four states**. Across wave transitions, confirmed laser-hit totals are accumulated rather than reading only the final wave's resettable counter.

| Metric, average across four starts | Stage 64 | Stage 65 |
|:--|--:|--:|
| Game updates before genuine game-over | 6,168 | 8,977 |
| Confirmed laser hits before game-over | 14.0 | 37.3 |
| Astronauts lost over the game | 8.25 | 2.75 |
| Runs that reached wave two | 1 of 4 | 4 of 4 |
| Smart bombs used | 0 | 0 |

Stage 65 individual runs lasted 11,326, 10,614, 9,161, and 4,805 game updates. They registered 43, 42, 36 and 28 confirmed laser hits respectively. A more aggressive rescue/braking policy and several other variants were **rejected** when they worsened the outcomes. This is a useful small-sample comparison, not proof of optimal intelligence or a guaranteed survival rate.

## Tests and known limitation

- `npm test` succeeds: **590 passing tests**, including all previous original-source checks, Stage 61/64 AI regressions, 8 new Stage 65 tests, and the original-game translation guardrails.
- New tests exercise firing during an aligned fly-by, immediate reverse-and-fire against a passed ship, shooting an unrelated enemy while chasing a captor, falling astronaut pursuit, abducting Lander prioritisation, one-pixel noise suppression, read-only RAM, and real-engine weapon conservation.
- **Limitation:** successful live human *pickups* have not been measured in sufficient numbers, and the browser's Chromium headless session does not complete in this environment. Test results establish substantial improvement in combat and preventing losses but not that all rescue manoeuvres or every on-screen attack succeeds. Further observed arcade gameplay can reveal additional tactics to improve.
