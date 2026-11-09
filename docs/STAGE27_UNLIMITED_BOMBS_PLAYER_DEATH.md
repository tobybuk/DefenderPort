# Stage 27 – Unlimited Smart Bombs, native player-death handling and shell collisions

## Source and scope

Pinned Williams Red Label sources: `src/defa7.src` 1325–1431 (PLEND and PDTH continuations), 2697–2717 (BKIL), 2902–3018 (COLIDE), 3128–3151 (COLCHK and COL0), 3171–3207 (SBOMB); `src/defb6.src` 1930–1936 and 2065–2069 (BXPIC/BXD10 bitmap). Upstream revision remains the project's pinned `e74006344b16d19245510b5e55780f90d7606bb8`. No 6809 interpreter or synthetic enemy art is introduced.

## Temporary developer option: infinite ammunition

`createFlightHarness({infiniteSmartBombs:true})` passes `infiniteAmmo:true` to `createDefa7SmartBombRoutines`. Only the source `PSBC` zero-charge test and `DEC PSBC` are skipped, so the original 3-charge memory remains unchanged and score/kill/debounce logic is preserved. The source-default diagnostic `createFlightHarness()` still decrements 3 → 2 → 1 → 0, and the live browser explicitly opts into unlimited bombs. `STATE().smartBombs === Infinity`, while `STATE().storedSmartBombs` reports the real source counter.

## Source player deaths and lives

`original/defa7-player-death.js` ports source entry points `PLEND`, `PDTHL`, `PDTH2` and `PDTH5`. It sets original `STATUS`/`BGLX`, saves wave enemy counts via `PLSAV`, makes `MONOPIC` from the actual Williams player source data (colour B), runs the `PXCTB` 2-tick colour series, and transitions through `GNCIDE`/`SUCIDE` into the existing source player-state restore. The `PLAS` source counter is decremented by the same stage-start path that consumes the initial ship; a natural wave transition first compensates for that decrement. On the final loss, game state is `STATUS=255` / game over; Reset starts a fresh game.

The complete final `PXVCT` ship shatter animation is not yet ported: the source process calls a documented bridge at `PDTH5` instead. Palette hardware colour fidelity and absolute frame scheduling are not yet differential-tested against original Williams hardware.

## Projectiles and player contact

`COLCHK` follows source `COLC1`: compare player source picture bytes with `OPTR`; if no object is hit, run `COL0` over `SPTR`. `COLIDE` shares the same packed-byte intersection calculation with both lists. `BKIL` follows the source `SCORE $0025 → DEC BMBCNT → KILSHL → OFSHIT → X = (screenX>>2)+BGL → OY16 -= 2 → OPICT = BXPIC → EXST → AHSND` path. `BXPIC` is transcribed from source `BXD10`, using `ON48/OFF48`, not a replacement particle sprite. Player-death scheduling uses the same source `MKPROC` and cannot duplicate an in-progress loss.

## Tests and limitations

- Native source/standalone tests for repeated unlimited-bomb presses; the original finite source option remains under its earlier regression suite.
- Source status flags, colour-cycle changes, life-count transitions, new game and wave-restoration counters.
- Player-object and player-projectile collision paths, including source `SPTR` unlink, projectile score, bitmap data and `EXST` bookkeeping.
- The bundled offline HTML is parsed and booted in a simulated DOM and its game state is asserted.
- Long-running simulated gameplay is not a browser-device test; physical mobile checks and exact original-hardware video/sound timing are outstanding.

This is an incremental source-faithful integration milestone, **not a verified arcade-perfect conversion**.
