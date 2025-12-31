import { TILESET_IDS } from '../config/tilesets.js';
import { lightStyle, swissImage } from '../config/mapStyles.js';

/**
 * Composable for map style toggling functionality
 * Handles switching between light and satellite/aerial map styles
 *
 * When switching map styles, the Mapbox style is completely replaced, which requires:
 * - Clearing loaded sources and click handlers
 * - Reinitializing all tileset sources
 * - Recreating layers for the current projection and year
 * - Restoring 3D terrain if it was previously enabled
 *
 * @param {Ref<mapboxgl.Map>} map - The Mapbox map instance
 * @param {Ref<boolean>} isSatellite - Whether satellite basemap is active
 * @param {Ref<boolean>} is3D - Whether 3D terrain mode is enabled
 * @param {Ref<Set<string>>} loadedSources - Set of loaded tileset source IDs
 * @param {Ref<boolean>} mapClickHandlerSetup - Whether map click handler is set up
 * @param {Function} loadTilesetSource - Function to load a tileset source
 * @param {Function} createLayersForProjectionYear - Function to create layers for a projection and year
 * @param {Function} updateAllLayerColors - Function to update all layer colors
 * @param {Function} setupClickHandler - Function to setup click handlers
 * @param {Ref<string>} projection - Current projection/scenario
 * @param {Ref<number>} currentYear - Current year
 * @returns {Object} Map style toggle function
 */
export function useMapStyles(
  map,
  isSatellite,
  is3D,
  loadedSources,
  mapClickHandlerSetup,
  loadTilesetSource,
  createLayersForProjectionYear,
  updateAllLayerColors,
  setupClickHandler,
  projection,
  currentYear
) {
  // Toggle between light and satellite map styles
  const toggleBasemap = (satellite) => {
    if (!map.value) return;

    if (isSatellite.value === satellite) return;

    const was3D = is3D.value;
    const currentPitch = map.value.getPitch();

    isSatellite.value = satellite;

    const newStyle = isSatellite.value ? swissImage : lightStyle;

    // Clear state before style change
    loadedSources.value.clear();
    mapClickHandlerSetup.value = false;

    // Reinitialize everything after style loads
    map.value.once('style.load', () => {
      if (isSatellite.value) {
        map.value.setProjection('globe');
      }

      // Restore 3D terrain if it was previously enabled
      if (was3D) {
        if (!map.value.getSource('mapbox-dem')) {
          map.value.addSource('mapbox-dem', {
            type: 'raster-dem',
            url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
            tileSize: 256,
            maxzoom: 11,
          });
        }

        map.value.setTerrain({
          source: 'mapbox-dem',
          exaggeration: 1.0,
        });

        map.value.easeTo({
          pitch: currentPitch || 50,
          duration: 0,
        });
      }

      // Reload all tileset sources and recreate layers
      const reinitializeLayers = async () => {
        const projections = Object.keys(TILESET_IDS).filter(
          (proj) => TILESET_IDS[proj] !== null
        );

        const loadPromises = projections.map((proj) => loadTilesetSource(proj));
        await Promise.all(loadPromises);

        createLayersForProjectionYear(projection.value, currentYear.value);
        updateAllLayerColors();
        setupClickHandler();
      };

      reinitializeLayers();
    });

    map.value.setStyle(newStyle);
  };

  return {
    toggleBasemap,
  };
}

