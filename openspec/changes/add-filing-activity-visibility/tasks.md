# Tasks

## 1. Activity model and persistence

- [x] 1.1 Add a feature-owned, versioned filing-activity model with processing and exhaustive terminal outcome variants plus unknown-data parsing that rejects forbidden or malformed fields; verify feature tests cover every variant, malformed storage, and URL or secret exclusion.
- [x] 1.2 Add a Chrome local activity store under `infrastructure/storage/` with start, completion, load, clear, and change-observation operations, a 50-record newest-first limit, and serialized mutations; verify infrastructure tests cover persistence, update-without-duplication, trimming, independent clearing, overlapping writes, and empty or invalid stored data.

## 2. Workflow outcome publication

- [x] 2.1 Refine post-acceptance `FilingWorkflowResult` paths into explicit filed, unresolved, bookmark-changed, configuration-changed, destination-changed, and sanitized unexpected-failure outcomes while preserving pre-acceptance ineligibility; verify exhaustive workflow tests cover every return path and unchanged bookmark safety.
- [x] 2.2 Integrate the feature-owned activity port at the workflow boundary so accepted events are recorded before classification and the same bookmark ID receives exactly one terminal update; verify tests cover success, every classifier category, below-threshold results, each revalidation cancellation, thrown dependencies, and no activity for out-of-Inbox or invalid initial events.
- [x] 2.3 Wire one activity store through background composition without exposing Chrome storage in the feature layer; verify listener and integration tests show overlapping bookmark events retain independent activity and unexpected accepted-event failures are no longer silently discarded.

## 3. Recent activity options experience

- [x] 3.1 Add a focused options activity controller that loads, maps, observes, and clears validated activity independently of configuration; verify feature tests cover newest-first display state, every safe reason label, empty and error states, live updates, clear confirmation, and configuration preservation.
- [x] 3.2 Extend the options composition, HTML, TypeScript entrypoint, and CSS with an accessible Recent activity section and clear-history control; verify the production options entrypoint builds and manual UI checks show processing, success, unresolved, canceled, empty, and section-local error states without exposing URLs or raw errors.
- [x] 3.3 Document local activity retention, included and excluded data, clearing behavior, processing interruption, and the absence of notifications or retries in `README.md`; verify the documentation matches activity specs and UI wording.

## 4. Integrated verification

- [ ] 4.1 Extend the bookmark-filing integration test across configuration, activity storage, classification, movement, and options loading; verify one successful and representative unresolved bookmark produce accurate, privacy-bounded records without changing movement decisions.
- [ ] 4.2 Run `pnpm validate`, `pnpm build`, and OpenSpec strict validation; verify all checks pass and the generated manifest adds no permissions or host access.
- [ ] 4.3 Reload the production extension and manually exercise successful filing, low confidence, provider failure, and clear history; verify activity survives worker restart, remains capped and newest-first, and configuration and bookmarks are unaffected by clearing.
