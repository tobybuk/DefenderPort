# Stage 66 AI — Threat-aware original-input controller

**Scope:** Only `browser/flight.js::createAttractPilot`, its tests, build metadata and documentation have changed. The original named 6809-to-JS game routines, original physics/terrain, source collision checks, original pickup (`AKIL1`), attached passenger (`AFALL2`), landing (`ALAND`), Pod destruction (`PRBKIL` -> `MMSW`) and source laser/weapon routines have NOT been modified. AI actions are emitted only as regular `lab.INPUT` switches.

## Root causes confirmed

1. The adapter `ENEMY_STATE()` retains allocation-time labels as object slots are reused. During real play, an object labelled `LNDP1` had current original `OPICT` pointers to Mutant (`$e280`), UFO (`$e100/$e10a/$e114`), Swarmer (`$e130`), explosion (`$e304/$e30e/$e342`), and other sprite types. Previously the AI classified all these as Landers and even pursued explosion records. Stage 66 follows the **current live `OPICT`** (not the stale descriptive label), and only targets known, live enemy sprites: `$e140/$e14a/$e154` Landers, `$e280` Mutants, `$e130` Swarmers, `$e100/$e10a/$e114` UFOs, `$e430/$e43a/$e444/$e44e` Bombers and `$e2ba` Pods. It ignores current explosion/astronaut/projectile sprite pointers.
2. The source process `AFALL2 ($e29a)` identifies a genuinely attached passenger. The previous AI never looked for this process and would continue pursuing other targets during delivery, leading to repeated altitude changes. Stage 66 reads the living astronaut's original `OBJID -> PADDR` and holds a committed descending target, using normal DOWN input, until the source itself terminates the attached state. A delivery counter increases **only** when the astronaut is still in `TLIST` and original `ALAND` has changed `OCVECT` to `ASTKIL ($e232)` and cleared `OBJID`.
3. Nearby Pod destruction invokes the original `PRBKIL -> MMSW` path, making point-blank kills hazardous. Stage 66 suppresses normal fire when the Pod's measured muzzle range is under 54 screen columns, and can retreat from threatening formations. It does not change the number or behaviour of spawned Swarmers.
4. A close overhead attacker cannot be engaged safely just by chasing the changing vertical coordinate. The pilot can commit to an `EXTEND` horizontal run away from the threat followed by `TURN_FIRE` to aim and fire from distance. The trigger is deliberately narrow: blanket evasion was measured to reduce kills and survival.
5. TIEP Bomber and SCZP Mutant classes now have explicit targeting weight, correct original dimensions and current-picture recognition. Firing remains pixel-level best effort, constrained to the source laser's own collision path and finite rate.

## Source-engine results

Benchmark: `tools/benchmark16.mjs`, 16 independently perturbed original random starting states, each up to 12,000 source game steps, all game rules/collision/finite bombs enabled. Stage 65 and Stage 66 use identical seeds and unchanged gameplay engine. Results before standalone wrapping:

| Mean across 16 runs | Stage 65 | Stage 66 |
| --- | ---: | ---: |
| Engine ticks until ordinary game-over / cutoff | 7,212.4 | 8,790.8 |
| Confirmed laser hits | 35.0 | 38.8 |
| Astronaut losses | 4.0 | 3.9 |
| Reached wave 2 | 16/16 | 16/16 |

All four traced Stage 66 seeds showed original-source successful deliveries: **12 total** (3, 2, 4, 3) by confirmed `ALAND` output. This is not equivalent to a full-life survival guarantee. Longer gameplay, higher-wave Pods and Bombers, and browser display behaviour still need empirical testing. Emergency bombs/hyperspace retain Stage 65 scarcity limits.

## Testing and restrictions

Run `npm test` for source guardrails and specific Stage 66 assertions. The six new checks cover: monotonically descending with a passenger, correct mutation/explosion identification, a Bomber attack, Pod-safe fire distance, overhead extend-turn engagement, and real-engine ammunition/collision integrity. The pre-existing Stage 61 fixture used a placeholder invalid picture pointer; it was updated to the real Lander `OPICT` so tests reflect actual original RAM. No production game code was altered to satisfy tests.
