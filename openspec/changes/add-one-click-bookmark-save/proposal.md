# Proposal

## Why

Chrome chooses the most recently modified bookmark folder for newly created bookmarks, so automatic filing can make a destination folder replace the configured Inbox as Chrome's next default. A dedicated extension action is needed to give users a deterministic one-click path that creates the current page directly in the Inbox without relying on Chrome's mutable default.

## What Changes

- Add an immediate toolbar action that saves the active page directly into the configured Inbox without opening a popup.
- Require a complete, currently valid filing configuration before creating a bookmark; otherwise create nothing, show failure feedback, and open the options page.
- Prevent creation when an exact-URL bookmark already exists anywhere in the profile, without moving or modifying existing bookmarks.
- Serialize overlapping action requests so repeated clicks do not create duplicate bookmarks or duplicate paid classification requests.
- Show brief action feedback for accepted, already-bookmarked, and failed requests while leaving the eventual classification result to Recent Activity.
- Preserve the existing Inbox `onCreated` workflow as the single classification and filing entry point after the action creates a bookmark.

## Capabilities

### New Capabilities

- `bookmark-capture`: Explicitly capture the active page into the configured Inbox through a safe, duplicate-aware extension action.

### Modified Capabilities

- `filing-configuration`: Define action behavior when the stored filing configuration or configured folder boundaries are not currently valid.

## Impact

- Adds an extension action and the narrowly scoped `activeTab` permission to the generated Chrome manifest.
- Extends background composition and bookmark infrastructure with action-event handling, exact-URL lookup, bookmark creation, readiness validation, serialized requests, and action feedback.
- Adds feature and infrastructure tests for capture outcomes, duplicate prevention, concurrency, invalid configuration, restricted tabs, and integration with the existing `onCreated` filing workflow.
- Updates user documentation for the explicit save interaction and clarifies that Chrome's native star and Ctrl+D behavior remain unchanged.
