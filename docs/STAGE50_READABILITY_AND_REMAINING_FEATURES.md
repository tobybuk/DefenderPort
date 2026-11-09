# Stage 50 — readable JavaScript and original-feature gap audit

**Baseline:** Stage 50, the native-JavaScript Williams Defender Red Label transliteration, pinned to the original assembly at `mwenge/defender` commit `e74006344b16d19245510b5e55780f90d7606bb8`.

## What changed in this package

- Reindented and expanded **165 `.js`/`.mjs` source and test files** without renaming any original game routines, objects, symbols, data tables or memory fields. The game remains **native JavaScript, not an emulator**.
- Retained the existing folder layout: `original/` (routine translations), `runtime/` (memory/process utilities), `browser/` (presentation and input), `demo/` (integration harness), `tests/`, and `tools/`.
- Regenerated `play.html`, a **self-contained runnable file**. Its inline JavaScript is now indented and divided into `/* MODULE ... */` sections rather than having densely packed routines.
- Updated **four test assertions that depended on exact whitespace** to match equivalent formatted JavaScript. They still assert the same source configuration.
- Compared syntax trees against the original Stage 50 ZIP: **all 161 non-test JavaScript source files have identical parsed AST structure and literal text**. Four intentionally updated test files differ only in whitespace-tolerant regex checks.
- Verified `npm run build` and `npm test`: **484/484 tests passing**. **No gameplay/sound/timing changes were intended**.

The standalone file is a convenience for playing. For reviewing or editing routines, use the individual `.js` files, not the 475 KB inline script.

## Feature gap classification

This list is based on the **current Stage 50 code and recent audits**, not on the outdated first-stage `docs/SOURCE_INVENTORY.md`. “Missing” denotes functionality not connected end to end. “Partial” denotes a running implementation with a known original-code gap. “Unverified” denotes code that exists but has not been compared against reference ROM execution; that is **not** the same as missing.

| Priority | Original game feature / machinery | Current Stage 50 state | Evidence to inspect |
|---|---|---|---|
| 1 | **Coin insertion, credit accumulation, coin-switch/debounce, coin/credit sound and start-button credit accounting** | **Missing end to end.** Browser starts a single-player game directly; attract display uses a fixture of two credits. `CSCAN`/`SSCAN` helpers exist but real coin input and pricing are not wired. | `docs/STAGE31_CABINET_INPUT_EXEC.md`, `docs/STAGE42_DEMO_SCREEN_SOURCE_AUDIT.md`, `demo/flight-harness.js` `coinDebounce1ms`; original `DEFA7.SRC` and `AMODE1.SRC` |
| 1 | **Two-player game selection and alternating turns** | **Missing.** The host calls the one-player start and does not implement original two-player cabinet start/turn state, despite some P2 RAM/HUD data being translated. The `ST2SND` audio is therefore intentionally not invoked. | `browser/flight.js`, `docs/STAGE48_SOUND_SOURCE_INTEGRATION.md`; original `DEFA7.SRC` |
| 1 | **High-score qualification, initials entry and persistent Hall of Fame records** | **Missing end to end.** Attract mode displays the original `ROMC8.DEFALT` factory scores, but does not allow names to be entered or saved. | `original/amode1-presentation-data.js`, `original/amode1-attract.js` `HALDIS`, `docs/STAGE38_ATTRACT_COLOURS_TITLE_HOF.md`; original `AMODE1.SRC` `HALLOF` and `ROMC8.SRC` |
| 1 | **Original finite Smart Bomb stock in normal browser play** | **Partially implemented / deliberately overridden.** Original decrement and stock checks exist and can be exercised in the harness, but the shipped browser constructs the game with `infiniteSmartBombs: true`. | `browser/flight.js`, `demo/flight-harness.js`, `docs/STAGE30_HYPERSPACE_INPUT.md`; original `DEFA7.SRC` |
| 2 | **Operator-configurable CMOS settings and cabinet defaults** | **Missing as an operator interface/persistent storage.** The replay threshold is provisioned at the ROM default (10,000), and some setup reads use fixed fixture values. Original settings/credit modes cannot be changed and saved as on a cabinet. | `demo/flight-harness.js` `RCMOSA`/`RCMOSD`, `docs/STAGE48_SOUND_SOURCE_INTEGRATION.md`; original `ROMC8.SRC`/`DEFA7.SRC` |
| 2 | **Original startup, ROM/RAM self-test, service diagnostics and test-button workflow** | **Missing as a complete boot flow.** Power-on `QUASAR` sound is available only after a browser gesture; the actual hardware test screens, input path and diagnostic state machine are not reproduced. | `browser/flight.js`, `docs/STAGE48_SOUND_SOURCE_INTEGRATION.md`; original board and test code |
| 2 | **Full `MESS0` text/command interpreter** | **Partial.** Source glyphs are used for title, enemy descriptions, HUD and bonus text, but the general source message/command stream is not implemented for all combinations. | `docs/STAGE41_SOURCE_FIDELITY_AUDIT.md`, `docs/STAGE42_DEMO_SCREEN_SOURCE_AUDIT.md`; original `MESS0.SRC` |
| 2 | **Complete source-driven attract-mode and game state transitions** | **Partial.** Main demo scenes work, but the attract task/process lifecycle, logo/text restoration scheduling, complete game-over/high-score transitions and overlapping writes still use browser-side bridges. | `original/amode1-attract.js`, `runtime/source-attract-processes.js`, `docs/STAGE49_TITLE_PROCESS_AND_PRESENTATION.md`, `docs/STAGE50_TITLE_CPU_WORKLOAD_AUDIT.md` |
| 2 | **High-score organ tunes at their original trigger** | **Sound synth present; feature not wired.** Commands `$3D` and `$3E` exist in the sound-board source, but the original initials/high-score routine is not implemented end to end. | `original/VSNDRM1-synth.js`, `docs/STAGE48_SOUND_SOURCE_INTEGRATION.md`; original `AMODE1.SRC` `HALLOF` |
| 2 | **Complete 6809 executive, task stack and raster IRQ time accounting** | **Partial.** Process continuations and display calls exist, but the host uses an IRQ-pair adapter plus a Stage 50 *estimated* CPU workload. No cycle-accurate ROM/beam trace exists. | `original/defa7-exec.js`, `original/defa7-irq.js`, `runtime/source-cpu-budget.js`, `docs/STAGE50_TITLE_CPU_WORKLOAD_AUDIT.md` |
| 2 | **Exact original input timing (held fire, switch scan/cabinet button history)** | **Partial.** `SSCAN`/`SWTAB` translations exist, but browser held fire is generated using a seven-tick convenience pulse, not a verified original hardware input transition. | `browser/flight.js`, `docs/STAGE31_CABINET_INPUT_EXEC.md` |
| 3 | **Continuous 6808 sound-board state, command interruptions and analogue filtering** | **Partial.** All named game sounds and the power-on sound have playable translated synthesis; continuous thrust repeats a finite buffer and exact 6808 IRQ state and cabinet DAC/filter characteristics are not verified. | `original/VSNDRM1-synth.js`, `browser/source-sound-output.js`, `docs/STAGE48_SOUND_SOURCE_INTEGRATION.md` |
| 3 | **Exact normal-play star twinkle invocation** | **Partial.** Stars visibly change colour, but the real-game invocation cadence of `SBLNK` has not been independently established; the browser uses a provisional call. | `demo/flight-harness.js`, `docs/STAGE33_THRUST_STARS_BOMBER.md`, `README.md` Stage 34 |
| 3 | **Cabinet-accurate CRT/raster/palette presentation** | **Partial.** Column-addressed video memory and resistor-weighted RGB palette are implemented; original scanline beam timing and analogue CRT characteristics are not. | `browser/video-presenter.js`, `browser/defender-palette.js`, `docs/STAGE50_TITLE_CPU_WORKLOAD_AUDIT.md` |

### Implemented, so NOT on the missing-feature list

The current browser/harness **already has translated paths** for the player ship (movement, reverse, fire, thrust and hyperspace), visible landers and other principal enemy types, their projectiles, astronaut pickup/carry/drop and capture/mutation, scanner/radar, lasers and collision, score/lives, terrain and planet destruction, explosions and appearance animations, wave transitions/bonus screens, smart-bomb effects, and the integrated sound-board command path. Some of these are **not yet machine-trace verified**, but calling them wholly missing would ignore work done after the early inventories.

### Verification still required across the whole game

Independent differential checks against the pinned Red Label ROM (ideally MAME frame/RAM/PIA traces) are still needed for: movement/AI edge cases, collision boundaries, wave balancing, animation order, sound preemption, raster updates and the full attract loop. “484 passing tests” proves useful internal regression coverage, **not complete original-ROM fidelity**.

## Suggested implementation sequence

1. Replace the unlimited Smart Bomb browser option with the source finite-inventory path, configurable as a debug-only flag.
2. Finish coin input/credits, the start flow and two-player mode using original `CSCAN`/`SSCAN` and cabinet-state routines.
3. Implement original high-score qualification, initials entry, persistent data, and associated organ playback.
4. Complete the `MESS0` command interpreter and operator settings.
5. Replace host-side process/timing shortcuts with ROM-differential-verified executive and sound-board timing; verify graphics and sound against real/original output.

**Original source:** https://github.com/mwenge/defender/tree/e74006344b16d19245510b5e55780f90d7606bb8/src
