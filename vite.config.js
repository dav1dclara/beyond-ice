import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  // Load environment variables - Vite automatically loads .env.production for production mode
  const env = loadEnv(mode, process.cwd(), '');
  
  // Get token from environment (process.env takes precedence, then .env file)
  const mapboxToken = process.env.VITE_MAPBOX_TOKEN || env.VITE_MAPBOX_TOKEN || '';
  
  console.log('[Vite Config] Mode:', mode);
  console.log('[Vite Config] Token from process.env:', !!process.env.VITE_MAPBOX_TOKEN);
  console.log('[Vite Config] Token from loadEnv:', !!env.VITE_MAPBOX_TOKEN);
  console.log('[Vite Config] Final token length:', mapboxToken.length);
  
  return {
    base: "/project/dclara/", // IMPORTANT: Replace with your student ID
    plugins: [vue()],
    define: {
      // Explicitly define the token - this will replace import.meta.env.VITE_MAPBOX_TOKEN
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