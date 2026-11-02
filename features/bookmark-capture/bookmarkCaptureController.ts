import {
  validateSourceDestinationBoundaries,
  type FilingConfiguration,
} from '../bookmark-filing/configuration';

export interface ActivePageCapture {
  readonly url?: string;
  readonly title?: string;
}

export type BookmarkCaptureResult =
  | { readonly kind: 'accepted' }
  | { readonly kind: 'already-bookmarked' }
  | { readonly kind: 'setup-unavailable' }
  | { readonly kind: 'page-unavailable' }
  | { readonly kind: 'failed' };

export interface CaptureConfigurationReader {
  load(): Promise<FilingConfiguration | null>;
}

export interface CaptureFolderSnapshot {
  findStaleFolderIds(folderIds: readonly string[]): readonly string[];
  isFolderAncestor(
    ancestorFolderId: string,
    descendantFolderId: string,
  ): boolean;
}

export interface CaptureFolderTree {
  loadSnapshot(): Promise<CaptureFolderSnapshot>;
}

export interface ExactUrlBookmark {
  readonly id: string;
  readonly url: string;
}

export interface ExactUrlBookmarkLookup {
  findByExactUrl(url: string): Promise<readonly ExactUrlBookmark[]>;
}

export interface InboxBookmarkCreator {
  createBookmark(input: {
    readonly parentId: string;
    readonly title: string;
    readonly url: string;
  }): Promise<void>;
}

export interface BookmarkCaptureDependencies {
  readonly configuration: CaptureConfigurationReader;
  readonly folderTree: CaptureFolderTree;
  readonly exactUrlLookup: ExactUrlBookmarkLookup;
  readonly inboxBookmarks: InboxBookmarkCreator;
}

function hasReadyFilingSetup(
  configuration: FilingConfiguration,
  snapshot: CaptureFolderSnapshot,
): boolean {
  const configuredFolderIds = [
    configuration.inboxFolderId,
    ...configuration.destinationRootIds,
  ];

  return (
    snapshot.findStaleFolderIds(configuredFolderIds).length === 0 &&
    validateSourceDestinationBoundaries(
      configuration,
      snapshot.isFolderAncestor.bind(snapshot),
    ).length === 0
  );
}

export class BookmarkCaptureController {
  private pendingCriticalSection: Promise<void> = Promise.resolve();

  constructor(private readonly dependencies: BookmarkCaptureDependencies) {}

  async capture(page: ActivePageCapture): Promise<BookmarkCaptureResult> {
    if (page.url === undefined || page.url.trim().length === 0) {
      return { kind: 'page-unavailable' };
    }

    const url = page.url;
    const title =
      page.title === undefined || page.title.trim().length === 0
        ? url
        : page.title;

    try {
      const configuration = await this.dependencies.configuration.load();

      if (configuration === null) {
        return { kind: 'setup-unavailable' };
      }

      const snapshot = await this.dependencies.folderTree.loadSnapshot();

      if (!hasReadyFilingSetup(configuration, snapshot)) {
        return { kind: 'setup-unavailable' };
      }

      return await this.runCaptureCriticalSection(async () => {
        const matches =
          await this.dependencies.exactUrlLookup.findByExactUrl(url);

        if (matches.length > 0) {
          return { kind: 'already-bookmarked' };
        }

        await this.dependencies.inboxBookmarks.createBookmark({
          parentId: configuration.inboxFolderId,
          title,
          url,
        });

        return { kind: 'accepted' };
      });
    } catch {
      return { kind: 'failed' };
    }
  }

  private async runCaptureCriticalSection(
    operation: () => Promise<BookmarkCaptureResult>,
  ): Promise<BookmarkCaptureResult> {
    const result = this.pendingCriticalSection.then(operation, operation);
    this.pendingCriticalSection = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
