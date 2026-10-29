# Proposal

## Why

Automatic filing cannot reach OpenAI in a Chrome Manifest V3 worker because the classifier invokes the native `fetch` function with the classifier instance as its receiver. Chrome rejects that call as an illegal invocation before issuing a network request, and the expected failure isolation then leaves the bookmark silently unresolved.

## What Changes

- Invoke the worker's native `fetch` implementation with a valid global receiver while preserving injected fetch implementations for tests.
- Add regression coverage that fails when the default fetch path is invoked with the wrong receiver.
- Keep the existing safe unresolved behavior for genuine network failures and avoid exposing credentials in errors.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This change restores conformance with the existing `bookmark-classification` requirements; it does not change the required behavior.

## Impact

- Affects `infrastructure/openai/openAiResponsesClassifier.ts` and its infrastructure tests.
- Does not change configuration storage, request contents, permissions, user-visible behavior, or dependencies.
- Enables the existing automatic filing workflow to make its intended OpenAI request from the background worker.
