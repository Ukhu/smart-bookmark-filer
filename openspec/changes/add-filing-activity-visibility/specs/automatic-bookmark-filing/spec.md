# Spec Delta

## ADDED Requirements

### Requirement: Observable eligible-bookmark lifecycle
The system SHALL publish a processing state and one terminal activity outcome for every URL bookmark created directly in the configured Inbox that enters filing evaluation.

#### Scenario: Eligible event is accepted
- **WHEN** a new URL bookmark in the configured Inbox passes initial configuration and folder validation
- **THEN** the system publishes a processing activity before requesting classification

#### Scenario: Eligible event is filed
- **WHEN** the workflow moves an eligible bookmark to a destination
- **THEN** the system publishes a successful terminal outcome for that bookmark ID

#### Scenario: Eligible event remains unresolved
- **WHEN** the workflow leaves an eligible bookmark unchanged because classification is unresolved or below threshold
- **THEN** the system publishes the corresponding unresolved terminal outcome for that bookmark ID

#### Scenario: Movement is canceled after classification
- **WHEN** revalidation prevents movement because the bookmark, configuration, or destination changed
- **THEN** the system publishes a canceled terminal outcome for that bookmark ID

#### Scenario: Event is outside the configured Inbox
- **WHEN** a bookmark is created outside the configured Inbox
- **THEN** the system creates no filing activity for that event

#### Scenario: Unexpected boundary failure
- **WHEN** processing an accepted event rejects unexpectedly
- **THEN** the system publishes a sanitized failure outcome instead of discarding the failure
