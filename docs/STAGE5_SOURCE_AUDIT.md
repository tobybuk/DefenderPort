# Stage 5 source audit — original BORDER and sound-command sequencing

Pinned source: `mwenge/defender` commit `e74006344b16d19245510b5e55780f90d7606bb8`.

| Source label(s) | JavaScript | Source semantics kept | Status |
| --- | --- | --- | --- |
| `BORDER`, `BORDLP`, `BORD1`, `BORD2`, `BORD3` | `original/defa7-top-display.js` | Source exact byte writes at `SCANH`, `SCANER`, bezel columns and `$9999` centre markers; original loop order and bounds | translated-unverified |
| `PLINDX`, `PLDX`, internal `PLND1` / `PLINX` | `original/defa7-player-index.js` | Exact CURPLR byte decrement and source P1SCR/P2SCR selection; no JS player objects | translated-unverified |
| `SNDOUT` | `original/defa7-sound.js` | Sound PIA 0x3F reset byte, complemented command and 6-bit mask | translated-unverified |
| `SNDLD` | same | `THFLG` clearing, priority compare including equality, RAM `SNDX=source_address-2`, `SNDTMR`=0x0101 | translated-unverified |
| `SNDSEQ`, `SNDS00`, `SNDS01`, `SNDS0`, `SNDS1` | same | Exact timer/repeat progression; source-defined table termination, thrust 0x16/0x0F events and STATUS guard | translated-unverified |
| 26 sound tables (e.g. `LASSND`, `SBSND`, `PDSND`) | same | Source byte sequences priority / repeated duration and command triples | data-copied-unverified |

## Source evidence

- https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/defa7.src — code under `BORDER` and `SNDOUT`/`SNDLD`/`SNDSEQ`.
- https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/phr6.src — `SCANH EQU YMIN-34`, `SCANER EQU $3000+SCANH`, `SNDX`, `SNDPRI`, `SNDTMR`, `SNDREP`, `THFLG`.

## Intentional translation boundaries

`BORDER` does not stand in for the scanner or `TDISP`. It only paints the bezel. PIA sound-command output does **not** stand in for the 6800 sound board, DAC or audible Defender effects. The `soundTableFixture()` maps data into a diagnostic address range solely to preserve the source pointer arithmetic; the assembled source table addresses and ROM banking are not asserted.

A diagnostic source call to `SNDSEQ` is made once per harness step, not from the untranslated source IRQ. Source-true IRQ cadence, framebuffer colour RAM, scanner terrain/object plots, complete startup and sound-board source remain explicit missing items.

## Equivalence tests

`tests/stage5-top-sound.test.mjs` validates exact final video bytes (including deliberate overlap), all 26 command-table shapes, sound priority and equal-priority replacement, original sound RAM pointer and timers, source sound bus encoding, repeated sequences, status gating and integration in the runnable harness. These are source-derived unit vectors, **not** MAME differential verification.
