## MODIFIED Requirements

### Requirement: Standard error is the log and standard output is the wire
The studio SHALL copy every line the sidecar writes to standard error into a log file in the app's log directory, line by line, timestamped and marked with whether the core or the sidecar said it. Standard output SHALL carry protocol frames only; a child of the sidecar that reports progress to it SHALL do so as a frame, never as a line on its standard error. The log SHALL be rolled aside whenever it grows past four megabytes, at start and while the app runs, keeping one previous file.

#### Scenario: The sidecar logs a line
- **WHEN** it writes to standard error
- **THEN** the line appears in the log file with a timestamp, and the log's path is on the status so the person can reveal it

#### Scenario: The log has grown large
- **WHEN** the app starts and the file is over four megabytes
- **THEN** it is rolled aside before the new session appends to it

#### Scenario: The log grows large while the app runs
- **WHEN** a line takes the file past four megabytes during a session
- **THEN** the file is rolled aside before the next line, the next line starts a new file, and only the one previous file is kept

#### Scenario: A design check reports its progress
- **WHEN** the preview host reports how far a design check has come
- **THEN** the report reaches the sidecar as a frame and is not written to the log

#### Scenario: A line on standard output is not a frame
- **WHEN** the core reads a line it cannot parse
- **THEN** it logs the line with the parse failure and keeps reading, rather than ending the session
