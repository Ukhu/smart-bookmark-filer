import type {
  FilingActivity,
  FilingActivityOutcome,
  FilingActivityStore,
  FilingCancellationReason,
} from './filingActivity';
import type { ClassificationUnresolvedCategory } from './classification';

export type OptionsActivityTone =
  'processing' | 'success' | 'unresolved' | 'canceled' | 'error';

export interface OptionsActivityItem {
  readonly bookmarkId: string;
  readonly title: string;
  readonly updatedAt: number;
  readonly outcomeKind: FilingActivityOutcome['kind'];
  readonly tone: OptionsActivityTone;
  readonly label: string;
  readonly detail: string;
}

export type OptionsActivityViewState =
  | {
      readonly kind: 'activity';
      readonly items: readonly OptionsActivityItem[];
    }
  | { readonly kind: 'empty'; readonly items: readonly [] }
  | { readonly kind: 'error'; readonly message: string };

export type OptionsActivityListener = (state: OptionsActivityViewState) => void;

const LOAD_ERROR_MESSAGE = 'Recent activity could not be loaded.';
const CLEAR_ERROR_MESSAGE = 'Recent activity could not be cleared.';

function percentage(confidence: number): string {
  return `${Math.round(confidence * 100)}% confidence`;
}

function unresolvedReason(reason: ClassificationUnresolvedCategory): string {
  switch (reason) {
    case 'no-candidates':
      return 'No eligible destination folders were available.';
    case 'missing-credentials':
      return 'OpenAI credentials were not configured.';
    case 'authorization-error':
      return 'OpenAI authorization failed.';
    case 'rate-limit':
      return 'OpenAI rate-limited the request.';
    case 'provider-error':
      return 'OpenAI could not complete the request.';
    case 'network-error':
      return 'The network request failed.';
    case 'timeout':
      return 'The classification request timed out.';
    case 'invalid-response':
      return 'OpenAI returned an invalid classification response.';
    default: {
      const exhaustiveReason: never = reason;
      return exhaustiveReason;
    }
  }
}

function cancellationReason(reason: FilingCancellationReason): string {
  switch (reason) {
    case 'bookmark-changed':
      return 'The bookmark changed before filing finished.';
    case 'configuration-changed':
      return 'Filing settings changed before filing finished.';
    case 'destination-changed':
      return 'The destination changed before filing finished.';
    default: {
      const exhaustiveReason: never = reason;
      return exhaustiveReason;
    }
  }
}

function displayOutcome(
  outcome: FilingActivityOutcome,
): Pick<OptionsActivityItem, 'tone' | 'label' | 'detail'> {
  switch (outcome.kind) {
    case 'processing':
      return {
        tone: 'processing',
        label: 'Processing',
        detail: 'Automatic filing is in progress or was interrupted.',
      };
    case 'filed':
      return {
        tone: 'success',
        label: 'Filed',
        detail: `Filed to ${outcome.destinationPath} with ${percentage(outcome.confidence)}.`,
      };
    case 'unresolved':
      return {
        tone: 'unresolved',
        label: 'Unresolved',
        detail: unresolvedReason(outcome.reason),
      };
    case 'below-threshold':
      return {
        tone: 'unresolved',
        label: 'Below confidence threshold',
        detail: `The ${percentage(outcome.confidence)} result was not accepted.`,
      };
    case 'canceled':
      return {
        tone: 'canceled',
        label: 'Canceled',
        detail: cancellationReason(outcome.reason),
      };
    case 'unexpected-failure':
      return {
        tone: 'error',
        label: 'Extension error',
        detail:
          'Automatic filing stopped because of an unexpected extension error.',
      };
  }
}

function toViewState(
  activity: readonly FilingActivity[],
): OptionsActivityViewState {
  const items = [...activity]
    .sort((first, second) => {
      if (second.updatedAt !== first.updatedAt) {
        return second.updatedAt - first.updatedAt;
      }
      return second.createdAt - first.createdAt;
    })
    .map((record) => ({
      bookmarkId: record.bookmarkId,
      title: record.title,
      updatedAt: record.updatedAt,
      outcomeKind: record.outcome.kind,
      ...displayOutcome(record.outcome),
    }));

  return items.length === 0
    ? { kind: 'empty', items: [] }
    : { kind: 'activity', items };
}

export class OptionsActivityController {
  constructor(private readonly store: FilingActivityStore) {}

  async load(): Promise<OptionsActivityViewState> {
    try {
      return toViewState(await this.store.load());
    } catch {
      return { kind: 'error', message: LOAD_ERROR_MESSAGE };
    }
  }

  observe(listener: OptionsActivityListener): () => void {
    return this.store.observe((activity) => listener(toViewState(activity)));
  }

  async clear(confirmed: boolean): Promise<OptionsActivityViewState> {
    if (!confirmed) {
      return this.load();
    }

    try {
      await this.store.clear();
      return { kind: 'empty', items: [] };
    } catch {
      return { kind: 'error', message: CLEAR_ERROR_MESSAGE };
    }
  }
}
