# Stage 62 — Attract-mode AI revision

The AI remains entirely a host-side controller. It observes source-owned `STATE`, `ENEMY_STATE`, `ASTRONAUT_STATE`, and source RAM linked objects, and acts only via `lab.INPUT()`. Neither lives, enemy collision physics, scores, smart-bomb supplies nor wave progression are modified for demonstration play. The normal game-over condition triggers a fresh ordinary game for long-term continuous display.

Changes from Stage 61:

- `WATCH AI PLAY` on the cabinet toolbar skips the attract enemy showcase. The original sequence still hands over after AMOD13.
- Source `OPTR` linked-list gating avoids retired enemy objects.
- Capturing Lander detected from source collision vector `LKIL1` ($E22A) and strongly prioritised.
- Future target intercept based on source enemy velocity, with target commitment and braking allowance.
- Patrol movement and altitude changes when there are no live threats, rather than stationary idle.
- Threat corridor checks and vertical escape actions when an enemy is about to intersect the player trajectory.
- Finite smart-bomb stock, normal hyperspace risks and switch-edge handling.

Tests: eleven AI-specific unit checks plus full original suite / guardrail. Chromium headless execution was attempted but failed to complete in the available environment; longer-term AI survival and score distributions have **not** been verified with live gameplay.
