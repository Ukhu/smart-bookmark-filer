# Repository Guidelines

These rules apply repository-wide:

- Use camelCase for every project-owned TypeScript filename.
- Keep tests outside production directories. Place feature tests under `features/tests/<feature>/` and infrastructure tests under `infrastructure/tests/<area>/`.
- Preserve exact filenames required by tools. Tool-required filenames, including WXT entrypoint names, are exceptions to the camelCase rule.
