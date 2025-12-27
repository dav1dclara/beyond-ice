// Vite will replace this at build time
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

/**
 * Map projection names to Mapbox tileset IDs
 * Each scenario has its own tileset
 */
export const TILESET_IDS = {
  'SSP1-2.6': 'davidclara.4wlqt2wx',
  'SSP2-4.5': 'davidclara.0xz49bme',
  'SSP3-7.0': 'davidclara.0sefku7k',
  'SSP5-8.5': 'davidclara.20v6wfcu',
}

export { MAPBOX_TOKEN };

