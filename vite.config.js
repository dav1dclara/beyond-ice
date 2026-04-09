import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import eslint from 'vite-plugin-eslint';

export default defineConfig({
  base: '/scenarios/',
  plugins: [vue(), eslint()],
  server: {
    port: 3000,
    open: true,
  },
  preview: {
    port: 3010,
    open: true,
  },
});
