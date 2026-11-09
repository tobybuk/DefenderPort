# Stage 15: Original UFO/swarmer/lander bitmap integration

## Observed Stage 14 fault
The upper canvas' `flightHarness` had its own RAM/video and no real enemy descriptors. Only an optional `PLAPIC` diagnostic descriptor existed. The Stage 12/13 enemy and lander workbenches used separate RAM and could not appear in the upper screen.

## Implemented
- `original/defb6-enemy-pictures.js`: exact `FDB` original 6809 graphic data sourced from pinned `src/defb6.src` lines 2077–2139; binary data transcribed directly, not substitute artwork. All six 2-phase pictures use original declared width/height.
- `demo/flight-harness.js`: resolves source descriptor names via explicitly **synthetic** JS pointer keys; dispatches sprite writes/erases through source-named `ON64`/`OFF64`, `ON34`/`OFF34`, `ON58`/`OFF58` and original `OPROC`. Object allocation/record fields use `GETOB`/`OBINIT` and original `OLINK`/`OPTR` RAM chain. Physical screen bytes are shared with the player/terrain/stars. Runtime movement uses `VELO`, in the existing translated IRQ order.
- Visible source `UFOP1`, `SWPIC1` and `LNDP1` records start at intentionally chosen test coordinates and test velocities. This is a **spawn-input fixture**, not arcade `GEXEC`/wave setup or original `APVCT`. Process slots are currently allocated via the source scheduler, but their synthetic continuation is not dispatched; do not describe this as live enemy AI.
- `tests/stage15-enemy-visible.test.mjs`: FDB phase lengths, original pixel bytes in active VIDEO memory, advancement and reset.

## Still missing
Actual original startup (`SINIT`/`EXEC`), source `APVCT` appearance and live `UFOST`/`LANDST`/`MMSW` game-process dispatch in the *same* runtime, full original sprite/collision/shot/sound/level transitions, verified palette and IRQ timing.

Source reference: https://github.com/mwenge/defender/tree/e74006344b16d19245510b5e55780f90d7606bb8/src
