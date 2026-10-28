import type { CreatedBookmark } from './filingWorkflow';

export interface BookmarkCreatedEvent {
  addListener(
    listener: (bookmarkId: string, bookmark: CreatedBookmark) => void,
  ): void;
}

export interface CreatedBookmarkProcessor {
  processCreatedBookmark(bookmark: CreatedBookmark): Promise<unknown>;
}

export function registerBookmarkCreatedListener(
  event: BookmarkCreatedEvent,
  processor: CreatedBookmarkProcessor,
): void {
  event.addListener((bookmarkId, bookmark) => {
    const requestBookmark: CreatedBookmark = {
      id: bookmarkId,
      title: bookmark.title,
      ...(bookmark.parentId === undefined
        ? {}
        : { parentId: bookmark.parentId }),
      ...(bookmark.url === undefined ? {} : { url: bookmark.url }),
    };

    void processor.processCreatedBookmark(requestBookmark).catch(() => {
      // An unexpected boundary failure leaves the bookmark unchanged.
    });
  });
}
