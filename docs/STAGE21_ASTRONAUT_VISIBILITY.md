# Stage 21 — actual astronaut population and viewport verification

## Reproduced user-visible defect

Stage 20 created one manually positioned astronaut (`OX16=$1200`,
`OY16=$DB00`) and asserted only that `ASTP1` picture bytes reached VIDEO.
The person was a 4×8 hardware-pixel sprite near the terrain, very hard to
see. Its population was not original Defender game start. Stage 20's first
frame had one astronaut sprite, and the source diagnostic displayed one on
the scanner. This should **not** have been described as a functioning
astronaut population.

## Source translation

Pinned original assembly (commit e74006344b16d19245510b5e55780f90d7606bb8):
- `src/defa7.src:1513–1540`: `ASTST`, `ASTST1`, `ASTS2`.
- `src/defa7.src:1547–1576`: astronaut setup portion of `PLRES`,
  `ASTS1`, `ASTS1A`, `ASTS1B`, `ASTS1C`.
- `src/defa7.src:1861–1862`: source's wave replenishment sets `PTARG` to 10.

Now translated as `original/defa7-astronaut-start.js`. The full PLRES enemy
reserve restoration after `ASTSX` is **not** translated here; method is named
`PLRES_ASTROS` to make the source boundary explicit.

`PLRES_ASTROS` creates the original ASTRO process and clears the actual
`TLIST`. When `PTARG` exceeds 7, it starts `floor(count/4)` people in each
of four `$4000` world quadrants; leftovers are seeded from `HSEED`, exactly
as in the source's ASTS1A/B/C branches. ASTST calls the existing source
`RAND`, allocates with original `GETOB`, stores the true object descriptors,
noncolliding object type `$10`, original colour `$6666`, zero velocities,
initial Y `$E0`, and links the results into `OPTR` and `TLIST`.

The initial P1TRG=10 value and selected player are still **level-one test
inputs**: the complete original pre-wave/CMOS startup remains untranslated.
No display coordinates are altered to manufacture visible humans. Existing
source OPROC/ON28 framebuffer rendering and source SCNR scanner continue to
consume the same RAM records.

## Verified behavior

With the deterministic source seed already used by the fixture:
- `ASTCNT` and source `TLIST` each contain 10 astronauts, all allocated in
  ordinary original RAM objects.
- 3 original 4×8 astronaut bitmaps are inside the main 292×240 viewport on
  the first frame; 7 are in the wider world. This count comes from original
  `OBJX` addresses and exact video bitmap bytes, **not Canvas markers**.
- Scanner counts 13 total objects initially (10 astronauts + UFO + lander +
  swarmer) and maintains source list tracking over 600+ updates.
- Source `ASTRO` walking advances world coordinates; reset reproduces the
  same original objects, positions and initial visible sprites.
- Standalone `play.html` runs through a DOM/canvas stub from its **bundled
  JavaScript** without external dependencies or startup errors. This is a
  startup regression, NOT an independent real-browser screenshot check.
- 308 Node/source/standalone regression tests pass, including new actual
  framebuffer/presenter assertions. Original Chrome-headless visual capture
  is still unavailable in this environment.

## Known limits

Only source-rendered 4×8 native-size astronauts are presented; browser
scaling is cosmetic. Full level startup, real player laser hits, astronaut
pickup/falling/rescue, complete wave transitions, sound, and MAME
frame-by-frame equivalence remain incomplete. Source-generated enemy
positions can be offscreen; the scanner can show such enemies and humans.
