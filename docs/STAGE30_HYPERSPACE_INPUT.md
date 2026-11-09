# Stage 30 — original Hyperspace and hold-to-fire

This stage builds directly on Stage 29. **Sound synthesis remains intentionally deferred** and the browser deliberately enables **unlimited Smart Bombs**. Neither behaviour is claimed to represent an unmodified 1981 cabinet.

## Original Hyperspace translation

Source: pinned Williams Defender Red Label `DEFA7.SRC` lines 3209–3276, `HYPER`, `HYP02`, `HYP0`, `HYP00`, `HYP1`, `HYP2`, `HYPX`; playfield clear `DEFB6.SRC` lines 1436–1458 `SCLR1/SC0LP/SC1LP`. Commit `e74006344b16d19245510b5e55780f90d7606bb8` in `mwenge/defender`.

- `HYPER` rejects non-play states through the source `STATUS & 0xFD` mask, sets `$77`, clears the main screen (not scanner or original HUD), then sleeps fifteen source process ticks.
- `HYP02` removes all linked shells (`SPTR`/`KILSHL`), resets `BMBCNT`, relocates original `BGL/BGLX/PLAX16/NPLAD/PLAY16` registers using the source `SEED` bytes, clears the original player velocities, runs `BGI`, and creates an original object record for a ship reappearance using `APVCT` with the actual `PLAPIC`/`PLBPIC` descriptors.
- `HYP2` retires its source reappearance object, restores the normal `STATUS` value, and checks the original `LSEED > 192` condition. When it fails, control branches into translated `PLEND`, invoking the existing three-life system.
- The zero-velocity and phony-object state use source RAM. Synthetic continuation IDs (`0xF970`, etc.) are dispatch handles in this JavaScript transliteration; they are **not** claimed to be original ROM addresses.
- A defensive `CANCEL(X)` disarms a still-running appearance reference before its source object record is recycled; otherwise the host's not-yet-cycle-exact EXPU cadence could cause use-after-free.

## Browser hold-to-fire input (explicit adapter)

- Hold **F** or **HOLD FIRE** for repeated calls to the native translated `LFIRE` firing path, nominally every seven source update ticks. The seven-tick interval is an **input convenience**, not verified source `SSCAN` cabinet timing.
- Tap **H** or **HYPERSPACE** to start the translated hyperspace process. Holding the button does not keep restarting it.
- Touch and pointer default/selection prevention remains active on all mobile controls; new controls are included.
- The external developer readout now shows the number of successful laser fire requests and hyperspace attempts.
- Source RAM and framebuffer remain shared between player, enemies and scanner. No Canvas enemy, explosion or player sprite was added.

## Verification and remaining boundaries

Run `npm run build && npm test`. The suite checks: source screen-clear limits, 15-tick delay, source SEED/HSEED byte layout and branch choices, failure into PLEND, finite/unlimited Smart Bomb coexistence, and bundled HTML control references. The actual standalone HTML was loaded into Chromium using `page.set_content` because local `file://` navigation is blocked by the execution environment; game boot, hyperspace activation/delay, held fire, and absence of console errors were checked.

**Still not established:** source-exact cabinet switch polling for rapid laser firing, the whole-machine 6809 instruction timing/raster-phase behaviour, original sound-board reproduction (intentionally deferred), and analogue CRT calibration. The development workbenches are not the active game state.
