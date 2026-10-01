## MODIFIED Requirements

### Requirement: Every shipped component is classified, and nothing else is
Every component the studio ships SHALL have a role, and the classification SHALL name only components the studio actually ships. A name the studio does not ship SHALL answer with no role rather than a guess.

#### Scenario: The shipped set is listed
- **WHEN** the bundled components are listed
- **THEN** all hundred and forty of them carry a role — forty-one entry, twenty-six emphasis, five exit, forty-two scene and twenty-six transition
- **AND** none is shown as unclassified

#### Scenario: An unknown name is classified
- **WHEN** a role is asked for a name nothing ships
- **THEN** the answer is no role
