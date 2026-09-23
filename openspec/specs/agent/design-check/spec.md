# agent/design-check Specification

## Purpose
The audit the agent runs against its own rendered frames before it calls a scene or a video finished: contrast, text bounds and reading time on real pixels, declared movement that must actually move, whole-film rhythm and continuity, the real audio mixdown, the runtime motion contracts a generated sequence publishes, and the source rules that decide whether the person will be able to tune the result without code.

## Requirements

### Requirement: One tool, three modes

The studio SHALL offer the agent a single design check with three modes: a sampled review of two to nine key frames, a full readiness pass that plans its own coverage across the whole composition, and a report mode that revalidates an existing report against the current sources. The answer SHALL always carry the composition, its dimensions, the frames inspected, the images written for them, the findings and a summary counting errors, warnings and information.

#### Scenario: Sampled

- **WHEN** the agent asks for two to nine distinct key frames
- **THEN** each is rendered and inspected, the declared motion assertions add whatever further frames they need, and the answer carries one image per inspected frame

#### Scenario: Too few or too many frames

- **WHEN** fewer than two or more than nine distinct frames are asked for in sampled mode
- **THEN** the call is refused with a sentence saying so, and nothing is rendered

#### Scenario: Full

- **WHEN** the agent asks for the full mode
- **THEN** the studio plans its own frames, measures the audio mixdown, and answers with a readiness report beside the findings

#### Scenario: Report

- **WHEN** the agent names an existing report id
- **THEN** that report is reloaded, its revision measured again against the current sources, and its coverage and exceptions are downgraded if anything has changed

### Requirement: The frame audit measures what a viewer would see

Each inspected frame SHALL be audited in the rendered page for text contrast against the actually rendered background, readable text that leaves the frame, readable text clipped by its own box or an ancestor, readable text covered by another painted layer, and resources that failed to load or decode.

#### Scenario: Contrast

- **WHEN** a readable text run is measured against its rendered background
- **THEN** it is required to reach 3:1 when it is at least 24px, or at least 19px and bold, and 4.5:1 otherwise
- **AND** a background the audit could not sample is recorded as unknown rather than reported as a failure

#### Scenario: Clipped, covered or out of frame

- **WHEN** a readable text box extends past the composition, past a clipping ancestor, or has most of its probes covered by an unrelated layer
- **THEN** each is its own finding naming the box and the element that clips or covers it

#### Scenario: A reveal that clips on purpose

- **WHEN** the clipping ancestor is a declared reveal mask and the text's own cue is entering or exiting
- **THEN** the finding is categorised as a motion reveal rather than as a text-bounds defect

#### Scenario: A narrow exception in the markup

- **WHEN** an element is inside a subtree marked as ignored for the design check
- **THEN** it is not audited at all

### Requirement: Declared movement is checked against the render

The studio SHALL accept up to twelve motion expectations from the agent, each naming a selector: that an element or its content visibly changed between two frames, that it is visible by a frame, that it never holds still longer than a stated run inside an interval, or that it never leaves the canvas. The studio SHALL report a selector that matches nothing, a selector that matches more than one element, an element that is not visible, one that leaves the frame, and a hold that is too long.

#### Scenario: An expectation is met

- **WHEN** the rendered frames satisfy the declared expectation
- **THEN** no finding is raised for it

#### Scenario: A selector that is not one element

- **WHEN** a selector matches nothing, or matches several elements
- **THEN** that is a finding naming the selector, rather than the assertion being skipped in silence

#### Scenario: An interval too large to sample

- **WHEN** a keeps-moving expectation would need more than forty-eight samples, or its interval is inverted, or its maximum hold is below one frame
- **THEN** the call is refused in sampled mode with a sentence telling the agent to split the interval
- **AND** in the full mode that expectation is left unevaluated and the coverage says the motion checks are incomplete

### Requirement: The whole-video pass reads the scene map

When the agent passes a scene map of shots in playback order, and optionally a camera selector, the studio SHALL sample the composition end to end and report the spread of the declared scene durations, cuts with nothing visible on both sides, the longest stretch in which nothing changed, and a declared camera that never moves. It SHALL be passed once for the video, not once per scene.

#### Scenario: An invalid map

- **WHEN** a scene ends past the composition, ends before it starts, is out of order, or the map holds more than twenty-four scenes, or the pass would need more than two hundred and forty samples
- **THEN** the call is refused with a sentence naming the scene or the budget and telling the agent how to split the pass

#### Scenario: Rhythm and accents

- **WHEN** at least three scenes are declared and their durations vary by less than fifteen percent of their mean
- **THEN** that is reported as information, stating explicitly that it does not measure the beats inside a shot
- **AND** with at least six scenes and none shorter than a second and a half, the absence of a short cut is reported the same way

#### Scenario: Continuity across cuts

- **WHEN** more than half the declared boundaries have no visible design id on both sampled sides
- **THEN** that is reported as information naming the cuts, with the caveat that a matching id alone does not prove visual continuity
- **AND** when no element anywhere carries a design id, that is reported instead, stating that continuity could not be judged at all

#### Scenario: A frozen stretch, and a locked camera

- **WHEN** nothing in the frame changes for at least forty-five sampled frames
- **THEN** that is reported as information, with the intended hold named as a valid outcome
- **AND** a declared camera selector that matched nothing is a warning, while one that held the same transform throughout is information

### Requirement: The full mode plans, refines and reports its own coverage

The full mode SHALL plan its frames from the composition and the scene map, refine locally around defects, changes and dark intervals, and bound itself by a frame budget and a time budget. Its report SHALL always state which frames were sampled, which intervals were never measured, how long it took, and every limitation that applies.

#### Scenario: Refinement

- **WHEN** a sampled frame carries a finding, is nearly black, or differs from the previous sample
- **THEN** neighbouring and intermediate frames are added to the queue, and boundaries a runtime motion contract declares are put at the front of it

#### Scenario: A budget is exhausted

- **WHEN** the frame budget or the time budget runs out with frames still queued
- **THEN** the report is marked incomplete and limited, the reason is added to its limitations, and whatever was measured is kept
- **AND** the coverage never reports complete in that case

#### Scenario: The check is cancelled

- **WHEN** the agent or the person cancels the check
- **THEN** the report is returned as cancelled and incomplete, warning that the input revision was not revalidated
- **AND** a partial report is never presented as a clean bill of health

#### Scenario: No scene map

- **WHEN** no scene map is given
- **THEN** a uniform grid is used and the limitation that short scenes and exact transitions may be missed is recorded

### Requirement: Rule execution is reported apart from what the rules found

The report SHALL carry a status per rule — completed, not applicable, skipped or failed — with the reason, so a rule that never ran is distinguishable from a rule that ran and found nothing.

#### Scenario: A rule that could not run

- **WHEN** the sampling gaps are wider than the reading-window resolution
- **THEN** the reading-time rule is marked skipped with that reason and its findings are dropped rather than reported on partial evidence

#### Scenario: A rule that does not apply

- **WHEN** no platform profile, no scene map, no motion expectation or no audio expectation was given
- **THEN** the corresponding rule is marked not applicable rather than passed

#### Scenario: Frames that failed to render

- **WHEN** any frame failed to render or inspect
- **THEN** the render rule is marked failed, each failure is a finding naming the frame and the reason, and the successfully inspected frames are retained

### Requirement: A finding says what it is, how sure it is and where to look

Every readiness finding SHALL carry a stable identity derived from its rule, element, interval and scene; whether it addresses the viewer, the author's intent, or the source's tunability; its category; whether it is a measurement or a heuristic; a confidence sentence; what was expected and what was observed; the frames and the interval it covers; the images that evidence it; its bounding box where it has one; and the numbers behind it.

#### Scenario: A measurement

- **WHEN** a finding comes from something measured on a rendered frame or on the audio mixdown
- **THEN** it is marked as a measurement and carries the numbers it was derived from

#### Scenario: A heuristic

- **WHEN** a finding comes from a reading-speed model, an intelligibility estimate or a pacing observation
- **THEN** it is marked as a heuristic and its confidence sentence says what it cannot establish

#### Scenario: Evidence

- **WHEN** a finding is raised
- **THEN** the images of the frames it was seen on are named, so the agent can look at them

### Requirement: Findings merge over contiguous intervals

Findings of the same rule, category, element and scene SHALL be merged when their intervals are contiguous within the sampling resolution, keeping the union of their frames and a bounded set of evidence, and text-bounds and contrast findings SHALL be raised from information to an error only once they persist for at least half a second across at least two frames.

#### Scenario: One defect across many frames

- **WHEN** the same element fails the same rule on a run of adjacent frames
- **THEN** it is one finding covering the whole interval rather than one per frame

#### Scenario: A single-frame glimpse

- **WHEN** a text-bounds or contrast problem appears on one sampled frame only
- **THEN** it stays information rather than being raised to an error

### Requirement: An intentional exception is bound to the version it was granted for

The studio SHALL accept narrow exceptions from the agent naming the rule, the element, the frame interval, a reason, and the revision they were granted against. An exception SHALL apply only while the report's revision still matches and the report is not stale.

#### Scenario: A matching exception

- **WHEN** an exception names the same rule, element and revision and covers the finding's whole interval
- **THEN** the finding carries that reason and is not reported to the agent as an outstanding defect

#### Scenario: The sources moved

- **WHEN** the revision has changed, or the report is stale
- **THEN** every exception is dropped and the findings stand again

### Requirement: A report is identified by what it measured

Each full report SHALL be stored with an id, and its revision SHALL be a hash of the project's sources and assets together with the composition, the declared expectations, the measurement options and the render settings — excluding the intent exceptions themselves and the pipeline's own documents, so writing a review note does not invalidate the render it describes.

#### Scenario: Sources changed during the check

- **WHEN** the revision measured after the pass differs from the one measured before it
- **THEN** the report is marked stale with a limitation saying every scene should be rechecked

#### Scenario: Reloading a report

- **WHEN** a report is reloaded by id
- **THEN** its revision is measured again against the current sources, its completeness is downgraded if it is now stale, and the stored report is updated with that verdict

#### Scenario: A report from elsewhere

- **WHEN** the id is malformed, or the report belongs to another project or another composition
- **THEN** the reload is refused with a sentence rather than answering about the wrong video

### Requirement: Audio is measured on the real mixdown

The full mode SHALL render the composition's actual audio mix and measure it, reporting sustained full-scale samples, insufficient peak headroom, an explicitly expected interval that is silent, an internal silence between audible passages, and an audible signal stopping at a scene or composition boundary. Speech-related conclusions SHALL be stated as advice.

#### Scenario: Clipping and headroom

- **WHEN** the mix reaches digital full scale repeatedly
- **THEN** that is a measured error naming the clipped sample count and the peak
- **AND** a peak above the configured threshold without sustained clipping is a warning about headroom

#### Scenario: Silence

- **WHEN** an interval the agent declared as expected to carry audio measures as silence, and it was not declared an intentional pause
- **THEN** that is a measured error
- **AND** an internal silence of at least three tenths of a second flanked by audible audio is a warning

#### Scenario: Masking

- **WHEN** role-isolated stems and declared speech intervals are supplied and the speech margin over the backing falls below the threshold
- **THEN** that is reported as a heuristic about intelligibility, never as a measured defect
- **AND** without stems and speech intervals the masking rule is marked skipped, saying volume declarations alone are insufficient

#### Scenario: Audio could not be measured

- **WHEN** the project's renderer exposes no mixdown, or the audio pass fails
- **THEN** the audio rules are marked failed with that reason and the visual findings are still returned

#### Scenario: A stem that changes the timeline

- **WHEN** a role stem's props change the composition's duration or frame rate
- **THEN** the audio pass fails with a sentence saying the masking measurement would be invalid

### Requirement: Runtime motion contracts are discovered from the render

Where a generated sequence publishes a motion contract in the rendered page, the studio SHALL read it, add the frames around each declared event to the sampling plan, and check the declared intervals against what the frames actually show: an element that exits past its window, one that outlives or precedes its parent, a reading budget longer than the settled interval, a target that is missing or ambiguous while it is promised, and two elements occupying one exclusive reading position at once.

#### Scenario: A contract is found

- **WHEN** a contract is discovered while sampling
- **THEN** its event frames are inspected ahead of the planned grid, and the coverage records how many contracts and cues were found and which event frames were never visited

#### Scenario: A contract the studio cannot trust

- **WHEN** a contract is malformed, oversized, has duplicate cue ids, has phases out of order, or changes between frames of the same pass
- **THEN** that is a measured error naming the problem, and the motion-contract rule is marked failed

#### Scenario: No contract at all

- **WHEN** the composition publishes no contract
- **THEN** the rule is marked skipped, the limitation that exact handoffs and declared reading positions are unverified is recorded, and the agent is told what to add

#### Scenario: Parts of the film with no contract

- **WHEN** contracts cover only part of the composition
- **THEN** the uncovered intervals are reported and the coverage is marked limited

### Requirement: The source's tunability is checked beside the pixels

Every design check SHALL also read the turn's own video source and report its tunability rules about whether the result can be tuned without code: a constant timing curve, a spring whose physics are nailed shut, a run of text in a plain element, one literal name shared by every instance a repetition renders, a curve that is never sampled, a schema component that never forwards its controls, a file that exports the unwrapped component, a scene sequenced without a name, a named scene with no scene object of the same label in `studio.json`, and a managed object that belongs to no scene. These findings SHALL be merged into the same findings list and counted in the same summary.

#### Scenario: Severities

- **WHEN** the source is scanned
- **THEN** a constant easing, a shared literal name, unforwarded controls, a raw export, an unnamed scene and a scene without its scene object are errors; a run of text in a plain element and an object outside every scene are warnings; a constant spring and an inert curve are information
- **AND** each finding names the file, the line and the snippet, what was expected and how to fix it

#### Scenario: Scenes are described

- **WHEN** the video's `index.tsx` sequences scenes with `<Series.Sequence>` or `<TransitionSeries.Sequence>`
- **THEN** each one without a `name` is reported, and each named one without a scene object of that label in `studio.json` is reported
- **AND** a managed object whose parents never reach a scene object is reported, unless the video's `index.tsx` renders it itself or the video has no scene objects at all

#### Scenario: Only this chat's video

- **WHEN** the scan runs
- **THEN** it reads only the folder of the video this chat is working on, never a sibling video's
- **AND** a chat with no video reads nothing

#### Scenario: The source could not be read

- **WHEN** the video's source cannot be read
- **THEN** the tunability rule is recorded as failed with that reason and the rest of the check is still returned
- **AND** the check the agent is waiting on is never failed over it

### Requirement: A check that cannot run says why, in the studio's own words

The check SHALL refuse clearly when there is nothing to inspect, and a renderer's own failure text SHALL be worded for the person rather than forwarded raw.

#### Scenario: No preview for this project

- **WHEN** the project's preview host is not running
- **THEN** the call is refused with a sentence saying there is nothing to render

#### Scenario: The chat has no video

- **WHEN** the chat is not attached to a composition
- **THEN** the call is refused with a sentence saying so

#### Scenario: A Remotion that cannot be inspected

- **WHEN** the project's Remotion can render stills but exposes no warm page to audit
- **THEN** the call is refused with that sentence rather than failing obscurely

#### Scenario: The host is busy

- **WHEN** a full check or a report reload is asked for while another render or check is running
- **THEN** it is refused with a sentence telling the agent to cancel it or wait

#### Scenario: Images from an earlier check

- **WHEN** a sampled check starts
- **THEN** the frames of previous sampled checks are swept and this check writes into a folder of its own
