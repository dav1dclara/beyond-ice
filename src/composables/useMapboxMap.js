import { ref, onBeforeUnmount } from 'vue';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAPBOX_TOKEN } from '../config/mapbox.js';
import { lightStyle } from '../config/mapStyles.js';

/**
 * Composable for initializing and managing a Mapbox GL map instance.
 * Handles map initialization, logo/attribution removal, and initial fly-in animation.
 *
 * @param {Ref<HTMLElement>} mapboxCanvas - The canvas element ref for the map container
 * @returns {Object} Map instance, loaded state, and initialization function
 */
export function useMapboxMap(mapboxCanvas) {
  const map = ref(null);
  const mapLoaded = ref(false);
  let logoObserver = null;

  const initializeMap = () => {
    if (!mapboxCanvas.value) {
      console.error('MapboxViewer: Mapbox canvas element not found');
      return;
    }

    if (!MAPBOX_TOKEN) {
      console.error(
        'Mapbox access token is missing. Please set VITE_MAPBOX_TOKEN in your .env file'
      );
      return;
    }

    if (mapLoaded.value) {
      return;
    }

    try {
      map.value = new mapboxgl.Map({
        container: mapboxCanvas.value,
        style: lightStyle,
        center: [8.5143, 46.3803], // Center of Switzerland
        zoom: 0,
        projection: 'globe',
        accessToken: MAPBOX_TOKEN,
        attributionControl: false, // Attribution shown in imprint modal instead
      });

      map.value.on('load', () => {
        // Ensure globe projection is set (in case it wasn't applied during initialization)
        map.value.setProjection('globe');

        const attributionElements = mapboxCanvas.value.querySelectorAll(
          '.mapboxgl-ctrl-attrib'
        );
        attributionElements.forEach((el) => el.remove());

        // Remove Mapbox logo watermark (may appear in bottom right or bottom left)
        const logoElements = mapboxCanvas.value.querySelectorAll(
          '.mapboxgl-ctrl-logo'
        );
        logoElements.forEach((el) => el.remove());

        const parentContainer = mapboxCanvas.value.parentElement;
        if (parentContainer) {
          const parentLogoElements = parentContainer.querySelectorAll(
            '.mapboxgl-ctrl-logo'
          );
          parentLogoElements.forEach((el) => el.remove());
        }

        // Use MutationObserver to remove logo if it appears later
        logoObserver = new MutationObserver(() => {
          const logos = mapboxCanvas.value.querySelectorAll(
            '.mapboxgl-ctrl-logo'
          );
          logos.forEach((el) => el.remove());
          if (parentContainer) {
            const parentLogos = parentContainer.querySelectorAll(
              '.mapboxgl-ctrl-logo'
            );
            parentLogos.forEach((el) => el.remove());
          }
        });
        logoObserver.observe(mapboxCanvas.value, {
          childList: true,
          subtree: true,
        });
        if (parentContainer) {
          logoObserver.observe(parentContainer, {
            childList: true,
            subtree: true,
          });
        }

        map.value.flyTo({
          center: [8.5143, 46.3803], // Center of Switzerland
          zoom: 8,
          duration: 3000,
          essential: true, // Animation is essential and won't be interrupted
        });
        mapLoaded.value = true;
      });

      map.value.on('error', (e) => {
        console.error('MapboxViewer: Map error:', e);
      });
    } catch (error) {
      console.error('MapboxViewer: Failed to initialize map:', error);
    }
  };

  onBeforeUnmount(() => {
    if (logoObserver) {
      logoObserver.disconnect();
      logoObserver = null;
    }
    if (map.value) {
      map.value.remove();
      map.value = null;
    }
  });

  return {
    map,
    mapLoaded,
    initializeMap,
  };
}
