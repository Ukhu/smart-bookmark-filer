import type {
  ActionCapturePresentation,
  ActionCapturePresenter,
} from '../../features/bookmark-capture/actionClickListener';

export const DEFAULT_ACTION_TITLE = 'Save current page to Inbox';
export const ACTION_FEEDBACK_DURATION_MS = 2_000;

interface ActionFeedbackContent {
  readonly badgeText: string;
  readonly color: string;
  readonly title: string;
}

const feedbackByKind: Record<
  ActionCapturePresentation['kind'],
  ActionFeedbackContent
> = {
  accepted: {
    badgeText: 'OK',
    color: '#137333',
    title: 'Bookmark saved to Inbox',
  },
  'already-bookmarked': {
    badgeText: '=',
    color: '#5f6368',
    title: 'Page is already bookmarked',
  },
  'setup-unavailable': {
    badgeText: '!',
    color: '#b06000',
    title: 'Set up Smart Bookmark Filer to save this page',
  },
  failed: {
    badgeText: '!',
    color: '#b3261e',
    title: 'Bookmark could not be saved',
  },
};

export interface ChromeActionApi {
  setBadgeBackgroundColor(details: {
    readonly color: string;
    readonly tabId: number;
  }): Promise<void>;
  setBadgeText(details: {
    readonly tabId: number;
    readonly text: string;
  }): Promise<void>;
  setTitle(details: {
    readonly tabId: number;
    readonly title: string;
  }): Promise<void>;
}

export interface ChromeRuntimeApi {
  openOptionsPage(): Promise<void>;
}

type FeedbackTimer = ReturnType<typeof setTimeout>;

export class ChromeActionFeedback implements ActionCapturePresenter {
  private readonly clearTimers = new Map<number, FeedbackTimer>();
  private readonly presentationVersions = new Map<number, number>();

  constructor(
    private readonly action: ChromeActionApi,
    private readonly runtime: ChromeRuntimeApi,
    private readonly durationMs = ACTION_FEEDBACK_DURATION_MS,
  ) {}

  async present(
    tabId: number | undefined,
    presentation: ActionCapturePresentation,
  ): Promise<void> {
    if (presentation.kind === 'setup-unavailable') {
      void this.runtime.openOptionsPage().catch(() => undefined);
    }

    if (tabId === undefined) return;

    const version = (this.presentationVersions.get(tabId) ?? 0) + 1;
    this.presentationVersions.set(tabId, version);
    this.cancelClear(tabId);
    await this.clearBrowserFeedback(tabId);

    if (this.presentationVersions.get(tabId) !== version) return;

    const feedback = feedbackByKind[presentation.kind];
    await Promise.allSettled([
      this.action.setBadgeBackgroundColor({
        color: feedback.color,
        tabId,
      }),
      this.action.setBadgeText({ tabId, text: feedback.badgeText }),
      this.action.setTitle({ tabId, title: feedback.title }),
    ]);

    if (this.presentationVersions.get(tabId) !== version) return;

    this.clearTimers.set(
      tabId,
      setTimeout(() => {
        void this.clearIfCurrent(tabId, version);
      }, this.durationMs),
    );
  }

  private cancelClear(tabId: number): void {
    const timer = this.clearTimers.get(tabId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.clearTimers.delete(tabId);
    }
  }

  private async clearIfCurrent(tabId: number, version: number): Promise<void> {
    if (this.presentationVersions.get(tabId) !== version) return;

    this.clearTimers.delete(tabId);
    await this.clearBrowserFeedback(tabId);
  }

  private async clearBrowserFeedback(tabId: number): Promise<void> {
    await Promise.allSettled([
      this.action.setBadgeText({ tabId, text: '' }),
      this.action.setTitle({ tabId, title: DEFAULT_ACTION_TITLE }),
    ]);
  }
}

export function createChromeActionFeedback(): ChromeActionFeedback {
  return new ChromeActionFeedback(browser.action, browser.runtime);
}
