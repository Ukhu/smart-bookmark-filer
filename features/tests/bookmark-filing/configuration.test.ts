import { describe, expect, it } from 'vitest';

import {
  FILING_CONFIGURATION_VERSION,
  parseFilingConfiguration,
  validateSourceDestinationBoundaries,
} from '../../bookmark-filing/configuration';

const validConfiguration = {
  version: FILING_CONFIGURATION_VERSION,
  inboxFolderId: 'inbox',
  destinationRootIds: ['engineering', 'personal'],
  openAiApiKey: 'secret-key',
  model: 'gpt-5-mini',
  confidenceThreshold: 0.8,
};

describe('parseFilingConfiguration', () => {
  it('parses a complete versioned configuration', () => {
    expect(parseFilingConfiguration(validConfiguration)).toEqual({
      ok: true,
      value: validConfiguration,
    });
  });

  it('reports every incomplete field', () => {
    const result = parseFilingConfiguration({
      version: FILING_CONFIGURATION_VERSION,
      inboxFolderId: '',
      destinationRootIds: [],
      openAiApiKey: '  ',
      model: '',
      confidenceThreshold: 0.8,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map(({ field, code }) => ({ field, code }))).toEqual(
        [
          { field: 'inboxFolderId', code: 'required' },
          { field: 'destinationRootIds', code: 'required' },
          { field: 'openAiApiKey', code: 'required' },
          { field: 'model', code: 'required' },
        ],
      );
    }
  });

  it.each([-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects an out-of-range threshold of %s',
    (confidenceThreshold) => {
      const result = parseFilingConfiguration({
        ...validConfiguration,
        confidenceThreshold,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toContainEqual(
          expect.objectContaining({
            field: 'confidenceThreshold',
            code: 'out-of-range',
          }),
        );
      }
    },
  );

  it('accepts inclusive confidence boundaries', () => {
    expect(
      parseFilingConfiguration({
        ...validConfiguration,
        confidenceThreshold: 0,
      }).ok,
    ).toBe(true);
    expect(
      parseFilingConfiguration({
        ...validConfiguration,
        confidenceThreshold: 1,
      }).ok,
    ).toBe(true);
  });

  it.each([
    null,
    [],
    {
      ...validConfiguration,
      version: 2,
    },
    {
      ...validConfiguration,
      destinationRootIds: ['engineering', 42],
    },
    {
      ...validConfiguration,
      confidenceThreshold: 'high',
    },
  ])('rejects malformed configuration data', (value) => {
    expect(parseFilingConfiguration(value).ok).toBe(false);
  });

  it('rejects duplicate destination roots', () => {
    const result = parseFilingConfiguration({
      ...validConfiguration,
      destinationRootIds: ['engineering', 'engineering'],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          field: 'destinationRootIds',
          code: 'duplicate',
        }),
      );
    }
  });
});

describe('validateSourceDestinationBoundaries', () => {
  const parseValidConfiguration = () => {
    const result = parseFilingConfiguration(validConfiguration);
    if (!result.ok) {
      throw new Error('Test fixture must be valid.');
    }
    return result.value;
  };

  it('accepts separate Inbox and destination subtrees', () => {
    expect(
      validateSourceDestinationBoundaries(
        parseValidConfiguration(),
        () => false,
      ),
    ).toEqual([]);
  });

  it.each([
    ['the Inbox itself', 'inbox', []],
    ['a descendant of the Inbox', 'inbox-child', [['inbox', 'inbox-child']]],
    ['an ancestor of the Inbox', 'root', [['root', 'inbox']]],
  ])('rejects %s as a destination root', (_label, rootId, ancestorPairs) => {
    const parsed = parseFilingConfiguration({
      ...validConfiguration,
      destinationRootIds: [rootId],
    });
    if (!parsed.ok) {
      throw new Error('Test fixture must be valid.');
    }

    const issues = validateSourceDestinationBoundaries(
      parsed.value,
      (ancestorId, descendantId) =>
        ancestorPairs.some(
          ([ancestor, descendant]) =>
            ancestor === ancestorId && descendant === descendantId,
        ),
    );

    expect(issues).toContainEqual(
      expect.objectContaining({
        field: 'destinationRootIds',
        code: 'source-destination-overlap',
      }),
    );
  });
});
