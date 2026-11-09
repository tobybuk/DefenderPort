# Stage 54 — Enter/Return as FIRE (browser-only control mapping)

## Change

The Stage 53 adapter rejected `Enter` and `NumpadEnter` as reserved keys and swallowed them before configurable gameplay mappings were evaluated. Consequently the FIRE control could not be assigned to either key.

Stage 54 allows these codes specifically for FIRE. The normal default remains `KeyF` (F), so this is opt-in through **KEYBOARD CONTROLS → FIRE → press Enter → DONE**. `displayKeyName` shows ENTER or NUMPAD ENTER, and existing binding persistence uses the same v1 storage key to retain old configurations. Source gameplay continues to receive logical `KeyF`; no 6809 routine is changed.

## Context-sensitive keyboard behaviour

* **Title / attract**: Enter begins a one-player game, retaining the Start control. That first key press does not also fire. A release is required before further actions.
* **Gameplay**: When mapped to FIRE, holding Enter translates to logical `KeyF` and therefore travels through the existing SSCAN/SWP/laser path. Browser auto-repeat does not produce fake extra press edges; key-up releases it. Numpad Enter can be selected separately.
* **Hall of Fame**: Enter continues to confirm each initial, whether or not the gameplay FIRE key is set to Enter. Held Enter cannot re-start the game after the last initial.
* **Settings**: Capturing Enter prevents the focused button's default activation. Escape cancels the choice. Enter cannot be assigned to a non-FIRE action, as that would conflict with existing Start/initials behaviour.

## Verification

`npm run build` produces a self-contained HTML file with readable non-minified JavaScript. `npm test` exercises the full source suite, and `tests/stage54-enter-fire.test.mjs` checks binding, validation, reloading, real standalone input, firing, key-release and initials confirmation. Desktop/mobile Chromium input smoke tests additionally verify reassignment through the settings screen and gameplay firing using actual keyboard events.

## Scope

This change intentionally does not adjust gameplay timers, sounds, ROM data, scoring or original graphics. Browser-local storage may be unavailable for a downloaded local HTML file, in which case changes last only while that page remains open.
