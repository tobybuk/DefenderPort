# Defender Stage 69 — Mutant breakaway and target-commitment correction

## Regression causes

The Stage 68 attack chooser ranked every visible and distant source enemy every tick. A distant carrying Lander could acquire a large static score bonus and steal the target even when the Defender was seconds from engaging an enemy directly ahead. Because facing is changed by the ordinary REV input, this became an inexplicable sudden U-turn. Stage 69 retains the Stage 68 general ranking, but refuses that single disruptive switch when the current target is live, directly in front and within 45 display columns, and the challenger is behind and at least twice as distant (at least 70 columns). If the near target dies, the lock is dropped immediately. Ordinary opportunistic lasers still check every candidate independently.

The Mutant threat code previously had essentially time-only disengagement and sometimes switched to TURN_FIRE too early, before the closing attack from above was safely separated. A universally long escape was tested and rejected: it sharply reduced kills because chasing Mutants outran the pilot's aiming opportunity. Stage 69 discriminates between an ordinary duel and an **actual diving interception**, using observed vertical drift, vertical separation and future relative X separation. Only a real dive starts an extended breakaway, with the ship accelerating away before facing the Mutant. A latched vertical escape lane prevents chasing the ship's own small movement; after space opens, an aiming lane can be established while outward momentum continues. The extended escape is bounded and eventually offers a counterattack. Non-diving Mutants retain Stage 68's more effective earlier reversal.

Mutant observation now distinguishes small oscillatory ±2 pixel hops from sustained vertical travel by examining sampled trajectory direction, amplitude and net displacement. Mutant aim is acquired promptly but subsequent small retargetings are limited by a 22-tick lane hold and a resting interval after a vertical correction. Imminent normal collision and hostile projectile avoidance still take priority.

## Unchanged game mechanics

The only gameplay output from the AI remains regular `lab.INPUT()` switches: thrust, up, down, reverse, fire, smartBomb and hyperspace. No modification to original source modules, player movement or inertia, enemy AI, collision mechanics, weapon quantities, scoring, human rescue, or normal game-over. A separate attract host restarts another standard game when it ends. `WATCH AI PLAY` jumps directly into the ordinary game under AI control.

## Verification

- 611/611 automated tests pass, including six new Stage 69 tactical tests, and the original source-fidelity guardrails.
- The scenario test recreates a ship approaching a real target while a much farther enemy behind it suddenly becomes a carrying Lander; the ship no longer U-turns away. Destroying its near target releases commitment.
- A descending Mutant fixture must remain in EXTEND beyond the former 25-tick cutoff and still eventually reverse to fire. A non-diving Mutant does not get the expensive long retreat.
- A synthetic Mutant moving ±2 pixels no longer produces repeated vertical direction reversals; substantial altitude corrections remain functional.
- 16 ordinary deterministic 12,000-tick engine runs compared with the exact Stage 68 controller: **47.8 vs 45.9 confirmed laser hits/run**; **6,923 vs 6,742 survival ticks/run**; **9/16 vs 8/16** reached wave 3; **6.1 vs 6.1** astronauts lost/run (rounded). These are deterministic samples, not a guarantee of improvement in every encounter.
- In 24 isolated Mutant duels, Stage 69 killed **15/24** compared with **16/24** for Stage 68, with zero player deaths in both. This is still a limitation; improved overhead stability does not yet imply expert Mutant combat.
- Emergency resources remain rare: no smart bombs in the 16 Stage 69 comparison runs. Hyperspace remained an actual last-resort input and was not needed in the focused unit tests.

## Run

Open `play.html` and select **WATCH AI PLAY**. Run `npm test` to execute the automated suite and source guardrail. Run `node tools/benchmark16.mjs /path/to/stage68/browser/flight.js /path/to/stage69/browser/flight.js` for the 16 fixed-state comparison, or `node tools/mutant-duels.mjs` for the 24 deterministic isolated Mutant encounters.

The automated engine tests do not replace long-duration human visual evaluation in a real browser; it has not been fully verified here.
