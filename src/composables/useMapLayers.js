import { ref } from 'vue'
import { TILESET_IDS } from '../config/mapbox.js'
import { PROJECTION_CONFIG } from '../config/projections.js'

/**
 * Composable for managing map layers (tileset sources and layer creation)
 * Handles layer creation for dynamic, overlay, and comparison modes
 * 
 * @param {Ref<mapboxgl.Map>} map - The Mapbox map instance
 * @param {Ref<string>} mapMode - Current map mode ('dynamic', 'overlay', 'comparison')
 * @param {Ref<Set<number>>} visibleYears - Set of visible years for overlay mode
 * @param {Ref<string>} referenceScenario - Reference scenario for comparison mode
 * @param {Ref<string>} comparisonScenario - Comparison scenario for comparison mode
 * @param {Ref<Set<string>>} visibleScenarios - Set of visible scenarios for comparison mode
 * @param {Ref<number|string|null>} selectedFeatureId - Selected feature ID for outline layer filter
 * @param {Function} getFillColor - Function to get fill color based on visualization
 * @param {Function} getFillOpacity - Function to get fill opacity
 * @param {Function} getOutlineColor - Function to get outline color (optional, defaults to getFillColor)
 * @param {Function} setupClickHandler - Callback to setup click handlers after layer creation
 * @param {Function} cleanupHandlers - Optional callback to cleanup handlers before layer removal
 * @returns {Object} Layer management functions and state
 */
export function useMapLayers(
  map,
  mapMode,
  visibleYears,
  referenceScenario,
  comparisonScenario,
  visibleScenarios,
  selectedFeatureId,
  getFillColor,
  getFillOpacity,
  getOutlineColor = null,
  setupClickHandler,
  cleanupHandlers = null
) {
  // Track which sources are loaded
  const loadedSources = ref(new Set())

  /**
   * Get source ID for a projection
   */
  const getSourceId = (proj) => `glacier-tileset-${proj}`

  /**
   * Get layer ID for a projection
   */
  const getLayerId = (proj) => `glacier-layer-${proj}`

  /**
   * Get outline layer ID for a projection
   */
  const getOutlineId = (proj) => `glacier-outline-${proj}`

  /**
   * Get layer ID for a specific year in overlay mode
   */
  const getStaticLayerId = (proj, year) => `glacier-layer-${proj}-${year}`

  /**
   * Get layer ID for comparison mode
   */
  const getComparisonLayerId = (proj) => `glacier-layer-comparison-${proj}`

  /**
   * Get outline layer ID for comparison mode
   */
  const getComparisonOutlineId = (proj) => `glacier-outline-comparison-${proj}`

  /**
   * Get outline layer ID for overlay mode (2020 year only)
   */
  const getOverlayOutlineId = (proj) => `glacier-outline-overlay-${proj}-2020`

  /**
   * Get color for a specific year in overlay mode (gradient from 2020 to 2100)
   */
  const getYearColor = (year) => {
    const minYear = PROJECTION_CONFIG.MIN_YEAR
    const maxYear = PROJECTION_CONFIG.MAX_YEAR
    // Normalize year to 0-1 range (0 = 2020, 1 = 2100)
    const normalized = (year - minYear) / (maxYear - minYear)
    
    // Interpolate from blue (2020) to orange (2100) for better visual distinction
    // Blue: #3B82F6 (rgb(59, 130, 246))
    // Orange: #F97316 (rgb(249, 115, 22))
    const blue = { r: 59, g: 130, b: 246 }  // #3B82F6
    const orange = { r: 249, g: 115, b: 22 }    // #F97316
    
    const r = Math.round(blue.r + (orange.r - blue.r) * normalized)
    const g = Math.round(blue.g + (orange.g - blue.g) * normalized)
    const b = Math.round(blue.b + (orange.b - blue.b) * normalized)
    
    return `rgb(${r}, ${g}, ${b})`
  }

  /**
   * Load a tileset source for a projection
   */
  const loadTilesetSource = (proj) => {
    if (!map.value) return Promise.resolve()

    const tilesetId = TILESET_IDS[proj]
    if (!tilesetId) {
      console.warn('[useMapLayers] No tileset ID found for projection:', proj)
      return Promise.resolve()
    }

    const sourceId = getSourceId(proj)
    
    // If source already exists, return
    if (map.value.getSource(sourceId)) {
      return Promise.resolve()
    }

    console.log('[useMapLayers] Loading tileset for projection:', proj, 'tileset:', tilesetId)

    return new Promise((resolve) => {
      // Add tileset source
      map.value.addSource(sourceId, {
        type: 'vector',
        url: `mapbox://${tilesetId}`
      })

      // Wait for source to load
      const onSourceData = (e) => {
        if (e.sourceId === sourceId && e.isSourceLoaded) {
          map.value.off('sourcedata', onSourceData)
          loadedSources.value.add(proj)
          console.log('[useMapLayers] ✓ Tileset loaded for projection:', proj)
          resolve()
        }
      }
      map.value.on('sourcedata', onSourceData)
    })
  }

  /**
   * Clean up all overlay mode layers for a specific projection
   */
  const cleanupStaticLayers = (proj) => {
    if (!map.value) return
    
    // Remove all overlay layers for this projection
    for (let year = PROJECTION_CONFIG.MIN_YEAR; year <= PROJECTION_CONFIG.MAX_YEAR; year += 10) {
      const layerId = getStaticLayerId(proj, year)
      if (map.value.getLayer(layerId)) {
        map.value.removeLayer(layerId)
      }
    }
    
    // Remove overlay outline layer
    const overlayOutlineId = getOverlayOutlineId(proj)
    if (map.value.getLayer(overlayOutlineId)) {
      map.value.removeLayer(overlayOutlineId)
    }
  }

  /**
   * Clean up all overlay mode layers for all projections
   */
  const cleanupAllStaticLayers = () => {
    if (!map.value) return
    
    // Get all available projections
    const projections = Object.keys(TILESET_IDS).filter(proj => TILESET_IDS[proj] !== null)
    
    // Remove all overlay layers for all projections
    projections.forEach(proj => {
      cleanupStaticLayers(proj)
    })
    
    console.log('[useMapLayers] Cleaned up all overlay mode layers')
  }

  /**
   * Create layers for a projection and year based on current mode
   */
  const createLayersForProjectionYear = (proj, year) => {
    if (!map.value) return

    const sourceId = getSourceId(proj)
    const layerId = getLayerId(proj)
    const outlineId = getOutlineId(proj)
    const sourceLayerName = year.toString()

    // Check if source exists
    if (!map.value.getSource(sourceId)) {
      console.warn('[useMapLayers] Source not found for projection:', proj, '- it may still be loading')
      return
    }

    // If in comparison mode, create layers for both scenarios
    if (mapMode.value === 'comparison') {
      // Clean up any existing comparison layers for all scenarios (in case scenarios changed)
      const allProjections = Object.keys(TILESET_IDS).filter(p => TILESET_IDS[p] !== null)
      allProjections.forEach(p => {
        const compLayerId = getComparisonLayerId(p)
        const compOutlineId = getComparisonOutlineId(p)
        if (map.value.getLayer(compLayerId)) map.value.removeLayer(compLayerId)
        if (map.value.getLayer(compOutlineId)) map.value.removeLayer(compOutlineId)
      })
      
      // Clean up regular layers
      if (map.value.getLayer(layerId)) map.value.removeLayer(layerId)
      if (map.value.getLayer(outlineId)) map.value.removeLayer(outlineId)
      
      // Clean up overlay layers
      cleanupStaticLayers(referenceScenario.value)
      cleanupStaticLayers(comparisonScenario.value)
      
      // Ensure both sources are loaded
      const refSourceId = getSourceId(referenceScenario.value)
      const compSourceId = getSourceId(comparisonScenario.value)
      
      if (!map.value.getSource(refSourceId) || !map.value.getSource(compSourceId)) {
        console.warn('[useMapLayers] Sources not ready for comparison mode')
        return
      }
      
      const refLayerId = getComparisonLayerId(referenceScenario.value)
      const compLayerId = getComparisonLayerId(comparisonScenario.value)
      
      // Create reference scenario layer (bottom layer, more transparent)
      // Higher opacity for selected glacier (1.0), base opacity for others
      const refFillOpacity = selectedFeatureId.value
        ? [
            'case',
            ['==', ['id'], selectedFeatureId.value],
            1.0, // Selected glacier: full opacity
            0.6 // Other glaciers: base opacity
          ]
        : 0.6
      
      map.value.addLayer({
        id: refLayerId,
        type: 'fill',
        source: refSourceId,
        'source-layer': sourceLayerName,
        layout: {
          visibility: visibleScenarios.value.has('reference') ? 'visible' : 'none'
        },
        paint: {
          'fill-color': '#3B82F6', // Blue for reference
          'fill-opacity': refFillOpacity,
        },
      })
      
      // Create comparison scenario layer (top layer, less transparent)
      // Higher opacity for selected glacier (1.0), base opacity for others
      const compFillOpacity = selectedFeatureId.value
        ? [
            'case',
            ['==', ['id'], selectedFeatureId.value],
            1.0, // Selected glacier: full opacity
            0.6 // Other glaciers: base opacity
          ]
        : 0.6
      
      map.value.addLayer({
        id: compLayerId,
        type: 'fill',
        source: compSourceId,
        'source-layer': sourceLayerName,
        layout: {
          visibility: visibleScenarios.value.has('comparison') ? 'visible' : 'none'
        },
        paint: {
          'fill-color': '#F97316', // Orange for comparison
          'fill-opacity': compFillOpacity,
        },
      })
      
      console.log('[useMapLayers] Comparison mode layers created for reference:', referenceScenario.value, 'comparison:', comparisonScenario.value, 'year:', year)
      
      // Setup click handlers for comparison layers
      // Use a small delay to ensure layers are fully added to the map
      if (setupClickHandler) {
        setTimeout(async () => {
          await setupClickHandler()
        }, 150)
      }
      
      return
    }
    
    // If in overlay mode, create overlay layers for every 10 years
    if (mapMode.value === 'overlay') {
      // Clean up any existing overlay layers
      cleanupStaticLayers(proj)
      
      // Also clean up regular layers
      if (map.value.getLayer(layerId)) {
        map.value.removeLayer(layerId)
      }
      if (map.value.getLayer(outlineId)) {
        map.value.removeLayer(outlineId)
      }
      
      // Create layers for each decade year (2020, 2030, ..., 2100)
      // Order: 2020 at bottom, 2100 on top
      const decadeYears = []
      for (let y = PROJECTION_CONFIG.MIN_YEAR; y <= PROJECTION_CONFIG.MAX_YEAR; y += 10) {
        decadeYears.push(y)
      }
      
      // Add layers in order: 2020 at bottom, 2100 on top
      // Only add layers for visible years
      // Add from 2100 to 2020, each before the previous one
      // This ensures 2020 is drawn first (bottom) and 2100 is drawn last (top)
      let lastAddedLayerId = undefined
      for (let i = decadeYears.length - 1; i >= 0; i--) {
        const decadeYear = decadeYears[i]
        
        // Only create layer if year is visible
        if (!visibleYears.value.has(decadeYear)) {
          continue
        }
        
        const staticLayerId = getStaticLayerId(proj, decadeYear)
        const yearColor = getYearColor(decadeYear)
        
        // Insert before the last added layer (which is a later year)
        map.value.addLayer({
          id: staticLayerId,
          type: 'fill',
          source: sourceId,
          'source-layer': decadeYear.toString(),
          paint: {
            'fill-color': yearColor,
            'fill-opacity': 0.7, // Slightly transparent so layers below show through
          },
        }, lastAddedLayerId)
        
        lastAddedLayerId = staticLayerId
      }
      
      // Add outline layer for 2020 year only (for selected glacier)
      const overlayOutlineId = getOverlayOutlineId(proj)
      const minYear = PROJECTION_CONFIG.MIN_YEAR // 2020
      
      // Only add outline if 2020 is visible
      if (visibleYears.value.has(minYear)) {
        map.value.addLayer({
          id: overlayOutlineId,
          type: 'line',
          source: sourceId,
          'source-layer': minYear.toString(),
          filter: selectedFeatureId.value 
            ? ['==', ['id'], selectedFeatureId.value]
            : ['literal', false], // Hide if nothing selected
          paint: {
            'line-color': getYearColor(minYear), // Match 2020 layer color
            'line-width': 2,
            'line-opacity': 1,
          },
        }, lastAddedLayerId) // Add after all fill layers
      }
      
      console.log(`[useMapLayers] ${mapMode.value} mode layers created for projection:`, proj, 'years:', decadeYears)
      
      // Setup click handlers for overlay layers
      // Use a small delay to ensure layers are fully added to the map
      if (setupClickHandler) {
        setTimeout(async () => {
          await setupClickHandler()
        }, 150)
      }
      
      return
    }

    // Dynamic mode: create single layer for current year
    // Clean up overlay layers if they exist
    cleanupStaticLayers(proj)
    
    // Clean up comparison layers if they exist (only if not in comparison mode)
    if (mapMode.value !== 'comparison') {
      const allProjections = Object.keys(TILESET_IDS).filter(p => TILESET_IDS[p] !== null)
      allProjections.forEach(p => {
        const compLayerId = getComparisonLayerId(p)
        const compOutlineId = getComparisonOutlineId(p)
        if (map.value.getLayer(compLayerId)) map.value.removeLayer(compLayerId)
        if (map.value.getLayer(compOutlineId)) map.value.removeLayer(compOutlineId)
      })
    }

    // Clean up handlers before removing layers (if callback provided)
    if (cleanupHandlers) {
      cleanupHandlers(layerId)
    }

    // Remove existing layers if they exist
    if (map.value.getLayer(layerId)) {
      map.value.removeLayer(layerId)
    }
    if (map.value.getLayer(outlineId)) {
      map.value.removeLayer(outlineId)
    }

    // Add fill layer (always visible when created, as it's for the active projection)
    const baseOpacity = getFillOpacity()
    // Higher opacity for selected glacier (1.0), base opacity for others
    const fillOpacity = selectedFeatureId.value
      ? [
          'case',
          ['==', ['id'], selectedFeatureId.value],
          1.0, // Selected glacier: full opacity
          baseOpacity // Other glaciers: base opacity
        ]
      : baseOpacity
    
    map.value.addLayer({
      id: layerId,
      type: 'fill',
      source: sourceId,
      'source-layer': sourceLayerName,
      paint: {
        'fill-color': getFillColor(),
        'fill-opacity': fillOpacity,
      },
    })

    // Add outline layer for selected glaciers only (filtered by selectedFeatureId)
    map.value.addLayer({
      id: outlineId,
      type: 'line',
      source: sourceId,
      'source-layer': sourceLayerName,
      filter: selectedFeatureId.value 
        ? ['==', ['id'], selectedFeatureId.value]
        : ['literal', false], // Hide if nothing selected
      paint: {
        'line-color': getOutlineColor ? getOutlineColor() : getFillColor(), // Use outline color if provided, otherwise match fill
        'line-width': 2,
        'line-opacity': 1,
      },
    })

    console.log('[useMapLayers] Layers created for projection:', proj, 'year:', year)
  }

  return {
    // State
    loadedSources,
    
    // Helper functions
    getSourceId,
    getLayerId,
    getOutlineId,
    getStaticLayerId,
    getComparisonLayerId,
    getComparisonOutlineId,
    getOverlayOutlineId,
    getYearColor,
    
    // Layer management
    loadTilesetSource,
    createLayersForProjectionYear,
    cleanupStaticLayers,
    cleanupAllStaticLayers,
  }
}

