## ADDED Requirements

### Requirement: The selected element's label shows that a turn is working

While the open chat's turn is running and nothing waits on the person — no permission card and no source question — the canvas SHALL show the chat's thinking animation just after the label of the selected element. It SHALL be the same mark the chat's "Thinking…" marker shows, drawn by the app window over the preview. It SHALL sit beside whichever label the selection shows: the name label, or the size readout that replaces it for a managed object with explicit geometry. It SHALL follow the label in the same frame the label moves — pan, zoom, playback, and a rebuild that picks the element again — and SHALL NOT be shown while no label is shown. It SHALL go away as soon as the turn ends, however it ends. It SHALL NOT take pointer events and SHALL NOT be announced to a screen reader; the chat is where the turn's progress is said. The app window owns the decision to show it; the preview page only marks its labels so the window can find them.

#### Scenario: A turn works while an element is selected

- **WHEN** an element is selected on the canvas and the open chat's turn is running with nothing waiting on the person
- **THEN** the thinking animation is shown just after the selection's label

#### Scenario: The turn ends

- **WHEN** the turn finishes, fails or is stopped
- **THEN** the animation beside the label goes away and the label stays

#### Scenario: A card is waiting to be answered

- **WHEN** the running turn raises a permission card or a source question
- **THEN** the animation is not shown until the card is answered and the turn carries on

#### Scenario: Nothing is selected

- **WHEN** a turn is running and no element is selected, or the label is hidden while text is edited inline
- **THEN** no animation is drawn on the canvas

#### Scenario: The label moves

- **WHEN** the canvas is panned or zoomed, the video plays, or a rebuild picks the element again
- **THEN** the animation stays just after the label in every frame, with no lag behind it

#### Scenario: A managed object with explicit geometry is selected

- **WHEN** the selection shows the object's size readout instead of a name
- **THEN** the animation sits just after the size readout

#### Scenario: The label cannot be found

- **WHEN** the preview page draws no label the window can find
- **THEN** no animation is drawn on the canvas, the chat still shows its marker, and nothing else about the canvas changes

#### Scenario: Reduced motion

- **WHEN** the system asks for reduced motion
- **THEN** the mark beside the label is shown still, the way the chat's mark is
