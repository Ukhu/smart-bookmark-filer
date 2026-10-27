import console from 'node:console';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ignoredDirectories = new Set([
  '.git',
  '.opencode',
  '.output',
  '.wxt',
  'coverage',
  'node_modules',
  'openspec',
]);

const toolRequiredTypeScriptFiles = new Set([
  'vitest.config.ts',
  'wxt.config.ts',
]);

const typeScriptExtensionPattern = /\.(?:cts|mts|tsx?)$/;
const testFilePattern = /\.(?:spec|test)\.(?:cts|mts|tsx?)$/;
const camelCasePattern = /^[a-z][A-Za-z0-9]*$/;

async function collectFiles(rootDirectory, currentDirectory = rootDirectory) {
  const entries = await readdir(currentDirectory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue;
    }

    const absolutePath = path.join(currentDirectory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...(await collectFiles(rootDirectory, absolutePath)));
      }
      continue;
    }

    if (entry.isFile()) {
      files.push(
        path.relative(rootDirectory, absolutePath).split(path.sep).join('/'),
      );
    }
  }

  return files;
}

function isToolRequiredTypeScriptFile(relativePath) {
  return (
    relativePath.startsWith('entrypoints/') ||
    toolRequiredTypeScriptFiles.has(relativePath)
  );
}

function getTypeScriptBasename(relativePath) {
  return path.posix
    .basename(relativePath)
    .replace(typeScriptExtensionPattern, '');
}

function isAllowedTestLocation(relativePath) {
  const segments = relativePath.split('/');
  const isGroupedFeatureTest =
    segments[0] === 'features' &&
    segments[1] === 'tests' &&
    Boolean(segments[2]);
  const isGroupedInfrastructureTest =
    segments[0] === 'infrastructure' &&
    segments[1] === 'tests' &&
    Boolean(segments[2]);

  return isGroupedFeatureTest || isGroupedInfrastructureTest;
}

export function findConventionViolations(relativePaths) {
  const violations = [];

  for (const relativePath of relativePaths) {
    if (!typeScriptExtensionPattern.test(relativePath)) {
      continue;
    }

    if (!isToolRequiredTypeScriptFile(relativePath)) {
      const basename = getTypeScriptBasename(relativePath)
        .replace(/\.(?:spec|test)$/, '')
        .replace(/\.d$/, '');

      if (!camelCasePattern.test(basename)) {
        violations.push(
          `${relativePath}: project-owned TypeScript filenames must use camelCase`,
        );
      }
    }

    if (
      testFilePattern.test(relativePath) &&
      !isAllowedTestLocation(relativePath)
    ) {
      violations.push(
        `${relativePath}: tests must be under features/tests/<feature>/ or infrastructure/tests/<area>/`,
      );
    }
  }

  return violations;
}

export async function checkConventions(rootDirectory) {
  const files = await collectFiles(rootDirectory);
  return findConventionViolations(files);
}

async function main() {
  const rootArgumentIndex = process.argv.indexOf('--root');
  const rootDirectory =
    rootArgumentIndex >= 0
      ? path.resolve(process.argv[rootArgumentIndex + 1] ?? '')
      : process.cwd();
  const violations = await checkConventions(rootDirectory);

  if (violations.length > 0) {
    console.error('Repository convention violations:');
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('Repository conventions passed.');
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
  await main();
}
