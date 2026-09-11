## Purpose

One typed contract joins the webview, the Rust core and the sidecar: a named method, its parameters, its result and the shape of the chunks it streams. Everything that crosses that boundary is decoded rather than trusted, every request is answered exactly once, and a cancel is a real interruption rather than a request nobody reads the answer to.

## ADDED Requirements

### Requirement: Every method is a name with three shapes
The studio SHALL define, for each method, the shape of its parameters, the shape of its result and the shape of the chunks it may stream. Both ends of the wire SHALL read those shapes from the same definition, and every value crossing the boundary SHALL be decoded against them rather than cast.

#### Scenario: A method is called with parameters it accepts
- **WHEN** the request arrives
- **THEN** the parameters are decoded before the handler sees them

#### Scenario: A method is called with parameters it does not accept
- **WHEN** the parameters do not decode
- **THEN** the request is answered with a single error frame naming what was wrong
- **AND** the handler is never run

### Requirement: A request is answered exactly once
The studio SHALL answer every request with exactly one terminal frame — a result or an error — whatever happens to the handler, including a handler that fails, one that is interrupted and one whose process is being shut down.

#### Scenario: The handler succeeds
- **WHEN** it returns
- **THEN** one result frame carrying the decoded result is sent, and no error frame follows it

#### Scenario: The handler fails
- **WHEN** it raises
- **THEN** one error frame carrying the failure's own sentence is sent

#### Scenario: A second request reuses an id still in flight
- **WHEN** it arrives
- **THEN** it is refused with an error saying that request is already in flight
- **AND** the request that is running is untouched

### Requirement: An unknown method is named, never dropped
The studio SHALL keep the method as plain text in the request envelope and decide separately whether it is a method it has. A method it does not have SHALL be answered with a sentence naming it.

#### Scenario: A method that does not exist is called
- **WHEN** the request arrives
- **THEN** the answer is an error frame reading that there is no method called that
- **AND** the caller is never left waiting for a reply that will not come

### Requirement: Streaming chunks arrive in order, before the result
The studio SHALL deliver a method's stream chunks in the order the handler emitted them, all of them before that request's terminal frame, and SHALL route each chunk to the request that emitted it.

#### Scenario: A streaming method runs
- **WHEN** it emits three chunks and then returns
- **THEN** the caller receives the three chunks in order and then the result

#### Scenario: Several requests stream at once
- **WHEN** two long-running requests are in flight
- **THEN** each chunk reaches only the caller of the request it belongs to, and neither request waits for the other to finish

### Requirement: Cancelling interrupts the work and still answers
The studio SHALL treat a cancel as an interruption of the running handler, SHALL let the handler's own cleanup run, and SHALL still send that request one terminal frame. Cancelling something that is not running SHALL do nothing at all.

#### Scenario: A running request is cancelled
- **WHEN** the cancel arrives
- **THEN** the handler is interrupted, its cleanup runs, and the request is answered with the cancellation marker rather than a result

#### Scenario: A cancel names an id nothing is serving
- **WHEN** it arrives
- **THEN** nothing is interrupted and no frame is sent

#### Scenario: The cancellation marker would reach a person
- **WHEN** a pane would otherwise print it
- **THEN** it is worded for what actually happened before it is shown

### Requirement: Closing the input interrupts everything
The studio SHALL treat the end of the sidecar's input as the end of the process: every request still in flight is interrupted, each one's cleanup runs, and each one is answered.

#### Scenario: The core closes the sidecar's input
- **WHEN** requests are still running
- **THEN** each of them is interrupted and answered, and the sidecar then exits

#### Scenario: The sidecar is asked to stop while serving
- **WHEN** it is signalled
- **THEN** the in-flight requests are answered before the process goes, rather than being left unanswered

### Requirement: A frame that cannot be read is logged and dropped
The studio SHALL never let a malformed frame end a session. A line that is not a frame SHALL be logged with the line itself and the reading SHALL continue.

#### Scenario: A line of junk arrives on the wire
- **WHEN** it cannot be parsed
- **THEN** it is logged as a dropped frame and the very next valid request is still served

#### Scenario: An empty line arrives
- **WHEN** it is read
- **THEN** it is ignored silently and nothing is logged

#### Scenario: A stream chunk cannot be decoded in the webview
- **WHEN** the chunk does not match the shape its method declares
- **THEN** it is reported with the method, the kind of chunk and the reason, rather than vanishing
- **AND** the rest of the stream continues

### Requirement: The protocol number is carried and compared
The studio SHALL carry a protocol number on the frame the sidecar announces itself with, and the core SHALL compare it with its own. A mismatch SHALL be logged and SHALL NOT stop the session. The number SHALL be the same on both sides of the wire and SHALL be raised whenever the frames change.

#### Scenario: The two sides agree
- **WHEN** the sidecar announces itself
- **THEN** nothing is logged about the protocol and the phase becomes ready

#### Scenario: The two sides disagree
- **WHEN** the numbers differ
- **THEN** both numbers are written to the log and the sidecar still serves

### Requirement: A failure reaches the person as a sentence
The studio SHALL carry every failure across the wire as readable text and SHALL surface it as that text. A failure SHALL never reach a pane as a framework's wrapper message or an unlabelled exception.

#### Scenario: A handler fails because the sidecar is not running
- **WHEN** the webview runs the request
- **THEN** the message the pane renders is the reason itself, such as that the sidecar is not running

#### Scenario: A request is deliberately cancelled by the person
- **WHEN** the running request is interrupted on the person's behalf
- **THEN** the pane shows no error at all
