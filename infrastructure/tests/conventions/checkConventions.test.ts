import { describe, expect, it } from 'vitest';

import { findConventionViolations } from '../../../scripts/checkConventions.mjs';

describe('repository convention checks', () => {
  it('accepts camelCase source files and grouped tests', () => {
    expect(
      findConventionViolations([
        'features/bookmark-filing/filingWorkflow.ts',
        'features/tests/bookmark-filing/filingWorkflow.test.ts',
        'infrastructure/tests/storage/configurationStore.test.ts',
        'entrypoints/tool-required-name.ts',
        'vitest.config.ts',
      ]),
    ).toEqual([]);
  });

  it('detects a non-camelCase TypeScript filename', () => {
    expect(
      findConventionViolations(['features/bookmark-filing/filing-workflow.ts']),
    ).toContain(
      'features/bookmark-filing/filing-workflow.ts: project-owned TypeScript filenames must use camelCase',
    );
  });

  it('detects a test colocated with production code', () => {
    expect(
      findConventionViolations([
        'infrastructure/storage/configurationStore.test.ts',
      ]),
    ).toContain(
      'infrastructure/storage/configurationStore.test.ts: tests must be under features/tests/<feature>/ or infrastructure/tests/<area>/',
    );
  });
});
