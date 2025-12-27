import { ref } from 'vue'
import { COLORS } from '../config/colors.js'

/**
 * Composable for feature selection logic
 * Handles clicking on glaciers, map clicks, and restoring selections
 * 
 * @param {Ref<mapboxgl.Map>} map - The Mapbox map instance
 * @param {Ref<string>} mapMode - Current map mode ('dynamic', 'overlay', 'comparison')
 * @param {Ref<string>} referenceScenario - Reference scenario for comparison mode
 * @param {Ref<string>} comparisonScenario - Comparison scenario for comparison mode
 * @param {Ref<Set<number>>} visibleYears - Set of visible years for overlay mode
 * @param {Array<number>} decadeYears - Array of decade years
 * @param {Ref<string>} projection - Current projection
 * @param {Ref<Array>} glacierSearchIndex - Glacier search index from useGlacierSearch
 * @param {Ref<boolean>} is3D - Whether 3D mode is enabled
 * @param {Function} getComparisonLayerId - Function to get comparison layer ID
 * @param {Function} getStaticLayerId - Function to get static layer ID
 * @param {ComputedRef<string>} currentLayerId - Current layer ID
 * @param {Ref<string>} searchQuery - Search query ref (for updating)
 * @param {Ref} selectedGlacier - Ref for selected glacier
 * @param {Ref} selectedFeatureId - Ref for selected feature ID
 * @param {Function} calculateTerrainCameraAngle - Function to calculate camera angle from terrain
 * @param {Function} updateLayerColors - Function to update layer colors
 * @param {Function} querySourceFeatures - Function to query features from source
 * @returns {Object} Selection functions
 */
export function useFeatureSelection(
  map,
  mapMode,
  referenceScenario,
  comparisonScenario,
  visibleYears,
  decadeYears,
  projection,
  glacierSearchIndex,
  is3D,
  getComparisonLayerId,
  getStaticLayerId,
  currentLayerId,
  searchQuery,
  selectedGlacier,
  selectedFeatureId,
  calculateTerrainCameraAngle,
  updateLayerColors,
  querySourceFeatures
) {

  /**
   * Handle click on glacier feature
   */
  const handleGlacierClick = (e) => {
    // In comparison mode or overlay mode, query features from all relevant layers at the click point
    // This ensures we get features even when layers overlap
    let features = []
    if (mapMode.value === 'comparison') {
      const refLayerId = getComparisonLayerId(referenceScenario.value)
      const compLayerId = getComparisonLayerId(comparisonScenario.value)
      
      // Query features from both layers at the click point
      const allFeatures = map.value.queryRenderedFeatures(e.point, {
        layers: [refLayerId, compLayerId]
      })
      
      console.log('[useFeatureSelection] Query found', allFeatures.length, 'features at click point in comparison mode', {
        refLayerId,
        compLayerId,
        point: e.point,
        features: allFeatures.map(f => ({
          id: f.id,
          layerId: f.layer?.id,
          hasProperties: !!f.properties
        }))
      })
      
      if (allFeatures.length === 0) {
        console.warn('[useFeatureSelection] No features found at click point in comparison mode')
        return
      }
      
      features = allFeatures
    } else if (mapMode.value === 'overlay') {
      // In overlay mode, query features from all visible overlay layers
      const overlayLayerIds = []
      decadeYears.forEach(year => {
        if (visibleYears.value.has(year)) {
          const layerId = getStaticLayerId(projection.value, year)
          if (map.value.getLayer(layerId)) {
            overlayLayerIds.push(layerId)
          }
        }
      })
      
      if (overlayLayerIds.length === 0) {
        console.warn('[useFeatureSelection] No visible overlay layers to query')
        return
      }
      
      // Query features from all visible overlay layers at the click point
      const allFeatures = map.value.queryRenderedFeatures(e.point, {
        layers: overlayLayerIds
      })
      
      console.log('[useFeatureSelection] Query found', allFeatures.length, 'features at click point in overlay mode', {
        overlayLayerIds,
        point: e.point,
        features: allFeatures.map(f => ({
          id: f.id,
          layerId: f.layer?.id,
          hasProperties: !!f.properties
        }))
      })
      
      if (allFeatures.length === 0) {
        console.warn('[useFeatureSelection] No features found at click point in overlay mode')
        return
      }
      
      features = allFeatures
    } else {
      // Regular mode: use features from event
      if (!e.features || e.features.length === 0) return
      features = e.features
    }
    
    // Use the topmost feature
    let selectedFeature = features[0]
    
    // If we have multiple features, prefer the topmost layer feature
    if (mapMode.value === 'comparison' && features.length > 1) {
      const compLayerId = getComparisonLayerId(comparisonScenario.value)
      const compFeature = features.find(f => f.layer?.id === compLayerId)
      if (compFeature) {
        selectedFeature = compFeature
      }
    } else if (mapMode.value === 'overlay' && features.length > 1) {
      // In overlay mode, prefer the most recent year (topmost layer)
      // Features are returned in layer order, so the last one is the topmost
      selectedFeature = features[features.length - 1]
    }
    
    // Get feature ID from the selected feature
    // Try multiple ways to get the ID
    let featureId = selectedFeature.id
    
    // If ID is null/undefined, try to get it from properties
    if (featureId === undefined || featureId === null || featureId === 'null' || featureId === '') {
      featureId = selectedFeature.properties?.['mapbox-id'] || 
                  selectedFeature.properties?.id ||
                  selectedFeature.properties?.['sgi-id'] ||
                  selectedFeature.properties?.['mapbox_id']
      
      console.log('[useFeatureSelection] Feature ID not in id field, trying properties:', {
        originalId: selectedFeature.id,
        'mapbox-id': selectedFeature.properties?.['mapbox-id'],
        'mapbox_id': selectedFeature.properties?.['mapbox_id'],
        'id': selectedFeature.properties?.id,
        'sgi-id': selectedFeature.properties?.['sgi-id'],
        foundId: featureId,
        allProperties: Object.keys(selectedFeature.properties || {})
      })
    }
    
    // Final check - if still no valid ID, log and return
    if (featureId === undefined || featureId === null || featureId === 'null' || featureId === '') {
      console.warn('[useFeatureSelection] Selected feature has no valid ID in any form', {
        feature: selectedFeature,
        layerId: selectedFeature.layer?.id,
        source: selectedFeature.source,
        sourceLayer: selectedFeature.sourceLayer,
        properties: selectedFeature.properties,
        idField: selectedFeature.id
      })
      return
    }
    
    // Convert to string/number as needed (ensure it's not a string "null")
    if (typeof featureId === 'string' && featureId.toLowerCase() === 'null') {
      console.warn('[useFeatureSelection] Feature ID is string "null", cannot use')
      return
    }
    
    console.log('[useFeatureSelection] Feature selected - ID:', featureId, 'from layer:', selectedFeature.layer?.id, 'total features:', features.length)
    
    // Calculate bearing from mapping CSV or terrain if 3D is enabled
    if (is3D.value) {
      try {
        // First try to get aspect_deg from mapping CSV
        const glacierEntry = glacierSearchIndex.value.find(entry => entry.mapbox_id === featureId)
        
        if (glacierEntry && glacierEntry.aspect_deg !== undefined && glacierEntry.aspect_deg !== null) {
          // Use aspect_deg from mapping CSV
          const bearing = (glacierEntry.aspect_deg + 180) % 360
          const slopeDeg = glacierEntry.slope_deg !== undefined && glacierEntry.slope_deg !== null
            ? glacierEntry.slope_deg
            : null
          let pitch = 50
          if (slopeDeg !== null) {
            pitch = 45 + (slopeDeg * 0.5)
            pitch = Math.min(65, Math.max(45, pitch))
          }
          
          console.log('[useFeatureSelection] 🧭 Using aspect_deg from mapping CSV:', {
            aspect_deg: glacierEntry.aspect_deg.toFixed(1) + '°',
            bearing: bearing.toFixed(1) + '°',
            slope_deg: slopeDeg !== null ? slopeDeg.toFixed(1) + '°' : 'N/A',
            pitch: pitch.toFixed(1) + '°'
          })
        } else if (selectedFeature.geometry) {
          // Fallback to calculating from terrain
          let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
          
          const processCoords = (coords) => {
            if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
              coords.forEach(coord => {
                if (Array.isArray(coord) && coord.length >= 2) {
                  const [lng, lat] = coord
                  minLng = Math.min(minLng, lng)
                  minLat = Math.min(minLat, lat)
                  maxLng = Math.max(maxLng, lng)
                  maxLat = Math.max(maxLat, lat)
                }
              })
            } else {
              const [lng, lat] = coords
              minLng = Math.min(minLng, lng)
              minLat = Math.min(minLat, lat)
              maxLng = Math.max(maxLng, lng)
              maxLat = Math.max(maxLat, lat)
            }
          }
          
          if (selectedFeature.geometry.type === 'Polygon') {
            selectedFeature.geometry.coordinates[0].forEach(processCoords)
          } else if (selectedFeature.geometry.type === 'MultiPolygon') {
            selectedFeature.geometry.coordinates.forEach(polygon => {
              polygon[0].forEach(processCoords)
            })
          }
          
          if (minLng !== Infinity && minLat !== Infinity) {
            const bounds = { min_lng: minLng, min_lat: minLat, max_lng: maxLng, max_lat: maxLat }
            const cameraAngle = calculateTerrainCameraAngle(bounds)
            console.log('[useFeatureSelection] 🧭 Calculated bearing from terrain (mapping CSV not available):', {
              bearing: cameraAngle.bearing.toFixed(1) + '°',
              pitch: cameraAngle.pitch.toFixed(1) + '°',
              aspect: ((cameraAngle.bearing + 180) % 360).toFixed(1) + '°'
            })
          }
        }
      } catch (error) {
        console.warn('[useFeatureSelection] Error calculating bearing:', error)
      }
    }
    
    // Ensure featureId is consistent type (convert to number if it's a numeric string)
    const normalizedFeatureId = typeof featureId === 'string' && !isNaN(featureId) && !isNaN(parseFloat(featureId))
      ? parseFloat(featureId)
      : featureId
    
    // Toggle selected feature (click again to deselect)
    // Compare with type coercion to handle string/number mismatches
    const currentId = selectedGlacier.value?.id
    const currentIdNormalized = currentId != null && typeof currentId === 'string' && !isNaN(currentId) && !isNaN(parseFloat(currentId))
      ? parseFloat(currentId)
      : currentId
    
    // Only consider it the same feature if both IDs are exactly equal (after normalization)
    const isSameFeature = currentIdNormalized != null && 
      currentIdNormalized === normalizedFeatureId
    
    console.log('[useFeatureSelection] Comparing feature IDs:', {
      currentId,
      currentIdNormalized,
      newFeatureId: normalizedFeatureId,
      currentType: typeof currentId,
      newType: typeof normalizedFeatureId,
      isSameFeature,
      strictEqual: currentIdNormalized === normalizedFeatureId
    })
    
    // In comparison mode or overlay mode, don't allow deselection by clicking the same feature
    // (since overlapping layers can make it confusing)
    // Only allow deselection by clicking outside
    if (isSameFeature && mapMode.value !== 'comparison' && mapMode.value !== 'overlay') {
      console.log('[useFeatureSelection] Deselecting feature (clicked same feature again)')
      selectedGlacier.value = null
      selectedFeatureId.value = null
      searchQuery.value = ''
    } else {
      console.log('[useFeatureSelection] Selecting feature, setting ID:', normalizedFeatureId, isSameFeature ? '(same feature, but keeping selected in comparison mode)' : '(new feature)')
      selectedGlacier.value = {
        id: normalizedFeatureId,
        name: selectedFeature.properties?.name || null,
        'sgi-id': selectedFeature.properties?.['sgi-id'] || null,
      }
      // Lock the feature ID so it persists across year/scenario changes
      selectedFeatureId.value = normalizedFeatureId
      // Update search bar
      searchQuery.value = selectedFeature.properties?.name || ''
    }
    
    // Update layer colors
    updateLayerColors()
    
    console.log('[useFeatureSelection] ✓ Feature selection updated, ID locked:', selectedFeatureId.value, {
      selectedGlacier: selectedGlacier.value,
      selectedFeatureId: selectedFeatureId.value
    })
  }

  /**
   * Handle click on map (outside glaciers)
   */
  const handleMapClick = (e) => {
    // In comparison mode, check both layers
    if (mapMode.value === 'comparison') {
      const refLayerId = getComparisonLayerId(referenceScenario.value)
      const compLayerId = getComparisonLayerId(comparisonScenario.value)
      const features = map.value.queryRenderedFeatures(e.point, {
        layers: [refLayerId, compLayerId]
      })
      
      // If no glacier features were selected, deselect
      if (features.length === 0 && selectedGlacier.value !== null) {
        selectedGlacier.value = null
        selectedFeatureId.value = null
        searchQuery.value = ''
        updateLayerColors()
        console.log('[useFeatureSelection] ✓ Deselected (clicked outside glacier)')
      }
    } else if (mapMode.value === 'overlay') {
      // In overlay mode, check all visible overlay layers
      const overlayLayerIds = []
      decadeYears.forEach(year => {
        if (visibleYears.value.has(year)) {
          const layerId = getStaticLayerId(projection.value, year)
          if (map.value.getLayer(layerId)) {
            overlayLayerIds.push(layerId)
          }
        }
      })
      
      const features = map.value.queryRenderedFeatures(e.point, {
        layers: overlayLayerIds
      })
      
      // If no glacier features were selected, deselect
      if (features.length === 0 && selectedGlacier.value !== null) {
        selectedGlacier.value = null
        selectedFeatureId.value = null
        searchQuery.value = ''
        updateLayerColors()
        console.log('[useFeatureSelection] ✓ Deselected (clicked outside glacier)')
      }
    } else {
      const layerId = currentLayerId.value
      // Check if any features from the glacier layer were selected
      const features = map.value.queryRenderedFeatures(e.point, {
        layers: [layerId]
      })
      
      // If no glacier features were selected, deselect
      if (features.length === 0 && selectedGlacier.value !== null) {
        selectedGlacier.value = null
        selectedFeatureId.value = null
        searchQuery.value = ''
        updateLayerColors()
        console.log('[useFeatureSelection] ✓ Deselected (clicked outside glacier)')
      }
    }
  }

  /**
   * Restore selection by feature ID (with retry logic)
   */
  const restoreSelectionByFeatureId = (featureId, retryCount = 0) => {
    if (!map.value) return
    
    const maxRetries = 5
    const retryDelay = 200
    
    try {
      const features = querySourceFeatures()
      console.log('[useFeatureSelection] Attempting to restore selection for feature ID:', featureId, 'Found', features?.length || 0, 'features')
      
      if (!features || features.length === 0) {
        // No features found yet, retry if we haven't exceeded max retries
        if (retryCount < maxRetries) {
          console.log('[useFeatureSelection] No features found yet, retrying...', retryCount + 1, '/', maxRetries)
          setTimeout(() => {
            restoreSelectionByFeatureId(featureId, retryCount + 1)
          }, retryDelay)
        } else {
          console.warn('[useFeatureSelection] Could not restore selection: no features found after', maxRetries, 'retries')
          selectedGlacier.value = null
          searchQuery.value = ''
          updateLayerColors()
        }
        return
      }
      
      const feature = features.find(f => f.id === featureId)
      
      if (feature) {
        selectedGlacier.value = {
          id: featureId,
          name: feature.properties?.name || null,
          'sgi-id': feature.properties?.['sgi-id'] || null,
        }
        searchQuery.value = feature.properties?.name || ''
        updateLayerColors()
        console.log('[useFeatureSelection] ✓ Selection restored for feature ID:', featureId)
      } else {
        // Feature not found in new layer, clear selection
        selectedGlacier.value = null
        searchQuery.value = ''
        updateLayerColors()
        console.log('[useFeatureSelection] Feature ID', featureId, 'not found in current layer (checked', features.length, 'features)')
      }
    } catch (error) {
      console.error('[useFeatureSelection] Error restoring selection:', error)
      // Retry on error if we haven't exceeded max retries
      if (retryCount < maxRetries) {
        setTimeout(() => {
          restoreSelectionByFeatureId(featureId, retryCount + 1)
        }, retryDelay)
      }
    }
  }

  /**
   * Clear selection
   */
  const clearSelection = () => {
    selectedGlacier.value = null
    selectedFeatureId.value = null
    searchQuery.value = ''
    updateLayerColors()
  }

  return {
    // Functions
    handleGlacierClick,
    handleMapClick,
    restoreSelectionByFeatureId,
    clearSelection
  }
}

