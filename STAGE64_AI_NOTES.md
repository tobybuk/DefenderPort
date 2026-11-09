# Stage 64 — Model-based attract-mode pilot

## Architecture

The pilot is a **host-side player/controller**, `browser/flight.js::createAttractPilot`. No original game routine, RAM field, collision path, player speed, score, lives, enemy behaviour, smart-bomb count, or hyperspace outcome has been modified for AI demonstration. The pilot reads a normal `lab.STATE()`, `lab.ENEMY_STATE()`, `lab.ASTRONAUT_STATE()` and read-only original RAM pointers; it outputs only the seven original switches via `lab.INPUT()`.

The normal AMOD13 attract sequence ends with an ordinary AI game, while the existing **WATCH AI PLAY** button starts the same normal game immediately. Game-over is a *real loss*; the host starts a new game so the unattended presentation continues indefinitely. Existing human-play and touchscreen input paths are unchanged.

## Changes from Stage 63

1. **Stable altitude lanes:** acquisition captures an intercept lane, replans only on a substantial sustained change, stops motion when close. One-pixel target jitter is ignored. Enemy/projectile evasion is committed for an interval; competing urgent hazards can cause genuine course changes, but no continuous one-pixel feedback correction.
2. **Real laser ballistics:** from original `defa7-laser.js`, a laser starts at NPLAXC (+7 when shooting right), at NPLAYC+4, and advances 4 columns per source update. The AI predicts when an enemy's **source-rendered video position** will intersect the beam, applying source horizontal velocity and vertical motion, then generates debounced fire edges. It will not waste shots outside the collision corridor.
3. **Hunting rather than waiting:** dedicated sweeping patrol with altitude changes, target commitment, explicit attack-run steering, and thrust maintained through intercepts instead of prematurely braking and coasting.
4. **Threats from any direction:** forecasts X/Y approach from live OPTR enemies, including descending attackers from above, and additionally reads the source's **SPTR enemy-projectile list**, which previous pilots ignored entirely. Planned escape is upward/downward away from the original position of the threat, rather than blindly moving towards the enemy's predicted collision height.
5. **Captured humans:** a Lander with collision vector LKIL1 ($E22A) is automatically a top-priority pursuit target, even if another enemy is closer. Falling astronaut pickup remains a possible secondary objective.
6. **Strict limited resource policy:** no smart bombs for an ordinary encounter; never spend the final bomb; one at most per wave, ≥3,500-tick cooldown, and only when >=13 *visible and live* targets, or >=11 with >=3 actual captors. Hyperspace is an exceptional last resort for at least three simultaneously imminent live projectiles and a vertical boundary; the original game's failure risk still applies.

All timing is in source game updates, not wall-clock time.

## Validation

- `npm test`: includes original gameplay/source-fidelity checks and Stage 64 tactical tests.
- 15 Stage 64 tests cover 1px target jitter, patrol, distant pursuit, overhead/below threats, live SPTR projectile evasion, physically predicted laser firing, missed-lane withholding, abductor priority, limited resource policies, normal game transitions, plus a **3,000-tick integration run** using the *actual source-translated game engine*.
- One deterministic, native harness comparison using `tools/profile-ai.mjs`: Stage 63: 2,459 ticks to genuine game over, 0 hits, 1 shot, 480 thrust ticks; Stage 64: survived 3,000 ticks, 11 hits, 36 shots, 2,788 thrust ticks, 0 bombs/hyperspaces. Runs represent one game seed, not a statistically significant benchmark.
- One 18,000-tick-budget unattended run reached wave two, then genuinely lost all remaining ships after 8,760 ticks; 1 smart bomb was used, 0 hyperspaces. No artificial continuation within a game.

Browser video/audio remain to be verified interactively on the user's device. These measurements are real **native gameplay simulation**, not proof of flawless long-term strategy or the exact performance of the finished browser UI.
