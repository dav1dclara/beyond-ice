import { ref, onBeforeUnmount } from 'vue';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAPBOX_TOKEN } from '../config/mapbox.js';
import { lightStyle } from '../config/mapStyles.js';

/**
 * Composable for initializing and managing a Mapbox GL map instance.
 * Handles map initialization and initial fly-in animation.
 *
 * @param {Ref<HTMLElement>} mapboxCanvas - The canvas element ref for the map container
 * @returns {Object} Map instance, loaded state, and initialization function
 */
export function useMapboxMap(mapboxCanvas) {
  const map = ref(null);
  const mapLoaded = ref(false);
  let controlPanelObserver = null;

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
        center: [8.5143, 46.3803],
        zoom: 0,
        projection: 'globe',
        accessToken: MAPBOX_TOKEN,
        attributionControl: false,
      });

      map.value.on('load', () => {
        map.value.setProjection('globe');

        // Add attribution control in top-right (compact mode)
        map.value.addControl(
          new mapboxgl.AttributionControl({ compact: true }),
          'top-right'
        );

        // Setup logo positioning and padding
        const setupLogo = () => {
          const bottomRightContainer = mapboxCanvas.value?.querySelector('.mapboxgl-ctrl-bottom-right');
          const bottomLeftContainer = mapboxCanvas.value?.querySelector('.mapboxgl-ctrl-bottom-left');
          const controlPanel = document.querySelector('.control-panel-container');
          
          if (!bottomRightContainer) return;

          // Move logo from bottom-left to bottom-right if needed
          const logoInLeft = bottomLeftContainer?.querySelector('.mapboxgl-ctrl-logo');
          if (logoInLeft) {
            const logoControl = logoInLeft.closest('.mapboxgl-ctrl');
            if (logoControl?.parentElement === bottomLeftContainer) {
              bottomRightContainer.appendChild(logoControl);
            }
          }

          // Update padding based on control panel state
          const logoInRight = bottomRightContainer.querySelector('.mapboxgl-ctrl-logo');
          if (logoInRight && controlPanel) {
            const isExpanded = controlPanel.querySelector('.evolution-graph-wrapper') !== null;
            bottomRightContainer.style.paddingBottom = isExpanded ? '241px' : '77px';
          }

          // Hide attribution text in top-right (keep only logo)
          const topRightContainer = mapboxCanvas.value?.querySelector('.mapboxgl-ctrl-top-right');
          const attributionText = topRightContainer?.querySelector('.mapboxgl-ctrl-attrib');
          if (attributionText) {
            attributionText.style.display = 'none';
          }
        };

        // Initial setup after a short delay to ensure DOM is ready
        setTimeout(setupLogo, 100);

        // Watch for control panel changes
        const setupObserver = () => {
          const controlPanel = document.querySelector('.control-panel-container');
          if (controlPanel) {
            controlPanelObserver = new MutationObserver(setupLogo);
            controlPanelObserver.observe(controlPanel, {
              childList: true,
              subtree: true,
              attributes: true,
            });
          } else {
            setTimeout(setupObserver, 200);
          }
        };

        setupObserver();

        map.value.flyTo({
          center: [8.5143, 46.3803],
          zoom: 8,
          duration: 3000,
          essential: true,
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
    if (controlPanelObserver) {
      controlPanelObserver.disconnect();
      controlPanelObserver = null;
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
