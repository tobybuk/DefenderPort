# Stage 71 — Repair the diagnostic process before modifying the AI

**User-observed issue:** Stage 70 still appeared unable to finish several Mutant engagements, particularly those near the upper playfield edge. Previous changes to retreat timing did not resolve the problem.

## Previously undiscovered test-harness defect

The Stage 70 arenas identified kills by checking `OPICT !== 0xe280`. This does **not** reliably represent an original Defender Mutant kill. `OPICT` can retain the old sprite address after `OPTR` is unlinked. One previously labelled failed test (holdout fixture 4) has `laserHits` increment to 1 and the object vanish from the live source list, while `OPICT` remains `0xe280`.

Revised encounter scripts `tools/mutant-arena-corrected.mjs` and `tools/mutant-holdout-corrected.mjs` require both: (a) the target removed from the *real* `OPTR` linked list, and (b) the original engine has counted a laser hit. All other gameplay physics, source routines, enemy AI, and input rules are unchanged.

## Actual aiming defect

When a Mutant stays at Y=42–46, the old controller's 45-pixel minimum aiming altitude causes the vertical Schmitt stop to settle around ship Y=47, placing the beam at Y=51. The source laser and sprite overlap is thus not achieved. The AI continues chasing a target that it cannot hit from its commanded altitude.

The repair allows a **temporary, narrowly scoped** 39-pixel *requested* aiming altitude when a Mutant is visible, above Y=46, 13–116 screen columns ahead and the player is already in the upper playfield. The original ship routine clips movement to its legal upper bound; this does **not** move the ship beyond its normal range. This is part of the external pilot, not the game engine. It does not affect non-Mutant targets, remote targets, carrying humans, or emergency evasion.

## Independent source-engine checks (48 fixtures per arena)

| Outcome | Stage 70 | Stage 71 |
|---|---:|---:|
| Holdout Mutant kills, corrected counting | 43/48 | 48/48 |
| Other arena Mutant kills, corrected counting | 45/48 | 47/48 |
| Combined Mutant kills | 88/96 | 95/96 |
| Player deaths, combined | 0 | 0 |

On 16 ordinary full games: Stage 70 mean laser hits 48.81, survival 6970.81 ticks, Stage 71 mean hits 47.31 and survival 7121.88 ticks; wave three reached in 9/16 for both. Human losses rose from 6.19 to 6.44 per game. These results are mixed and do not prove Stage 71 is globally stronger, despite the improved diagnostic Mutant encounters.

## Verification

Run `npm test`, `npm run build`, `node tools/mutant-arena-corrected.mjs browser/flight.js`, and `node tools/mutant-holdout-corrected.mjs browser/flight.js`. The Stage 71 tests verify a legal top-of-screen laser hit using normal game inputs and prove that an unlinked object can retain its original sprite pointer.

Known limits: Two arranged Mutant encounters still fail within the 360-tick arena window. Real play has many enemies, bullets and astronaut responsibilities. The original engine is unchanged, and no claim of universal optimal play is made.
