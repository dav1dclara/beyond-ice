import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  // Also check process.env (for CI/CD)
  const mapboxToken = process.env.VITE_MAPBOX_TOKEN || env.VITE_MAPBOX_TOKEN || '';
  
  return {
    base: "/project/dclara/", // IMPORTANT: Replace with your student ID
    plugins: [vue()],
    define: {
      // Explicitly define the token from environment
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