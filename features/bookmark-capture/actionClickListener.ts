import type {
  ActivePageCapture,
  BookmarkCaptureResult,
} from './bookmarkCaptureController';

export interface ActionClickedTab {
  readonly id?: number;
  readonly title?: string;
  readonly url?: string;
}

export interface ActionClickedEvent {
  addListener(listener: (tab: ActionClickedTab) => void): void;
}

export interface ActivePageCaptureProcessor {
  capture(page: ActivePageCapture): Promise<BookmarkCaptureResult>;
}

export type ActionCapturePresentation =
  | { readonly kind: 'accepted' }
  | { readonly kind: 'already-bookmarked' }
  | { readonly kind: 'setup-unavailable' }
  | { readonly kind: 'failed' };

export interface ActionCapturePresenter {
  present(
    tabId: number | undefined,
    presentation: ActionCapturePresentation,
  ): Promise<void>;
}

function toPresentation(
  result: BookmarkCaptureResult,
): ActionCapturePresentation {
  return result.kind === 'page-unavailable' ? { kind: 'failed' } : result;
}

async function handleActionClick(
  tab: ActionClickedTab,
  capture: ActivePageCaptureProcessor,
  presenter: ActionCapturePresenter,
): Promise<void> {
  let presentation: ActionCapturePresentation;

  try {
    const page: ActivePageCapture = {
      ...(tab.url === undefined ? {} : { url: tab.url }),
      ...(tab.title === undefined ? {} : { title: tab.title }),
    };
    presentation = toPresentation(await capture.capture(page));
  } catch {
    presentation = { kind: 'failed' };
  }

  try {
    await presenter.present(tab.id, presentation);
  } catch {
    // Action feedback is best-effort and must not reject the browser event.
  }
}

export function registerActionClickListener(
  event: ActionClickedEvent,
  capture: ActivePageCaptureProcessor,
  presenter: ActionCapturePresenter,
): void {
  event.addListener((tab) => {
    void handleActionClick(tab, capture, presenter);
  });
}
