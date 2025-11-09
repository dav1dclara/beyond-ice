import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  base: "/project/dclara/", // IMPORTANT: Replace with your student ID
  plugins: [vue()],
  server: {
    port: 3000,
    open: true,
  },
  preview: {
    port: 3010,
    open: true,
  },
});