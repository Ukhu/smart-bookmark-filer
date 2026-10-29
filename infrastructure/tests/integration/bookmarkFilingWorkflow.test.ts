import { describe, expect, it, vi } from 'vitest';

import { ChromeBookmarkTreeAdapter } from '../../bookmarks/chromeBookmarkTree';
import { OpenAiResponsesClassifier } from '../../openai/openAiResponsesClassifier';
import {
  ChromeFilingConfigurationStore,
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
      );
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
    const pending: Promise<unknown>[] = [];
    let listener:
      ((bookmarkId: string, bookmark: CreatedBookmark) => void) | undefined;
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
    const emitAndWait = async (bookmark: CreatedBookmark): Promise<void> => {
      bookmarksById.set(bookmark.id, bookmark);
      listener?.(bookmark.id, bookmark);
      const processing = pending.at(-1);
      if (processing === undefined) throw new Error('Event was not processed.');
      await processing;
    };

    await emitAndWait({
      id: 'successful',
      title: 'TypeScript',
      parentId: 'inbox',
      url: 'https://www.typescriptlang.org/',
    });
    await emitAndWait({
      id: 'low-confidence',
      title: 'Uncertain',
      parentId: 'inbox',
      url: 'https://example.com/uncertain',
    });
    await emitAndWait({
      id: 'provider-failure',
      title: 'Unavailable',
      parentId: 'inbox',
      url: 'https://example.com/unavailable',
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(move).toHaveBeenCalledTimes(1);
    expect(move).toHaveBeenCalledWith('successful', {
      parentId: 'engineering',
    });
    expect(bookmarksById.get('successful')?.parentId).toBe('engineering');
    expect(bookmarksById.get('low-confidence')?.parentId).toBe('inbox');
    expect(bookmarksById.get('provider-failure')?.parentId).toBe('inbox');
    const activity = await activityStore.load();
    expect(activity).toMatchObject([
      {
        bookmarkId: 'provider-failure',
        title: 'Unavailable',
        outcome: { kind: 'unresolved', reason: 'provider-error' },
      },
      {
        bookmarkId: 'low-confidence',
        title: 'Uncertain',
        outcome: { kind: 'below-threshold', confidence: 0.79 },
      },
      {
        bookmarkId: 'successful',
        title: 'TypeScript',
        outcome: {
          kind: 'filed',
          confidence: 0.9,
          destinationFolderId: 'engineering',
          destinationPath: 'Destinations/Engineering',
        },
      },
    ]);

    const activityView = await new OptionsActivityController(
      activityStore,
    ).load();
    expect(activityView).toMatchObject({
      kind: 'activity',
      items: [
        {
          bookmarkId: 'provider-failure',
          label: 'Unresolved',
          detail: 'OpenAI could not complete the request.',
        },
        {
          bookmarkId: 'low-confidence',
          label: 'Below confidence threshold',
          detail: 'The 79% confidence result was not accepted.',
        },
        {
          bookmarkId: 'successful',
          label: 'Filed',
          detail: 'Filed to Destinations/Engineering with 90% confidence.',
        },
      ],
    });

    const serializedActivity = JSON.stringify(activity);
    expect(serializedActivity).not.toContain('https://');
    expect(serializedActivity).not.toContain('test-key');
    expect(serializedActivity).not.toContain('provider unavailable');
  });
});
