export interface BookmarkTreeNode {
  readonly id: string;
  readonly title: string;
  readonly parentId?: string;
  readonly url?: string;
  readonly children?: readonly BookmarkTreeNode[];
}

export interface BookmarkFolder {
  readonly id: string;
  readonly title: string;
  readonly parentId?: string;
  readonly path: string;
}

export interface ChromeBookmarksApi {
  getTree(): Promise<readonly BookmarkTreeNode[]>;
}

function appendPath(parentPath: string | undefined, title: string): string {
  const segment = title.trim();

  if (parentPath === undefined) {
    return segment || '/';
  }

  if (segment.length === 0) {
    return parentPath;
  }

  return parentPath === '/' ? segment : `${parentPath}/${segment}`;
}

export class BookmarkTreeSnapshot {
  private readonly foldersById = new Map<string, BookmarkFolder>();
  private readonly folderOrder: BookmarkFolder[] = [];

  constructor(tree: readonly BookmarkTreeNode[]) {
    for (const node of tree) {
      this.visit(node, undefined, undefined);
    }
  }

  enumerateFolders(): readonly BookmarkFolder[] {
    return [...this.folderOrder];
  }

  resolveFolder(folderId: string): BookmarkFolder | null {
    return this.foldersById.get(folderId) ?? null;
  }

  isFolderAncestor(
    ancestorFolderId: string,
    descendantFolderId: string,
  ): boolean {
    if (ancestorFolderId === descendantFolderId) {
      return false;
    }

    const visited = new Set<string>();
    let current = this.resolveFolder(descendantFolderId);

    while (current?.parentId !== undefined) {
      if (current.parentId === ancestorFolderId) {
        return this.resolveFolder(ancestorFolderId) !== null;
      }

      if (visited.has(current.parentId)) {
        return false;
      }

      visited.add(current.parentId);
      current = this.resolveFolder(current.parentId);
    }

    return false;
  }

  findStaleFolderIds(folderIds: readonly string[]): readonly string[] {
    return [
      ...new Set(
        folderIds.filter((folderId) => this.resolveFolder(folderId) === null),
      ),
    ];
  }

  private visit(
    node: BookmarkTreeNode,
    traversalParentId: string | undefined,
    parentPath: string | undefined,
  ): void {
    if (node.url !== undefined) {
      return;
    }

    const parentId = node.parentId ?? traversalParentId;
    const path = appendPath(parentPath, node.title);
    const folder: BookmarkFolder = {
      id: node.id,
      title: node.title,
      ...(parentId === undefined ? {} : { parentId }),
      path,
    };

    this.foldersById.set(folder.id, folder);
    this.folderOrder.push(folder);

    for (const child of node.children ?? []) {
      this.visit(child, node.id, path);
    }
  }
}

export class ChromeBookmarkTreeAdapter {
  constructor(private readonly bookmarks: ChromeBookmarksApi) {}

  async loadSnapshot(): Promise<BookmarkTreeSnapshot> {
    return new BookmarkTreeSnapshot(await this.bookmarks.getTree());
  }
}

export function createChromeBookmarkTreeAdapter(): ChromeBookmarkTreeAdapter {
  return new ChromeBookmarkTreeAdapter(browser.bookmarks);
}
