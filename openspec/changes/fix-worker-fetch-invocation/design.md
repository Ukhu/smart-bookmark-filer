# Design

## Context

See `proposal.md` for motivation. `OpenAiResponsesClassifier` accepts an optional fetch implementation for infrastructure tests and otherwise captures `globalThis.fetch`. The captured native function is later called through an instance property, so JavaScript supplies the classifier as the receiver. Chrome's worker implementation enforces the `WorkerGlobalScope` receiver and throws before creating a network request. Existing tests inject receiver-agnostic mocks and therefore pass.

## Goals / Non-Goals

**Goals:**

- Preserve the native worker-global receiver on the default fetch path.
- Preserve dependency injection and all existing request, timeout, response-validation, and safe-failure behavior.
- Reproduce the receiver constraint in an automated regression test without making a live request.

**Non-Goals:**

- Change OpenAI request contents, model configuration, retry behavior, or failure categories.
- Add runtime activity or diagnostic UI; that is covered by `add-filing-activity-visibility`.
- Add a browser-driven end-to-end test framework for this isolated correction.

## Decisions

### Wrap the native fetch call instead of storing the unbound method

When no implementation is injected, the classifier will use a wrapper that calls `globalThis.fetch(input, init)` at invocation time. The member call supplies `globalThis` as the receiver and matches execution in both window and worker globals.

Binding once with `globalThis.fetch.bind(globalThis)` would also correct the receiver, but the wrapper is explicit, straightforward to type, and easier to exercise with a temporarily substituted global function. Changing every call site was rejected because the adapter should continue to expose one fetch dependency internally.

### Keep injected implementations receiver-neutral

An explicitly supplied fetch implementation will still be stored and called as the adapter dependency. Tests and alternative implementations remain ordinary functions and do not need to emulate a browser global unless a test specifically verifies the default path.

### Add a branded receiver regression fixture

The infrastructure test will substitute a fetch-compatible function on `globalThis` that records or validates its `this` value, construct the classifier without injection, and assert that classification reaches the response path with `this === globalThis`. The test will restore the original global in cleanup and use a synthetic response, so it performs no network access and handles no real credentials.

Testing only an explicitly bound mock was rejected because that would bypass the default path that failed in Chrome. A live extension smoke test remains useful manual verification but is not sufficient regression coverage.

## Risks / Trade-offs

- **[Global substitution can leak between tests]** -> Restore the original fetch in `afterEach` or a `try/finally`, and keep the test isolated from concurrent mutation.
- **[Node does not reproduce Chrome's native brand check]** -> Make the fixture enforce the expected receiver explicitly rather than relying on Node's fetch behavior.
- **[A valid request may reveal a separate model or authorization error]** -> Preserve existing categorized unresolved handling; those outcomes are independent of this transport invocation fix.

## Migration Plan

Build and reload the unpacked production extension, then create a controlled bookmark directly in Inbox and verify that the worker issues the OpenAI request. Rollback restores the prior adapter implementation; no storage or bookmark migration is required.
