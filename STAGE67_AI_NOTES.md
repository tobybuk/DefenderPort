# Stage 67 — overhead Mutant interception, original-input AI

## Scope and operation

This release modifies only `browser/flight.js`'s `createAttractPilot` controller, documentation, tests and presentation/version metadata. It **does not alter any file under `original/`** or any physics, collision, laser, enemy-AI, astronaut, scoring, game-over, lives, ammunition, wave or rendering routine. The controller uses ordinary `lab.INPUT()` switches. `WATCH AI PLAY` still bypasses the Williams showcase; automatic handoff from the showcase and demonstration restart after ordinary game-over are retained.

## Changes

1. **Earlier overhead Mutant detection.** Whereas Stage 66's initial horizontal retreat geometry for Mutants required an enemy within 22 screen columns and 12–45 pixels above the ship, the Stage 67 Mutant check reaches 75 screen columns and up to 60 pixels above *when the attacker is closing or descending*. Swarmers, Pods, Bombers and other enemy classes retain the Stage 66 checks. This reduces the chance of climbing directly into a descending Mutant.
2. **Retreat based partly on real ship momentum.** If an overhead Mutant is still within 28 screen columns and the original ship's `game.vx` is moving *towards* it, Stage 67 does not blindly terminate `EXTEND` at 25 ticks. It continues to create a firing gap until the condition clears or a firm 62-tick bound is reached. The manoeuvre then follows the existing reverse, track and fire path, using normal player thrust and laser controls.
3. **Less restrictive close Mutant shots.** Only Mutants get a 2.2-pixel predicted raster overlap tolerance rather than Stage 66's universal 1.7-pixel tolerance. Normal source laser collision determines any actual hit. Other enemy classes retain the original Stage 66 decision.

All earlier Stage 66 protections remain, including live `OPICT` classification, committed astronaut landing, range safety against Pods and finite emergency resources.

## Results and caveats

Tests run directly against native JavaScript source game processes, with real lives/collisions/weapons enabled. Isolated Mutant scenario fixture creates one original `SCZST()` Mutant, then positions the target and moves other enemies off-screen **only in the benchmark setup**, never in gameplay or the shipping controller.

| Metric | Stage 66 | Stage 67 |
|---|---:|---:|
| Mutants eliminated within 430 game ticks (24 isolated geometries) | 14 | 16 |
| Player deaths in those isolated scenarios | 0 | 0 |
| Mean ordinary game survival (16 seeded 12,000-tick runs, game ticks) | 8,791 | 8,564 |
| Mean confirmed laser hits (16 runs) | 38.8 | 37.1 |
| Mean lost astronauts (16 runs) | 3.94 | 4.31 |

This represents a **specific improvement in isolated Mutant engagements**, not an across-the-board improvement. Stage 67 remains below the intended expert tactical ability. The small benchmark difference may be noisy; outcomes are not a claim of general superhuman accuracy. A full browser endurance playthrough is not verified.

## Reproducible checks

```sh
npm test
node tools/benchmark16.mjs ../benchmarks/stage66-flight.js ../browser/flight.js
node tools/mutant-duels.mjs benchmarks/stage66-flight.js browser/flight.js
npm run build
```

The first two tooling commands resolve code paths relative to the `tools/` directory; `mutant-duels` receives paths relative to the working directory. The complete source audit tool in `npm test` also verifies the absence of prohibited substitutions in original source translations.
