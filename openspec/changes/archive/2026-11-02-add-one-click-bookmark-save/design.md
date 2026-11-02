# Design

## Context

See `proposal.md` for motivation. The Manifest V3 background entrypoint currently registers only `bookmarks.onCreated`; that event passes new nodes to `FilingWorkflow`, which accepts URL bookmarks created directly in the configured Inbox. Configuration parsing is centralized in the Chrome local configuration store, while live folder existence and source-destination boundaries are checked from a bookmark-tree snapshot.

Chrome exposes the clicked tab to an extension action under the temporary `activeTab` permission, but the bookmarks API has no default-folder setting or atomic create-if-absent operation. Action events and bookmark events can overlap within one background worker, and eventual classification remains asynchronous after bookmark creation.

## Goals / Non-Goals

**Goals:**

- Keep active-page capture separate from classification while reusing the existing `onCreated` workflow as the only automatic-filing trigger.
- Keep browser APIs behind feature-owned ports so readiness, duplicate, concurrency, and outcome behavior can be tested without Chrome.
- Use the minimum additional browser permission and sanitize all action-facing failures.
- Make repeated action requests within the extension produce at most one bookmark for an exact URL.

**Non-Goals:**

- Override Chrome's star, Ctrl+D, remembered folder, or other native bookmark creation paths.
- Add a popup, title editor, keyboard command, context menu, notification, retry, or manual reclassification flow.
- Deduplicate or reorganize bookmarks that already exist, or guarantee uniqueness against simultaneous writes by Chrome sync, users, or other extensions.
- Treat successful capture feedback as proof that classification or filing succeeded.

## Decisions

### Add a feature-owned capture controller and narrow browser ports

Introduce a capture controller that receives an immutable active-page input and coordinates configuration loading, folder validation, exact-URL lookup, and Inbox creation. Its result is a closed outcome such as accepted, already bookmarked, setup unavailable, page unavailable, or sanitized failure. Ports will cover configuration reading, folder snapshots, exact-URL search, and bookmark creation; Chrome adapters and action feedback remain infrastructure concerns.

This follows the existing feature/infrastructure/composition boundaries and keeps `browser.action`, `browser.tabs.Tab`, and raw Chrome errors out of domain logic. Putting the sequence directly in `entrypoints/background.ts` was rejected because it would make safety and concurrency behavior difficult to test and would mix browser event wiring with policy.

### Register a direct action click with temporary active-tab access

Declare an action with a descriptive default title and add only `activeTab` to the existing permissions. Register `action.onClicked` in the background entrypoint without a popup; the click-provided tab supplies its URL, title, and tab ID. Missing or inaccessible URLs are rejected before bookmark access.

Using persistent `tabs` or broad host permissions was rejected because capture needs tab metadata only after an explicit user gesture. A popup was rejected because immediate one-click capture is the intended interaction.

### Validate setup before duplicate lookup or creation

For each accepted tab input, load the parsed configuration and a fresh bookmark-tree snapshot. Require the complete configuration to load, all configured folder IDs to resolve, and source-destination boundaries to remain valid. A setup failure returns without searching or creating and asks the browser-facing listener to open the existing options page.

This duplicates no configuration parsing and reuses the existing public boundary-validation rules. Saving into a known Inbox while other filing settings are stale was rejected because it would create a bookmark that cannot enter the promised filing workflow and may produce no activity explanation.

Provider availability is not part of local readiness: no network probe is added. A provider failure after capture remains an ordinary unresolved filing outcome and leaves the bookmark in Inbox.

### Serialize the duplicate-check and create critical section

Run action capture requests through one in-memory promise chain in the background worker. Within the serialized section, use exact URL search across the profile and create only when no matching bookmark exists. Later overlapping action requests observe the bookmark created by the first request and return already bookmarked.

A URL-keyed in-flight set alone was rejected because it would need separate treatment for different URLs and would not protect the search/create interval after the first promise settles incorrectly. A single queue is simple and appropriate for explicit, low-volume user actions.

Chrome provides no uniqueness transaction, so this guarantee applies to requests coordinated by this extension. A user, sync operation, or another extension can still create the same URL between search and creation; existing duplicates are always preserved rather than deleted or merged.

### Create in Inbox and rely on `bookmarks.onCreated`

Create the bookmark with the validated Inbox parent ID, active tab URL, and title. Use the URL as a fallback when the tab title is empty. Do not invoke `FilingWorkflow` from the action path. Chrome's resulting `bookmarks.onCreated` event enters the existing listener, which applies current eligibility, classification, movement, and activity behavior exactly once.

Directly calling the workflow after creation was rejected because the same node would also emit `onCreated`, risking duplicate classification and paid requests. Suppressing the event and adding a separate classification path was rejected because it would split filing semantics and revalidation.

### Keep immediate feedback separate from filing activity

Map controller outcomes to brief per-tab action badge text, color, and accessible action title, then clear temporary feedback after a short interval. Accepted means only that Chrome created the bookmark in Inbox. Already-bookmarked and failure outcomes create no activity because no bookmark entered filing evaluation. Setup-unavailable additionally opens the options page. Unexpected errors are collapsed to a safe failure outcome; raw error text, URLs, and credentials are not displayed or persisted as feedback.

Browser notifications were rejected as disproportionate for a direct click. Reusing Recent Activity for capture failures was rejected because that store intentionally records only bookmarks that enter filing evaluation.

## Risks / Trade-offs

- **[Chrome has no atomic exact-URL create]** -> Serialize all action requests owned by this worker, document that external concurrent writers can still create duplicates, and never delete existing nodes automatically.
- **[Configuration or folders can change after readiness validation]** -> Use fresh state immediately before duplicate lookup and creation; treat create rejection safely, while the existing workflow independently revalidates state before classification and movement.
- **[The service worker may stop after bookmark creation]** -> Let the existing event-driven workflow and persistent processing activity describe interruption; action success promises only Inbox creation.
- **[Temporary badge state can outlive its intended interval if cleanup is interrupted]** -> Set feedback per tab and clear it defensively on later action handling; never encode authoritative filing state in the badge.
- **[The action may not be pinned]** -> Keep it available from Chrome's extension menu and document how to pin it for true one-click toolbar access.
- **[Exact matching treats path, query, and fragment differences as distinct]** -> Follow the agreed exact-URL contract and Chrome's verbatim URL search rather than introducing surprising normalization.

## Migration Plan

1. Add the action manifest declaration and `activeTab` permission; existing local configuration and activity data require no migration.
2. Register capture and feedback handling alongside the existing bookmark-created listener.
3. Verify the generated manifest, local readiness failures, duplicate behavior, overlapping clicks, and end-to-end action-to-activity flow in a production build.
4. Roll back by removing the action declaration, permission, listener, and capture components. Bookmarks already created through the action remain ordinary user bookmarks and require no cleanup.
