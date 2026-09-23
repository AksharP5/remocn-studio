## MODIFIED Requirements

### Requirement: Every turn carries the studio's own conventions

Every turn SHALL append the studio's conventions to the provider's own system prompt: the chat works on exactly one video, its lane is that video's folder under `src/videos/`, `Root.tsx` is never edited, a new scene is a component sequenced with `<Series>` or `<TransitionSeries>` in the video's `index.tsx`, given a short human `name`, and described in `studio.json` by a scene object (definition `scene`, label equal to that name) bound to the scene's root that its objects name as `parentId`, what is reused lives in `src/shared/`, an attached track's audiomap is timing evidence to be confirmed against the rendered mix, and the result stays editable as named components with plain props.

#### Scenario: The video is named

- **WHEN** the chat's video is known
- **THEN** the conventions name that slug, its folder and the composition it registers

#### Scenario: The video could not be read

- **WHEN** the chat's video row cannot be resolved
- **THEN** the conventions omit that one sentence and everything else is unchanged

#### Scenario: References in the message

- **WHEN** the message carries element references or backticked paths
- **THEN** the conventions explain that each element is described in a block at the end of the message, that requested changes are grouped by the component that owns them and are edited in that file, and that a backticked path was picked from the app's own file list

#### Scenario: A scene is sequenced

- **WHEN** the agent adds a scene to a video
- **THEN** the conventions have asked it to name the sequence, add the scene object with the same label bound to the scene's root, and parent the scene's objects to it
- **AND** an object drawn inside another object is parented to that object instead
