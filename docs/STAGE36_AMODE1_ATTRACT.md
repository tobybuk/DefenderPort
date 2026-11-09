# Stage 36 — Defender source-derived attract demonstration

Source: pinned Defender Red Label `src/amode1.src`, commit
`e74006344b16d19245510b5e55780f90d7606bb8`. This is *native
JavaScript*, **not** a Motorola 6809 emulator and not a pre-rendered movie.
The normal game remains based on the Stage 35 translated source runtime.

## New source routines and data

- `LGOTAB`, `LOGO0`: source cursor-control byte stream and progressive
  video-memory line drawing for the Williams logo. The browser's canvas only
  copies the original-style column-major video bytes.
- `DEFDAT`, `DEFNNN`, `DEFEND`: original compressed **60 × 24 video-byte**
  DEFENDER title graphic, decoded using the source run/pixel-phase operations
  and written to video from the original image data.
- `HALDIS`: original MESS0 glyphs render the HALL OF FAME heading. Real
  CMOS high-score names, ranking, score-entry state and cabinet DIP/credit
  management are not yet translated; no false records are manufactured.
- `LEDRET`, `AMODE1`–`AMODE8`, `AMOD12`, `AMOD10`–`AMOD11`, `BMODE2`–`BMODE3`:
  scene sequence, positions, sprite data, object movement and waits are
  translated from the source demonstration. The six named original enemy
  pictures are Lander, Mutant, Baiter, Bomber, Pod and Swarmer. The rescue
  scene uses the original astronaut/player/lander bitmap data.
- `LASRS`: the demonstration's source-data laser columns are present, but
  full interrupt/process accuracy of the laser animation and some demo
  object-erasure timing are still approximations, not cabinet-proven.
- Terrain/scanner: uses existing native BLK71 `BGINIT/BGOUT` and AMODE1
  `SCNR`; source image data is used throughout. Because the simplified
  demo renderer lacks original overlapping-caption damage restoration, the
  translated MESS0 captions are restored after each attract animation step.

## User-visible integration

The HTML **opens in attract mode**, not gameplay. The demo cycles from
animated Williams/Defender artwork to the Hall of Fame heading, then to
animated rescue and the six enemy introductions, and loops. Enter or START
GAME invokes the existing playable game reset and activates wave one, with
five Landers, ten astronauts, no initial Baiters and unlimited Smart Bombs.
WATCH DEMO stops the playable update loop and starts the attract cycle anew.
The two modes have **separate source memory and video memory**: background
GEXEC spawning must never run during attract.

## Known remaining boundaries

This first Stage 36 implementation translates the main source-attract
sequences, original picture data and image rendering, but it is **not** yet a
cycle-accurate, complete `AMODE1` port: Hall of Fame display/input needs
persistent high-score data and dedicated source routines; scripted movement
and page timing need comparison with original-machine traces, and the
full sound board remains deliberately deferred by user request. The
playable game itself still has pre-existing arcade timing limitations.

## Verification

`npm run build`, `npm test` (431 tests), standalone JavaScript parsing,
4,000-step source demonstration loop, and Chromium loading via `set_content`
with pixel-rendered original Williams and Defender artwork; verified
START GAME, WATCH DEMO and keyboard Enter, with **no console errors**.
