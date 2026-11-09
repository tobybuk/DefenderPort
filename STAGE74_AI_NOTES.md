# Stage 74 — Wave tactics: Pods, scarce humans, post-planet smart bombs, Baiters

Only `createAttractPilot()` in `browser/flight.js` changed. It still reads source RAM and acts only through ordinary player switches. The translated game is untouched. All new tuning lives in one `TACTICS` block.

## Requests and source facts

| Request | Source behaviour that matters |
|---|---|
| Pods: too reluctant; reverses near them | Old AI retreated (`EXTEND`) from any Pod within 49 columns, yet would not fire at one closer than 54, so it rarely got a shot. `PRBKIL` releases 1–7 Swarmers at the Pod (`MMSW`). |
| Keep a human under the ship when humans are short | A caught human (`AFALL2`) hangs 10px under the ship and lands only when that point passes the terrain altitude (`GETALT`). The highest terrain in `ALTTBL` is 160, so a ship at y ≤ 148 never sets him down. Landers can't abduct a carried human (`LANDS0` rejects a target whose `OCVECT` isn't `ASTKIL`). When `ASTCNT` hits zero, `TERBLO` destroys the planet and Landers become Mutants. |
| Planet gone: gather Mutants, then smart bomb | `SBOMB` kills every on-screen enemy. Mutants always chase the ship horizontally, so they converge on it. |
| Baiters: finish the wave first, but no Baiter swarm | `WVCHK` ends the wave when Landers, Bombers, Pods, Swarmers and Mutants (active and reserve) are all gone. Baiters don't count. `UFOST` brings Baiters sooner once ≤ 8 such enemies remain (up to 12 at once), and Baiters fly at the ship's own speed plus an offset. |

Measured in Stage 73 play: 88% of human deaths were completed abductions. A doomed abduction took about 116 ticks from grab to Mutant and started on average 110 columns from the ship.

## Implementation

- **Pods:** no retreat. They're hunted like other enemies, approached with thrust off inside 28 columns, and shot from 16 columns (was 54). The shield handles the released Swarmers.
- **Keeping a human:** with 1–3 humans left (`keepHumansAt`), a caught human is not delivered. The AI keeps fighting normally: duel, shield, dodges and hunting all stay active. Every height it chooses, including shield substitutes, is capped at y ≤ 148 (`keepFloor`), so he stays aboard. With more humans the old delivery for 500 points is unchanged. When humans are scarce, abductors get extra priority, falling humans are chased from further away, and Landers dropping towards the ground are hunted first.
- **Abductions first:** while any Lander is carrying a human, the generic retreat-and-fire combat is suspended. The Mutant duel engages only a Mutant that is about to collide; the shield still applies.
- **Planet gone:** smart bomb when at least 5 Mutants are on screen together (or all of them, if fewer remain), at most once per 150 ticks. It always keeps **2 bombs in reserve** for the shield's emergency bomb. Without that reserve, Mutant deaths rose sixfold, because all 36 Mutant deaths in that trial happened with no bombs left.
- **Baiters:** while Baiters are present, the wave's other enemies get +140 priority and half the distance penalty, so distant ones are hunted down. Baiters get −80 unless they are within 24 columns or there are 3 or more; then the wave bonus is dropped and they get +150. The opportunistic gun still fires at any Baiter in line.

## Results

Paired comparison: 56 seeded games (the `benchmark16` seed formula, seeds 64–71 and 80–127), 30,000-tick cap. Seeds 72–79 are excluded for both versions; see the engine trap under Limitations.

| Metric | Stage 73 | Stage 74 |
|---|---:|---:|
| Mean survival (ticks) / game-overs before cap | 26,574 / 22 | 28,386 / 11 |
| Player deaths per 10,000 ticks | 2.37 | 2.27 |
| Mean score | 58,240 | 70,350 |
| Mean furthest wave | 6.13 | 7.29 |
| Waves cleared per 10,000 ticks | 1.93 | 2.21 |
| Pods destroyed per 10,000 ticks | 5.30 | 6.64 |
| Share of time within 50 columns of a Pod | 16.4% | 10.5% |
| Share of time with Baiters present / mean when present / max | 27.1% / 1.61 / 8 | 20.6% / 1.36 / 6 |
| Deaths with a Baiter nearest | 70 | 31 |
| Share of time with the planet destroyed | 65.1% | 59.5% |
| Share of time carrying a human | 0.4% | 6.4% |
| Smart bombs per 10,000 ticks / Mutants killed per bomb | 1.95 / 4.41 | 2.68 / 3.97 |
| Mutant deaths per 10,000 ticks | 0.21 | 0.38 |
| Deaths with a Swarmer nearest | 61 | 90 |
| Humans lost per 10,000 ticks | 6.77 | 6.89 |

Variants rejected on the same metrics:
- Unrationed post-planet bombing: Mutant deaths 1.03 per 10,000 ticks.
- A 1-bomb reserve: worse deaths and score.
- A larger Baiter-swarm bonus.
- A 24-column Pod range: no better.

Re-running the same build on a second seed set moved headline figures by 5–10%, so smaller differences are noise.

## Tests

- New: `tests/stage74-wave-tactics.test.mjs` (9 tests).
  - Pods are shot from 30 columns without retreating, and still never from point-blank range.
  - A carried human is kept above the highest terrain when humans are scarce, and delivered otherwise.
  - Gather-and-bomb fires with 5 Mutants on screen, but not with 2 bombs left or while most Mutants are off screen.
  - Baiter priorities, and abduction-first over a Mutant that isn't yet dangerous.
- Adapted: the Stage 66 "close Pod is NEVER shot" test now places its close Pod at 10 columns, under the new 16-column limit. Its 44-column "close" Pod is now an intended target.
- New tool: `npm run ai:benchmark` (`tools/stage74-benchmark.mjs`) reproduces these metrics.
- `npm test`: 631 tests pass, plus the source guardrail. The Stage 73 Mutant arena is unchanged.

## Limitations

- **Engine trap:** the translated game raised its original ERROR trap once in roughly 600 benchmark games. A laser hit a human whose process had already been retired: `AKIL1` → `KILLOP` → "KILL: … not in ACTIVE". This is in the translated engine, not the pilot; the pilot's play only happened to reach it. In the browser it stops the game at a "Source boundary". The shipped settings didn't hit it in 192 games.
- **Human losses haven't fallen.** Abductions far across the world still mostly succeed. Keeping a human aboard is what reduces planet-loss time.
- **Engaging Pods costs Swarmer deaths.** Mutant deaths per 10,000 ticks are about double Stage 73's (still far below Stage 72's 1.62), because more bombs go into gathered swarms. Overall deaths per tick are slightly lower.
- **The 148 keep-height is conservative.** It's set by the single highest peak; the pilot doesn't read the terrain bank.
