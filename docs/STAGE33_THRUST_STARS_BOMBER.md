# Stage 33: player thrust, background star blink, Bomber and mine colours

## Reported defects

In Stage 32 the ship thrust pixels looked static, the 16 source stars did not twinkle, and Bomber colours appeared stuck. The source routines existed in different modules and diagnostic workbenches, but the main game wave did not create the original tasks that animate them.

## Source correspondence

Pinned original files: `src/defa7.src` and `src/defb6.src` in `mwenge/defender` commit `e74006344b16d19245510b5e55780f90d7606bb8`.

| Area | Original routines/data | Native integration |
|---|---|---|
| Thrust | `THINIT`, `THPROC`, `THPR1`, `THPR2`; `THOUT`, `THOUT1` | Start THPROC with `MKPROC` on wave start; source NAP(4) updates `THX` and `FBX`, player renderer reads `THX`. |
| Bomber | `TIECOL`, `TIECL`, `TCTAB` | Start TIECOL with `MKPROC`; rotate palette indices D/E/F through three original triples, NAP(6). |
| Bomber mines | `CBOMB`, `CBMB1`, `BMBD10`, `BMBD20` | Start CBOMB process; alternating 3/6 updates change registers A/C and source bitmap pointer `BAX`. |
| Star colours | `STOUT`, `SBLNK`, `SMAP`, `SCOL` | Star colour bytes change in original SMAP, and source STOUT writes the pixels through video RAM; no Canvas particles. |

The native addresses `0xe800+` for relocated bomb/colour data, and `0xf71c+` for host process-entry identifiers, are **native-address mapping conveniences**. They are not asserted to be actual 6809 hardware ROM locations.

## Caveat: SBLNK and its unusual source branch

The pinned `SBLNK` source includes a branch which, for an even seed (including `$A0` under its guards), writes into an address determined from seed bytes. Invoking the entire routine periodically causes real process-RAM corruption and failures in the native host runtime, which does not occur on the working normal-play path. The pinned source does not provide a confirmed periodic normal-gameplay call site for `SBLNK`.

Rather than incorrectly asserting that all of `SBLNK` executes each IRQ, Stage 33 connects the **odd-seed colour-only path** on a provisional host adapter cadence of once per four game updates (conditional on the source seed's low bit). The colour transform `SCOL = (SCOL + $11) & $77` and star selection `(SEED & $3C)` are source operations. Accurate cabinet star blink timing remains a differential-validation task.

## Verification

- `tests/stage33-colour-thrust-stars.test.mjs`: checks source 9-byte Bomber palette cycle, 3+6 tick mine colour transition, original bomb bitmap phases consumed by `BMBOUT`, source THX pointer advancement, IRQ palette latching, star-map colour change, and 12,000-update stress run including multiple ship deaths/resets.
- Full suite: run `npm test` (includes earlier stage regression tests).
- Standalone: run `npm run build`, then test `play.html` startup in Chromium. The build script must bundle `original/defb6-colour-processes.js` explicitly.

No sound-board implementation or audio changes are included. Unlimited Smart Bombs remain a temporary user-requested setting.
