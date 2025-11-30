import { PROJECTION_FOLDERS } from '../config/projections.js'
import { TIMING } from '../config/timing.js'

/**
 * Composable for managing glacier data loading
 * Handles data file path generation and data loading operations
 * 
 * @param {Ref<mapboxgl.Map>} map - The Mapbox map instance
 * @param {Object} layerManager - Object from useGlacierLayers composable
 * @param {Object} options - Configuration options
 * @param {Function} options.onSelectionRestore - Callback to restore selection after data loads
 * @param {Function} options.onFilterApply - Callback to apply filter for a feature
 * @param {Function} options.onHandlersSetup - Callback to setup event handlers after data loads
 * @param {Function} options.onVisualizationApply - Callback to apply visualization after data loads
 * @param {Function} options.onSearchClear - Callback to clear search results
 * @returns {Object} Data loading functions
 */
export function useGlacierDataLoading(map, layerManager, options = {}) {
  const {
    onSelectionRestore,
    onFilterApply,
    onHandlersSetup,
    onVisualizationApply,
    onSearchClear,
  } = options

  const { loadGeoJSONLayer, clearSourceAndLayers, waitForDataReady, getOutlineLayerId } = layerManager

  /**
   * Get data file path based on projection and year
   * @param {string} projection - Projection name (e.g., 'Current', 'SSP1-2.6')
   * @param {number} year - Year value
   * @returns {string} URL to the GeoJSON data file
   */
  const getDataFilePath = (projection, year) => {
    if (projection === 'Current') {
      return `${import.meta.env.BASE_URL}data/sgi2016.geojson`
    }
    
    const folder = PROJECTION_FOLDERS[projection]
    if (!folder) {
      console.warn(`[useGlacierDataLoading] Unknown projection: ${projection}, using Current data`)
      return `${import.meta.env.BASE_URL}data/sgi2016.geojson`
    }
    
    return `${import.meta.env.BASE_URL}data/${folder}/${year}.geojson`
  }

  /**
   * Load data smoothly by updating existing source (for year changes)
   * @param {Object} params - Loading parameters
   * @param {string} params.layerId - Layer ID
   * @param {string} params.projection - Projection name
   * @param {number} params.year - Year value
   * @param {string|null} params.selectedMapboxId - Currently selected feature mapbox-id
   * @param {boolean} params.wasFilterActive - Whether filter was active
   */
  const loadDataSmooth = ({ layerId, projection, year, selectedMapboxId, wasFilterActive }) => {
    if (!map.value || !layerId) {
      console.warn('[useGlacierDataLoading] Cannot load data smoothly: map or layerId missing')
      return
    }

    const dataUrl = getDataFilePath(projection, year)
    console.log('[useGlacierDataLoading] Loading data smoothly:', dataUrl, 'for layer:', layerId)

    const source = map.value.getSource(layerId)
    const outlineLayerId = getOutlineLayerId(layerId)

    // If source exists and is GeoJSON, update it smoothly
    if (source && source.type === 'geojson') {
      // Reset filter temporarily (will be restored if feature is found)
      if (wasFilterActive) {
        map.value.setFilter(layerId, null)
        if (map.value.getLayer(outlineLayerId)) {
          map.value.setFilter(outlineLayerId, null)
        }
      }

      // Use requestAnimationFrame for smooth update
      requestAnimationFrame(() => {
        try {
          // Update source data directly - this is much smoother than removing/recreating
          source.setData(dataUrl)

          // Restore selection and filter after data loads
          waitForDataReady(layerId, () => {
            if (selectedMapboxId !== null && selectedMapboxId !== undefined) {
              // Restore selection (this also handles filter if wasFilterActive is true)
              if (onSelectionRestore) {
                onSelectionRestore(selectedMapboxId, wasFilterActive)
              }
            }

            // Apply current visualization if callback provided
            if (onVisualizationApply) {
              setTimeout(() => {
                onVisualizationApply()
              }, TIMING.VISUALIZATION_DELAY)
            }
          })
        } catch (error) {
          console.error('[useGlacierDataLoading] Error updating source data smoothly:', error)
          // Fallback to full reload if smooth update fails
          loadDataFull({ layerId, projection, year, selectedMapboxId, wasFilterActive })
        }
      })

      return
    }

    // Fallback to regular load if source doesn't exist or isn't GeoJSON
    loadDataFull({ layerId, projection, year, selectedMapboxId, wasFilterActive })
  }

  /**
   * Load data with full reload (removes and recreates source/layers)
   * Used for initial load and scenario changes
   * @param {Object} params - Loading parameters
   * @param {string} params.layerId - Layer ID
   * @param {string} params.projection - Projection name
   * @param {number} params.year - Year value
   * @param {string|null} params.selectedMapboxId - Currently selected feature mapbox-id
   * @param {boolean} params.wasFilterActive - Whether filter was active
   * @param {string|null} params.selectedGlacierId - Currently selected feature ID (for clearing state)
   */
  const loadDataFull = ({ 
    layerId, 
    projection, 
    year, 
    selectedMapboxId, 
    wasFilterActive,
    selectedGlacierId = null
  }) => {
    if (!map.value || !layerId) {
      console.warn('[useGlacierDataLoading] Cannot load data: map or layerId missing')
      return
    }

    const dataUrl = getDataFilePath(projection, year)
    console.log('[useGlacierDataLoading] Loading data:', dataUrl, 'for layer:', layerId)

    const outlineLayerId = getOutlineLayerId(layerId)

    // Clear selection state (but keep the mapbox-id to restore later)
    if (selectedGlacierId !== null && map.value) {
      try {
        map.value.setFeatureState(
          { source: layerId, id: selectedGlacierId },
          { selected: false }
        )
      } catch (e) {
        // Feature might not exist, that's okay
      }
    }

    // Clear search results if callback provided
    if (onSearchClear) {
      onSearchClear()
    }

    // Reset filter if active (will be restored if feature is found)
    if (wasFilterActive && map.value) {
      map.value.setFilter(layerId, null)
      if (map.value.getLayer(outlineLayerId)) {
        map.value.setFilter(outlineLayerId, null)
      }
    }

    // Clear existing source and layers
    const source = map.value.getSource(layerId)
    if (source && source.type === 'geojson') {
      clearSourceAndLayers(layerId)

      // Small delay to allow garbage collection and cleanup
      setTimeout(() => {
        // Recreate source and layers with new data
        loadGeoJSONLayer(dataUrl, layerId)

        // Apply filter immediately when data loads (before rendering) if filter was active
        if (wasFilterActive && selectedMapboxId !== null && selectedMapboxId !== undefined) {
          map.value.once('data', (e) => {
            if (e.sourceId === layerId && e.isSourceLoaded) {
              // Data is loaded, apply filter immediately
              if (onFilterApply) {
                onFilterApply(selectedMapboxId)
              }
            }
          })
        }

        // Setup handlers and restore selection after layer is added
        map.value.once('idle', () => {
          if (onHandlersSetup) {
            onHandlersSetup()
          }

          // Restore selection if we had a selected feature
          if (selectedMapboxId !== null && selectedMapboxId !== undefined) {
            if (onSelectionRestore) {
              onSelectionRestore(selectedMapboxId, wasFilterActive)
            }
          }

          // Apply current visualization if callback provided
          if (onVisualizationApply) {
            setTimeout(() => {
              onVisualizationApply()
            }, TIMING.VISUALIZATION_DELAY)
          }
        })
      }, TIMING.SOURCE_CLEANUP_DELAY) // Small delay for cleanup

      return
    }

    // If source doesn't exist, create it
    loadGeoJSONLayer(dataUrl, layerId)

    // Apply filter immediately when data loads (before rendering) if filter was active
    if (wasFilterActive && selectedMapboxId !== null && selectedMapboxId !== undefined) {
      map.value.once('data', (e) => {
        if (e.sourceId === layerId && e.isSourceLoaded) {
          // Data is loaded, apply filter immediately
          if (onFilterApply) {
            onFilterApply(selectedMapboxId)
          }
        }
      })
    }

    // Setup handlers after layer is added
    map.value.once('idle', () => {
      if (onHandlersSetup) {
        onHandlersSetup()
      }

      // Restore selection if we had a selected feature
      if (selectedMapboxId !== null && selectedMapboxId !== undefined) {
        if (onSelectionRestore) {
          onSelectionRestore(selectedMapboxId, wasFilterActive)
        }
      }

      // Apply current visualization if callback provided
      if (onVisualizationApply) {
        setTimeout(() => {
          onVisualizationApply()
        }, TIMING.VISUALIZATION_DELAY)
      }
    })
  }

  return {
    getDataFilePath,
    loadDataSmooth,
    loadDataFull,
  }
}
