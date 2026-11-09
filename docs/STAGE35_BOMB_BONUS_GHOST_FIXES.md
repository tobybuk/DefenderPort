# Stage 35 source integration audit — Smart Bomb, Bonus and Bomber erasure

## Reproduction in Stage 34

- At tick 100, press Smart Bomb. Its first dispatch sets `SBFLG=1` and starts `SBMBX0`, complementing `PCRAM` every two source update ticks.
- Remove all remaining enemies during the flash. `GEX0` sees `WVCHK()==0`, calls `GNCIDE`, and starts `BONUS` four ticks after the Smart Bomb began — with flashing still active. This could present the bonus message against the wrong palette.
- Reproduction at a visible second-wave Bomber: its `TIEKIL` unlinks the owner from OPTR but did not erase the previous bitmap in the integration frame. 21 nonzero sprite bytes remained where the 4x8 original TIEP bitmap had been drawn.

## Changes

1. `original/defa7-smart-bomb.js`: `FLASHING()` exposes the original `SBMBX → SBX10` flash interval without altering source palette operations, duration, or button debounce. `RESET()` clears only this host bookkeeping.
2. `demo/flight-harness.js`: the `GEX0` dispatch bridge calls original `GEX3` if `WVCHK()==0` and the bomb is still flashing; the next normal 15-tick wakeup rechecks and enters unmodified `GEX0`/`BONUS`. This is a declared host timing adapter, not a claim of exact original CPU scheduling.
3. `demo/flight-harness.js`: the `TIEKIL` collision-vector bridge calls original `OFSHIT(X)` before `TIEKIL` unlinks X. Other kill vectors remain unchanged.
4. `tests/stage35-bomb-transition-cleanup.test.mjs`: regression tests cover the source/host interactions and actual source-video bytes.

## Constraints and limitations

- No invented animations, Canvas erasure, or sound.
- Unlimited Smart Bombs stay temporarily active.
- Bonus timings and scores remain unmodified once the bonus screen begins.
- If further artifacts occur, a screenshot plus approximate wave/enemy type will help locate another death-vector boundary.
