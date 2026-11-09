# Stage 42 — source-first audit of Defender Red Label attract instruction screen

Pinned original: `mwenge/defender@e74006344b16d19245510b5e55780f90d7606bb8`.
Input references: two user screenshots, Stage 41 (missing radar frame) and original arcade footage (blue framed radar, mini-terrain, SCANNER label, lander/mutant/baiter, terrain and CREDITS:2).

## Root causes identified with original instruction addresses

| ROM source path | Source instruction / invariant | Fault found in Stage 41 | Stage 42 change / validation |
|---|---|---|---|
| `AMODE1.SRC:LEDRET`, lines 468–481 | `JSR SCINIT; LDA #$D9; STA STATUS; JSR SCORES; NEWP CREDS; JSR BORDER; NEWP SCPROC; NEWP TEXTP` | `BORDER`, `SCORES`, source-driven `CREDS`, and `$D9` write were missing | Reused existing native `DEFA7.BORDER`; enacted `SCINIT`, `SCORES`, `CREDS`; STATUS `$D9` after SCINIT; tests assert source-written memory bytes |
| `DEFA7.SRC:BORDER`, lines 905–928 | `BORDLP`, `BORD1`, `BORD2`, `BORD3` write video bytes `55`/`99` using source absolute byte addresses | Screen contained a detached SCANNER heading without enclosed miniature display | Existing gameplay's exact `BORDER()` routine now called by `LEDRET`; tests cover bottom divider, side walls and top rim |
| `AMODE1.SRC:SCINIT`, lines 515–528 | Set `$DB`, clear source display, reset scroll, `MLJSR BGI`, `CRINIT`, scanner marker `$1030` | `PLAXC/PLAYC` were subsequently overwritten from synthetic demo flight object | Removed the host assignment; source marker `$1030` remains fixed; `CRTAB` applied with original hardware index 5 `$81` |
| `AMODE1.SRC:MT1`, lines 1159 onward | Branch `BITA #2; BNE MTX`: **do not draw mini-terrain if bit 1 of STATUS is set** | Merely adding `BORDER` produced a blue empty rectangle while status remained `$DB` | `LEDRET` now writes `$D9`, enabling original `MTERR` table output; browser screenshot displays mini-terrain; source-based regression asserts interior terrain |
| `DEFA7.SRC:IRQ` star pass | `STOUT` writes source star map pixels | Demo instruction scene had almost no stars and did not use available `STOUT` | Calls the existing native `STOUT` routine; no fake stars |
| `AMODE1.SRC:CREDS`, lines 957–971; `MESS0.SRC:CREDWS` | Show credits only if `CREDIT != 0`; text `$28E5`, number `$48E5`; original colon glyph | Original comparison had `CREDITS: 2`, Stage 41 omitted it | Native `CWRIT` glyphs and `CREDIT` state now drive it, with initialCredits=2 **fixture only** to match reference; `initialCredits=0` blank, no permanent overlay; colon copied from source |
| `AMODE1.SRC:AMODES`, lines 699–710 | `LDA #$FB; STA STATUS` when starting the Williams page | Source instruction absent on demo restart | Restored `$FB`, tested return from `$D9` instruction page |
| `AMODE1.SRC:TEXTAB`, lines 1116–1130; `TEXTP`, lines 686–695 | SCANNER first, then enemy captions as `BMODE2` advances the pointer | Earlier versions pre-rendered labels immediately | Stage 41 source ordering retained; Stage 42 tests assert the first label and later LANDER 150 |
| `AMODE1.SRC:AMOD11/APST/EXPU` | Laser hit and next enemy appearance share original SAMEX routines | Earlier versions skipped appearance and explosion effects | Stage 41 paths retained; prior regression tests continue to pass |

## Observable output and tests

- Stage 42 browser preview contains the original mini-terrain above `SCANNER`, joined side walls, a full-width divider, original object pictures and scrolling ground, and source-rendered `CREDITS: 2` when initial credits are explicitly seeded to two.
- Eight new source-address / lifecycle tests in `tests/stage42-demo-scanner-fidelity.test.mjs`, in addition to the previous suite.
- Run `npm test` and `npm run build`. Screenshot and headless-browser checks are distinct from unit tests: they verify that video RAM reaches the displayed canvas.

## Independent limitations: not certified 100% arcade-equivalent

1. The browser's attract scene remains an integration workbench, **not the complete original `NEWP`/`NAPP` linked cooperative scheduler** with every IRQ dispatch and timing proven frame-by-frame against real ROM execution. The actual `AMODE1.SRC` call graph is partially reproduced, so extra process interactions could still diverge.
2. `SCINIT` uses the already-translated `BGI` / terrain routines and copied palette but does not invoke a 1:1 `OINIT` object free-list reset. The 6809 object records are partly held in JS host-side sprite wrappers for the scripted scene.
3. Source `CREDS` coin-increase interrupt (`OCRED`, `ICREDF`) and hardware coin-switch handling are not wired. The provided `initialCredits=2` is a reproducible cabinet fixture, **not a claim that Defender always starts with two credits**.
4. Source `MESS0` caption strings and glyph bytes are used, but the entire generic MESS0 format/command interpreter is not yet implemented.
5. Original CMOS high-score persistence, hardware raster synchronization, DAC audio (deliberately deferred), and independent original-ROM frame-by-frame golden-image comparisons are not completed.

These boundaries are explicitly stated rather than hidden behind an automated test count. **No hand-drawn scanner frame or terrain was introduced.**
