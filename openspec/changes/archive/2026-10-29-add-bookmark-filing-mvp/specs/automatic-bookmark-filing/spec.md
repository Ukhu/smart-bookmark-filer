# Spec Delta

## Purpose

Observe new bookmarks in a designated Inbox and move only trustworthy classifications without disturbing manually filed or unresolved bookmarks.

## ADDED Requirements

### Requirement: Inbox-only bookmark detection
The system SHALL consider a newly created node for automatic filing only when it is a URL bookmark whose immediate parent is the configured Inbox and the filing configuration is valid.

#### Scenario: URL bookmark created in Inbox
- **WHEN** a URL bookmark is created directly inside the configured Inbox with a valid filing configuration
- **THEN** the system submits that bookmark for classification

#### Scenario: Bookmark created elsewhere
- **WHEN** a bookmark is created outside the configured Inbox
- **THEN** the system takes no classification or movement action

#### Scenario: Folder created in Inbox
- **WHEN** a folder or other node without a URL is created in the configured Inbox
- **THEN** the system ignores the node

#### Scenario: Filing is not configured
- **WHEN** a bookmark is created in the Inbox while configuration is missing or stale
- **THEN** the system leaves the bookmark unchanged and does not contact OpenAI

### Requirement: Confidence-gated movement
The system SHALL move an eligible bookmark only when classification returns a currently valid destination with confidence equal to or greater than the configured threshold.

#### Scenario: Classification meets threshold
- **WHEN** classification selects an eligible destination with confidence equal to or greater than the threshold and the bookmark remains in the Inbox
- **THEN** the system moves the bookmark to the selected folder

#### Scenario: Classification is below threshold
- **WHEN** a valid classification has confidence below the configured threshold
- **THEN** the system leaves the bookmark in the Inbox

### Requirement: Preserve unresolved bookmarks
The system SHALL leave the bookmark in the Inbox when classification cannot safely produce an accepted destination.

#### Scenario: Classification fails
- **WHEN** classification ends in a provider, network, timeout, or validation failure
- **THEN** the bookmark remains unchanged in the Inbox

#### Scenario: No eligible destinations
- **WHEN** the destination folders cannot be resolved or the candidate set is empty
- **THEN** the bookmark remains unchanged and no move is attempted

### Requirement: Respect changes during classification
The system SHALL revalidate both the bookmark and selected destination immediately before moving so asynchronous classification does not override intervening user or bookmark-tree changes.

#### Scenario: User manually moves the bookmark
- **WHEN** the bookmark leaves the Inbox before classification completes
- **THEN** the system does not move it again

#### Scenario: Bookmark is deleted
- **WHEN** the bookmark is deleted before classification completes
- **THEN** the system ends processing without recreating it or moving another bookmark

#### Scenario: Destination becomes unavailable
- **WHEN** the selected destination is deleted or leaves the configured destination roots before movement
- **THEN** the system leaves the bookmark in the Inbox

### Requirement: Independent event processing
The system SHALL process each eligible bookmark by its stable bookmark ID so one bookmark's outcome does not move or modify another bookmark.

#### Scenario: Multiple bookmarks are created close together
- **WHEN** multiple eligible bookmarks are created before earlier classifications finish
- **THEN** each classification result is applied only to the bookmark that initiated its request
