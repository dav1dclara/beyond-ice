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
   * Animate terrain exaggeration smoothly
   */
  const animateTerrainExaggeration = (startValue, endValue, duration, onComplete) => {
    if (!map.value) return

    const startTime = performance.now()
    const source = 'mapbox-dem'
    
    // Ensure terrain source exists
    if (!map.value.getSource(source)) {
      map.value.addSource(source, {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 256,
        maxzoom: 11,
      })
    }

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Use easeInOutCubic for smooth acceleration/deceleration
      const easeInOutCubic = (t) => {
        return t < 0.5
          ? 4 * t * t * t
          : 1 - Math.pow(-2 * t + 2, 3) / 2
      }
      
      const easedProgress = easeInOutCubic(progress)
      const currentExaggeration = startValue + (endValue - startValue) * easedProgress
      
      // Update terrain with current exaggeration
      map.value.setTerrain({
        source: source,
        exaggeration: currentExaggeration,
      })
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        // Animation complete
        if (onComplete) onComplete()
      }
    }
    
    requestAnimationFrame(animate)
  }

  /**
   * Toggle 3D terrain on/off
   */
  const toggleTerrain = () => {
    if (!map.value) return

    is3D.value = !is3D.value
    const duration = 1000 // Match the pitch animation duration

    if (is3D.value) {
      // Enable 3D terrain with performance optimizations
      // Add terrain source if it doesn't exist
      if (!map.value.getSource('mapbox-dem')) {
        map.value.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 256,
          maxzoom: 11, // Reduced from 14 for better performance
        })
      }
      
      // Start with 0 exaggeration and animate to 1.0
      animateTerrainExaggeration(0, 1.0, duration)
      
      // Apply performance optimizations
      map.value.setRenderWorldCopies(false)
      
      // Tilt the map for 3D view (reduced pitch for better performance)
      map.value.easeTo({
        pitch: 50, // Reduced from 60 for better performance
        duration: duration,
      })
    } else {
      // Get current exaggeration before animating down
      const currentTerrain = map.value.getTerrain()
      const currentExaggeration = currentTerrain?.exaggeration || 1.0
      
      // Animate exaggeration from current value to 0, then disable terrain
      animateTerrainExaggeration(currentExaggeration, 0, duration, () => {
        // Disable terrain after animation completes
        map.value.setTerrain(null)
      })
      
      // Reset to flat view
      map.value.easeTo({
        pitch: 0,
        duration: duration,
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
