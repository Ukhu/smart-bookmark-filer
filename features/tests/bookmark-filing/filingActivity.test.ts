import { describe, expect, it } from 'vitest';

import {
  FILING_ACTIVITY_VERSION,
  parseFilingActivity,
  parseFilingActivityHistory,
} from '../../bookmark-filing/filingActivity';

const baseActivity = {
  version: FILING_ACTIVITY_VERSION,
  bookmarkId: 'bookmark-1',
  title: 'TypeScript handbook',
  createdAt: 1_000,
  updatedAt: 2_000,
};

describe('parseFilingActivity', () => {
  it.each([
    { kind: 'processing' },
    {
      kind: 'filed',
      confidence: 0.92,
      destinationFolderId: 'typescript',
      destinationPath: 'Engineering / TypeScript',
    },
    { kind: 'unresolved', reason: 'no-candidates' },
    { kind: 'unresolved', reason: 'missing-credentials' },
    { kind: 'unresolved', reason: 'authorization-error' },
    { kind: 'unresolved', reason: 'rate-limit' },
    { kind: 'unresolved', reason: 'provider-error' },
    { kind: 'unresolved', reason: 'network-error' },
    { kind: 'unresolved', reason: 'timeout' },
    { kind: 'unresolved', reason: 'invalid-response' },
    { kind: 'below-threshold', confidence: 0.42 },
    { kind: 'canceled', reason: 'bookmark-changed' },
    { kind: 'canceled', reason: 'configuration-changed' },
    { kind: 'canceled', reason: 'destination-changed' },
    { kind: 'unexpected-failure' },
  ])('parses the $kind outcome variant', (outcome) => {
    const activity = { ...baseActivity, outcome };

    expect(parseFilingActivity(activity)).toEqual(activity);
  });

  it.each([
    null,
    [],
    { ...baseActivity, version: 2, outcome: { kind: 'processing' } },
    { ...baseActivity, bookmarkId: '', outcome: { kind: 'processing' } },
    { ...baseActivity, title: 42, outcome: { kind: 'processing' } },
    { ...baseActivity, createdAt: -1, outcome: { kind: 'processing' } },
    { ...baseActivity, updatedAt: 999, outcome: { kind: 'processing' } },
    { ...baseActivity, outcome: { kind: 'unknown' } },
    {
      ...baseActivity,
      outcome: { kind: 'filed', confidence: 2, destinationFolderId: 'a' },
    },
    { ...baseActivity, outcome: { kind: 'unresolved', reason: 'raw-error' } },
    { ...baseActivity, outcome: { kind: 'canceled', reason: 'other' } },
  ])('rejects malformed activity data', (value) => {
    expect(parseFilingActivity(value)).toBeNull();
  });

  it.each([
    ['url', 'https://example.com'],
    ['openAiApiKey', 'secret-key'],
    ['authorization', 'Bearer secret'],
    ['providerResponse', { private: true }],
    ['error', 'raw exception text'],
  ])('rejects the forbidden top-level field %s', (field, forbiddenValue) => {
    expect(
      parseFilingActivity({
        ...baseActivity,
        outcome: { kind: 'processing' },
        [field]: forbiddenValue,
      }),
    ).toBeNull();
  });

  it('rejects forbidden details nested in an outcome', () => {
    expect(
      parseFilingActivity({
        ...baseActivity,
        outcome: {
          kind: 'unexpected-failure',
          error: 'API key secret-key failed at https://example.com',
        },
      }),
    ).toBeNull();
  });
});

describe('parseFilingActivityHistory', () => {
  it('parses an empty or fully valid history', () => {
    expect(parseFilingActivityHistory([])).toEqual([]);
    expect(
      parseFilingActivityHistory([
        { ...baseActivity, outcome: { kind: 'processing' } },
      ]),
    ).toHaveLength(1);
  });

  it('rejects a non-array or a history containing one malformed record', () => {
    expect(parseFilingActivityHistory({})).toBeNull();
    expect(
      parseFilingActivityHistory([
        { ...baseActivity, outcome: { kind: 'processing' } },
        { malformed: true },
      ]),
    ).toBeNull();
  });
});
