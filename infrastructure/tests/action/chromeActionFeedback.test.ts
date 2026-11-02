import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ActionCapturePresentation } from '../../../features/bookmark-capture/actionClickListener';
import {
  ACTION_FEEDBACK_DURATION_MS,
  ChromeActionFeedback,
  DEFAULT_ACTION_TITLE,
  type ChromeActionApi,
  type ChromeRuntimeApi,
} from '../../action/chromeActionFeedback';

function createAction(): ChromeActionApi {
  return {
    setBadgeBackgroundColor: vi.fn(async () => undefined),
    setBadgeText: vi.fn(async () => undefined),
    setTitle: vi.fn(async () => undefined),
  };
}

function createRuntime(): ChromeRuntimeApi {
  return { openOptionsPage: vi.fn(async () => undefined) };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('ChromeActionFeedback', () => {
  it.each([
    [
      'accepted',
      { badgeText: 'OK', color: '#137333', title: 'Bookmark saved to Inbox' },
    ],
    [
      'already-bookmarked',
      {
        badgeText: '=',
        color: '#5f6368',
        title: 'Page is already bookmarked',
      },
    ],
    [
      'setup-unavailable',
      {
        badgeText: '!',
        color: '#b06000',
        title: 'Set up Smart Bookmark Filer to save this page',
      },
    ],
    [
      'failed',
      {
        badgeText: '!',
        color: '#b3261e',
        title: 'Bookmark could not be saved',
      },
    ],
  ] as const)(
    'shows accessible per-tab feedback for %s',
    async (kind, expected) => {
      vi.useFakeTimers();
      const action = createAction();
      const runtime = createRuntime();
      const feedback = new ChromeActionFeedback(action, runtime);

      await feedback.present(42, { kind });

      expect(action.setBadgeBackgroundColor).toHaveBeenLastCalledWith({
        color: expected.color,
        tabId: 42,
      });
      expect(action.setBadgeText).toHaveBeenLastCalledWith({
        tabId: 42,
        text: expected.badgeText,
      });
      expect(action.setTitle).toHaveBeenLastCalledWith({
        tabId: 42,
        title: expected.title,
      });
    },
  );

  it('clears temporary feedback after the brief display period', async () => {
    vi.useFakeTimers();
    const action = createAction();
    const feedback = new ChromeActionFeedback(action, createRuntime());

    await feedback.present(4, { kind: 'accepted' });
    await vi.advanceTimersByTimeAsync(ACTION_FEEDBACK_DURATION_MS);

    expect(action.setBadgeText).toHaveBeenLastCalledWith({
      tabId: 4,
      text: '',
    });
    expect(action.setTitle).toHaveBeenLastCalledWith({
      tabId: 4,
      title: DEFAULT_ACTION_TITLE,
    });
  });

  it('replaces prior feedback without allowing its timer to clear the new state', async () => {
    vi.useFakeTimers();
    const action = createAction();
    const feedback = new ChromeActionFeedback(action, createRuntime());

    await feedback.present(8, { kind: 'accepted' });
    await vi.advanceTimersByTimeAsync(ACTION_FEEDBACK_DURATION_MS / 2);
    await feedback.present(8, { kind: 'failed' });
    await vi.advanceTimersByTimeAsync(ACTION_FEEDBACK_DURATION_MS / 2);

    expect(action.setBadgeText).toHaveBeenLastCalledWith({
      tabId: 8,
      text: '!',
    });
    expect(action.setTitle).toHaveBeenLastCalledWith({
      tabId: 8,
      title: 'Bookmark could not be saved',
    });

    await vi.advanceTimersByTimeAsync(ACTION_FEEDBACK_DURATION_MS / 2);
    expect(action.setBadgeText).toHaveBeenLastCalledWith({
      tabId: 8,
      text: '',
    });
  });

  it.each([
    ['accepted', false],
    ['already-bookmarked', false],
    ['failed', false],
    ['setup-unavailable', true],
  ] as const)('opens Options for %s only: %s', async (kind, opensOptions) => {
    vi.useFakeTimers();
    const runtime = createRuntime();
    const feedback = new ChromeActionFeedback(createAction(), runtime);

    await feedback.present(3, { kind });
    await Promise.resolve();

    expect(runtime.openOptionsPage).toHaveBeenCalledTimes(opensOptions ? 1 : 0);
  });

  it('opens Options for setup failure even when the tab ID is unavailable', async () => {
    const action = createAction();
    const runtime = createRuntime();
    const feedback = new ChromeActionFeedback(action, runtime);

    await feedback.present(undefined, { kind: 'setup-unavailable' });
    await Promise.resolve();

    expect(runtime.openOptionsPage).toHaveBeenCalledOnce();
    expect(action.setBadgeText).not.toHaveBeenCalled();
  });

  it('contains browser feedback failures and still performs setup redirection', async () => {
    vi.useFakeTimers();
    const failure = new Error('Chrome action unavailable');
    const action: ChromeActionApi = {
      setBadgeBackgroundColor: vi.fn(async () => Promise.reject(failure)),
      setBadgeText: vi.fn(async () => Promise.reject(failure)),
      setTitle: vi.fn(async () => Promise.reject(failure)),
    };
    const runtime = createRuntime();
    const feedback = new ChromeActionFeedback(action, runtime);

    await expect(
      feedback.present(5, { kind: 'setup-unavailable' }),
    ).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(ACTION_FEEDBACK_DURATION_MS);

    expect(runtime.openOptionsPage).toHaveBeenCalledOnce();
    expect(action.setBadgeText).toHaveBeenLastCalledWith({
      tabId: 5,
      text: '',
    });
  });

  it('uses only fixed safe badge and title text for every outcome', async () => {
    vi.useFakeTimers();
    const action = createAction();
    const feedback = new ChromeActionFeedback(action, createRuntime());
    const outcomes: readonly ActionCapturePresentation[] = [
      { kind: 'accepted' },
      { kind: 'already-bookmarked' },
      { kind: 'setup-unavailable' },
      { kind: 'failed' },
    ];

    for (const outcome of outcomes) {
      await feedback.present(6, outcome);
    }

    const displayedText = JSON.stringify([
      ...vi.mocked(action.setBadgeText).mock.calls,
      ...vi.mocked(action.setTitle).mock.calls,
    ]);
    expect(displayedText).not.toMatch(
      /https?:|sk-|api.?key|credential|exception|error:/i,
    );
  });
});
