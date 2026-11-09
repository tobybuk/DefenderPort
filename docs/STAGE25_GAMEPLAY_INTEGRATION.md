# Stage 25 — gameplay integration, source boundaries and validation

## Scope and provenance

Baseline: Stage 24, pinned Williams Defender *Red Label* assembly in `src/defa7.src`, `src/defb6.src`, `src/samexap7.src`, and `src/blk71.src` (mwenge/defender commit `e74006344b16d19245510b5e55780f90d7606bb8`). This is native JavaScript, **not a 6809 emulator**. Numeric 16-bit words, packed video bytes, original object/process lists, source callbacks, and sound command writes remain distinct from browser presentation. Addresses `0xE2xx` and `0xF9xx` used by the diagnostic are symbolic handles **not verified cartridge ROM addresses**.

## Five requested development targets

1. **Player lasers, hits and scoring.** `original/defa7-laser.js` implements `LFIRE`, `LASR0`, `LASL0`, `LASD`, `COLIDE`, `FISS` and the maximum-four-shot limit. It scans **actual source object picture bytes** and dispatches their `OCVECT` kill callback, decrements enemy counts, unlinks the killed process and awards packed-BCD score via the translated `SCORE`. Keyboard **F** and mobile **FIRE LASER** invoke source `FIRE`/`MKPROC`, no longer only the sound diagnostic. Score bytes show in the live game state. The original sound-board synthesis remains unavailable.

2. **Astronaut rescue.** Source `AKIL1` in `original/defb6-astronaut.js` distinguishes collision with the player (`PCFLG` nonzero) from a projectile: the former redirects the falling astronaut to `AFALL2` and starts `P500`, which awards original **500 points** and displays the original `C5P1` graphic. A safe landing uses `P250` / `C25P1`. `original/defa7-collision.js` exposes `COLCHK` over the same shared object bytes and player picture. Original `PLEND` ship-death handling is not yet ported, **so `COLCHK` is not automatically called from each flight tick**: doing so would destroy enemies on ship contact without accounting for player lives. This is an explicit source-completion boundary, not a claim of full live rescues.

3. **Appearance effects.** Source `APST` from `samexap7` now creates original `0xAF00` negative-size appearance slots, inserts `NULOB` object descriptor and lets `EXPU4` restore the original picture as the source-size countdown ends. The source FDB bytes go through `EWRITE`. Destruction during appearance disarms stale explosion-slot pointers to prevent writes to a recycled source object.

4. **Planet destruction.** `TERBLO → TBLP0 → TBL3 → TBL4` now clears original terrain and scanner reference bytes, uses the source `COLTAB` palette and 16 two-explosion steps with source `TEREX` picture data, plus original short and random process sleeps. No invented Canvas particle system.

5. **Wave transition.** When source `WVCHK` sees no living wave enemies or reserves, original `GEXEC` invokes `PLSAV` for target and enemy counts, `BONUS` to credit points per remaining astronaut, and next `GETWV`. After the original `$80`-tick delay, the harness restarts translated `PLRES` with saved P1 score/targets. Wave 2 populates its original **Ties and Probe**, and Probe destruction invokes `PRBKIL → MMSW` to start actual Swarmers. The reset bridge replaces untranslated `INIT20` and full hardware startup; it is not a cycle-accurate `PLSTR0` translation.

## Corrections and failure prevention

- The standalone packaging list now includes *all* new modules. CI tests execute its **exact** `<script>` in a simulated browser DOM, catching undefined imports and prior malformed HTML regressions.
- Sound priorities mean an arriving enemy can legitimately suppress a lower-priority laser sound at boot. Old tests that assumed otherwise have been updated without bypassing source sound precedence.
- Older tests that required enemy sprites **before** original `APST` completed now check the appearance transition and subsequent source framebuffer bytes.
- The scanner and playfield continue to use the same OPTR/IPTR records, never independent marker fixtures.
- Mobile long-press selection/copy-callout controls from Stage 24 are retained and tested on the complete HTML.

## Limits and evidence

Tests verify code paths and RAM/framebuffer effects. **They do not prove arcade-identical behaviour:** original 6809 clock, scanline IRQ timing, programmable palette, collision edge cases, player deaths/lives/game-over `PLEND`, full audio synthesis, and original cabinet comparison remain unfinished. Headless Chromium screenshot launch timed out in the available environment, so independent graphical validation is not claimed; the release is additionally boot-tested in a simulated DOM.

To build and test: `npm run build && npm test`. Open `play.html` locally without a server; use F / FIRE LASER to fire, Space to thrust, Up/Down to steer. `tests/stage25-gameplay-milestone.test.mjs` covers original arrival, laser lifecycle, on-screen kill/score, rescue, planet destruction, wave two and Probe-to-Swarmer transition. `tests/stage25-standalone-release.test.mjs` verifies the single-file release, button, and second-wave integration.
