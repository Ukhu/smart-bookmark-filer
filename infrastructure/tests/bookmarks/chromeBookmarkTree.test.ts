import { describe, expect, it, vi } from 'vitest';

import {
  BookmarkTreeSnapshot,
  ChromeBookmarkTreeAdapter,
  type BookmarkTreeNode,
  type ChromeBookmarksApi,
} from '../../bookmarks/chromeBookmarkTree';

const nestedTree: readonly BookmarkTreeNode[] = [
  {
    id: '0',
    title: '',
    children: [
      {
        id: 'bar',
        title: 'Bookmarks bar',
        children: [
          {
            id: 'inbox',
            title: 'Inbox',
            children: [
              {
                id: 'unfiled-bookmark',
                title: 'Example',
                url: 'https://example.com',
              },
            ],
          },
          {
            id: 'engineering',
            title: 'Engineering',
            children: [{ id: 'engineering-research', title: 'Research' }],
          },
        ],
      },
      {
        id: 'other',
        title: 'Other bookmarks',
        children: [{ id: 'other-research', title: 'Research' }],
      },
    ],
  },
];

describe('ChromeBookmarkTreeAdapter', () => {
  function createBookmarksApi(
    overrides: Partial<ChromeBookmarksApi> = {},
  ): ChromeBookmarksApi {
    return {
      getTree: vi.fn(async () => nestedTree),
      get: vi.fn(async () => []),
      search: vi.fn(async () => []),
      create: vi.fn(async (bookmark) => ({ id: 'created', ...bookmark })),
      move: vi.fn(async () => nestedTree[0]!),
      ...overrides,
    };
  }

  it('loads a fresh snapshot from the Chrome bookmarks API', async () => {
    const bookmarks = createBookmarksApi();
    const adapter = new ChromeBookmarkTreeAdapter(bookmarks);

    const snapshot = await adapter.loadSnapshot();

    expect(bookmarks.getTree).toHaveBeenCalledOnce();
    expect(snapshot.resolveFolder('inbox')).toMatchObject({
      id: 'inbox',
      parentId: 'bar',
      path: 'Bookmarks bar/Inbox',
    });
  });

  it('re-reads and moves a bookmark by stable ID', async () => {
    const bookmark = {
      id: 'bookmark-1',
      title: 'Example',
      parentId: 'inbox',
      url: 'https://example.com',
    };
    const bookmarks = createBookmarksApi({
      get: vi.fn(async () => [bookmark]),
      move: vi.fn(async () => ({ ...bookmark, parentId: 'engineering' })),
    });
    const adapter = new ChromeBookmarkTreeAdapter(bookmarks);

    await expect(adapter.getBookmark('bookmark-1')).resolves.toEqual(bookmark);
    await adapter.moveBookmark('bookmark-1', 'engineering');

    expect(bookmarks.get).toHaveBeenCalledWith('bookmark-1');
    expect(bookmarks.move).toHaveBeenCalledWith('bookmark-1', {
      parentId: 'engineering',
    });
  });

  it('returns null when a bookmark no longer exists', async () => {
    const bookmarks = createBookmarksApi();

    await expect(
      new ChromeBookmarkTreeAdapter(bookmarks).getBookmark('deleted'),
    ).resolves.toBeNull();
  });

  it('finds only bookmarks with the exact verbatim URL', async () => {
    const exactUrl = 'https://example.com/path?query=one#section';
    const bookmarks = createBookmarksApi({
      search: vi.fn(async () => [
        { id: 'exact', title: 'Exact', url: exactUrl },
        {
          id: 'similar',
          title: 'Similar',
          url: 'https://example.com/path?query=one',
        },
        { id: 'folder', title: 'Folder' },
      ]),
    });
    const adapter = new ChromeBookmarkTreeAdapter(bookmarks);

    await expect(adapter.findByExactUrl(exactUrl)).resolves.toEqual([
      { id: 'exact', url: exactUrl },
    ]);
    expect(bookmarks.search).toHaveBeenCalledWith({ url: exactUrl });
  });

  it('returns no exact URL matches when Chrome finds none', async () => {
    const adapter = new ChromeBookmarkTreeAdapter(createBookmarksApi());

    await expect(
      adapter.findByExactUrl('https://example.com/missing'),
    ).resolves.toEqual([]);
  });

  it('creates a bookmark in the requested parent folder', async () => {
    const bookmarks = createBookmarksApi();
    const adapter = new ChromeBookmarkTreeAdapter(bookmarks);
    const input = {
      parentId: 'inbox',
      title: 'Example',
      url: 'https://example.com',
    };

    await adapter.createBookmark(input);

    expect(bookmarks.create).toHaveBeenCalledWith(input);
  });

  it.each([
    [
      'search',
      (adapter: ChromeBookmarkTreeAdapter) =>
        adapter.findByExactUrl('https://example.com'),
    ],
    [
      'create',
      (adapter: ChromeBookmarkTreeAdapter) =>
        adapter.createBookmark({
          parentId: 'inbox',
          title: 'Example',
          url: 'https://example.com',
        }),
    ],
  ])('propagates rejected Chrome %s calls', async (operation, invoke) => {
    const failure = new Error(`${operation} failed`);
    const bookmarks = createBookmarksApi({
      search: vi.fn(async () => Promise.reject(failure)),
      create: vi.fn(async () => Promise.reject(failure)),
    });

    await expect(invoke(new ChromeBookmarkTreeAdapter(bookmarks))).rejects.toBe(
      failure,
    );
  });
});

describe('BookmarkTreeSnapshot', () => {
  it('enumerates only folders in nested tree order', () => {
    const snapshot = new BookmarkTreeSnapshot(nestedTree);

    expect(snapshot.enumerateFolders().map(({ id }) => id)).toEqual([
      '0',
      'bar',
      'inbox',
      'engineering',
      'engineering-research',
      'other',
      'other-research',
    ]);
    expect(snapshot.resolveFolder('unfiled-bookmark')).toBeNull();
  });

  it('resolves duplicate names by stable ID with distinct contextual paths', () => {
    const snapshot = new BookmarkTreeSnapshot(nestedTree);

    expect(snapshot.resolveFolder('engineering-research')).toMatchObject({
      title: 'Research',
      path: 'Bookmarks bar/Engineering/Research',
    });
    expect(snapshot.resolveFolder('other-research')).toMatchObject({
      title: 'Research',
      path: 'Other bookmarks/Research',
    });
  });

  it('returns null for missing folders and identifies stale selections', () => {
    const snapshot = new BookmarkTreeSnapshot(nestedTree);

    expect(snapshot.resolveFolder('deleted')).toBeNull();
    expect(
      snapshot.findStaleFolderIds([
        'inbox',
        'deleted',
        'engineering',
        'deleted',
        'also-deleted',
      ]),
    ).toEqual(['deleted', 'also-deleted']);
  });

  it('determines strict ancestry across root, Inbox, and nested folders', () => {
    const snapshot = new BookmarkTreeSnapshot(nestedTree);

    expect(snapshot.isFolderAncestor('0', 'inbox')).toBe(true);
    expect(snapshot.isFolderAncestor('bar', 'inbox')).toBe(true);
    expect(snapshot.isFolderAncestor('inbox', '0')).toBe(false);
    expect(snapshot.isFolderAncestor('inbox', 'inbox')).toBe(false);
    expect(snapshot.isFolderAncestor('inbox', 'engineering')).toBe(false);
    expect(snapshot.isFolderAncestor('missing', 'inbox')).toBe(false);
    expect(snapshot.isFolderAncestor('0', 'missing')).toBe(false);
  });
});
