import { ref, watch } from 'vue'

export function useMapStyle(map) {
  const currentStyle = ref('dark') // 'dark', 'light', or 'satellite'

  const styles = {
    dark: 'mapbox://styles/mapbox/dark-v11',
    light: 'mapbox://styles/mapbox/light-v11',
    satellite: 'mapbox://styles/mapbox/satellite-v9',
  }

  // Sync with map's actual style when map loads
  const syncStyleFromMap = () => {
    if (!map.value) return

    // Get the style URL from the map
    const styleUrl = map.value.getStyle()?.sprite || ''
    
    // Detect which style is currently active by checking the style URL
    if (styleUrl.includes('dark-v11') || styleUrl.includes('/dark/')) {
      currentStyle.value = 'dark'
    } else if (styleUrl.includes('light-v11') || styleUrl.includes('/light/')) {
      currentStyle.value = 'light'
    } else if (styleUrl.includes('satellite-v9') || styleUrl.includes('/satellite/')) {
      currentStyle.value = 'satellite'
    }
  }

  // Watch for map to load and sync style
  watch(map, (newMap) => {
    if (newMap) {
      newMap.once('load', () => {
        syncStyleFromMap()
      })
      // Also try to sync immediately if map is already loaded
      if (newMap.loaded()) {
        syncStyleFromMap()
      }
    }
  }, { immediate: true })

  const setMapStyle = (styleName, onStyleLoad = null) => {
    if (!map.value || !styles[styleName]) return

    // Check if terrain is currently enabled from the map itself
    const terrainEnabled = map.value.getTerrain() !== null
    const currentPitch = map.value.getPitch()

    currentStyle.value = styleName
    map.value.setStyle(styles[styleName])

    // Re-add everything after style loads
    map.value.once('style.load', () => {
      // Re-add terrain if it was enabled
      if (terrainEnabled) {
        // Re-add terrain source if it doesn't exist
        if (!map.value.getSource('mapbox-dem')) {
          map.value.addSource('mapbox-dem', {
            type: 'raster-dem',
            url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
            tileSize: 256,
            maxzoom: 14,
          })
        }

        // Re-enable terrain
        map.value.setTerrain({
          source: 'mapbox-dem',
          exaggeration: 1.5,
        })

        // Restore pitch
        map.value.easeTo({
          pitch: currentPitch,
          duration: 0, // Instant restore
        })
      }

      // Call custom callback to re-add other layers (like GeoJSON)
      if (onStyleLoad) {
        onStyleLoad()
      }
    })
  }

  return {
    currentStyle,
    setMapStyle,
  }
}

