import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'AI Context Reporter',
    description: 'Capture element context for AI coding agents',
    version: '0.1.0',
    permissions: ['storage', 'downloads', 'contextMenus'],
  },
});
