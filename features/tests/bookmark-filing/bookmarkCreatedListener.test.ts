import { describe, expect, it, vi } from 'vitest';

import {
  registerBookmarkCreatedListener,
  type BookmarkCreatedEvent,
  type CreatedBookmarkProcessor,
} from '../../bookmark-filing/bookmarkCreatedListener';
import type { CandidateFolderSnapshot } from '../../bookmark-filing/candidateBuilder';
import type { BookmarkClassificationResult } from '../../bookmark-filing/classification';
import {
  FILING_CONFIGURATION_VERSION,
  type FilingConfiguration,
} from '../../bookmark-filing/configuration';
import {
  FilingWorkflow,
  type CreatedBookmark,
} from '../../bookmark-filing/filingWorkflow';

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

function createMockEvent(): {
  readonly event: BookmarkCreatedEvent;
  emit(bookmarkId: string, bookmark: CreatedBookmark): void;
} {
  let listener:
    ((bookmarkId: string, bookmark: CreatedBookmark) => void) | undefined;

  return {
    event: {
      addListener: vi.fn((registeredListener) => {
        listener = registeredListener;
      }),
    },
    emit: (bookmarkId, bookmark) => {
      if (listener === undefined) {
        throw new Error('No bookmark-created listener was registered.');
      }
      listener(bookmarkId, bookmark);
    },
  };
}

describe('registerBookmarkCreatedListener', () => {
  it.each([
    ['bookmark-2', 'bookmark-1'],
    ['bookmark-1', 'bookmark-2'],
  ] as const)(
    'keeps request contexts independent when %s completes before %s',
    async (firstCompletion, secondCompletion) => {
      const event = createMockEvent();
      const deferredById: Record<
        string,
        Deferred<BookmarkClassificationResult>
      > = {
        'bookmark-1': createDeferred(),
        'bookmark-2': createDeferred(),
      };
      const destinationById: Record<string, string> = {
        'bookmark-1': 'engineering',
        'bookmark-2': 'finance',
      };
      const bookmarkIdByTitle: Record<string, string> = {
        TypeScript: 'bookmark-1',
        Budget: 'bookmark-2',
      };
      const configuration: FilingConfiguration = {
        version: FILING_CONFIGURATION_VERSION,
        inboxFolderId: 'inbox',
        destinationRootIds: ['destinations'],
        openAiApiKey: 'secret-key',
        model: 'gpt-test',
        confidenceThreshold: 0.8,
      };
      const snapshot: CandidateFolderSnapshot = {
        enumerateFolders: () => [],
        findStaleFolderIds: () => [],
        isFolderAncestor: (ancestorFolderId, descendantFolderId) =>
          ancestorFolderId === 'destinations' &&
          ['engineering', 'finance'].includes(descendantFolderId),
      };
      const bookmarks = new Map<string, CreatedBookmark>();
      const movements: Array<{
        readonly bookmarkId: string;
        readonly destinationFolderId: string;
      }> = [];
      const pending: Promise<unknown>[] = [];
      const classifier = {
        classify: vi.fn(
          async ({ title }: { readonly title: string }) =>
            deferredById[bookmarkIdByTitle[title]!]!.promise,
        ),
      };
      const workflow = new FilingWorkflow({
        configuration: { load: vi.fn(async () => configuration) },
        bookmarks: {
          getBookmark: vi.fn(
            async (bookmarkId) => bookmarks.get(bookmarkId) ?? null,
          ),
          moveBookmark: vi.fn(async (bookmarkId, destinationFolderId) => {
            movements.push({ bookmarkId, destinationFolderId });
          }),
        },
        folderTree: { loadSnapshot: vi.fn(async () => snapshot) },
        candidateBuilder: {
          build: vi.fn(async () => ({
            ok: true as const,
            candidates: [
              { folderId: 'engineering', path: 'Destinations/Engineering' },
              { folderId: 'finance', path: 'Destinations/Finance' },
            ],
          })),
        },
        classifier,
      });
      const processor: CreatedBookmarkProcessor = {
        processCreatedBookmark: vi.fn((bookmark) => {
          bookmarks.set(bookmark.id, bookmark);
          const processing = workflow.processCreatedBookmark(bookmark);
          pending.push(processing);
          return processing;
        }),
      };

      registerBookmarkCreatedListener(event.event, processor);
      event.emit('bookmark-1', {
        id: 'bookmark-1',
        title: 'TypeScript',
        parentId: 'inbox',
        url: 'https://www.typescriptlang.org/',
      });
      event.emit('bookmark-2', {
        id: 'bookmark-2',
        title: 'Budget',
        parentId: 'inbox',
        url: 'https://example.com/budget',
      });

      await vi.waitFor(() => {
        expect(classifier.classify).toHaveBeenCalledTimes(2);
      });
      deferredById[firstCompletion]!.resolve({
        kind: 'success',
        folderId: destinationById[firstCompletion]!,
        confidence: 0.9,
      });
      await vi.waitFor(() => {
        expect(movements).toEqual([
          {
            bookmarkId: firstCompletion,
            destinationFolderId: destinationById[firstCompletion],
          },
        ]);
      });
      deferredById[secondCompletion]!.resolve({
        kind: 'success',
        folderId: destinationById[secondCompletion]!,
        confidence: 0.9,
      });
      await Promise.all(pending);

      expect(movements).toEqual(
        [firstCompletion, secondCompletion].map((bookmarkId) => ({
          bookmarkId,
          destinationFolderId: destinationById[bookmarkId],
        })),
      );
      expect(new Set(movements.map(({ bookmarkId }) => bookmarkId))).toEqual(
        new Set(['bookmark-1', 'bookmark-2']),
      );
    },
  );

  it('uses the event bookmark ID and an immutable copy of event data', async () => {
    const event = createMockEvent();
    const received: CreatedBookmark[] = [];
    const processor: CreatedBookmarkProcessor = {
      processCreatedBookmark: vi.fn(async (bookmark) => {
        received.push(bookmark);
      }),
    };
    const eventBookmark = {
      id: 'stale-object-id',
      title: 'Original title',
      parentId: 'inbox',
      url: 'https://example.com',
    };

    registerBookmarkCreatedListener(event.event, processor);
    event.emit('stable-event-id', eventBookmark);
    eventBookmark.title = 'Mutated title';
    await Promise.resolve();

    expect(received).toEqual([
      {
        id: 'stable-event-id',
        title: 'Original title',
        parentId: 'inbox',
        url: 'https://example.com',
      },
    ]);
  });
});
