import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '.output/**',
      '.vitepress/cache/**',
      '.vitepress/dist/**',
      '.wxt/**',
      'coverage/**',
      'node_modules/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['features/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/infrastructure/**'],
              message:
                'Feature code must depend on feature-owned ports, not infrastructure implementations.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['entrypoints/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/infrastructure/openai/**',
                '**/infrastructure/storage/**',
              ],
              message:
                'Entrypoints must use the bookmark-filing composition boundary instead of provider or storage implementations.',
            },
          ],
        },
      ],
    },
  },
);
