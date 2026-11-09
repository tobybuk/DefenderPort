# Checkpoint 0.2 verification and open issues

This is a runnable **player-flight diagnostic**, not the game.

- `npm test`: arithmetic, process lists, source-named RAND/STINIT, PLAYER input responses, VELO, original RAM addresses, EXEC fail-closed behavior, determinism and guardrails.
- `npm run demo`: deterministic RAM output over 180 original PLAYER updates.
- `npm run build`: includes only native JavaScript in an offline HTML file.
- Chromium headless in-memory page: standalone page initializes, renders the source sprite, responds to the Single step button without JS exceptions.

## Not yet proven

- No original ROM/MAME differential state trace has been run; all added routine translations remain **translated-unverified**.
- Original SINIT and actual interrupt chain are incomplete. The executable `demo/flight-harness.js` applies test fixture initial values to existing source symbols to exercise PLAYER; **this is not a translation of game startup**.
- The display contains a **diagnostic measurement grid**, not terrain, scanner or framebuffer. No sound, enemies, shots, score or explosions were substituted.
- Original source annotation generation requires a pinned source checkout and its audit is not yet complete in this container.
- The browser loop simply calls PLAYER at approximately 60.096 Hz as a test driver, not a port of the original IRQ scheduler.

## Next work

Translate source init/IRQ bank-control and scheduler hand-off, original framebuffer and drawing routines, then original terrain, laser and enemy processes, preserving every named entry and testing against the original machine's behaviour.
