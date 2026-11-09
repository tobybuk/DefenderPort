# Stage 22: source first-wave correction

## Root cause

The Stage 21 flight harness started the original GEXEC using *hand-inserted* wave parameters `UFOTIM=1`, `LNDRES=1`, `WAVSIZ=1`, plus a fixed Swarmer. The first `GEXEC` tick (GEX0) therefore spawned a Baiter almost immediately. This made the visible opposition predominantly Baiters rather than the first wave of Landers.

## Source trace (pinned mwenge/defender, commit e74006344b16d19245510b5e55780f90d7606bb8)

- `BLK71.SRC`, `WVTAB`: first wave has 15 Landers; 0 Ties/Probes/Schitzos/Swarmers; WAVTIM=30; WAVSIZ=5; UFOTIM=$D4.
- `DEFA7.SRC`, `GETWV`: copies the wave-one column of WVTAB into the selected player record (PENEMY).
- `DEFA7.SRC`, `PLRES/ASTSX/ELS1/ELS2`: copies selected player enemy settings into live `ELIST` and clears `ECNTS`; later reserve branches not yet translated and throw if nonzero.
- `DEFA7.SRC`, `GEXEC` through `GEX0`: initial wave script starts a squad of `WAVSIZ=5` Landers from `LNDRES`, then waits on `WAVTMR`; Baiters wait for `UFOTMR`.
- `DEFB6.SRC`, `LANDST`, `LANDS0`: allocates the original lander processes and bitmaps, in shared `OPTR` read by source `OPROC` and scanner `SCNR`.

## Verified initial state

`P1WAV=1`, `ASTCNT=10`, `LNDCNT=5`, `LNDRES=10`, `UFOCNT=0`, `UFOTIM=$D4`, `UFOTMR=$D3`, `WAVTIM=30`, `WAVSIZ=5`; all other enemy reserves zero. Scanner has 15 object blips including astronauts. With seeded source RNG $A55A, two source Lander sprites occupy the initial visible viewport and are written to video memory with original `ON58` picture data. No diagnostic Swarmer or manually seeded Baiter is present in the live game object list.

After ~450 diagnostic frames the second batch of five Landers is started; no Baiters are present within the first 1000 tested frames. The original wave program and its timers continue to execute, but not every subsequent process is translated.

## Validation and limitations

Stage 22 adds `tests/stage22-first-wave-regression.test.mjs` and standalone browser-boot assertion. The original world startup/CMOS is still a documented harness input; first-wave parameter values derive from original source. The opt-in diagnostic Swarmer is retained only for old explicit tests. Further lander abduction reaches an untranslated astronaut-death/explosion dependency (`ASTK1`/`XSVCT`). The browser now catches this translation boundary and halts the update loop with the specific error; it does not swallow the error by inventing gameplay. Independent Chromium visual verification should be distinguished from deterministic video-RAM tests.
