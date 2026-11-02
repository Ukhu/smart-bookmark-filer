import { describe, expect, it, vi } from 'vitest';

import {
  BookmarkCaptureController,
  type BookmarkCaptureDependencies,
  type CaptureFolderSnapshot,
  type ExactUrlBookmark,
} from '../../bookmark-capture/bookmarkCaptureController';
import {
  FILING_CONFIGURATION_VERSION,
  type FilingConfiguration,
} from '../../bookmark-filing/configuration';

const configuration: FilingConfiguration = {
  version: FILING_CONFIGURATION_VERSION,
  inboxFolderId: 'inbox',
  destinationRootIds: ['destinations'],
  openAiApiKey: 'secret-key',
  model: 'gpt-test',
  confidenceThreshold: 0.8,
};

function createSnapshot(
  staleFolderIds: readonly string[] = [],
  isFolderAncestor: CaptureFolderSnapshot['isFolderAncestor'] = () => false,
): CaptureFolderSnapshot {
  return {
    findStaleFolderIds: (folderIds) =>
      folderIds.filter((folderId) => staleFolderIds.includes(folderId)),
    isFolderAncestor,
  };
}

function createDependencies(
  overrides: Partial<BookmarkCaptureDependencies> = {},
): BookmarkCaptureDependencies {
  return {
    configuration: { load: vi.fn(async () => configuration) },
    folderTree: { loadSnapshot: vi.fn(async () => createSnapshot()) },
    exactUrlLookup: { findByExactUrl: vi.fn(async () => []) },
    inboxBookmarks: { createBookmark: vi.fn(async () => undefined) },
    ...overrides,
  };
}

describe('BookmarkCaptureController readiness and capture', () => {
  it('creates an available page directly in the configured Inbox', async () => {
    const dependencies = createDependencies();
    const controller = new BookmarkCaptureController(dependencies);

    await expect(
      controller.capture({
        title: 'Example page',
        url: 'https://example.com/page',
      }),
    ).resolves.toEqual({ kind: 'accepted' });
    expect(dependencies.exactUrlLookup.findByExactUrl).toHaveBeenCalledWith(
      'https://example.com/page',
    );
    expect(dependencies.inboxBookmarks.createBookmark).toHaveBeenCalledWith({
      parentId: 'inbox',
      title: 'Example page',
      url: 'https://example.com/page',
    });
  });

  it.each([undefined, '', '   '])(
    'uses the URL as the safe fallback for title %j',
    async (title) => {
      const dependencies = createDependencies();
      const controller = new BookmarkCaptureController(dependencies);

      await expect(
        controller.capture({ title, url: 'https://example.com/fallback' }),
      ).resolves.toEqual({ kind: 'accepted' });
      expect(dependencies.inboxBookmarks.createBookmark).toHaveBeenCalledWith({
        parentId: 'inbox',
        title: 'https://example.com/fallback',
        url: 'https://example.com/fallback',
      });
    },
  );

  it.each([undefined, '', '   '])(
    'rejects an unavailable page URL %j before loading setup',
    async (url) => {
      const dependencies = createDependencies();
      const controller = new BookmarkCaptureController(dependencies);

      await expect(
        controller.capture({ title: 'Unavailable', url }),
      ).resolves.toEqual({ kind: 'page-unavailable' });
      expect(dependencies.configuration.load).not.toHaveBeenCalled();
      expect(dependencies.inboxBookmarks.createBookmark).not.toHaveBeenCalled();
    },
  );

  it('rejects capture when filing configuration is missing', async () => {
    const dependencies = createDependencies({
      configuration: { load: vi.fn(async () => null) },
    });
    const controller = new BookmarkCaptureController(dependencies);

    await expect(
      controller.capture({ url: 'https://example.com' }),
    ).resolves.toEqual({ kind: 'setup-unavailable' });
    expect(dependencies.folderTree.loadSnapshot).not.toHaveBeenCalled();
    expect(dependencies.exactUrlLookup.findByExactUrl).not.toHaveBeenCalled();
    expect(dependencies.inboxBookmarks.createBookmark).not.toHaveBeenCalled();
  });

  it.each(['inbox', 'destinations'])(
    'rejects capture when configured folder %s is stale',
    async (staleFolderId) => {
      const dependencies = createDependencies({
        folderTree: {
          loadSnapshot: vi.fn(async () => createSnapshot([staleFolderId])),
        },
      });
      const controller = new BookmarkCaptureController(dependencies);

      await expect(
        controller.capture({ url: 'https://example.com' }),
      ).resolves.toEqual({ kind: 'setup-unavailable' });
      expect(dependencies.exactUrlLookup.findByExactUrl).not.toHaveBeenCalled();
      expect(dependencies.inboxBookmarks.createBookmark).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['the Inbox is a destination root', configuration.inboxFolderId],
    ['the Inbox contains a destination root', configuration.inboxFolderId],
    ['a destination root contains the Inbox', 'destinations'],
  ])('rejects capture when %s', async (_description, ancestorFolderId) => {
    const overlappingConfiguration =
      ancestorFolderId === configuration.inboxFolderId &&
      _description === 'the Inbox is a destination root'
        ? { ...configuration, destinationRootIds: ['inbox'] }
        : configuration;
    const dependencies = createDependencies({
      configuration: { load: vi.fn(async () => overlappingConfiguration) },
      folderTree: {
        loadSnapshot: vi.fn(async () =>
          createSnapshot(
            [],
            (ancestorId, descendantId) =>
              ancestorId === ancestorFolderId && ancestorId !== descendantId,
          ),
        ),
      },
    });
    const controller = new BookmarkCaptureController(dependencies);

    await expect(
      controller.capture({ url: 'https://example.com' }),
    ).resolves.toEqual({ kind: 'setup-unavailable' });
    expect(dependencies.exactUrlLookup.findByExactUrl).not.toHaveBeenCalled();
    expect(dependencies.inboxBookmarks.createBookmark).not.toHaveBeenCalled();
  });

  it.each([
    'configuration',
    'folderTree',
    'exactUrlLookup',
    'inboxBookmarks',
  ] as const)(
    'sanitizes failures from the %s dependency',
    async (dependencyName) => {
      const rawFailure = new Error(
        'credential=secret-key url=https://private.example',
      );
      const dependencies = createDependencies(
        dependencyName === 'configuration'
          ? {
              configuration: {
                load: vi.fn(async () => Promise.reject(rawFailure)),
              },
            }
          : dependencyName === 'folderTree'
            ? {
                folderTree: {
                  loadSnapshot: vi.fn(async () => Promise.reject(rawFailure)),
                },
              }
            : dependencyName === 'exactUrlLookup'
              ? {
                  exactUrlLookup: {
                    findByExactUrl: vi.fn(async () =>
                      Promise.reject(rawFailure),
                    ),
                  },
                }
              : {
                  inboxBookmarks: {
                    createBookmark: vi.fn(async () =>
                      Promise.reject(rawFailure),
                    ),
                  },
                },
      );
      const controller = new BookmarkCaptureController(dependencies);

      const result = await controller.capture({ url: 'https://example.com' });

      expect(result).toEqual({ kind: 'failed' });
      expect(JSON.stringify(result)).not.toContain('secret-key');
      expect(JSON.stringify(result)).not.toContain('private.example');
    },
  );
});

describe('BookmarkCaptureController exact-URL critical section', () => {
  function createProfileDependencies(
    initialBookmarks: readonly ExactUrlBookmark[] = [],
  ): BookmarkCaptureDependencies & {
    readonly profileBookmarks: ExactUrlBookmark[];
  } {
    const profileBookmarks = [...initialBookmarks];
    const dependencies = createDependencies({
      exactUrlLookup: {
        findByExactUrl: vi.fn(async (url) =>
          profileBookmarks.filter((bookmark) => bookmark.url === url),
        ),
      },
      inboxBookmarks: {
        createBookmark: vi.fn(async ({ url }) => {
          profileBookmarks.push({
            id: `created-${profileBookmarks.length + 1}`,
            url,
          });
        }),
      },
    });

    return { ...dependencies, profileBookmarks };
  }

  it('preserves a matching bookmark found anywhere in the profile', async () => {
    const existingBookmark = {
      id: 'outside-inbox',
      url: 'https://example.com/existing',
    };
    const dependencies = createProfileDependencies([existingBookmark]);
    const controller = new BookmarkCaptureController(dependencies);

    await expect(
      controller.capture({ url: existingBookmark.url }),
    ).resolves.toEqual({ kind: 'already-bookmarked' });
    expect(dependencies.inboxBookmarks.createBookmark).not.toHaveBeenCalled();
    expect(dependencies.profileBookmarks).toEqual([existingBookmark]);
  });

  it.each([
    ['path', 'https://example.com/other'],
    ['query', 'https://example.com/page?view=other'],
    ['fragment', 'https://example.com/page#other'],
  ])(
    'does not treat a different %s as an exact URL match',
    async (_difference, existingUrl) => {
      const dependencies = createProfileDependencies([
        { id: `existing-${_difference}`, url: existingUrl },
      ]);
      const controller = new BookmarkCaptureController(dependencies);

      await expect(
        controller.capture({ url: 'https://example.com/page' }),
      ).resolves.toEqual({ kind: 'accepted' });
      expect(dependencies.profileBookmarks).toHaveLength(2);
    },
  );

  it('serializes overlapping requests for the same URL', async () => {
    const dependencies = createProfileDependencies();
    const controller = new BookmarkCaptureController(dependencies);

    const first = controller.capture({ url: 'https://example.com/same' });
    const second = controller.capture({ url: 'https://example.com/same' });

    await expect(Promise.all([first, second])).resolves.toEqual([
      { kind: 'accepted' },
      { kind: 'already-bookmarked' },
    ]);
    expect(dependencies.inboxBookmarks.createBookmark).toHaveBeenCalledOnce();
    expect(dependencies.profileBookmarks).toHaveLength(1);
  });

  it('captures distinct URLs submitted concurrently', async () => {
    const dependencies = createProfileDependencies();
    const controller = new BookmarkCaptureController(dependencies);

    await expect(
      Promise.all([
        controller.capture({ url: 'https://example.com/first' }),
        controller.capture({ url: 'https://example.com/second' }),
      ]),
    ).resolves.toEqual([{ kind: 'accepted' }, { kind: 'accepted' }]);
    expect(dependencies.inboxBookmarks.createBookmark).toHaveBeenCalledTimes(2);
    expect(dependencies.profileBookmarks.map(({ url }) => url)).toEqual([
      'https://example.com/first',
      'https://example.com/second',
    ]);
  });

  it('continues processing queued requests after a failed critical section', async () => {
    const dependencies = createProfileDependencies();
    vi.mocked(dependencies.exactUrlLookup.findByExactUrl)
      .mockRejectedValueOnce(new Error('lookup failed'))
      .mockResolvedValueOnce([]);
    const controller = new BookmarkCaptureController(dependencies);

    await expect(
      Promise.all([
        controller.capture({ url: 'https://example.com/first' }),
        controller.capture({ url: 'https://example.com/second' }),
      ]),
    ).resolves.toEqual([{ kind: 'failed' }, { kind: 'accepted' }]);
  });
});
