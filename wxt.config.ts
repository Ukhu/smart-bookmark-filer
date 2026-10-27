import { defineConfig } from 'wxt';

export default defineConfig({
  webExt: {
    disabled: true,
  },
  manifest: {
    name: 'Smart Bookmark Filer',
    description:
      'A personal Chrome extension for automatically organizing bookmarks.',
    version: '0.1.0',
    permissions: ['bookmarks', 'storage'],
    host_permissions: ['https://api.openai.com/*'],
  },
});
