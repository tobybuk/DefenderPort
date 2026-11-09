# Stage 72 — Imminent overhead Mutant interception

## Failure addressed
Stage 71 can let a Mutant descend onto the ship while the AI continues normal interception, or repeatedly corrects vertical alignment instead of establishing a stable escape trajectory.

## Design
The pilot checks current vertical separation, Mutant descent, and relative horizontal position projected to the time of vertical crossing. Only a nearby imminent dive interrupts ordinary play. It latches a lower escape altitude and uses the original reverse/thrust inputs to create horizontal distance. It does not spend a smart bomb or invoke hyperspace. The AI keeps the original MUTANT SEPARATE → ALIGN → SHOOT machinery to counterattack, with the breakaway gap extended only for a tracked imminent dive. No changes in original game routines.

## Tests and caveats
- All 621 node regression tests passed, including two new source-engine close-overhead scenarios. Original-code guardrails pass.
- A 48-case close overhead arena (3–24 columns ahead and 14–40 pixels above) yielded 48/48 kills and zero player deaths; Stage 71 yielded 47/48 and zero deaths. Stage 72 took longer to finish the kills.
- On the broader original 96-encounter suite, Stage 72 won 94/96 vs Stage 71 95/96; there were no player deaths in either set.
- Across 16 ordinary seeded games Stage 72 averaged 47.75 laser hits, 7421 survival ticks, and 6.88 humans lost; Stage 71 had 47.31 hits, 7122 ticks and 6.44 humans lost. Wave-three reach was 8/16 vs 9/16.

This is a tested specific emergency avoidance improvement, not proof of universally better Mutant combat. It does not change the source game physics or immunise the player from hits. Tests do not replace prolonged visual inspection.
