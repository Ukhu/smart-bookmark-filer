# Tasks

## 1. Prerequisite and Extension Surface

- [x] 1.1 Confirm `setup-project-foundation` has been implemented and its validation command passes before changing product code; verify the WXT background scaffold, TypeScript checks, and Vitest harness are available.
- [x] 1.2 Configure the generated manifest with `bookmarks` and `storage` permissions plus host access limited to the OpenAI API, and verify a production build contains those permissions without content-script, active-tab, or broad host access.
- [x] 1.3 Establish the bookmark-filing feature and infrastructure module boundaries from the design without adding empty placeholder directories, and verify imports compile without entrypoints depending directly on OpenAI or storage implementation details.

## 2. Configuration and Options Experience

- [x] 2.1 Implement the versioned filing-configuration model, unknown-data parser, field validation, and source/destination overlap validation with unit tests covering valid, incomplete, out-of-range, malformed, and overlapping configurations.
- [x] 2.2 Implement Chrome local-storage access that preserves the last valid object, supports explicit API-key replacement and clearing, and never returns malformed settings as usable; verify with mocked Chrome storage tests including reload and stale-data cases.
- [x] 2.3 Implement the Chrome bookmark-tree adapter needed to enumerate folders, resolve IDs, determine ancestry, and identify stale selections; verify unit tests cover nested trees, missing folders, duplicate names, and root/Inbox relationships.
- [x] 2.4 Add a framework-free WXT options entrypoint that selects one Inbox and multiple destination roots, edits model and confidence settings, masks configured-key state, and reports validation or stale-folder errors; verify the options entrypoint builds and its extracted state/validation logic passes tests for save, preserve-key, replace-key, and clear-key flows.
- [x] 2.5 Document local configuration, the non-synchronized API-key storage limitation, and folder-boundary rules in the README; verify the instructions match the implemented options controls and do not suggest committing a key.

## 3. Repository Conventions and Enforcement

- [ ] 3.1 Create root `AGENTS.md` with repository-wide guidance that project-owned TypeScript filenames use camelCase, tests remain outside production directories under `features/tests/<feature>/` or `infrastructure/tests/<area>/`, and tool-required filenames such as WXT entrypoint names are exceptions; verify the file states each rule unambiguously.
- [ ] 3.2 Add equivalent OpenSpec apply guidance to `openspec/config.yaml`; verify the apply instructions match `AGENTS.md` without introducing contradictory naming, test-location, or exception rules.
- [ ] 3.3 Rename existing kebab-case project-owned TypeScript files to camelCase and update all affected imports while preserving tool-required filenames; verify repository search finds no disallowed TypeScript filenames and `pnpm typecheck` passes.
- [ ] 3.4 Move existing tests out of production directories while preserving module grouping under `features/tests/<feature>/` and `infrastructure/tests/<area>/`, updating imports and test discovery as needed; verify no test files remain colocated and `pnpm test` discovers and passes the moved tests.
- [ ] 3.5 Expand formatting coverage to all relevant project source and test paths, add automated filename and test-location enforcement, and include the checks in repository validation; verify formatting checks pass and the enforcement detects representative invalid filename and colocated-test cases.
- [ ] 3.6 Run the complete validation suite after repository normalization and verify formatting, linting, type checking, tests, and convention enforcement all pass before continuing feature implementation.

## 4. Candidate Construction and OpenAI Classification

- [ ] 4.1 Implement live destination-candidate construction from selected roots with contextual paths, inclusion of selected roots, recursive descendants, and ID-based deduplication; verify unit tests cover overlapping roots, duplicate folder names, empty trees, and stale roots.
- [ ] 4.2 Define the classification port and discriminated success/unresolved result types so feature code has no OpenAI-specific response dependency; verify TypeScript exhaustiveness checks and unit tests cover every unresolved category used by the workflow.
- [ ] 4.3 Implement the direct OpenAI Responses API adapter using `fetch`, a finite timeout, the configured model and key, and strict structured output for folder ID and confidence; verify mocked-fetch tests inspect that requests contain only title, URL, candidate IDs/paths, and classification instructions.
- [ ] 4.4 Validate response shape, candidate membership, finite confidence bounds, and safe error mapping while redacting credentials from all errors; verify tests cover valid output, invented folders, malformed JSON/schema data, missing credentials, authorization errors, rate limits, provider errors, network failures, and timeouts.
- [ ] 4.5 Document exactly which bookmark data is sent to OpenAI, which data is excluded, and the cost/privacy implications of direct personal API use; verify the documentation agrees with request-contract tests.

## 5. Automatic Filing Workflow

- [ ] 5.1 Implement the filing workflow's initial eligibility checks for URL bookmarks created directly in a valid configured Inbox; verify unit tests prove bookmarks elsewhere, non-URL nodes, and incomplete or stale configurations do not invoke classification.
- [ ] 5.2 Implement confidence-gated outcomes so valid results at or above the threshold proceed and low-confidence or unresolved results leave the bookmark untouched; verify boundary tests cover confidence below, equal to, and above the threshold plus every classifier failure category.
- [ ] 5.3 Implement fresh bookmark, configuration, and destination revalidation immediately before movement; verify tests cover successful movement, manual movement during classification, bookmark deletion, changed configuration, deleted destinations, and destinations that leave the allowed roots.
- [ ] 5.4 Register the Chrome bookmark-created listener in the WXT background entrypoint and create independent request context per bookmark ID; verify mocked event tests show overlapping classifications can complete in either order without moving the wrong bookmark.
- [ ] 5.5 Document Inbox-only behavior, unresolved-bookmark handling, lack of automatic retries, and the risk of bulk additions triggering paid requests; verify the README description matches workflow tests.

## 6. Integration Verification

- [ ] 6.1 Run the complete validation suite and production build, then verify generated artifacts contain the background and options entrypoints, expected permissions, and no API key, page-content access, content scripts, or unrelated host permissions.
- [ ] 6.2 Exercise the built workflow with mocked Chrome and OpenAI boundaries across configuration save, Inbox event, classification, and movement, and verify a successful path moves exactly one bookmark while low-confidence and failure paths leave it in the Inbox.
