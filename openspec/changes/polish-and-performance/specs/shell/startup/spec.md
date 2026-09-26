## MODIFIED Requirements

### Requirement: The splash holds a minimum and leaves at a cap

The splash SHALL stay for at least 0.8 seconds — the length of its draw, which lands at 775 ms — so the draw is seen whole and never cut, and SHALL leave no later than 6 seconds after it appeared whether or not the shell has settled. Between those two, it SHALL leave as soon as the shell settles. Leaving SHALL be a fade of 250 ms.

#### Scenario: Everything settles quickly

- **WHEN** the shell is ready before the first 0.8 seconds have passed
- **THEN** the splash keeps drawing until 0.8 seconds have passed
- **AND** it then fades out in 250 ms

#### Scenario: Something is slow

- **WHEN** the shell is still not ready at 0.8 seconds
- **THEN** the splash holds, without restarting its draw
- **AND** it leaves at 6 seconds regardless, revealing the shell and whatever the sidecar's status row says

#### Scenario: Reduced motion is asked for

- **WHEN** the operating system asks for reduced motion
- **THEN** the splash holds from the start instead of drawing its entrance
- **AND** the same minimum and cap still apply
