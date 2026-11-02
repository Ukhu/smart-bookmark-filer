# filing-activity Specification

## Purpose

Provide a privacy-bounded local record of recent automatic-filing outcomes so users can understand whether each eligible bookmark was filed or why it remained in the Inbox.

## Requirements

### Requirement: Recent filing activity persistence
The system SHALL keep at most 50 recent activity records in local extension storage and restore them after the background worker, options page, or browser restarts.

#### Scenario: Eligible bookmark starts processing
- **WHEN** a URL bookmark created directly in the configured Inbox enters automatic filing evaluation
- **THEN** the system records that the bookmark is processing

#### Scenario: Processing reaches a terminal outcome
- **WHEN** filing evaluation completes for a recorded bookmark
- **THEN** the system updates that bookmark's activity to one terminal outcome without creating a duplicate history item

#### Scenario: History exceeds its limit
- **WHEN** storing an activity record would retain more than 50 records
- **THEN** the system removes the oldest records until 50 remain

### Requirement: Understandable activity outcomes
The system SHALL present successful filing, expected unresolved outcomes, intervening state changes, and unexpected extension failures as distinct, user-readable activity outcomes.

#### Scenario: Bookmark is filed
- **WHEN** automatic filing moves a bookmark successfully
- **THEN** its activity identifies the destination folder and accepted confidence

#### Scenario: Classification is unresolved
- **WHEN** filing leaves a bookmark in the Inbox because classification is below threshold or ends in a safe failure category
- **THEN** its activity explains the applicable safe reason

#### Scenario: Filing state changes during processing
- **WHEN** movement is canceled because the bookmark, configuration, or destination changed
- **THEN** its activity identifies the applicable cancellation category without claiming that filing succeeded

#### Scenario: Unexpected processing failure
- **WHEN** automatic filing ends because of an unexpected extension error
- **THEN** its activity reports a sanitized extension failure without raw exception text

### Requirement: Privacy-bounded activity data
The system SHALL store only the bookmark ID, bookmark title, timestamps, lifecycle outcome, safe reason, confidence, and destination folder identity needed for recent activity.

#### Scenario: Activity is stored
- **WHEN** the system creates or updates a filing activity record
- **THEN** the record excludes bookmark URLs, API keys, authorization headers, provider response bodies, and raw exception text

#### Scenario: Bookmark title is displayed
- **WHEN** the user reviews activity for an identifiable bookmark
- **THEN** the options page may show its locally stored title without displaying or retaining its URL

### Requirement: Recent activity presentation
The system SHALL show recent filing activity in the options page in newest-first order with clear empty, processing, success, and unresolved states.

#### Scenario: Activity history exists
- **WHEN** the user opens the options page with stored activity
- **THEN** the page shows each record's bookmark title, time, outcome, and available safe destination or reason details

#### Scenario: No activity exists
- **WHEN** the user opens the options page without stored activity
- **THEN** the page explains that no eligible bookmarks have been processed yet

### Requirement: Independent history clearing
The system SHALL let the user clear filing activity without modifying filing configuration or bookmarks, and SHALL NOT restore records that existed before the confirmed clear when background activity writes overlap it.

#### Scenario: User clears activity
- **WHEN** the user confirms the clear-activity action
- **THEN** all activity records are removed while configuration, credentials, and bookmarks remain unchanged

#### Scenario: Clear overlaps in-flight filing completions
- **WHEN** the user confirms the clear-activity action while one or more filing completions are pending
- **THEN** activity records that existed before the clear remain removed
- **AND** terminal outcomes completed after the clear may create new records only for their corresponding in-flight bookmarks
