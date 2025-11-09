export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Debug: Log token status (works in both dev and production)
console.log("=== Mapbox Config Debug ===");
console.log("MAPBOX_TOKEN value:", MAPBOX_TOKEN);
console.log("MAPBOX_TOKEN type:", typeof MAPBOX_TOKEN);
console.log("MAPBOX_TOKEN truthy?", !!MAPBOX_TOKEN);
console.log("MAPBOX_TOKEN length:", MAPBOX_TOKEN ? MAPBOX_TOKEN.length : 0);
console.log("import.meta.env.VITE_MAPBOX_TOKEN:", import.meta.env.VITE_MAPBOX_TOKEN);
console.log("import.meta.env keys:", Object.keys(import.meta.env).filter(key => key.includes('MAPBOX') || key.includes('VITE')));
console.log("========================");

