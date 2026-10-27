import { describe, expect, it } from 'vitest';

import {
  CLASSIFICATION_UNRESOLVED_CATEGORIES,
  type BookmarkClassificationResult,
  type BookmarkClassifier,
  type ClassificationUnresolvedCategory,
} from '../../bookmark-filing/classification';

function describeResult(result: BookmarkClassificationResult): string {
  switch (result.kind) {
    case 'success':
      return `${result.folderId}:${result.confidence}`;
    case 'unresolved':
      return describeUnresolvedCategory(result.category);
    default: {
      const exhaustiveResult: never = result;
      return exhaustiveResult;
    }
  }
}

function describeUnresolvedCategory(
  category: ClassificationUnresolvedCategory,
): string {
  switch (category) {
    case 'no-candidates':
      return 'no-candidates';
    case 'missing-credentials':
      return 'missing-credentials';
    case 'authorization-error':
      return 'authorization-error';
    case 'rate-limit':
      return 'rate-limit';
    case 'provider-error':
      return 'provider-error';
    case 'network-error':
      return 'network-error';
    case 'timeout':
      return 'timeout';
    case 'invalid-response':
      return 'invalid-response';
    default: {
      const exhaustiveCategory: never = category;
      return exhaustiveCategory;
    }
  }
}

describe('BookmarkClassifier', () => {
  it('exposes a provider-neutral successful classification', async () => {
    const classifier: BookmarkClassifier = {
      classify: async () => ({
        kind: 'success',
        folderId: 'engineering',
        confidence: 0.92,
      }),
    };

    const result = await classifier.classify({
      title: 'TypeScript handbook',
      url: 'https://www.typescriptlang.org/docs/',
      candidates: [{ folderId: 'engineering', path: 'Engineering' }],
      apiKey: 'secret-key',
      model: 'configured-model',
    });

    expect(result).toEqual({
      kind: 'success',
      folderId: 'engineering',
      confidence: 0.92,
    });
    expect(describeResult(result)).toBe('engineering:0.92');
  });

  it.each(CLASSIFICATION_UNRESOLVED_CATEGORIES)(
    'represents the %s category without a destination',
    (category) => {
      const result: BookmarkClassificationResult = {
        kind: 'unresolved',
        category,
      };

      expect(result).toEqual({ kind: 'unresolved', category });
      expect('folderId' in result).toBe(false);
      expect(describeResult(result)).toBe(category);
    },
  );
});
