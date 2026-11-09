# Stage 19–20 consolidated development pass — 2026-11-06

## Completed

* Transcribed **10 additional exact source graphics descriptors** from pinned
  `src/defb6.src` lines 1895–2025 / 2073–2075: `ASTP1`–`ASTP4`,
  `SCZP1`, `ASXP1`, `SWXP1`, `PRBP1`, `BMBP1`, `BMBP2`
  (four astronauts + six others). All source pixels are
  16-bit `FDB` words stored as packed big-endian video bytes. The source
  odd/even phase is preserved exactly, and existing ON28/ON48/ON58/ON23
  entry points draw directly to source VIDEO memory.
* Registered the astronaut in shared `OPTR` and `SCNR` lists; original
  `OPROC → ON28` draws the human into the main framebuffer. No Canvas
  sprite/marker substitute is involved.
* Scheduled translated `ASTRO` on the existing linked `DISP/SLEEP` process
  list, with `TLIST`, `GETALT`, source `ASTP1`–`ASTP4` image changes and
  terrain-relative walking. Source `AFALL`/`AFALL2` continuations are
  registered, but require collision transitions to become active in play.
* The legacy one-swarmer fixture now runs translated `MSWM/MSWLP` rather
  than an inert placeholder continuation. It uses original signed velocity,
  acceleration, damping and 3-tick scheduling; source `GETSHL` can allocate
  a projectile when original `SWBMB` conditions permit. The original
  swarmer creation via probe destruction (`PRBKIL → MMSW`) remains absent.
* All objects continue sharing the one source RAM, video and scanner.

## Verifications

* Node test suite + source guardrail, standalone build and JS syntax.
* Tests for source pixel bytes, all new picture descriptor geometry,
  source `ASTRO` target scanning, human world movement, source `MSWM/MSWLP`
  dispatch and scanner integration, stress, and reset.

## Accuracy boundaries

* Human starting position (`0x1200`) and initial count (one) are **diagnostic
  fixtures**, not full original wave/astronaut startup. The swarmer is seeded
  at a fixture position and does not yet originate from `MMSW`.
* Main runtime does not implement full `APVCT`, original collision and rescue
  hooks, player laser hits, kill/destruction/explosion process wiring, actual
  level transitions, or original cabinet sound board. Additional pictures
  are registered for source processes but do not claim those processes can
  currently spawn or execute end-to-end.
* `GEXEC` still starts with diagnostic wave parameters. Do not call the
  result arcade-accurate or fully playable.
