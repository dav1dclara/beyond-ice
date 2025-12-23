import { ref, onBeforeUnmount } from 'vue'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MAPBOX_TOKEN } from '../config/mapbox.js'
// import { blendedSatelliteAerial } from '../config/mapStyles.js'

export function useMapboxMap(mapboxCanvas) {
  const map = ref(null)
  const mapLoaded = ref(false)
  let logoObserver = null

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
      // Initialize Mapbox map starting at zoom level 0
      map.value = new mapboxgl.Map({
        container: mapboxCanvas.value,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [8.3818, 46.3621], // Center of Switzerland
        zoom: 0, // Start at zoom level 0
        projection: 'globe', // Enable globe projection
        accessToken: MAPBOX_TOKEN,
        attributionControl: false, // Attribution shown in imprint modal instead
      })

      // Mark map as loaded when it's ready and fly in to zoom level 8
      map.value.on('load', () => {
        // Ensure globe projection is set (in case it wasn't applied during initialization)
        map.value.setProjection('globe')
        
        // Explicitly remove any Mapbox attribution elements from the DOM
        const attributionElements = mapboxCanvas.value.querySelectorAll('.mapboxgl-ctrl-attrib')
        attributionElements.forEach(el => el.remove())
        
        // Remove Mapbox logo watermark (may appear in bottom right or bottom left)
        const logoElements = mapboxCanvas.value.querySelectorAll('.mapboxgl-ctrl-logo')
        logoElements.forEach(el => el.remove())
        
        // Also check parent container for logo elements
        const parentContainer = mapboxCanvas.value.parentElement
        if (parentContainer) {
          const parentLogoElements = parentContainer.querySelectorAll('.mapboxgl-ctrl-logo')
          parentLogoElements.forEach(el => el.remove())
        }
        
        // Use MutationObserver to remove logo if it appears later
        logoObserver = new MutationObserver(() => {
          const logos = mapboxCanvas.value.querySelectorAll('.mapboxgl-ctrl-logo')
          logos.forEach(el => el.remove())
          if (parentContainer) {
            const parentLogos = parentContainer.querySelectorAll('.mapboxgl-ctrl-logo')
            parentLogos.forEach(el => el.remove())
          }
        })
        logoObserver.observe(mapboxCanvas.value, { childList: true, subtree: true })
        if (parentContainer) {
          logoObserver.observe(parentContainer, { childList: true, subtree: true })
        }
        
        // Fly in from zoom 0 to zoom 8 with a smooth animation
        map.value.flyTo({
          center: [8.3818, 46.3621], // Center of Switzerland
          zoom: 8,
          duration: 3000, // 3 second animation
          essential: true // Animation is essential and won't be interrupted
        })
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
    if (logoObserver) {
      logoObserver.disconnect()
      logoObserver = null
    }
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

