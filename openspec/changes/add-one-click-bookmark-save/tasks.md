# Tasks

## 1. Bookmark capture policy

- [ ] 1.1 Add a feature-owned active-page capture model, closed result variants, and narrow ports for configuration, folder snapshots, exact-URL lookup, and Inbox creation; verify feature tests cover accepted capture, URL fallback title, unavailable pages, missing configuration, stale folders, invalid boundaries, and sanitized dependency failures.
- [ ] 1.2 Serialize the exact-URL lookup and create critical section so extension-owned overlapping requests produce at most one bookmark while preserving all existing matches; verify feature tests cover same-URL overlap, distinct URL requests, profile-wide matches, and path, query, or fragment differences.

## 2. Chrome action boundaries

- [ ] 2.1 Add Chrome bookmark capture operations for verbatim URL search and parent-targeted creation without exposing browser types to the feature layer; verify infrastructure tests cover exact matches, empty results, creation inputs, and rejected API calls.
- [ ] 2.2 Add action-click adaptation that safely maps the clicked tab into capture input and maps closed outcomes into accepted, already-bookmarked, setup-unavailable, or failed presentation; verify listener tests cover missing URL/title/tab ID, concurrent clicks, and rejection containment.
- [ ] 2.3 Add per-tab action feedback with accessible titles, brief badges, defensive clearing, and options-page opening only for setup-unavailable outcomes; verify infrastructure tests cover every outcome, safe text, cleanup, repeated feedback, and absence of raw errors, URLs, or credentials.

## 3. Background integration and user guidance

- [ ] 3.1 Compose one capture controller and feedback boundary in the background entrypoint, register `action.onClicked` alongside `bookmarks.onCreated`, and declare an action plus only the `activeTab` permission; verify the production build manifest contains the action and expected permissions without a popup, broad host access, persistent `tabs`, commands, context menus, or notifications.
- [ ] 3.2 Extend the bookmark-filing integration test so an action-created Inbox bookmark emits the existing creation event and causes exactly one classification path, while duplicate and setup-failure attempts cause no creation or classification; verify accepted, filed, unresolved, duplicate, invalid-setup, and overlapping-click cases pass without calling the workflow directly from capture.
- [ ] 3.3 Document one-click save, action pinning, exact-URL duplicate behavior, setup redirection, badge meaning, restricted-page failures, and the unchanged Chrome star/Ctrl+D behavior in `README.md`; verify the documented interaction and privacy claims match the capture and filing specifications.

## 4. Integrated verification

- [ ] 4.1 Run `pnpm validate`, `pnpm build`, and `openspec validate add-one-click-bookmark-save --strict`; verify all automated checks pass and generated artifacts contain no unexpected permissions or host access.
- [ ] 4.2 Load the production extension and manually exercise accepted capture, an exact duplicate, similar non-exact URLs, rapid repeated clicks, missing or stale setup, a restricted page, provider failure after acceptance, badge clearing, and Options redirection; verify at most one bookmark and classification request are produced per exact action URL and Recent Activity remains the filing-outcome source.
