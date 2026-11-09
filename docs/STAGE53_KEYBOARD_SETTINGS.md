# Stage 53 — configurable browser keyboard controls

This is a browser input adapter, not a change to the source-derived 6809 cabinet switch routines. `browser/control-bindings.js` maps `KeyboardEvent.code` to the existing logical game inputs.

## Defaults

| Action | Physical key (`KeyboardEvent.code`) |
| --- | --- |
| Up | A (`KeyA`) |
| Down | Z (`KeyZ`) |
| Thrust | RIGHT SHIFT (`ShiftRight`) |
| Reverse | SPACE (`Space`) |
| Smart Bomb | TAB (`Tab`) |
| Hyperspace | H (`KeyH`) |
| Fire | F (`KeyF`, existing default) |

Press **KEYBOARD CONTROLS**, choose an action, press the desired key, and select **DONE**. Conflicting assignments are rejected; **RESTORE DEFAULTS** restores the table above. Assignments use browser `localStorage` when available, but local-file and private browser contexts may prohibit persistence. Enter is reserved for Start and high-score confirmation; Escape cancels a pending capture. During gameplay the browser prevents bound Tab and Space from moving focus or scrolling. Right and Left Shift are distinct.

Source-derived switch/PIA behaviour, sound commands, gameplay timing, and high-score input logic are not remapped internally. The high-score initials screen receives the logical UP/DOWN/FIRE inputs through this same adapter.

## Verification

- 510 Node tests passed, including five specific binding tests.
- Chromium mobile-width integration test passed: defaults, duplicate rejection, reassignment, localStorage write, Tab capture, Right Shift, Reverse, Smart Bomb, Fire, Up/Down, Reset, and three-initial Hall-of-Fame entry with no repeated name prompt.
