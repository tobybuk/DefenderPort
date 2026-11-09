# Stage 70 — Empirically selected Mutant engagement strategy

## Objective and constraints

The user reported that Stage 69 handled descending Mutants poorly, failed to back away into a stable firing position and still oscillated vertically. This change modifies **only** the host-side `createAttractPilot()` within `browser/flight.js`. It reads original RAM objects and uses ordinary `lab.INPUT()` player switches. It never changes the original translated routines, collisions, projectile motion, weapons, enemy behaviour, scoring, rescue or game-over. The demonstration can still run indefinitely by starting a new ordinary game after game-over. `WATCH AI PLAY` is retained.

## How the strategy was derived

The original `SCZ0()` and `PLAYER()` routines were inspected. Mutants move horizontally towards the player, but their vertical behaviour depends on horizontal distance and includes source-random hopping and vertical display wrapping. Defender's `REV` changes its facing independently of momentum. The source laser (`LFIRE`, `LASR0`, `LASL0`, `COLIDE`) advances in four display-column steps.

An experimental arena launches actual source `SCZST` Mutants in 48 scripted starting geometries. `tools/mutant-holdout.mjs` repeats the comparison on a second set of 48 geometries and RNG seeds. The original stage 69 policy and a range of candidate engagement policies were measured under the same source collisions, finite ammunition, and real Mutant routines, not with mock hit detection. Wider game performance was measured using `tools/benchmark16.mjs` for 16 deterministic ordinary 12,000-tick starts. These are controlled samples, not proof of global optimality.

**Rejected experiments:** an unrestricted long retreat missed most firing windows; a high unconditional Mutant priority starved normal gameplay and rescues; over-loose firing tolerance reduced survival; forced retreat for all overhead cases was worse than selectively engaging imminent ones. A rescue-priority experimental variant also surfaced an original process trap and was not shipped. The selected candidate uses a Mutant-specific plan only when a nearby Mutant is more than 65 pixels above the ship and within 55 horizontal display columns. Otherwise normal Stage 69 combat remains active. The empirical breakaway threshold of 42 columns creates useful separation without letting the target escape the firing window; the gun then reverses while the ship retains outward velocity.

## Implementation

- `mutPhase`: `SEPARATE`, `ALIGN`, `SHOOT`, `REACQUIRE`. Each phase persists against a live original `OPTR` object and does not chase individual one-pixel hops.
- A latched escape lane prevents short up/down reversals; stable target altitude is updated periodically rather than on every pixel.
- Mutant beam lead was separately tuned rather than changing the prediction for other enemy types.
- The existing artificial 26-tick laser-opportunity gate was raised to 30 ticks, within ordinary source laser range. The source laser itself is unchanged.
- Original `YMIN` / `YMAX` wrap is unwrapped when estimating Mutant vertical motion, avoiding a false 196-pixel leap from the top to bottom of the playfield.
- The existing Pod stand-off safety, Bombers, Swarmers, astronaut delivery, scarce smart bombs and last-resort hyperspace logic were retained.

## Reproduction

From the source tree:

```
npm test
npm run build
node tools/mutant-arena.mjs browser/flight.js
node tools/mutant-holdout.mjs browser/flight.js
node tools/benchmark16.mjs browser/flight.js
```

For direct Stage 69 comparison, pass the Stage 69 source file as a separate argument to the three scripts; their output reports each path separately. `tools/mutant-arena.mjs` and `tools/mutant-holdout.mjs` each cover 48 different arranged real-engine Mutant encounters, with player deaths and laser-confirmed object kills. Arrange-only mutations of starting source RAM are test fixtures and are **not** present in gameplay code.

## Results

| Metric | Stage 69 | Stage 70 |
|---|---:|---:|
| Mutants killed, 48 design encounters | 26 | 33 |
| Mutants killed, 48 held-out encounters | 26 | 34 |
| Combined player deaths | 2 | 0 |
| Combined vertical direction changes | 657 | 424 |
| Mean confirmed laser hits, 16 ordinary games | 47.81 | 48.81 |
| Mean survival ticks, 16 ordinary games | 6,922.9 | 6,970.8 |
| Reached wave 3 in 16 games | 9 | 9 |
| Mean lost astronauts, 16 ordinary games | 6.06 | 6.19 |
| Smart bombs used in these 16 games | 0 | 0 |

617 regression tests passed, including six Stage 70 tests. The source-fidelity guardrail passed. The self-contained `play.html` is generated from the same verified source tree.

## Limitations

A 96-encounter evaluation cannot establish an absolute or mathematical optimum. Some Mutants are still missed, and ordinary game improvement is modest. Benchmark geometry, durations, starting wave and RNG seeds affect scores. The confidence is in improved tested Mutant engagement and reduced micro-steering, not an invincible arcade pilot. Long browser-based human viewing is still advised.
