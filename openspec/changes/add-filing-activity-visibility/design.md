# Design

## Context

See `proposal.md` and the capability deltas for motivation and observable behavior. `FilingWorkflow` already returns discriminated outcomes for filed, unresolved, and generic ineligible cases, but `registerBookmarkCreatedListener` discards fulfilled results and catches rejected promises without reporting them. Some post-classification cancellation paths also collapse into `ineligible`, so they cannot yet support an accurate explanation. Configuration and the API key already use `chrome.storage.local`; the options page is the only existing extension UI.

Manifest V3 workers can stop between events, and bookmark events can overlap. Activity persistence must therefore be bounded, validated as unknown data, and safe against overlapping read-modify-write operations. Activity is diagnostic data and must not become another route for retaining bookmark URLs or provider details.

## Goals / Non-Goals

**Goals:**

- Give each accepted Inbox bookmark one stable activity record that moves from processing to a terminal outcome.
- Preserve useful distinctions across filing success, classification failures, low confidence, and revalidation cancellation.
- Keep records local, bounded, validated, privacy-minimized, and visible from the existing options page.
- Keep concurrent bookmark processing from losing or cross-associating records.

**Non-Goals:**

- Record bookmarks created outside the configured Inbox or maintain a general extension debug log.
- Persist URLs, request or response bodies, raw exceptions, credentials, or authorization data.
- Add browser notifications, an action popup, retries, queues, reclassification, analytics, or remote telemetry.
- Validate configured OpenAI credentials or model availability when settings are saved.

## Decisions

### Use a feature-owned activity model and storage port

Add a filing-activity model with a schema version, bookmark ID and title, created and updated timestamps, and a discriminated lifecycle state. Terminal variants will cover filed, unresolved classification category, below threshold, canceled because bookmark/configuration/destination changed, and unexpected extension failure. Optional confidence and destination identity appear only on outcomes that can safely supply them.

The feature layer will own interfaces for starting, completing, loading, clearing, and observing activity. A Chrome local-storage adapter will parse unknown persisted values and enforce the 50-record bound. This follows the existing configuration boundary and avoids coupling workflow code to Chrome APIs.

A console-only logger was rejected because it is transient and developer-oriented. Reusing the configuration object was rejected because activity has different lifecycle, privacy, and clearing semantics.

### Record only after initial eligibility and candidate validation

The workflow will create a processing record after confirming a URL bookmark is directly in the configured Inbox, the configuration folders and boundaries are valid, and at least one candidate exists, but before classification begins. Events outside that boundary remain unrecorded to avoid turning activity into a log of unrelated bookmark creation.

From that point, every expected return path will complete the same record. Post-classification generic `ineligible` returns will be replaced with explicit cancellation reasons. The workflow will also catch unexpected failures after activity starts, write a sanitized terminal failure, and preserve the current safety property that the bookmark is not moved by failed processing.

Starting activity at listener receipt was rejected because it would retain titles for every Chrome bookmark event and fill history with irrelevant entries. Recording only terminal results was rejected because users would still lack evidence that a request is in progress or was interrupted.

### Update one record by stable bookmark ID

The Chrome bookmark ID is the activity identity for one creation event. Starting processing inserts or replaces that ID, and terminal completion updates it rather than appending another item. Records are ordered by `updatedAt` newest first, and trimming removes the oldest updated records beyond 50.

The storage adapter will serialize mutations through an in-memory promise chain before each read-modify-write operation. This prevents overlapping classifications in one worker instance from overwriting each other's records. Durable cross-context transactions are unavailable in `chrome.storage.local`; only the background workflow mutates normal outcomes, while clear-history is an explicit user action whose result may intentionally win.

### Store privacy-minimized display snapshots

Activity will retain the bookmark title for identification and a destination folder ID and contextual path for successful filing. It will not retain the URL. Safe reason values will be closed enums translated to user-facing text by the options feature; raw exception messages and provider payloads never enter the record.

Resolving destination names only when rendering was rejected because folders can later be renamed or deleted, making historical outcomes misleading or unavailable. Storing the contextual path captures what the user was told at filing time without retaining unrelated bookmark-tree data.

### Add a separate activity controller to the options composition

A focused options activity controller will load validated records and clear them without expanding configuration save semantics. The options entrypoint will render a Recent activity section with accessible status text, newest-first items, an empty state, and a clear button. It will subscribe to changes for the activity storage key so an open options page reflects processing and terminal updates.

Activity rendering failures will show a local section error without preventing the configuration form from loading or saving. Clear history will require an explicit confirmation and will not touch the configuration storage key.

Combining configuration and activity into one controller was rejected because partial activity failures should not disable settings and the two stores have independent commands.

## Risks / Trade-offs

- **[Bookmark titles may contain sensitive text]** -> Retain only 50 local records, never retain URLs, document the local history, and provide independent clearing.
- **[A worker may terminate after writing processing but before terminal state]** -> Preserve the processing record as evidence of interruption; a later options view can describe it as incomplete rather than falsely successful.
- **[Concurrent updates can lose records]** -> Serialize adapter mutations and cover overlapping start/complete operations with tests.
- **[Clear history can race with an in-flight classification]** -> Define clear as removing current history; a later terminal result for already-running work may create a new record, and explain this behavior in UI documentation.
- **[More detailed result variants increase workflow branching]** -> Use discriminated unions and exhaustive mapping tests so every accepted outcome has one safe activity representation.
- **[Destination paths become historical snapshots]** -> Label them as the destination used at the recorded time rather than resolving them as current folder state.

## Migration Plan

1. Introduce the validated activity schema and empty-default store without changing existing configuration data.
2. Add workflow publication and explicit terminal mappings, then add options-page loading, live updates, and clearing.
3. Build and reload the extension; exercise successful, low-confidence, provider-failure, and unexpected-failure paths and inspect the stored record for forbidden fields.

Existing installations begin with empty activity because the new storage key is absent. Rollback removes activity publication and UI while leaving the independent activity key harmless; it may be removed explicitly without affecting configuration or bookmarks.
