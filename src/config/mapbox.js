// Vite will replace this at build time
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

/**
 * Map projection names to Mapbox tileset IDs
 * Each scenario has its own tileset
 */
export const TILESET_IDS = {
  'SSP1-2.6': 'davidclara.6ubfwx3d',
  'SSP2-4.5': 'davidclara.25ea51o8',
  'SSP3-7.0': 'davidclara.4jmyo15p',
  'SSP5-8.5': 'davidclara.2qlhskys',
}

export { MAPBOX_TOKEN };

