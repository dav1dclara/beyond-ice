<template>
  <div class="map-viewer">
    <div ref="mapboxCanvas" class="mapbox-canvas"></div>
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MAPBOX_TOKEN } from '../config/mapbox.js'

// Template Refs
const mapboxCanvas = ref(null)
const map = ref(null)
const mapLoaded = ref(false)

// Mute all console warnings
const originalWarn = console.warn
console.warn = () => {
  // Silently ignore all warnings
}

// Initialize map
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
    // Initialize Mapbox map with standard style
    map.value = new mapboxgl.Map({
      container: mapboxCanvas.value,
      style: 'mapbox://styles/mapbox/standard',
      center: [8.2275, 46.8182], // Center of Switzerland
      zoom: 7,
      accessToken: MAPBOX_TOKEN,
      attributionControl: true,
    })

    // Mark map as loaded when it's ready
    map.value.on('load', () => {
      mapLoaded.value = true
      
      // Remove all label layers (symbol layers)
      removeAllLabels()
    })
    
    // Function to remove all label layers
    const removeAllLabels = () => {
      if (!map.value) return
      
      try {
        const style = map.value.getStyle()
        if (!style || !style.layers) return
        
        // Find all symbol layers (these are the label layers)
        style.layers.forEach((layer) => {
          if (layer.type === 'symbol') {
            try {
              // Hide the layer by setting visibility to 'none'
              map.value.setLayoutProperty(layer.id, 'visibility', 'none')
            } catch (e) {
              // Layer might not support visibility property, try removing it
              try {
                if (map.value.getLayer(layer.id)) {
                  map.value.removeLayer(layer.id)
                }
              } catch (e2) {
                // Layer might be protected, that's okay
              }
            }
          }
        })
        
        console.log('[MapMinimal] Removed all label layers')
      } catch (error) {
        console.warn('[MapMinimal] Error removing labels:', error)
      }
    }

    // Filter out all warnings and non-critical errors
    map.value.on('error', (e) => {
      // Filter out all warnings and expression evaluation errors
      if (e.error) {
        const errorMsg = (e.error.message || e.error.toString() || '').toLowerCase()
        // Filter out common non-critical warnings/errors
        if (errorMsg.includes('warning') ||
            errorMsg.includes('failed to evaluate expression') ||
            errorMsg.includes('evaluated to null') ||
            errorMsg.includes('sizerank') ||
            errorMsg.includes('expected to be of type') ||
            errorMsg.includes('cutoff') ||
            errorMsg.includes('featurenamespace')) {
          return // Silently ignore warnings
        }
      }
      // Only log actual errors
      console.error('MapboxViewer: Map error:', e)
    })
  } catch (error) {
    console.error('MapboxViewer: Failed to initialize map:', error)
  }
}

// Initialize map when component mounts
watch(mapboxCanvas, (canvas) => {
  if (canvas) {
    initializeMap()
  }
}, { immediate: true })

// Cleanup on unmount
onBeforeUnmount(() => {
  // Restore original console.warn
  console.warn = originalWarn
  
  if (map.value) {
    map.value.remove()
    map.value = null
  }
})
</script>

<style scoped>
.map-viewer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.mapbox-canvas {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

/* Hide Mapbox logo but keep attribution control */
.mapbox-canvas :deep(.mapboxgl-ctrl-logo) {
  display: none !important;
}
</style>
