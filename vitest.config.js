// This file was reviewed by Jules and the jsdom environment is correctly configured.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      'zipjs': '@zip.js/zip.js',
      'utils': '/src/utils/index.js',
      'constants': '/src/constants.js',
    }
  }
});
