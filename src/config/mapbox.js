export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Debug: Log environment variable status (only in development)
if (import.meta.env.DEV) {
  console.log("Mapbox config - VITE_MAPBOX_TOKEN exists:", !!import.meta.env.VITE_MAPBOX_TOKEN);
  console.log("Mapbox config - All VITE_ env vars:", Object.keys(import.meta.env).filter(key => key.startsWith('VITE_')));
}

