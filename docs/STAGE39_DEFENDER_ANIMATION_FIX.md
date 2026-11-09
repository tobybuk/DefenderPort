# Stage 39 — DEFENDER attract animation: 6809 centre-register correction

## Source references

- Williams Defender Red Label, pinned commit `e74006344b16d19245510b5e55780f90d7606bb8`
- [`src/amode1.src`, `DEFEND`, `DEFENS`, `DEF1`, `DEF2`, `DEF33`, `DEF50`, `DEF44`](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/amode1.src#L791-L834)
- [`src/samexap7.src`, `APST`, `EXPU4`, `EXPU7`, `EWRITE`](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/samexap7.src#L160-L202)

## Root cause and the exact fix

Stage 38's `original/samexap7-explosion-update.js` incorrectly calculated the **X coordinate of `CENTER`** for the `EXPU7` appearance fragments: it treated the low byte of the SECOND `MUL` as a horizontal distance. The original assembly's `LDB 1,U` **replaces that low byte** with the image height and `LSRB` halves it. Only the high byte of the second product survives as the X-component adjustment.

Original instructions:

```asm
LDB #$DA
MUL
ASLA
LDU OBDESC,Y
LDB ,U
MUL
LDB 1,U
LSRB
ADDD TOPLFT,Y
STD CENTER,Y
```

For first DEFENDER fragment at `TOPLFT=$3098`, width 4, height 12:

1. `$30 × $DA = $28E0` (D), so A is `$28`.
2. `ASLA` yields A=`$50`.
3. `MUL` width 4 yields D=`$0140`.
4. `LDB height; LSRB` **replaces** `$40` with `$06`, yielding D=`$0106`.
5. `ADDD $3098` yields `CENTER=$319E`.

Stage 38 had `$709E`, more than 60 framebuffer byte-columns too far right. Because `EWRITE` uses `CENTER` to position all sparse fragments, the animation appeared in the wrong screen area or was clipped; it did not simply have incorrect font or palette colours. Stage 39 preserves the source's register widths and overwrites when calculating `CENTER`, with no JavaScript-designed animation algorithm.

## Preserved source data and timing

- Exactly **15** source `DEFPIC` descriptors remain. Each is `4 × 12` bytes. Successive data pointers advance by `4 × 24` through expanded `DEFBLK`: this is **intentional in original `DEF1`**; Stage 38's contiguous 48-byte picture extraction from each 96-byte stride was source-correct and remains unchanged.
- `APST` starts at `RSIZE=$AF00`; `EXPU` decrements `$0100` at each source appearance update.
- `DEF2` waits `$2E` and then `DEF50` restores the 60 × 24 image; `DEF44` starts palette cycling `$28` later.
- Browser rendering remains a framebuffer presenter, not an emulator or substituted draw routine.

**Known source/hardware boundary:** Original `BLKLEN` for the special attract object array is 14 bytes, while `APST` writes `OTYP` at object offset 20. This overlaps one `DEFPIC` RAM data-pointer byte in the Red Label memory layout. The RAM faithfully reflects the write, while the existing appearance picture resolver uses expanded source data associated with each descriptor rather than dereferencing this modified pointer against the full cabinet memory map. Independent machine-trace equality, including this alias and original process-IRQ timing, has not been established. This fix does not claim cycle-perfect emulation. Sounds remain deliberately deferred.

## Regression tests

`tests/stage39-defender-appearance-centre.test.mjs` checks every original descriptor stride, `RSIZE`, all 15 `EXPU7` centres against an independent instruction-order reference function, first-frame visible position, and the original delayed restoration. The pre-existing colour, Williams logo, Hall of Fame, gameplay and explosion tests remain in place.
