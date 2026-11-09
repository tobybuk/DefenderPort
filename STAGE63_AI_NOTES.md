# Stage 63 — AI tactical revision

The AI is a cabinet/input adapter (`browser/flight.js::createAttractPilot`), not a gameplay variant. All game state continues through the source-translated routines.

- Target selection includes sticky acquisition and high-priority carrying Landers.
- Altitude control uses a stable target lane, deadband and hold time rather than oscillating against each one-pixel enemy movement.
- Firing checks the actual current beam altitude, with short lead for motion and rapid bursts through the ordinary FIRE switch.
- Collisions are considered from above, below and horizontally, using predicted relative movement, a persistent evasion lane and avoidance of frontal thrust.
- Smart bombs require a large on-screen cluster (8 or 6 with 2 carriers), and are gated by a long cooldown.
- Hyperspace is only requested when 3 simultaneous immediate threats leave no vertical escape lane, and not in the first 900 ticks. It remains dangerous per original rules.
- The existing WATCH AI PLAY shortcut still launches an ordinary game. Death/game over still happens normally and the attract controller restarts another game.

## Validation

Added eight focused AI tactic tests including jitter, overhead/downward threat, below/upward threat, repeated conventional firing, bomb conservation, bomb cluster and hyperspace conservation. These are isolated controller tests, not a verified browser survival benchmark.
