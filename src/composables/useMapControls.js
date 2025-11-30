import { ref, watch } from 'vue'

/**
 * Composable for managing map controls (terrain, style, camera)
 * Consolidates terrain, style, and camera control functionality
 * 
 * @param {Ref<mapboxgl.Map>} map - The Mapbox map instance
 * @returns {Object} Map control state and functions
 */
export function useMapControls(map) {
  // Terrain state
  const is3D = ref(false)

  // Sync with map's actual terrain state when map loads
  const syncTerrainFromMap = () => {
    if (!map.value) return

    const terrain = map.value.getTerrain()
    const pitch = map.value.getPitch()
    // Consider 3D if terrain is enabled OR pitch is > 0
    is3D.value = terrain !== null || pitch > 0
  }

  // Watch for map to load and sync terrain state
  watch(map, (newMap) => {
    if (newMap) {
      newMap.once('load', () => {
        syncTerrainFromMap()
      })
      // Also try to sync immediately if map is already loaded
      if (newMap.loaded()) {
        syncTerrainFromMap()
      }
    }
  }, { immediate: true })

  /**
   * Toggle 3D terrain on/off
   */
  const toggleTerrain = () => {
    if (!map.value) return

    is3D.value = !is3D.value

    if (is3D.value) {
      // Enable 3D terrain
      // Add terrain source if it doesn't exist
      if (!map.value.getSource('mapbox-dem')) {
        map.value.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 256,
          maxzoom: 14,
        })
      }
      
      // Enable 3D terrain
      map.value.setTerrain({
        source: 'mapbox-dem',
        exaggeration: 1.5,
      })
      
      // Tilt the map for 3D view
      map.value.easeTo({
        pitch: 60,
        duration: 1000,
      })
    } else {
      // Disable terrain
      map.value.setTerrain(null)
      
      // Reset to flat view
      map.value.easeTo({
        pitch: 0,
        duration: 1000,
      })
    }
  }

  /**
   * Reset map bearing to north (0 degrees)
   */
  const resetBearing = () => {
    if (!map.value) return
    map.value.easeTo({
      bearing: 0,
      duration: 1000,
    })
  }

  return {
    // Terrain
    is3D,
    toggleTerrain,
    
    // Camera
    resetBearing,
  }
}
