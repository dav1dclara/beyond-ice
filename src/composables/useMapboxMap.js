import { ref, onBeforeUnmount } from 'vue'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MAPBOX_TOKEN } from '../config/mapbox.js'

export function useMapboxMap(mapboxCanvas) {
  const map = ref(null)
  const mapLoaded = ref(false)

  const initializeMap = () => {
    if (!mapboxCanvas.value) {
      console.error('MapboxViewer: Mapbox canvas element not found')
      return
    }

    if (!MAPBOX_TOKEN) {
      console.error('Mapbox access token is missing. Please set VITE_MAPBOX_TOKEN in your .env file')
      return
    }

    if (mapLoaded.value) {
      return // Map already loaded
    }

    try {
      // Initialize Mapbox map
      map.value = new mapboxgl.Map({
        container: mapboxCanvas.value,
        style: 'mapbox://styles/mapbox/light-v11', // Dark style (default)
        center: [8.2275, 46.8182], // Center of Switzerland
        zoom: 7,
        accessToken: MAPBOX_TOKEN,
        attributionControl: true,
      })

      // Mark map as loaded when it's ready
      map.value.on('load', () => {
        mapLoaded.value = true
      })

      // Log any errors
      map.value.on('error', (e) => {
        console.error('MapboxViewer: Map error:', e)
      })
    } catch (error) {
      console.error('MapboxViewer: Failed to initialize map:', error)
    }
  }

  // Cleanup on unmount
  onBeforeUnmount(() => {
    if (map.value) {
      map.value.remove()
      map.value = null
    }
  })

  return {
    map,
    mapLoaded,
    initializeMap,
  }
}

