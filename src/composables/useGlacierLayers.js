import { PROJECTION_FOLDERS } from '../config/projections.js'
import { TIMING } from '../config/timing.js'

/**
 * Composable for managing GeoJSON layer creation and management
 * Handles source/layer creation, updates, and cleanup
 * 
 * @param {Ref<mapboxgl.Map>} map - The Mapbox map instance
 * @returns {Object} Layer management functions
 */
export function useGlacierLayers(map) {
  /**
   * Get outline layer ID from fill layer ID
   * @param {string} layerId - Fill layer ID
   * @returns {string} Outline layer ID
   */
  const getOutlineLayerId = (layerId) => {
    return `${layerId}-outline`
  }

  /**
   * Create or update GeoJSON source and layers
   * @param {string} url - URL to GeoJSON data
   * @param {string} layerId - Layer ID for the source and fill layer
   * @returns {mapboxgl.GeoJSONSource|null} The created/updated source
   */
  const loadGeoJSONLayer = (url, layerId = 'geojson-layer') => {
    if (!map.value) {
      console.warn('[useGlacierLayers] Map not available')
      return null
    }

    // Add or update GeoJSON source
    let source
    if (!map.value.getSource(layerId)) {
      map.value.addSource(layerId, {
        type: 'geojson',
        data: url,
        promoteId: 'mapbox-id', // Use 'mapbox-id' property as feature ID for setFeatureState
      })
      source = map.value.getSource(layerId)
    } else {
      // Update existing source
      source = map.value.getSource(layerId)
      if (source.type === 'geojson') {
        source.setData(url)
      }
    }

    // Add fill layer if it doesn't exist
    if (!map.value.getLayer(layerId)) {
      map.value.addLayer({
        id: layerId,
        type: 'fill',
        source: layerId,
        paint: {
          'fill-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            '#4682B4', // Steel blue when selected
            '#87CEEB', // Default sky blue
          ],
          'fill-opacity': 0.6,
        },
      })
    }

    // Add outline layer
    const outlineId = getOutlineLayerId(layerId)
    if (!map.value.getLayer(outlineId)) {
      map.value.addLayer({
        id: outlineId,
        type: 'line',
        source: layerId,
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            '#4682B4', // Steel blue when selected
            '#87CEEB', // Default sky blue
          ],
          'line-width': 2,
        },
      })
    }

    return source
  }

  /**
   * Clear source data and remove layers
   * @param {string} layerId - Layer ID to clear
   */
  const clearSourceAndLayers = (layerId) => {
    if (!map.value) return

    const source = map.value.getSource(layerId)
    const outlineLayerId = getOutlineLayerId(layerId)

    if (source && source.type === 'geojson') {
      // Remove old event handlers
      try {
        map.value.off('mousemove', layerId)
        map.value.off('mouseleave', layerId)
        map.value.off('click', layerId)
      } catch (e) {
        // Handlers might not exist, that's okay
      }

      // Clear source data to free memory
      try {
        source.setData({ type: 'FeatureCollection', features: [] })
      } catch (error) {
        console.warn('[useGlacierLayers] Error clearing source data:', error)
      }

      // Remove layers first
      if (map.value.getLayer(layerId)) {
        map.value.removeLayer(layerId)
      }
      if (map.value.getLayer(outlineLayerId)) {
        map.value.removeLayer(outlineLayerId)
      }

      // Remove source
      map.value.removeSource(layerId)
    }
  }

  /**
   * Wait for data to load and map to be idle
   * @param {string} sourceId - Source ID to wait for
   * @param {Function} callback - Callback to execute when ready
   */
  const waitForDataReady = (sourceId, callback) => {
    if (!map.value) return

    const handleDataLoad = (e) => {
      if (e.sourceId === sourceId && e.isSourceLoaded) {
        map.value.off('data', handleDataLoad)
        
        // Wait for map to be idle (fully rendered) before executing callback
        map.value.once('idle', () => {
          // Small delay to ensure feature states can be set
          setTimeout(() => {
            callback()
          }, TIMING.SELECTION_DELAY)
        })
      }
    }

    map.value.on('data', handleDataLoad)
  }

  return {
    getOutlineLayerId,
    loadGeoJSONLayer,
    clearSourceAndLayers,
    waitForDataReady,
  }
}
