# filing-configuration Specification

## Purpose

Provide a local options experience for defining where filing starts, where bookmarks may be placed, and how OpenAI classification is authorized and accepted.

## Requirements

### Requirement: Complete filing configuration
The system SHALL let the user configure one Inbox folder, one or more destination-root folders, an OpenAI API key, an OpenAI model, and a confidence threshold from 0 through 1 inclusive.

#### Scenario: Save valid configuration
- **WHEN** the user selects an existing Inbox, selects one or more destination roots outside the Inbox subtree, supplies an API key and model, enters a threshold within the allowed range, and saves
- **THEN** the system persists the complete configuration and confirms that it is ready for automatic filing

#### Scenario: Reject incomplete configuration
- **WHEN** the user attempts to save without an Inbox, destination root, API key, model, or valid confidence threshold
- **THEN** the system identifies the invalid fields and does not replace the last valid configuration

### Requirement: Separate source and destination boundaries
The system SHALL reject a configuration when the Inbox subtree overlaps a selected destination-root subtree.

#### Scenario: Inbox selected as a destination
- **WHEN** the user selects the Inbox itself as a destination root
- **THEN** the system rejects the configuration and explains that the source and destination folders must be separate

#### Scenario: Nested source and destination
- **WHEN** the selected Inbox is an ancestor or descendant of a selected destination root
- **THEN** the system rejects the configuration and preserves the last valid configuration

### Requirement: Multiple destination roots
The system SHALL allow multiple destination roots and SHALL treat each selected root and every folder below it as an eligible filing destination.

#### Scenario: Select roots from separate categories
- **WHEN** the user selects Engineering, Finance, and Personal Development as destination roots
- **THEN** the saved configuration includes all three roots and their descendant folders are available for classification

#### Scenario: Avoid duplicate candidate folders
- **WHEN** selected destination roots overlap because one selected root contains another selected root
- **THEN** the system presents each eligible folder only once while retaining its full contextual path

### Requirement: Local settings persistence
The system SHALL store filing configuration locally in the user's Chrome profile and SHALL restore it when the options page or background worker starts.

#### Scenario: Reopen options
- **WHEN** the user reopens the options page after saving configuration
- **THEN** the system displays the previously saved Inbox, destination roots, model, and confidence threshold

#### Scenario: API key presentation
- **WHEN** a stored API key is present and the options page is opened
- **THEN** the system does not display the key as unmasked plain text

#### Scenario: Clear API key
- **WHEN** the user explicitly clears the saved API key
- **THEN** the system removes it from local extension storage and automatic filing remains inactive until a valid key is saved

### Requirement: Stale folder configuration
The system SHALL detect configured folder IDs that no longer exist and SHALL prevent automatic filing until the affected selections are corrected.

#### Scenario: Configured Inbox was deleted
- **WHEN** the stored Inbox folder can no longer be found
- **THEN** the options page identifies the stale Inbox and the background worker does not classify new bookmarks

#### Scenario: Destination root was deleted
- **WHEN** one stored destination root can no longer be found
- **THEN** the options page identifies the stale destination and the background worker does not file bookmarks using a partial destination set

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
