# Stage 75 — Engine fixes, demo robustness and a source-faithful shield

## Engine fixes

These are fixes to the translated game, checked against the pinned upstream source (`mwenge/defender` e740063).

### 1. Score popups left on screen (`KILOFF`)

DEFB6.SRC line 1150 reads `KILOFF JSR KILLOB`, with no `RTS`. Execution falls through into `OFSHIT`, which erases the object's last image. The translation's `KILOFF` stopped after `KILLOB`.

As a result, every object retired through `KILOFF` left its last bitmap behind. Most visibly, this affected the 250/500 rescue scores (`P503`, after 50 ticks).

`original/defb6-banking-object.js` now falls through. An object with no screen address (`OBJX` = 0) has nothing to erase.

### 2. Engine ERROR trap: "KILL: … not in ACTIVE"

The original `PRBKIL` uses the `KILO` macro, which removes the Pod *object* only. Pods have no process of their own. Their `OBJID` simply names whichever process created them.

The harness used `KILP`, which also kills that process. Once the creator's slot had been reused, shooting a Pod killed an unrelated process. In the traced case it was the `AFALL2` process carrying a human, and `MMSW` immediately recycled the slot as a Swarmer. The human was left pointing at a dead process, and the next laser hit on him (`AKIL1` → `KILLOP`) reached the original ERROR trap.

The old harness guard only recognised the `GEX0` creator itself, not a reused slot. `demo/flight-harness.js` now has a `KILO` (object only) and uses it for Pods, in the original order: `KILO`, `RMAX` 6, `MMSW`, `DEC PRBCNT`.

The new tests fail on the old code and pass on the new.

## Demo mode

- **Recovery:** if the AI demonstration ever reaches a source boundary or ERROR trap, it logs a console warning and starts a fresh demo game instead of freezing. Player games keep the original stop-and-report behaviour.
- **"DEMO MODE ACTIVE":** flashes (400 ms on, 200 ms off) for 5 seconds at the start of each demo game. It's drawn like the boot screen's "INITIAL TESTS INDICATE": original MESS0 glyphs via ROMF8 `CWRIT`, in the RORAOK colour `$7A`, centred. It lives in its own buffer composited over the picture, so the game's video memory is never touched (`createSourceTextBanner` in `browser/cabinet-boot.js`).

## Attract pilot

- **Swarmers in the shield** follow `MSWLP`/`MSWM`. Each Swarmer's own vertical acceleration is read from its process (`PD2`). It accelerates towards the ship's height, damped by about 1/64 and clamped to ±2 px/tick. It keeps its horizontal velocity until it is 150×32 units past the ship, then turns at `SWXV`.
- **Baiters in the shield** follow `UFOLP`/`UFONV0`:
  - A Baiter flies straight, and may re-aim only when its UFOP1–3 animation wraps (every 18 ticks, timed from its current frame). The shield assumes every such chance is taken.
  - On a re-aim: beyond 20 columns, `OXV` = the ship's `PLAXV` ± `$40`; beyond 10 px, `OYV` = (±1 px + `PLAYV`)/2.
  - A first version re-aimed every tick. That made the shield override the AI for 17,000 ticks per 8 games while Baiters were present, so it dodged instead of shooting. The source timing fixed that.
- **Real terrain for a kept human:** the harness exposes `ALTITUDE(x)`, the same `ALTTBL` lookup as `GETALT`, and the browser passes it to the pilot. The keep height becomes (lowest terrain under the human from 4 columns behind to 20 ticks of travel ahead) − 13, instead of a fixed y 148. If Baiters are present and every remaining wave enemy is below that height, the human is set down so the wave can finish.
- **Never shooting humans:** fire is held if a human (other than our own passenger) lies in the beam's path before the target. The laser stops at the first object it meets.
- **Hyperspace as last resort:** used when no input avoids a collision within 3 ticks, nothing already overlaps the ship, and no smart bomb is going off. `HYP2` kills the ship when `LSEED` > 192 (about 25%). In 8 traced games the AI jumped 75 times and 16 jumps failed (21%), against otherwise certain collisions.

## Results

64 seeded games (seeds 64–127), 30,000-tick cap, both versions on the fixed engine.

| Metric | Stage 74 | Stage 75 |
|---|---:|---:|
| Player deaths per 10,000 ticks | 2.38 | 1.58 |
| Game-overs before the cap | 19 | 3 |
| Mean score | 68,272 | 77,209 |
| Mean furthest wave | 7.16 | 7.88 |
| Waves cleared per 10,000 ticks | 2.22 | 2.31 |
| Deaths with a shell / Swarmer / Baiter nearest | 205 / 99 / 50 | 105 / 40 / 21 |
| Mutant deaths per 10,000 ticks | 0.29 | 0.18 |
| Share of time with Baiters present (mean / max count) | 21.7% (1.46 / 7) | 23.0% (1.79 / 12) |
| Share of time carrying a human | 6.2% | 2.8% |
| Share of time with the planet destroyed | 59.2% | 62.5% |
| Humans lost per 10,000 ticks | 6.98 | 6.75 |

Stage 75 has 63 deaths with no enemy nearby. These are mostly failed hyperspace jumps.

## Tests

- New: `tests/stage75-fixes.test.mjs`, 8 tests.
  - `KILOFF` erases a retired on-screen Lander, and `PRBKIL` spares an unrelated process. Both fail on the old code.
  - The keep height follows the terrain, and the human is released when he blocks the wave.
  - Fire is held for a human in the beam.
  - Hyperspace is used only for an unavoidable collision, and a re-aiming Baiter is anticipated.
  - The banner uses the source font, colour and centring.
- `npm test`: 639 tests pass, plus the source guardrail.

## Limitations

- **Baiter presence didn't fall.** The AI survives longer into Baiter-heavy late waves, and time carrying a human halved. Releasing the human whenever the wave's remaining enemies are below the keep height is a blunt rule.
- **Hyperspace still loses about a fifth of jumps.** That's the source rule. The AI only jumps when a collision is otherwise certain.
- **Other `KILP` uses weren't changed.** Every other `KILP` matches the original macro use. `TIEKIL` has its own translation.
