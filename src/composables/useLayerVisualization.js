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
   * Uses external function if provided, otherwise defines internally
   */
  const getFillColor = externalGetFillColor || (() => {
    if (visualization.value === 'area-change') {
      // Simple color expression for area change
      return [
        'interpolate',
        ['linear'],
        ['get', 'Area change (%)'],
        -100, COLORS.visualization.negative,
        0, COLORS.visualization.neutral
      ]
    } else if (visualization.value === 'volume-change') {
      // Simple color expression for volume change
      return [
        'interpolate',
        ['linear'],
        ['get', 'Volume change (%)'],
        -100, COLORS.visualization.negative,
        0, COLORS.visualization.neutral
      ]
    } else if (visualization.value === 'bivariate') {
      // Bivariate choropleth: Bilinear interpolation using X (area) and Y (volume) as coordinates
      // Normalize X and Y to 0-1 range (0 = 0% change, 1 = -100% change)
      // Corner colors (as RGB):
      // lowLow (X=0, Y=0):   rgb(232, 244, 248) = #E8F4F8 (very light blue-gray)
      // highLow (X=1, Y=0):  rgb(231, 76, 60)  = #E74C3C (bright red)
      // lowHigh (X=0, Y=1):  rgb(52, 152, 219) = #3498DB (bright blue)
      // highHigh (X=1, Y=1): rgb(44, 62, 80)   = #2C3E50 (dark slate)
      // Formula: R = (1-X)(1-Y)*R_ll + X(1-Y)*R_hl + (1-X)Y*R_lh + XY*R_hh
      // Calculate everything inline without let expressions
      return [
        'case',
        ['all', ['has', 'Area change (%)'], ['has', 'Volume change (%)']],
        [
          'rgb',
          // Red channel: bilinear interpolation (all inline)
          [
            '+',
            ['*', ['*', ['-', 1, ['/', ['abs', ['get', 'Area change (%)']], 100]], ['-', 1, ['/', ['abs', ['get', 'Volume change (%)']], 100]]], 232],  // (1-X)(1-Y) * 232
            ['*', ['*', ['/', ['abs', ['get', 'Area change (%)']], 100], ['-', 1, ['/', ['abs', ['get', 'Volume change (%)']], 100]]], 231],            // X(1-Y) * 231
            ['*', ['*', ['-', 1, ['/', ['abs', ['get', 'Area change (%)']], 100]], ['/', ['abs', ['get', 'Volume change (%)']], 100]], 52],              // (1-X)Y * 52
            ['*', ['*', ['/', ['abs', ['get', 'Area change (%)']], 100], ['/', ['abs', ['get', 'Volume change (%)']], 100]], 44]                        // XY * 44
          ],
          // Green channel: bilinear interpolation (all inline)
          [
            '+',
            ['*', ['*', ['-', 1, ['/', ['abs', ['get', 'Area change (%)']], 100]], ['-', 1, ['/', ['abs', ['get', 'Volume change (%)']], 100]]], 244],  // (1-X)(1-Y) * 244
            ['*', ['*', ['/', ['abs', ['get', 'Area change (%)']], 100], ['-', 1, ['/', ['abs', ['get', 'Volume change (%)']], 100]]], 76],             // X(1-Y) * 76
            ['*', ['*', ['-', 1, ['/', ['abs', ['get', 'Area change (%)']], 100]], ['/', ['abs', ['get', 'Volume change (%)']], 100]], 152],             // (1-X)Y * 152
            ['*', ['*', ['/', ['abs', ['get', 'Area change (%)']], 100], ['/', ['abs', ['get', 'Volume change (%)']], 100]], 62]                          // XY * 62
          ],
          // Blue channel: bilinear interpolation (all inline)
          [
            '+',
            ['*', ['*', ['-', 1, ['/', ['abs', ['get', 'Area change (%)']], 100]], ['-', 1, ['/', ['abs', ['get', 'Volume change (%)']], 100]]], 248],  // (1-X)(1-Y) * 248
            ['*', ['*', ['/', ['abs', ['get', 'Area change (%)']], 100], ['-', 1, ['/', ['abs', ['get', 'Volume change (%)']], 100]]], 60],             // X(1-Y) * 60
            ['*', ['*', ['-', 1, ['/', ['abs', ['get', 'Area change (%)']], 100]], ['/', ['abs', ['get', 'Volume change (%)']], 100]], 219],            // (1-X)Y * 219
            ['*', ['*', ['/', ['abs', ['get', 'Area change (%)']], 100], ['/', ['abs', ['get', 'Volume change (%)']], 100]], 80]                         // XY * 80
          ]
        ],
        COLORS.visualization.missing
      ]
    } else {
      // Uniform visualization: white when aerial basemap, blue otherwise
      return isSatellite.value ? '#FFFFFF' : COLORS.glacier.default
    }
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
   * Uses external function if provided, otherwise defines internally
   */
  const getFillOpacity = externalGetFillOpacity || (() => {
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

