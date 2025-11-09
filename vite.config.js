import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '');
  const mapboxToken = process.env.VITE_MAPBOX_TOKEN || env.VITE_MAPBOX_TOKEN || '';
  
  console.log('Vite config - mode:', mode);
  console.log('Vite config - VITE_MAPBOX_TOKEN from process.env:', !!process.env.VITE_MAPBOX_TOKEN);
  console.log('Vite config - VITE_MAPBOX_TOKEN from loadEnv:', !!env.VITE_MAPBOX_TOKEN);
  console.log('Vite config - Final token length:', mapboxToken.length);
  
  return {
    base: "/project/dclara/", // IMPORTANT: Replace with your student ID
    plugins: [vue()],
    define: {
      // Explicitly replace import.meta.env.VITE_MAPBOX_TOKEN with the actual value
      'import.meta.env.VITE_MAPBOX_TOKEN': JSON.stringify(mapboxToken),
    },
    server: {
      port: 3000,
      open: true,
    },
    preview: {
      port: 3010,
      open: true,
    },
  };
});