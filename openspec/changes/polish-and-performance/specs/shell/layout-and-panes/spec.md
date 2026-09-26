## MODIFIED Requirements

### Requirement: The title bar band carries a shader that can be turned off

The band under the traffic lights SHALL carry an animated field whose speed and hue follow what the studio is doing — calm while idle, faster while a turn runs, another hue while something waits or has failed. Showing the field SHALL be a preference (`titlebarShader`), animating it SHALL be a second preference (`titlebarMotion`), both on by default and both remembered. The band SHALL keep the same height either way, so nothing below it moves. While the window is not the focused window the field SHALL hold still and stop drawing, and it SHALL resume when the window is focused again.

#### Scenario: Turning the shader off

- **WHEN** the person turns *Show the shader* off in Appearance
- **THEN** the band is the sidebar's own plain colour
- **AND** *Animate it* is disabled, since there is nothing left to animate
- **AND** both choices come back on the next launch

#### Scenario: Turning only the motion off

- **WHEN** the person turns *Animate it* off
- **THEN** the field holds one frame and its hue still follows the mood

#### Scenario: The system asks to reduce motion

- **WHEN** the operating system asks for reduced motion
- **THEN** the field holds one frame regardless of the preference
- **AND** a change of mood changes the hue at once rather than fading to it

#### Scenario: The window goes to the background

- **WHEN** another app's window is focused
- **THEN** the field holds its current frame and draws nothing until the studio's window is focused again

#### Scenario: No project yet, or no WebGL

- **WHEN** no project has been opened, or the webview cannot give the page a WebGL context
- **THEN** the band is drawn plain rather than failing

## ADDED Requirements

### Requirement: The webview's own menu appears only over text

A secondary click SHALL NOT open the webview's own context menu anywhere except over a text field or an editable region, and over text marked as selectable only while some of that text is selected, where the system's text menu stays. Rows that have actions of their own SHALL answer a secondary click with a native menu of those actions instead.

#### Scenario: Right-clicking the chrome

- **WHEN** the person right-clicks a button, a pane header or an empty part of a pane
- **THEN** no menu appears, and in particular no Reload or Inspect Element

#### Scenario: Right-clicking text

- **WHEN** the person right-clicks inside the composer, or inside an assistant message with some of its text selected
- **THEN** the system's text menu appears with Copy, Paste and Look Up as usual

#### Scenario: Right-clicking the transcript with nothing selected

- **WHEN** the person right-clicks an assistant message while none of its text is selected
- **THEN** no menu appears, and in particular no Reload or Inspect Element

### Requirement: A failure reads as a sentence and keeps its raw text behind Details

Wherever the studio shows a failure — the history, the library, the project list, a turn, the preview, an export and a scaffold — it SHALL show a sentence. Text that is not a sentence — JSON, a stack, a bare token, an `Error:` prefix, or a JavaScript engine's own error such as a `TypeError` — SHALL NOT be the sentence: the studio SHALL show a sentence for that surface instead, and SHALL keep the raw text behind a Details disclosure with Copy details. A failure that already arrives as a sentence SHALL be shown as it is, with Details only when more lines follow it.

#### Scenario: A structured rejection

- **WHEN** a failure arrives as a JSON object
- **THEN** the surface reads its own sentence, and the JSON is only under Details

#### Scenario: A message with a stack

- **WHEN** a failure's first line is a sentence and a stack follows it
- **THEN** the first line is shown and the whole text is under Details, where Copy details copies it

#### Scenario: A JavaScript error

- **WHEN** a failure reads *TypeError: Cannot read properties of undefined (reading 'x')*
- **THEN** the surface reads its own sentence, and that text is only under Details

#### Scenario: A worded failure

- **WHEN** a failure reads *the sidecar is not running*
- **THEN** exactly that is shown and there is no Details

### Requirement: Surfaces arrive and leave with a short fade that respects Reduce Motion

Settings, the notice cards above the composer and the preview's status rows SHALL fade in when they appear and fade out when they leave, within a quarter of a second and without bouncing. The studio's motion SHALL use one ease-out curve and a short set of durations. With the system's Reduce Motion on, entrances SHALL degrade to a short crossfade and decorative motion — the toast's shake and bounce, the easing preview's dot and the title bar's hue fade — SHALL stop, while spinners keep turning.

#### Scenario: Closing Settings

- **WHEN** Settings is closed
- **THEN** it crossfades away over the shell rather than vanishing, and takes no clicks while it fades

#### Scenario: A notice is answered

- **WHEN** the asset offer or the environment checklist above the composer goes away
- **THEN** it fades out rather than disappearing in one frame

#### Scenario: Reduce Motion

- **WHEN** the system asks for reduced motion and a toast reports an error
- **THEN** the toast appears without shaking
