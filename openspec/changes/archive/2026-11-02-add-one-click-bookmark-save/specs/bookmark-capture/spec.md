# Spec Delta

## Purpose

Provide an explicit, deterministic way to save the active page into the configured Inbox without depending on Chrome's remembered bookmark folder.

## ADDED Requirements

### Requirement: Immediate active-page capture
The system SHALL expose an extension action that creates the active page as a URL bookmark directly in the configured Inbox without opening a popup.

#### Scenario: Capture a bookmarkable active page
- **WHEN** the user invokes the action on a page with an available URL and title while filing is ready
- **THEN** the system creates one bookmark in the configured Inbox using that URL and title

#### Scenario: Capture a page without a title
- **WHEN** the user invokes the action on a bookmarkable page whose title is unavailable or empty while filing is ready
- **THEN** the system creates the Inbox bookmark with a safe fallback title derived from the page URL

#### Scenario: Active page is unavailable
- **WHEN** the user invokes the action on a restricted or otherwise unavailable page whose URL cannot be accessed
- **THEN** the system creates no bookmark and reports that the capture failed

### Requirement: Exact-URL duplicate prevention
The system SHALL create no bookmark when any existing profile bookmark has a URL exactly equal to the active page URL, and SHALL NOT move or modify existing bookmarks while checking.

#### Scenario: Exact URL already exists outside the Inbox
- **WHEN** the user invokes the action and the exact active page URL is already bookmarked in any folder
- **THEN** the system creates no bookmark, preserves the existing bookmark, and reports that the page is already bookmarked

#### Scenario: Similar URL is not exact
- **WHEN** the user invokes the action and existing bookmarks differ from the active page URL by path, query, or fragment
- **THEN** those bookmarks do not prevent capture of the active page URL

#### Scenario: Capture requests overlap
- **WHEN** multiple action requests for the same previously unbookmarked URL overlap
- **THEN** the system completes at most one bookmark creation and reports the later request as already bookmarked

### Requirement: Capture outcome feedback
The system SHALL provide brief action feedback that distinguishes accepted capture, an already-bookmarked page, and capture failure without claiming that asynchronous classification has succeeded.

#### Scenario: Bookmark is accepted into the Inbox
- **WHEN** the action successfully creates the active page in the Inbox
- **THEN** the action reports that capture was accepted while Recent Activity remains the source of the eventual filing outcome

#### Scenario: Duplicate is detected
- **WHEN** capture is prevented because the exact URL is already bookmarked
- **THEN** the action reports an already-bookmarked outcome

#### Scenario: Capture fails
- **WHEN** capture cannot create a bookmark for a reason other than an existing exact URL
- **THEN** the action reports a failure without exposing raw exception text or credentials

### Requirement: Existing filing workflow handoff
The system SHALL submit a bookmark created by the extension action to the existing Inbox-created bookmark workflow rather than invoking classification through a separate path.

#### Scenario: Action creates an Inbox bookmark
- **WHEN** the action creates a URL bookmark directly in the configured Inbox
- **THEN** the normal bookmark-created handling evaluates that bookmark for classification and filing

#### Scenario: Action does not create a bookmark
- **WHEN** action capture is rejected as unavailable, not ready, already bookmarked, or failed
- **THEN** the action starts no classification request for that capture attempt
