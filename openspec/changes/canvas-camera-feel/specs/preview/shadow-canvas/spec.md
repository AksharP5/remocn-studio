## ADDED Requirements

### Requirement: Camera jumps are animated

Fit, 100%, zoom in, zoom out and zoom to selection, from the toolbar or their
shortcuts, SHALL move the camera to its target over about 200 ms with an
ease-out curve. Pan, wheel and pinch SHALL remain immediate, and any of them
SHALL stop an animation in progress where it is. With reduced motion requested
by the system, jumps SHALL be immediate. An edit that holds the camera SHALL
prevent the jump as before.

#### Scenario: Fitting the video

- **WHEN** the person presses ⇧1 at 400%
- **THEN** the camera moves to the fitted view over about 200 ms

#### Scenario: Taking over mid-animation

- **WHEN** the person starts panning while the camera is animating
- **THEN** the animation stops and the pan follows the pointer from the current view

#### Scenario: Reduced motion

- **WHEN** the system asks for reduced motion and the person fits the video
- **THEN** the camera is fitted at once

### Requirement: Rulers measure the video

The canvas SHALL show rulers along its top and left edges, in video pixels,
following the camera, with tick spacing chosen so labels do not collide at any
zoom. The rulers SHALL mark the pointer's position and the selected object's
extent. A toolbar toggle and ⇧R SHALL show or hide them; the choice SHALL be
remembered between launches. Fit and zoom to selection SHALL leave the rulers'
space uncovered.

#### Scenario: Reading a position

- **WHEN** the rulers are shown and the pointer is over the canvas
- **THEN** both rulers mark the pointer's position in video pixels

#### Scenario: A selection

- **WHEN** an object is selected
- **THEN** each ruler highlights the object's extent on its axis

#### Scenario: Hiding the rulers

- **WHEN** the person presses ⇧R with the canvas focused
- **THEN** the rulers are hidden, and stay hidden after a relaunch

### Requirement: A pixel grid appears at high zoom

From 800% zoom, the canvas SHALL draw a one-pixel grid over the video aligned
to video pixels, and SHALL remove it below that zoom. The grid SHALL NOT appear
in Snapshot or Export.

#### Scenario: Zooming in

- **WHEN** the person zooms to 800% or more
- **THEN** a grid marks every video pixel over the frame

### Requirement: The camera is remembered between launches

The canvas SHALL remember the camera of recently viewed videos between
launches, keyed by project, video and dimensions, and SHALL restore it when the
video is opened again, keeping the same video point at the centre of the canvas
whatever the window size. A video without a remembered camera SHALL be fitted.
Changing a video's dimensions SHALL fit it again.

#### Scenario: Reopening the app

- **WHEN** the person zoomed into a corner of a video, quit and relaunched
- **THEN** the video opens at the same zoom with the same point at the centre

#### Scenario: A different window size

- **WHEN** the window is smaller than when the camera was saved
- **THEN** the same video point is at the centre of the canvas
