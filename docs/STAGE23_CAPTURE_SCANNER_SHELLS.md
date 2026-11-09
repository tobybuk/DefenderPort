# Stage 23 — Lander capture, mutants, source scanner scheduling and projectiles

## Scope and source audit

Pinned original Williams Defender source revision `e74006344b16d19245510b5e55780f90d7606bb8`.
No 6809 interpreter, and no Canvas substitute for game objects. Browser code only
presents bytes written by translated drawing routines.

| Assembly source / routines | Native module | Integration |
| --- | --- | --- |
| `DEFA7.SRC` `SCPROC`, `SCP1`, `SCP2` | `original/defa7-process-tasks.js` | Linked `MKPROC` task scheduled via `DISP` and `SLEEP`; calls `ISCAN`, `OSCAN`, `SHSCAN`, `MAPCH1`, `SCNRV` |
| `DEFA7.SRC` `OSCAN`, `ISCAN` | `original/defa7-scanning.js` | Moves objects between original `OPTR` and `IPTR`; distant objects get original eight-tick position integration |
| `DEFA7.SRC` `GETSHL`, `SHELL`, `FBOUT`, `SHSCAN` | `original/defa7-shells.js` | Lander/UFO firing allocates source shells, advances and renders them and retires expired shells through `OFSHIT` |
| `DEFB6.SRC` `LSHOT`, `SHOOT` | `original/defb6-shoot.js` | Firing enabled in main runtime; sound-command data resolved from source tables |
| `DEFB6.SRC` `ASTCLR`, `ASTK1`, `LNDFXA`, `SCZ00`, `SCZ0` | `original/defb6-astronaut.js`, `original/defb6-lander.js` | Lander capture removes astronaut from original TLIST and object list, changes carrier into source mutant object and decrements Lander count |
| `SAMEXAP7.SRC` `EXST`/`EXST1–EXST8`, `EERASE`/`EERAS1–EERAS2` | **new** `original/samexap7-explosion-start.js` | Allocates explosion bookkeeping in source RAM `$9c00–$9fff`, stores original width/height centre, tracks erase-table slots; expansion raster **not translated** |
| `DEFB6.SRC` `SCZST`/`SCZS0` | **new** `original/defb6-mutant-start.js` | Native source mutant allocations and random world placement using source `RAND`, `RMAX`, `OBINIT` and object lists; wired for `LANDST` fallback when no targets remain |

The experiment retains synthetic JavaScript handles for source labels and the
Stage 22 diagnostic APVCT list-insertion adapter. They **are not** genuine
ROM addresses or an implementation of the original APST appearance transition.
The initial user inputs, ship pose and IRQ stimulus also remain documented
flight-harness fixtures. Source sound command PIA writes do not generate sound.

## Runtime progression verified

1. Original wave one starts with ten astronauts and five Landers; no Baiters,
   mutants or Swarmers at startup. A further five Landers launch on the
   original `WAVTIM` schedule.
2. Original Lander shot timers call `SHOOT → GETSHL`, and original `SHELL`
   and scheduled `SHSCAN` display and retire shells. `BMBCNT` agrees with the
   actual `SPTR` linked shell list (no unbounded shell leak in tested run).
3. At the deterministic first capture (~tick 1323), `LNDFXA → ASTK1 →
   ASTCLR/KILOFF → EXST → SCZ00` executes. The live astronaut count falls to
   nine, a Lander becomes a mutant and the scanner tracks the remaining
   object records. The translated object renderer has an original mutant bitmap.
4. By update 3000, one astronaut remains and nine mutants have been produced.
   Reset recreates ten humans and the five-Lander opening squad.
5. At approximately update 3382, the last astronaut dies and source
   `ASTCLR` starts `TERBLO`. That original planet-destruction entry is **not**
   translated; the harness gives an explicit named error and stops rather
   than fabricating terrain explosions or letting gameplay silently diverge.

## Strict accuracy boundaries

- `SAMEXAP7.SRC EXPU`, `EWRITE` and visible explosion expansion are **NOT**
  translated. `EXST` records source explosion state, but cannot yet display a
  growing explosion or correctly erase all pixels of a dead astronaut.
- `TERBLO`/`BGERAS`, post-human terrain detonation and later wave transitions
  are not integrated. The diagnostic deliberately stops when this process runs.
- Player laser collision, hit/destruction callbacks, scoring and rescues are
  still incomplete. Do not call Stage 23 a playable arcade reproduction.
- Full game startup `SINIT/PLSTRT`, true APST appearance, source cabinet
  palette/timing and Williams sound board DAC synthesis remain incomplete.
- The lower independently seeded process workbenches are still diagnostic
  and do not feed into the main game framebuffer.

## Verification

`npm test` runs **321** Node regression and integration checks plus the source
substitution guard. New Stage 23 checks exercise source `OPTR/IPTR`, real
projectile retirement, capture/respawn mutation and `ASTCNT`/`SCZCNT`, source
`EXST` block allocation and `EERASE`, 3000 consecutive actual source updates,
`SCZST` object creation, the `TERBLO` boundary, and the actual bundled HTML
running through the former 1323-tick crash without a syntax/startup error.

`npm run build` creates self-contained `play.html`; we additionally use
`node --check` on the bundled JavaScript and `unzip -t` on the release archive.
Independent Chromium screenshot capture has timed out in this environment;
the visual appearance is not verified via a live browser. The HTML VM test
and source framebuffer tests verify data and DOM state, not browser parity.
