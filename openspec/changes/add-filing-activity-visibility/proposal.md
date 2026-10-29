# Proposal

## Why

Automatic filing currently discards every workflow result and unexpected boundary failure, so users cannot tell whether a bookmark was filed, rejected for low confidence, blocked by configuration, or affected by an OpenAI or extension error. A local activity view is needed to make the extension's safe no-op behavior understandable and actionable.

## What Changes

- Record a bounded local history for bookmarks that are created directly in the configured Inbox and enter filing evaluation.
- Represent processing, successful filing, expected unresolved outcomes, configuration or destination invalidation, and sanitized unexpected failures as user-readable activity states.
- Show recent filing activity in the existing options page, newest first, including bookmark title, timestamp, outcome, and destination or safe reason when applicable.
- Exclude bookmark URLs, API keys, authorization headers, provider response bodies, and raw exception text from activity records.
- Allow the user to clear activity history without clearing filing configuration, and prevent overlapping background writes from restoring records that existed before the clear.
- Keep notifications, retries, and manual reclassification outside this change.

## Capabilities

### New Capabilities

- `filing-activity`: Persist and present privacy-bounded recent automatic-filing outcomes for user diagnosis.

### Modified Capabilities

- `automatic-bookmark-filing`: Report observable lifecycle outcomes for eligible Inbox bookmarks while preserving filing and safety semantics.
- `bookmark-classification`: Surface existing safe classification failure categories to filing activity without exposing credentials or raw provider details.

## Impact

- Extends the filing workflow result model and background listener boundary to publish activity.
- Adds a versioned or validated local activity store alongside the existing configuration store.
- Extends the options controller, composition, markup, styling, and tests with recent activity and clear-history behavior.
- Uses the existing `storage` permission and adds no host permissions, content scripts, browser notifications, or external services.
