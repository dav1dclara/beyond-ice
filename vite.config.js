import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import vue from "@vitejs/plugin-vue";

const cesiumSource = "node_modules/cesium/Build/Cesium";
const cesiumBaseUrl = "cesium";

export default defineConfig({
  base: "/project/dclara/", // IMPORTANT: Replace with your student ID
  plugins: [
    vue(),
    viteStaticCopy({
      targets: [
        { src: `${cesiumSource}/ThirdParty`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Workers`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Assets`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Widgets`, dest: cesiumBaseUrl },
      ],
    }),
  ],
  server: {
    port: 3000,
    open: true,
  },
  preview: {
    port: 3010,
    open: true,
  },
  define: {
    CESIUM_BASE_URL: JSON.stringify(cesiumBaseUrl),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          cesium: ["cesium"],
        },
      },
    },
    chunkSizeWarningLimit: 5000,
  },
});