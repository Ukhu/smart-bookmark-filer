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
    action: {
      default_title: 'Save current page to Inbox',
    },
    permissions: ['activeTab', 'bookmarks', 'storage'],
    host_permissions: ['https://api.openai.com/*'],
  },
});
