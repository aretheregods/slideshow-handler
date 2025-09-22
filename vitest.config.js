import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      'utils': '/src/utils/index.js',
      'constants': '/src/constants.js',
    }
  }
});
