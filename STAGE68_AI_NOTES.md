# Defender Stage 68 — full live enemy roster and predicted overhead Mutant manoeuvre

## Confirmed defect fixed

Stage 67 iterated only the `ENEMY_STATE()` adapter's historical allocation log. The original source `TIEST()` (Bomber) and `PRBST()` (Pod) code creates linked original OPTR objects but never adds them to that list. Swarmers may also be omitted. Consequently those real enemies could be visible to the game but invisible to the demonstrator AI.

Stage 68 walks the real source `OPTR` chain (up to 95 links, cycle guarded), reading each object's current `OPICT`, `OX16`, `OY16`, `OXV`, `OYV` and `OBJX`. It recognises all four Bomber animation frames and Pods, plus source Landers, Mutants, Swarmers, and UFOs. It uses `ENEMY_STATE()` only as a fallback in incomplete synthetic unit fixtures where the X-coordinate isn't populated in RAM. Normal gameplay is observed exclusively through the original linked source objects.

The controller's TIEP/PRBP widths now use their actual four-column picture descriptor width, improving laser intersection estimates. Bomber and Pod attack-priority scores are adjusted so they are viable hunt targets. Close Pod explosions still risk releasing Swarmers; laser fire is deliberately withheld inside the 54-column safety threshold. No smart bombs or hyperspace are spent merely on Bomber/Pod proximity.

## Overhead Mutants

The Mutant threat evaluation now predicts lateral convergence from relative source X velocity and observed descent before the Mutant is directly overhead. A far-overhead interception starts a committed `EXTEND` manoeuvre using normal reverse and thrust controls; it keeps a fixed vertical escape lane, aims for at least 45 columns of separation and waits up to 60 ticks before reversing to shoot. Ordinary close Mutant fights retain Stage 67's shorter turn-and-fire, which scored better in actual simulated duels. This was chosen after testing alternatives that spent too long fleeing and scored worse.

## Rules / engine boundary

- Only `browser/flight.js` AI observation and tactical policy, tests, documentation and version metadata change.
- No edits to `original/` modules or original lives, physics, human capture/delivery, collision, projectile, scoring, wave, smart bomb or hyperspace routines.
- The AI issues the same seven normal PIA control fields (`thrust`, `up`, `down`, `reverse`, `fire`, `smartBomb`, `hyperspace`) through `lab.INPUT()`. Demonstration cycles restart via an ordinary new game.
- `WATCH AI PLAY` still shortcuts directly into an AI game.

## Verification

- All 605 automated tests pass, including five new Stage 68 checks: all Bomber animation frames; actual source-created Bomber/Pod absent from `ENEMY_STATE()`; safe vs unsafe Pod firing ranges; early overhead Mutant breakout and eventual return to firing; no spurious retreat from a Mutant moving away.
- The existing source-translation guardrail suite passes.
- 24 isolated Mutant duels: 16 kills and zero deaths in both Stage 67 and Stage 68. The new overhead approach is therefore a specific safety and anticipation improvement, not yet an improvement in isolated kill rate.
- In sixteen 12,000-tick deterministic engine starts, Stage 67 averaged 37.1 confirmed hits and reached wave three in 0/16 runs. Stage 68 averaged 45.9 hits and reached wave three in 8/16. Stage 68 survival averaged 6,742 ticks versus 8,564 for Stage 67, while total astronauts lost increased 6.12 vs 4.31. Reaching harder later waves sooner partly affects those comparisons, but this is not an across-the-board improvement.
- Stage 68 used one smart bomb across the 16 benchmark games; original finite weapon rules remain enforced.

Browser endurance and a long manual playthrough have not been verified. The enemy-visibility defect is conclusively corrected; strategic survival and human preservation still need ongoing work.
