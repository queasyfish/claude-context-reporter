import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Claude Context Report',
    description: 'DevTools extension for capturing element context for AI',
    version: '0.1.0',
    permissions: ['storage', 'downloads', 'contextMenus'],
  },
});
