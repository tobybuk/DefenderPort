# Stage 48 — source-driven Defender audio integration

## Source policy

This release integrates the standalone Stage 47 native JavaScript translation of the **Williams Defender 6808 sound board** into the existing Stage 43 Red Label 6809 game translation. No JavaScript collision handler or CSS presentation event plays a sound merely because something looks like a hit.

Pinned source references:

- [Original game: `DEFA7.SRC`](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/defa7.src), especially `ST1`, `SNDOUT`, `SNDLD`, `SNDSEQ`, `SNDS00`, `SNDS01`, the named `*SND` tables, `START`, `SCORE`, `SCRX`, `PLEND`, `PDTH5` and `HALLOF`.
- [Enemy sources: `DEFB6` and related original files](https://github.com/mwenge/defender/tree/e74006344b16d19245510b5e55780f90d7606bb8/src), for `SHOOT`, enemy death vectors, Lander pickup/abduction, astronaut events and projectile handling.
- [Original sound board `VSNDRM1.SRC`](https://github.com/historicalsource/williams-soundroms/blob/main/VSNDRM1.SRC), original output firmware and waveform/command tables.
- `ROMC8.SRC` `DEFALT`: default replay threshold data bytes `$01,$00` (10,000 points).

## Original call chain (the important part)

1. The native gameplay routines request the original sound-table address via `SNDLD` (with priority). Direct commands such as thrust also go through `SNDOUT`.
2. Source `SNDSEQ` advances the repetition/duration table in RAM: `SNDX`, `SNDTMR`, `SNDREP`, `SNDPRI` are **the original variables**.
3. `SNDOUT` emits two PIA bytes: reset/strobe `$3F`, followed by the inverted command byte (`~B & $3F`).
4. `browser/source-sound-output.js` listens **only** to that PIA pair, decodes it through the translated 6808 IRQ command decoder, and calls Stage 47's original-data DAC synthesiser with the **original `SNDTMR` duration**, not an invented fixed WAV duration.
5. Web Audio plays the synthesised DAC buffer; sound output is unlocked by a user gesture (mobile-browser requirement).

The browser start button is the existing untranslated cabinet coin/start input boundary. It restores the `ST1 → ST1SND` load *before* the first source `SNDSEQ` tick. It does not call some unrelated synthesiser preset at button click.

## Verified source-event mapping

| Event / source entry | Source sound | Confirmed first command | Source duration |
|---|---|---|---|
| One-player start (`ST1`) | `ST1SND` | `$0A` | `$40` (64 ticks) |
| Player laser (`LFIRE`) | `LASSND` | `$14` | `$30` (48 ticks) |
| Smart bomb (`SBOMB`) | `SBSND` | `$11` repeated six times, then `$17` | six × 4 ticks, then 16 ticks |
| Replay/free ship (`SCORE.SCRX`) | `RPSND` | `$1E` | `$20` (32 ticks) |
| Thrust pressed (`SNDS00`) | direct sound | `$16` | continuous until another command |
| Thrust released (`SNDS00`) | direct sound | `$0F` | continuous background state |
| Player death (`PLEND`) | `PDSND` | `$11`, then `$17` | 2 × 8 ticks, then 32 ticks |
| Death completion (`PDTH5`) | direct `SNDOUT` | `$13` | background stop |
| Enemy deaths (`KILP`, death vectors) | `LHSND`, `UFHSND`, `SCHSND`, `SWHSND`, `PRHSND`, `TIHSND` as applicable | original table data | original table data |
| Lander pickup/abduction/shots | `LPKSND`, `LSKSND`, `LSHSND`, direct `$12` | original table data | original table data |
| Astronaut events | `AHSND`, `ASCSND`, `ALSND`, `ACSND` as applicable | original table data | original table data |
| Alien, bomber and swarmer firing | `USHSND`, `SSHSND`, `SWSSND` as applicable | original table data | original table data |
| Object materialisation | `APSND` | `$15` | `$30` (48 ticks) |
| Power-on after an audio unlock | `QUASAR` | `$1F` | full original VARI sweep (not an `SNDSEQ` entry) |

The game's 26 named sound tables remain unchanged. Their first commands and duration bytes are checked in the integration suite. During actual gameplay the source's priorities may suppress some lower-priority effects; this is *not* a playback bug, and removing that behaviour would be wrong.

**Replay fix:** Stage 43 left `REPLA` at zero, preventing the `SCORE.SCRX` original replay path from firing in normal play. Stage 48 initialises `REPLA` and fresh-player `P1RP` to source default `$0100`. A score-crossing test proves that the ship award and `$1E` sound both occur through `SCORE`.

## What is deliberately NOT triggered

- `ST2SND` is the two-player start sound; there is no genuine two-player cabinet-start flow in this current game, so it is not played on a one-player start.
- Coin `CNSND` is not played for a browser click. Coin PIA input/credit accrual are not translated yet.
- High-score organ music `$3D` and `$3E` is **not** automatically played when an attract Hall-of-Fame page appears. It belongs to the original initials/high-score sequence, which is not yet translated end-to-end.
- `AMODE1` demonstration pages do not create arbitrary host audio. They remain silent unless a translated original source sound command is issued.
- Power-on QUASAR is postponed to `ENABLE SOUND` while on the attract page because browser autoplay policy prevents page-load playback.

## Limitations and honesty about source fidelity

- The Stage 47 synthesis uses original sound-board data and translated routines, but **exact 6808 IRQ preemption, retained state and analogue speaker filtering are not yet hardware-verified**.
- Continuous `$0F` and `$16` commands currently repeat a finite synthesised buffer. This is an adapter to Web Audio, not the exact continuously running 6808 state machine; audible wraparound remains possible.
- Several original main-game object/event routines are incomplete (the project was not a fully cycle-exact 6809/raster port at Stage 43). Sound events that never reach their original source routine cannot be guaranteed to occur in all arcade scenarios. Stage 48 does not manufacture substitute triggers.
- ROMC8 factory default replay is retained; user-modifiable operator CMOS and coin/start input modes are not yet supported.

## Tests

`npm run build && npm test`: 474 tests passing, including six Stage-48 sound integration tests. Browser smoke tests: Chromium desktop 1280×960 and phone 390×844; verify deferred QUASAR, one-player start command, smart-bomb seven-part command sequence, canvas display and no page errors. External real-arcade A/B acoustic validation remains outstanding.
