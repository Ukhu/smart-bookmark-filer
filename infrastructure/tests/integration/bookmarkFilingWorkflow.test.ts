import { describe, expect, it, vi } from 'vitest';

import { ChromeBookmarkTreeAdapter } from '../../bookmarks/chromeBookmarkTree';
import { OpenAiResponsesClassifier } from '../../openai/openAiResponsesClassifier';
import {
  ChromeFilingConfigurationStore,
  FILING_CONFIGURATION_STORAGE_KEY,
  type LocalStorageArea,
} from '../../storage/chromeFilingConfigurationStore';
import { ChromeFilingActivityStore } from '../../storage/chromeFilingActivityStore';
import {
  registerBookmarkCreatedListener,
  type BookmarkCreatedEvent,
} from '../../../features/bookmark-filing/bookmarkCreatedListener';
import { DestinationCandidateBuilder } from '../../../features/bookmark-filing/candidateBuilder';
import type { CreatedBookmark } from '../../../features/bookmark-filing/filingWorkflow';
import { FilingWorkflow } from '../../../features/bookmark-filing/filingWorkflow';
import { OptionsActivityController } from '../../../features/bookmark-filing/optionsActivityController';
import { FilingOptionsController } from '../../../features/bookmark-filing/optionsController';
import { BookmarkCaptureController } from '../../../features/bookmark-capture/bookmarkCaptureController';

function openAiResponse(folderId: string, confidence: number): Response {
  return new Response(
    JSON.stringify({
      output: [
        {
          content: [
            {
              type: 'output_text',
              text: JSON.stringify({ folderId, confidence }),
            },
          ],
        },
      ],
    }),
    { status: 200 },
  );
}

describe('bookmark filing integration', () => {
  it('persists privacy-bounded outcomes for filing and options display without changing movement decisions', async () => {
    const storedValues: Record<string, unknown> = {};
    const storage: LocalStorageArea = {
      get: vi.fn(async (key) => ({ [key]: storedValues[key] })),
      set: vi.fn(async (items) => {
        Object.assign(storedValues, items);
      }),
      remove: vi.fn(async (key) => {
        delete storedValues[key];
      }),
    };
    const bookmarksById = new Map<string, CreatedBookmark>();
    const pending: Promise<unknown>[] = [];
    let listener:
      ((bookmarkId: string, bookmark: CreatedBookmark) => void) | undefined;
    let nextBookmarkId = 0;
    const move = vi.fn(
      async (bookmarkId: string, { parentId }: { parentId: string }) => {
        const bookmark = bookmarksById.get(bookmarkId);
        if (bookmark === undefined) throw new Error('Bookmark not found.');
        bookmarksById.set(bookmarkId, { ...bookmark, parentId });
        return bookmarksById.get(bookmarkId)!;
      },
    );
    const bookmarksApi = {
      getTree: vi.fn(async () => [
        {
          id: 'root',
          title: '',
          children: [
            { id: 'inbox', title: 'Inbox', parentId: 'root' },
            {
              id: 'destinations',
              title: 'Destinations',
              parentId: 'root',
              children: [
                {
                  id: 'engineering',
                  title: 'Engineering',
                  parentId: 'destinations',
                },
              ],
            },
          ],
        },
      ]),
      get: vi.fn(async (bookmarkId: string) => {
        const bookmark = bookmarksById.get(bookmarkId);
        return bookmark === undefined ? [] : [bookmark];
      }),
      search: vi.fn(async ({ url }: { url: string }) =>
        [...bookmarksById.values()].filter((bookmark) => bookmark.url === url),
      ),
      create: vi.fn(async (input: Omit<CreatedBookmark, 'id'>) => {
        const bookmark: CreatedBookmark = {
          ...input,
          id: `captured-${++nextBookmarkId}`,
        };
        bookmarksById.set(bookmark.id, bookmark);
        listener?.(bookmark.id, bookmark);
        return bookmark;
      }),
      move,
    };
    const bookmarkTree = new ChromeBookmarkTreeAdapter(bookmarksApi);
    const configurationStore = new ChromeFilingConfigurationStore(storage);
    const activityStore = new ChromeFilingActivityStore(
      storage,
      {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      (() => {
        let timestamp = 0;
        return () => ++timestamp;
      })(),
    );
    const options = new FilingOptionsController(
      configurationStore,
      bookmarkTree,
    );
    const saved = await options.save({
      inboxFolderId: 'inbox',
      destinationRootIds: ['destinations'],
      model: 'gpt-test',
      confidenceThreshold: 0.8,
      apiKeyReplacement: 'test-key',
    });

    expect(saved.ok).toBe(true);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(openAiResponse('engineering', 0.9))
      .mockResolvedValueOnce(openAiResponse('engineering', 0.79))
      .mockResolvedValueOnce(
        new Response('provider unavailable', { status: 500 }),
      )
      .mockResolvedValueOnce(openAiResponse('engineering', 0.95));
    const workflow = new FilingWorkflow({
      configuration: configurationStore,
      bookmarks: bookmarkTree,
      folderTree: bookmarkTree,
      candidateBuilder: new DestinationCandidateBuilder(bookmarkTree),
      classifier: new OpenAiResponsesClassifier({
        fetchImplementation: fetchMock,
      }),
      activity: activityStore,
    });
    const event: BookmarkCreatedEvent = {
      addListener: vi.fn((registeredListener) => {
        listener = registeredListener;
      }),
    };
    registerBookmarkCreatedListener(event, {
      processCreatedBookmark: (bookmark) => {
        const processing = workflow.processCreatedBookmark(bookmark);
        pending.push(processing);
        return processing;
      },
    });
    const capture = new BookmarkCaptureController({
      configuration: configurationStore,
      folderTree: bookmarkTree,
      exactUrlLookup: bookmarkTree,
      inboxBookmarks: bookmarkTree,
    });
    const captureAndWait = async (page: {
      readonly title: string;
      readonly url: string;
    }): Promise<CreatedBookmark> => {
      const pendingCount = pending.length;
      await expect(capture.capture(page)).resolves.toEqual({
        kind: 'accepted',
      });
      const processing = pending[pendingCount];
      if (processing === undefined) throw new Error('Event was not processed.');
      await processing;
      const bookmark = [...bookmarksById.values()].find(
        ({ url }) => url === page.url,
      );
      if (bookmark === undefined) throw new Error('Bookmark was not created.');
      return bookmark;
    };

    const successful = await captureAndWait({
      title: 'TypeScript',
      url: 'https://www.typescriptlang.org/',
    });
    const lowConfidence = await captureAndWait({
      title: 'Uncertain',
      url: 'https://example.com/uncertain',
    });
    const providerFailure = await captureAndWait({
      title: 'Unavailable',
      url: 'https://example.com/unavailable',
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(move).toHaveBeenCalledTimes(1);
    expect(move).toHaveBeenCalledWith(successful.id, {
      parentId: 'engineering',
    });
    expect(bookmarksById.get(successful.id)?.parentId).toBe('engineering');
    expect(bookmarksById.get(lowConfidence.id)?.parentId).toBe('inbox');
    expect(bookmarksById.get(providerFailure.id)?.parentId).toBe('inbox');
    const activity = await activityStore.load();
    expect(activity).toMatchObject([
      {
        bookmarkId: providerFailure.id,
        title: 'Unavailable',
        outcome: { kind: 'unresolved', reason: 'provider-error' },
      },
      {
        bookmarkId: lowConfidence.id,
        title: 'Uncertain',
        outcome: { kind: 'below-threshold', confidence: 0.79 },
      },
      {
        bookmarkId: successful.id,
        title: 'TypeScript',
        outcome: {
          kind: 'filed',
          confidence: 0.9,
          destinationFolderId: 'engineering',
          destinationPath: 'Destinations/Engineering',
        },
      },
    ]);

    const creationCount = bookmarksApi.create.mock.calls.length;
    await expect(
      capture.capture({
        title: 'Duplicate',
        url: 'https://www.typescriptlang.org/',
      }),
    ).resolves.toEqual({ kind: 'already-bookmarked' });
    expect(bookmarksApi.create).toHaveBeenCalledTimes(creationCount);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const validConfiguration = storedValues[FILING_CONFIGURATION_STORAGE_KEY];
    storedValues[FILING_CONFIGURATION_STORAGE_KEY] = {
      ...(validConfiguration as Record<string, unknown>),
      destinationRootIds: ['inbox'],
    };
    await expect(
      capture.capture({
        title: 'Invalid setup',
        url: 'https://example.com/invalid-setup',
      }),
    ).resolves.toEqual({ kind: 'setup-unavailable' });
    expect(bookmarksApi.create).toHaveBeenCalledTimes(creationCount);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    storedValues[FILING_CONFIGURATION_STORAGE_KEY] = validConfiguration;

    const pendingBeforeOverlap = pending.length;
    const overlapResults = await Promise.all([
      capture.capture({
        title: 'Overlap',
        url: 'https://example.com/overlap',
      }),
      capture.capture({
        title: 'Overlap',
        url: 'https://example.com/overlap',
      }),
    ]);
    expect(overlapResults.map(({ kind }) => kind).sort()).toEqual([
      'accepted',
      'already-bookmarked',
    ]);
    expect(bookmarksApi.create).toHaveBeenCalledTimes(creationCount + 1);
    expect(pending).toHaveLength(pendingBeforeOverlap + 1);
    await pending[pendingBeforeOverlap];
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const overlap = [...bookmarksById.values()].find(
      ({ url }) => url === 'https://example.com/overlap',
    );
    expect(overlap?.parentId).toBe('engineering');

    const activityView = await new OptionsActivityController(
      activityStore,
    ).load();
    expect(activityView).toMatchObject({
      kind: 'activity',
      items: [
        {
          bookmarkId: overlap?.id,
          label: 'Filed',
          detail: 'Filed to Destinations/Engineering with 95% confidence.',
        },
        {
          bookmarkId: providerFailure.id,
          label: 'Unresolved',
          detail: 'OpenAI could not complete the request.',
        },
        {
          bookmarkId: lowConfidence.id,
          label: 'Below confidence threshold',
          detail: 'The 79% confidence result was not accepted.',
        },
        {
          bookmarkId: successful.id,
          label: 'Filed',
          detail: 'Filed to Destinations/Engineering with 90% confidence.',
        },
      ],
    });

    const serializedActivity = JSON.stringify(await activityStore.load());
    expect(serializedActivity).not.toContain('https://');
    expect(serializedActivity).not.toContain('test-key');
    expect(serializedActivity).not.toContain('provider unavailable');
  });
});
