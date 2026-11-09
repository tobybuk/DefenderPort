# Stage 24 — Movement fidelity, SAMEX explosion graphics, mobile long-press

## Scope

Source revision: `mwenge/defender@e74006344b16d19245510b5e55780f90d7606bb8` (Red Label).
Source locations: `src/defb6.src:843-900` (`SCZ0`) and `src/samexap7.src:119-376`
(`EXPU`, `EWRITE`, `EERASE`). No ROM execution or CPU instruction interpreter is used.

### Mutant movement audit

`SCZ0` was already implemented in `original/defb6-lander.js`. The Stage 24
branch-flag oracle independently calculates 6809 carry/zero/negative/overflow
for `CMPY`, `SUBD`, `SUBA`, `CMPA`, and `BMI` path choices, testing 3,500 varied
input states and all outputs: signed-extended `OXV`, `OYV` selection, `SZRY`
random sign hops, `YMIN -> YMAX` wrap, shot countdown, source sound dispatch,
and `NAP 3,SCZ0` process continuation. No discrepancy was detected in the
translated `SCZ0` memory effects. An additional real-harness check starts
after a first abduction and advances the mutant 120 updates, confirming its
world X moves and its source object remains on the linked scanner lists.

**Accuracy limit**: These are source-level branch comparisons, not original
arcade hardware versus JavaScript input-state differential traces. They do
not establish perfect absolute timing, sprite presentation or combat results.
The game harness still uses an IRQ input fixture and a provisional top-level
scheduler cadence.

### Expanded source explosions

`original/samexap7-explosion-update.js` introduces two new source-named
translation entrypoints:

- `EWRITE`: uses exact original packed FDB bytes (from picture descriptors
  already present) and writes them into original two-byte vertical video
  columns, with source computed pixel gaps as `RSIZE` increases; it also
  records destination word pointers in the backwards $40-byte erase table,
  with the source's two-byte explosion-centre opening.
- `EXPU`: advances all 16 original $9c00-$9fff slots, adds `$00AA` to each
  explosion size, tracks source BGL/BGLX quantised scroll, removes previous
  frame bytes using source `EERASE`, and stops at width byte >`$30`.

The original assembly `EXPU4-EXPU7` appearance update remains incomplete
because `APST` has not been integrated; encountering an appearance slot
throws `TranslationBoundaryError`. `TERBLO` is also untranslated. This
implementation is `translated-unverified` pending original-machine
comparison; the exact main-game invocation cadence is not yet known and is
currently one expansion update per diagnostic tick.

### Mobile behaviour

CSS `-webkit-user-select:none`, `user-select:none`,
`-webkit-touch-callout:none`, `touch-action:none` are attached to controls;
`contextmenu`, `selectstart`, and `dragstart` default actions are blocked on
all buttons. Continuous game buttons additionally suppress native
`touchstart` with `{passive:false}`, while pointer down/up/cancel/leave
control the held states and handle simultaneous pointers correctly. Normal
button clicks still work. The standalone HTML VM checks these listeners;
actual on-device Android/iOS verification remains desirable.

### Tests and limits

`npm run build`, JavaScript `node --check`, full `npm test` (331 passing),
source substitution guardrail, source framebuffer extraction at tick 1331
(9 humans, one mutant, active explosion) and zip integrity. Chromium timed
out in this environment and is **not** claimed as visually validated.

Deferred: full player laser hit detection and scoring, source `APST`,
`TERBLO` and later waves, arcade-accurate palette/audio and comprehensive
original-machine trace comparison.
