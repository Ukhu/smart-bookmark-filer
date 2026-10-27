import { existsSync, readdirSync } from 'node:fs';
import { basename, extname, join, relative, sep } from 'node:path';

import { defineConfig, type DefaultTheme } from 'vitepress';

const openspecDir = join(import.meta.dirname, '..', 'openspec');

function titleCase(value: string): string {
  return value
    .split(/[-_]/u)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function changeTitle(name: string): string {
  const datedName = /^(\d{4}-\d{2}-\d{2})-(.+)$/u.exec(name);

  return datedName
    ? `${datedName[1]} — ${titleCase(datedName[2])}`
    : titleCase(name);
}

function markdownFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        return markdownFiles(path);
      }

      return entry.isFile() && extname(entry.name) === '.md' ? [path] : [];
    });
}

function routeFor(file: string): string {
  const sourcePath = relative(openspecDir, file).split(sep).join('/');

  return `/${sourcePath.slice(0, -extname(sourcePath).length)}`;
}

function pageItem(file: string): DefaultTheme.SidebarItem {
  const fileName = basename(file, extname(file));
  const parentName = basename(join(file, '..'));
  const text =
    fileName === 'spec' ? titleCase(parentName) : titleCase(fileName);

  return { text, link: routeFor(file) };
}

function changeItems(directory: string): DefaultTheme.SidebarItem[] {
  const files = markdownFiles(directory);
  const namedArtifact = (name: string) =>
    files.find((file) => relative(directory, file) === `${name}.md`);
  const specificationFiles = files.filter((file) =>
    relative(directory, file).startsWith(`specs${sep}`),
  );
  const items: DefaultTheme.SidebarItem[] = [];

  for (const artifactName of ['proposal'] as const) {
    const file = namedArtifact(artifactName);
    if (file) items.push(pageItem(file));
  }

  if (specificationFiles.length > 0) {
    items.push({
      text: 'Specs',
      collapsed: false,
      items: specificationFiles.map(pageItem),
    });
  }

  for (const artifactName of ['design', 'tasks'] as const) {
    const file = namedArtifact(artifactName);
    if (file) items.push(pageItem(file));
  }

  return items;
}

function changeGroups(
  directory: string,
  collapsed: boolean,
): DefaultTheme.SidebarItem[] {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'archive')
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => ({
      text: changeTitle(entry.name),
      collapsed,
      items: changeItems(join(directory, entry.name)),
    }));
}

function durableSpecItems(): DefaultTheme.SidebarItem[] {
  return markdownFiles(join(openspecDir, 'specs')).map(pageItem);
}

function sidebar(): DefaultTheme.SidebarItem[] {
  const activeChanges = changeGroups(join(openspecDir, 'changes'), false);
  const durableSpecs = durableSpecItems();
  const archivedChanges = changeGroups(
    join(openspecDir, 'changes', 'archive'),
    true,
  );

  return [
    { text: 'Review Home', link: '/' },
    {
      text: 'Active Changes',
      collapsed: false,
      items: activeChanges,
    },
    ...(durableSpecs.length > 0
      ? [
          {
            text: 'Durable Specifications',
            collapsed: false,
            items: durableSpecs,
          },
        ]
      : []),
    {
      text: 'Archived Changes',
      collapsed: true,
      items: archivedChanges,
    },
  ];
}

export default defineConfig({
  srcDir: './openspec',
  appearance: true,
  themeConfig: {
    search: {
      provider: 'local',
    },
    outline: [2, 4],
    sidebar: sidebar(),
  },
});
