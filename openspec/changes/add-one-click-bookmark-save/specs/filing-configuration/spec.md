# Spec Delta

## ADDED Requirements

### Requirement: Action capture readiness
The system SHALL create an action-requested bookmark only when the complete filing configuration exists, every configured folder exists, and the Inbox and destination boundaries remain valid.

#### Scenario: Filing setup is ready
- **WHEN** the user invokes the capture action with a complete configuration, resolvable configured folders, and valid source-destination boundaries
- **THEN** the system may continue duplicate detection and active-page capture

#### Scenario: Filing configuration is missing or incomplete
- **WHEN** the user invokes the capture action while the complete filing configuration is unavailable
- **THEN** the system creates no bookmark, reports a setup failure, and opens the options page

#### Scenario: Configured folder is stale
- **WHEN** the user invokes the capture action after the configured Inbox or any destination root was deleted
- **THEN** the system creates no bookmark, reports a setup failure, and opens the options page

#### Scenario: Configured boundaries are invalid
- **WHEN** the user invokes the capture action while the Inbox and a destination-root subtree overlap
- **THEN** the system creates no bookmark, reports a setup failure, and opens the options page

#### Scenario: Provider later rejects classification
- **WHEN** local filing setup is ready but classification later encounters a provider, network, timeout, or validation failure
- **THEN** the accepted bookmark remains in the Inbox and its filing outcome follows the automatic-filing and activity requirements
