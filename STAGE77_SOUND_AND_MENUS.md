# Stage 77 — Sound audit, sound-board rebuild, silent demo, menus

Everything was checked against the pinned original source (`mwenge/defender` e740063): DEFA7 and DEFB6 for when the game asks for a sound, and VSNDRM1 for how the sound board makes it.

## 1. Are the sounds requested at the right moments?

All 26 DEFA7 sound tables (priority, repeats, durations, commands) match the source byte for byte (`tools/check-sound-data.mjs`). `SNDLD`, `SNDSEQ`, `SNDOUT` and the thrust on/off logic (`SNDS00`) match. `SNDSEQ` runs once per frame, as in the IRQ.

Every original `SNDLD`/`SNDOUT` call site was traced to the port:

| Sound | Original trigger | Port |
|---|---|---|
| Kill sounds (Lander, Mutant, Baiter, Swarmer, Pod, Bomber, mine) | `KILP`/`KILO` in each kill routine | Matches |
| Enemy shots (`LSHSND`, `SSHSND`, `USHSND`, `SWSSND`) | `LSHOT`, `SCZ0`, `UFOLP`, `MMSW` | Matches |
| Human picked up, scream, landed, killed | `LKIL1`, `ALAND`, `ASTK1` | Matches |
| Lander pull-in (`SNDOUT $12` each frame) | `LNDFXA` | Matches |
| **Falling human caught by the ship** | **`AKIL1`: `ACSND`** | **Played `ASCSND` (the Lander scream). Fixed.** |
| Laser, smart bomb, player death, planet explosion, appear, extra ship, coin, start | DEFA7/DEFB6 | Matches |
| Stop sounds at death and game over (`SNDOUT $13`) | `PLEND`/`PLE2` | Matches |

`ST2SND` (two-player start) is unused because the port is one-player only.

## 2. Was the sound board emulated correctly?

No. The command decoding and data tables were right, but there were four problems:

1. **No board state between commands.** Every command was rendered on a brand-new board. The real board keeps its RAM, and several Defender sounds rely on that:
   - The rising Lander-carry "spinner" (`LSKSND`: ten `SP1` commands, each raising the pitch through `SP1FLG`) played the same note ten times.
   - The Lander pull-in (`$12` every frame) relies on `B2FLG`, so each repeat continues the bonus sweep (`BON21 → GEND50`). Instead it restarted every frame.
   - Releasing thrust sends `$0F`, which starts the `BG1` background. On the board, every later effect falls back into `BG1` through `IRQ3` until `$13` (`BGEND`) at death or game over. The port never returned to it.
2. **Sounds were cut short.** Each effect was truncated to the game's `SNDTMR` frame count. On the board, an effect plays to its natural end unless a new command interrupts it.
3. **Wrong instruction timing.** The routines used estimated cycle counts. Now every routine uses the 6800 cycle cost of each original instruction (direct, extended and indexed addressing; `ROR`/`TST`/`INC`/`COM` on memory have no direct mode).
   - `FNOISE` (thrust, cannon): 30 cycles per ramp step, not 21. It ran about 40% fast.
   - `SCREAM`: about 190 cycles per sample, not 95. It ran twice as fast, an octave high.
   - `HYPER`: 123, not 105. `NOISE` (laser): 8 cycles per delay count, not 6. `LITEN` (appear, lightning): larger overheads.
   - `ORGAN` (high-score tunes): **72 + delay** cycles per sample, not 72 + 3×delay. The source confirms this: duration × (72 + delay) is the same for every note. The tunes now play at the right pitch and tempo.
   - `GWAVE` and `VARI` were already exact and are unchanged.
4. **Aliasing.** The DAC output was point-sampled. It is now averaged over each output sample (a box filter), which removes most aliasing.

### The new board (`original/VSNDRM1-synth.js`)

`SoundBoard` is one persistent machine:
- A 64 KB memory array holds the original RAM map: `BG1FLG`, `SP1FLG`, `B2FLG`, `ORGFLG`, `HI`/`LO`, and the shared `LOCRAM` parameter block at the original addresses. The source tables are laid out as ROM.
- Routines are written in source order as generators, so the board can stream in real time and be interrupted.
- `irq(pia)` reproduces the board IRQ: `ORGFLG` handling, clearing `SP1FLG`/`B2FLG`, command dispatch, then `IRQ3` (background or idle).

`browser/source-sound-output.js` streams the board through a `ScriptProcessorNode`. Commands that arrive between audio callbacks keep their relative timing, with one buffer (about 21 ms) of latency.

Measured: thrust uses 30 cycles per step. Toccata lasts about 15 s and Phantom about 3 s. Rendering four seconds of the busiest sound takes about 15 ms.

**Not verified:** the cabinet's analogue amplifier and filter (only a DC blocker is modelled), and interrupt latency inside an instruction.

## 3. Demo mode is silent

During the AI demo, sound output is gated. Leaving the demo power-cycles the sound board, so no demo background leaks into the next game. The player's own mute and volume settings are not changed.

## 4. Buttons and menus

- **START works during the AI demo.** The button was disabled because its enable test only allowed attract and Hall of Fame modes, although `startGame()` accepted the demo.
- **START with no credit inserts the coin itself.** It uses the ordinary `COIN` path, so coinage and audits still apply. INSERT COIN is still there.
- **The toolbar follows the cabinet state:**
  - Powered off: POWER ON only.
  - Attract, Hall of Fame or demo: INSERT COIN, START, WATCH AI PLAY or STOP DEMO.
  - Playing: PAUSE/RESUME.
- **Status line** under the toolbar says what to do next.
- **SOUND quick toggle** on the toolbar. Keyboard: **M** mutes, **P** pauses. These apply only when the key isn't assigned to a game control.
- **Menu** is grouped into Sound, Controls and Cabinet. It closes on Escape or a click outside.

## Tests

- New: `tests/stage77-sound-board.test.mjs` (9 tests):
  - Organ timing, thrust ramp timing and SCREAM timing.
  - Spinner persistence, bonus sweep continuation and `BG1` return.
  - Effects playing past `SNDTMR`.
  - `ACSND` on catch.
  - START in demo mode and the demo sound gate.
- Updated:
  - The Stage 48 and 52 sound tests now use the streaming board.
  - The Stage 55 test now expects START to add a coin instead of being refused.
  - The Stage 61 test matches the new WATCH AI / STOP DEMO handler.
- `npm test`: 653 tests pass, plus the source guardrail.
