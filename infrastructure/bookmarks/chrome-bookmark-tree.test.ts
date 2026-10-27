import { describe, expect, it, vi } from 'vitest';

import {
  BookmarkTreeSnapshot,
  ChromeBookmarkTreeAdapter,
  type BookmarkTreeNode,
  type ChromeBookmarksApi,
} from './chrome-bookmark-tree';

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
  it('loads a fresh snapshot from the Chrome bookmarks API', async () => {
    const bookmarks: ChromeBookmarksApi = {
      getTree: vi.fn(async () => nestedTree),
    };
    const adapter = new ChromeBookmarkTreeAdapter(bookmarks);

    const snapshot = await adapter.loadSnapshot();

    expect(bookmarks.getTree).toHaveBeenCalledOnce();
    expect(snapshot.resolveFolder('inbox')).toMatchObject({
      id: 'inbox',
      parentId: 'bar',
      path: 'Bookmarks bar/Inbox',
    });
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
