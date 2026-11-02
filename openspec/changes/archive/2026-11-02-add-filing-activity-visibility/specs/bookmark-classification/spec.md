# Spec Delta

## MODIFIED Requirements

### Requirement: Classification failure isolation
The system SHALL convert provider, network, timeout, and response-validation failures into categorized unresolved outcomes that may be reported in filing activity without exposing the API key or sensitive provider details.

#### Scenario: OpenAI request fails
- **WHEN** OpenAI returns an error, the network request fails, or the request times out
- **THEN** the system reports an unresolved outcome and does not return a destination folder

#### Scenario: Failure details are shown
- **WHEN** a classification error is reported for diagnosis
- **THEN** the error identifies a safe failure category without including the API key or authorization header

#### Scenario: Classification failure is recorded as activity
- **WHEN** an eligible bookmark's classification returns an unresolved failure category
- **THEN** filing activity records only that safe category and excludes provider response bodies and raw exception text
