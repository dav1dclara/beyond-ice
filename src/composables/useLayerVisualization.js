import { COLORS } from '../config/colors.js'

/**
 * Composable for layer visualization logic
 * Handles color expressions, opacity, and layer updates
 * 
 * @param {Ref<mapboxgl.Map>} map - The Mapbox map instance
 * @param {Ref<string>} visualization - Current visualization mode
 * @param {Ref<boolean>} isSatellite - Whether satellite basemap is active
 * @param {Ref<number|string|null>} selectedFeatureId - Selected feature ID for outline filter
 * @param {ComputedRef<string>} currentLayerId - Current layer ID
 * @param {ComputedRef<string>} currentOutlineId - Current outline layer ID
 * @param {Function} externalGetFillColor - Optional external getFillColor function
 * @param {Function} externalGetFillOpacity - Optional external getFillOpacity function
 * @returns {Object} Visualization functions
 */
export function useLayerVisualization(
  map,
  visualization,
  isSatellite,
  selectedFeatureId,
  currentLayerId,
  currentOutlineId,
  externalGetFillColor = null,
  externalGetFillOpacity = null
) {
  /**
   * Get fill color based on visualization mode
   * Uses external function provided by Map.vue (single source of truth)
   */
  const getFillColor = externalGetFillColor || (() => {
    // Fallback: should not be used if external function is provided
    // This is kept for backwards compatibility but Map.vue always provides the function
    console.warn('useLayerVisualization: Using fallback getFillColor - external function should be provided')
    return isSatellite.value ? '#FFFFFF' : COLORS.glacier.default
  })

  /**
   * Get outline color
   * In uniform mode with aerial basemap, use blue for selected glaciers
   */
  const getOutlineColor = () => {
    // In uniform visualization with aerial basemap and selected glacier, use blue outline
    if (visualization.value === 'uniform' && isSatellite.value && selectedFeatureId.value) {
      return COLORS.glacier.default // Blue color
    }
    // Otherwise, match fill color
    return getFillColor()
  }

  /**
   * Get fill opacity based on basemap mode
   * Uses external function provided by Map.vue (single source of truth)
   */
  const getFillOpacity = externalGetFillOpacity || (() => {
    // Fallback: should not be used if external function is provided
    return isSatellite.value ? 0.8 : 0.6
  })

  /**
   * Update layer colors and outline filter
   */
  const updateLayerColors = () => {
    const layerId = currentLayerId.value
    const outlineId = currentOutlineId.value
    
    if (!map.value) {
      return
    }
    
    if (map.value.getLayer(layerId)) {
      const fillColor = getFillColor()
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
      
      map.value.setPaintProperty(layerId, 'fill-color', fillColor)
      map.value.setPaintProperty(layerId, 'fill-opacity', fillOpacity)
    }
    
    // Update outline layer filter and color to show only selected glacier
    if (map.value.getLayer(outlineId)) {
      const filter = selectedFeatureId.value 
        ? ['==', ['id'], selectedFeatureId.value]
        : ['literal', false]
      map.value.setFilter(outlineId, filter)
      // Update outline color (uses getOutlineColor which handles special cases)
      const outlineColor = getOutlineColor()
      map.value.setPaintProperty(outlineId, 'line-color', outlineColor)
    }
  }

  return {
    getFillColor,
    getOutlineColor,
    getFillOpacity,
    updateLayerColors
  }
}

