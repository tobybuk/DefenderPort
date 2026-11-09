# Translation contract

## Implementation restrictions

1. Native JavaScript. No fetching or decoding 6809 opcodes, no ROM interpreter, no instruction-step CPU emulator.
2. Preserve source module, routine and (where relevant) branch-label names. One original callable entry equals one corresponding JavaScript function or an explicitly documented direct alias into an original shared tail.
3. Preserve source-defined data structures, big-endian layout, signed comparison, byte overflow, carry and borrow where consumed. No JavaScript floating-point world coordinates for original fixed-point data.
4. Translate the process scheduler rather than inventing frame-based cadence. No arbitrary random movement or enemy cadence.
5. A native runtime continuation is allowed solely to represent the original saved return/resume address. It does not decide game logic.
6. Browser Canvas and Web Audio may only present source-derived pixel/sample output; graphics and sound algorithms belong in original-file translations.
7. Translate original source tables byte for byte. Never substitute approximated artwork, terrain, scanner or sounds.
8. Untranslated calls are errors, never rewritten fallbacks.

## Evidence requirements

- `translated-unverified`: function and control flow have been mapped by reading source but no comparison trace is available.
- `verified`: the routine passes representative identical-state comparisons against the original executable and a cited reference trace is stored with the project.
- `incomplete`: no native JS implementation or known unresolved branch, table or hardware dependency.
- Passing self-consistency unit tests **never** promotes a routine to `verified`.
- The machine-generated inventory must be compared against the translation-status file, with no silent omission of labels used as routine entrypoints.

## Legitimate differences

The original 6809's instruction-level mechanics (stack push/pop, register transfer, jump to indirect pointer) may be expressed as direct JavaScript argument passing, return values, typed memory and continuation functions, **only if their external effects on shared memory and call/resumption order are identical**. These differences must be documented at the translated function.

An original internal branch label is not automatically a separate callable routine. Some labels are shared tails and must remain traceable without changing fall-through behaviour.

## Known limitations — Stage 10

- The original program's source-level IRQ handoff is now connected to player, stars, terrain and object/shell output in an explicitly labelled raster-input diagnostic.
- This is **not** the full `SINIT`/`EXEC` cooperative process path. Original enemy AI, explosion expansion, sound firmware, palette and some descriptor tables are unported.
- Stage 10 translates the original bank selectors and `OFSHIT` as separate routines; only the diagnostic original `PLAPIC` picture descriptor is installed in the runnable harness.
- The source archive cannot be fetched inside this container; the pinned GitHub text was manually inspected. Complete inventory and annotation tools need a user-provided local checkout.
- Tests establish arithmetic, object/scheduler invariants and integrated IRQ behaviour; **no original-versus-native differential trace** is yet available. No original hardware equivalence claim is made.
