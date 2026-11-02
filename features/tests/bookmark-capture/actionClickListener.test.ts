import { describe, expect, it, vi } from 'vitest';

import {
  registerActionClickListener,
  type ActionCapturePresenter,
  type ActionClickedEvent,
  type ActionClickedTab,
  type ActivePageCaptureProcessor,
} from '../../bookmark-capture/actionClickListener';
import type { BookmarkCaptureResult } from '../../bookmark-capture/bookmarkCaptureController';

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: (value) => resolvePromise?.(value),
  };
}

function createActionEvent(): {
  readonly event: ActionClickedEvent;
  emit(tab: ActionClickedTab): void;
} {
  let listener: ((tab: ActionClickedTab) => void) | undefined;

  return {
    event: {
      addListener: vi.fn((registeredListener) => {
        listener = registeredListener;
      }),
    },
    emit: (tab) => {
      if (listener === undefined) {
        throw new Error('No action-click listener was registered.');
      }
      listener(tab);
    },
  };
}

function createPresenter(): ActionCapturePresenter {
  return { present: vi.fn(async () => undefined) };
}

describe('registerActionClickListener', () => {
  it.each([
    {
      description: 'missing URL',
      tab: { id: 1, title: 'Unavailable' },
      expectedPage: { title: 'Unavailable' },
    },
    {
      description: 'missing title',
      tab: { id: 2, url: 'https://example.com/no-title' },
      expectedPage: { url: 'https://example.com/no-title' },
    },
    {
      description: 'missing tab ID',
      tab: { title: 'Example', url: 'https://example.com' },
      expectedPage: { title: 'Example', url: 'https://example.com' },
    },
  ])('safely adapts a clicked tab with $description', async (testCase) => {
    const action = createActionEvent();
    const capture: ActivePageCaptureProcessor = {
      capture: vi.fn<ActivePageCaptureProcessor['capture']>(async () => ({
        kind: 'accepted',
      })),
    };
    const presenter = createPresenter();

    registerActionClickListener(action.event, capture, presenter);
    action.emit(testCase.tab);

    await vi.waitFor(() => expect(presenter.present).toHaveBeenCalledOnce());
    expect(capture.capture).toHaveBeenCalledWith(testCase.expectedPage);
    expect(presenter.present).toHaveBeenCalledWith(testCase.tab.id, {
      kind: 'accepted',
    });
  });

  it.each([
    ['accepted', 'accepted'],
    ['already-bookmarked', 'already-bookmarked'],
    ['setup-unavailable', 'setup-unavailable'],
    ['page-unavailable', 'failed'],
    ['failed', 'failed'],
  ] as const)(
    'maps the %s capture result to %s presentation',
    async (captureKind, presentationKind) => {
      const action = createActionEvent();
      const capture: ActivePageCaptureProcessor = {
        capture: vi.fn(async () => ({ kind: captureKind })),
      };
      const presenter = createPresenter();

      registerActionClickListener(action.event, capture, presenter);
      action.emit({ id: 7, url: 'https://example.com' });

      await vi.waitFor(() => expect(presenter.present).toHaveBeenCalledOnce());
      expect(presenter.present).toHaveBeenCalledWith(7, {
        kind: presentationKind,
      });
    },
  );

  it('keeps concurrent click outcomes associated with their tabs', async () => {
    const action = createActionEvent();
    const first = createDeferred<BookmarkCaptureResult>();
    const second = createDeferred<BookmarkCaptureResult>();
    const capture: ActivePageCaptureProcessor = {
      capture: vi
        .fn<ActivePageCaptureProcessor['capture']>()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise),
    };
    const presenter = createPresenter();

    registerActionClickListener(action.event, capture, presenter);
    action.emit({ id: 1, url: 'https://example.com/first' });
    action.emit({ id: 2, url: 'https://example.com/second' });
    second.resolve({ kind: 'already-bookmarked' });
    first.resolve({ kind: 'accepted' });

    await vi.waitFor(() => expect(presenter.present).toHaveBeenCalledTimes(2));
    expect(presenter.present).toHaveBeenCalledWith(1, { kind: 'accepted' });
    expect(presenter.present).toHaveBeenCalledWith(2, {
      kind: 'already-bookmarked',
    });
  });

  it('contains capture and presentation rejections', async () => {
    const action = createActionEvent();
    const captureFailure = new Error('sensitive capture failure');
    const capture: ActivePageCaptureProcessor = {
      capture: vi.fn(async () => Promise.reject(captureFailure)),
    };
    const presenter: ActionCapturePresenter = {
      present: vi.fn(async () => Promise.reject(new Error('badge failure'))),
    };

    registerActionClickListener(action.event, capture, presenter);
    action.emit({ id: 9, url: 'https://example.com/private' });

    await vi.waitFor(() => expect(presenter.present).toHaveBeenCalledOnce());
    expect(presenter.present).toHaveBeenCalledWith(9, { kind: 'failed' });
  });
});
