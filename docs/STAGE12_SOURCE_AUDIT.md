# Stage 12 — source-to-JavaScript routine audit

**Upstream:** `mwenge/defender`, pinned commit `e74006344b16d19245510b5e55780f90d7606bb8`. Exact source: [`src/defb6.src`](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/defb6.src), [`src/defa7.src`](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/defa7.src).

## Original routine boundaries preserved

| Source listing lines | Assembly labels | JavaScript module | Source-sensitive aspects |
| --- | --- | --- | --- |
| `defb6.src:4–78` | `UFOST`, `UFOLP`, `UFONV`, `UFONV0` | `original/defb6-ufo.js` | Original `NAP 6`, picture-descriptor stepping, 8-bit and 16-bit arithmetic, player pursuit and initial shot delay |
| `defb6.src:86–113` | `PRBST` | `original/defb6-probe.js` | Original OBI data, RAND, signed velocity bytes and source 8-bit DEC loop |
| `defb6.src:127–171` | `RANDV`, `MMSW` | `original/defb6-swarm.js` | Signed seed velocity, process/object allocation, swarmer count cap, PTIME and shot timer |
| `defb6.src:197–287` | `MSWM`, `MSWLP`, `SWBMB` | `original/defb6-swarm.js` | Integer motion, vertical clamp/complement damping, aiming and original NAP 3 |
| `defb6.src:533–582` | `SHOOT`, `LSHOT` | `original/defb6-shoot.js` | SHL/GETSHL allocation, byte-oriented signed aim, inherited horizontal velocity, source shot timers and sound command |
| `defb6.src:630–646` | `GTARG` | `original/defb6-target.js` | 64-byte TLIST ring and targeting fields PD2/PD4 |
| `defa7.src:103–121` | `OBINIT` | `original/defa7.js` | Three original OBI fields and process owner; no invented entity object |

Corresponding `PHR6.SRC` field offsets (`PD2`–`PD7`, descriptor words) are mapped in `runtime/phr6-layout.js` and exercised as byte-addressed RAM.

## Source architecture and diagnostic boundaries

- `demo/enemy-harness.js` is **not an alternate game loop**. It seeds explicit synthetic test addresses and initial state, then advances translated `DISP`, `SLEEP` and named enemy process continuations. The swarmer is constructed via `MMSW`; the UFO initial record is seeded with the exact `UFOST` shot timer `8` to avoid the missing `APVCT` entry.
- Source `SHOOT` allocates an original shell through `GETSHL`; the game-side source `SNDLD` manages the original priority/sequence bytes. The original DAC audio firmware is **not** translated, and browser sound playback is absent.
- `APVCT` appearance, `LANDST`/`LANDS0` lander process, complete IRQ-driven `VELO` position updates for these test objects, collision/destruction and full game startup are missing. The diagnostic deliberately does not move enemies via a custom loop.
- Synthetic fixture addresses (`0xf4xx` etc.) are **not ROM addresses**. They are used only for callback dispatch in tests. No CPU instruction emulator or ROM loading is included.
- The translated routines are **source-derived, not independently verified** against MAME, original CPU memory traces, DAC captures or pixel-for-pixel output. Passing isolated unit tests is not evidence of overall arcade fidelity.
- The assembly annotation tool can locally embed the complete upstream routine immediately above its JavaScript translation, if the user supplies the original checkout. Original source is not redistributed verbatim in this archive.

## Verification

Run `npm test`, `npm run build`. Source-level regression tests: `tests/stage12-enemies.test.mjs`, `tests/stage12-harness.test.mjs`, `tests/stage12-shoot.test.mjs`. Browser smoke test checks independent enemy/process/flight diagnostics, source firing allocation and sound command state, and error-free page operation. No original-machine differential verification has been performed.
