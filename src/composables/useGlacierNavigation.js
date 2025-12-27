import mapboxgl from 'mapbox-gl'

/**
 * Composable for glacier navigation operations (zooming, camera angles)
 * Handles zooming to glaciers with terrain-aware camera positioning
 * 
 * @param {Ref<mapboxgl.Map>} map - The Mapbox map instance
 * @param {Ref<Object>} selectedGlacier - The currently selected glacier
 * @param {Ref<Array>} glacierSearchIndex - The glacier search index with bounds data
 * @param {Ref<Boolean>} is3D - Whether 3D mode is enabled
 * @returns {Object} Navigation functions
 */
export function useGlacierNavigation(map, selectedGlacier, glacierSearchIndex, is3D) {
  /**
   * Calculate optimal camera angle (bearing and pitch) from terrain
   * Samples elevation at grid points and calculates aspect/slope
   * 
   * @param {Object} bounds - Bounds object with min_lng, min_lat, max_lng, max_lat
   * @returns {Object} Object with bearing and pitch values
   */
  const calculateTerrainCameraAngle = (bounds) => {
    if (!map.value) return { bearing: 0, pitch: 50 }
    
    const terrain = map.value.getTerrain()
    if (!terrain) {
      // If terrain not enabled, return default values
      return { bearing: 0, pitch: 50 }
    }
    
    const { min_lng, min_lat, max_lng, max_lat } = bounds
    
    // Sample elevation at a grid of points within the bounds
    const gridSize = 5 // 5x5 grid = 25 sample points
    const lngStep = (max_lng - min_lng) / (gridSize - 1)
    const latStep = (max_lat - min_lat) / (gridSize - 1)
    
    const elevations = []
    const elevationGrid = []
    
    // Sample elevations
    for (let i = 0; i < gridSize; i++) {
      const row = []
      for (let j = 0; j < gridSize; j++) {
        const lng = min_lng + j * lngStep
        const lat = min_lat + i * latStep
        
        try {
          const elevation = terrain.getElevation(new mapboxgl.LngLat(lng, lat))
          elevations.push(elevation)
          row.push(elevation)
        } catch (error) {
          // If elevation query fails, use 0 as fallback
          row.push(0)
        }
      }
      elevationGrid.push(row)
    }
    
    if (elevations.length === 0) {
      return { bearing: 0, pitch: 50 }
    }
    
    // Calculate aspect (direction of steepest slope) using gradient
    // Aspect is the direction the slope faces downhill (0-360 degrees, where 0° = North, 90° = East)
    let aspectX = 0  // East-West component (positive = eastward slope)
    let aspectY = 0  // North-South component (positive = northward slope)
    let totalSlope = 0
    let sampleCount = 0
    
    // Calculate gradients between adjacent points
    // Account for actual geographic distances
    for (let i = 0; i < gridSize - 1; i++) {
      for (let j = 0; j < gridSize - 1; j++) {
        const e1 = elevationGrid[i][j]
        const e2 = elevationGrid[i][j + 1]  // Point to the east (increasing longitude)
        const e3 = elevationGrid[i + 1][j]  // Point to the south (decreasing latitude)
        
        // Calculate geographic distances (approximate, in meters)
        // At these latitudes, 1 degree longitude ≈ 111km * cos(latitude)
        // 1 degree latitude ≈ 111km
        const centerLat = (min_lat + max_lat) / 2
        const lngDist = lngStep * 111000 * Math.cos(centerLat * Math.PI / 180) // meters
        const latDist = latStep * 111000 // meters
        
        // Calculate elevation gradients (elevation change per meter)
        // dx: positive = terrain higher to the east (slopes down to the west)
        // dy: positive = terrain higher to the north (slopes down to the south)
        const dx = (e2 - e1) / lngDist  // East-West gradient (m/m)
        const dy = (e1 - e3) / latDist  // North-South gradient (m/m) - inverted because lat decreases south
        
        // Calculate slope magnitude
        const slopeMagnitude = Math.sqrt(dx * dx + dy * dy)
        if (slopeMagnitude > 0) {
          // Aspect is the direction of steepest descent (downhill)
          // The gradient vector (dx, dy) points uphill, so we negate it for descent
          // Then convert to aspect components where:
          // - aspectX: east component (positive = slopes down east)
          // - aspectY: north component (positive = slopes down north)
          // Aspect convention: 0° = North, 90° = East, 180° = South, 270° = West
          
          // Weight by slope magnitude to emphasize steeper areas
          const weight = slopeMagnitude
          aspectX += -dx * weight  // Negate: positive dx (uphill east) → negative (downhill west)
          aspectY += -dy * weight  // Negate: positive dy (uphill north) → negative (downhill south)
          totalSlope += slopeMagnitude
          sampleCount++
        }
      }
    }
    
    if (sampleCount === 0 || totalSlope === 0) {
      return { bearing: 0, pitch: 50 }
    }
    
    // Calculate weighted average aspect direction (normalized vector)
    const avgAspectX = aspectX / totalSlope  // East component of descent direction
    const avgAspectY = aspectY / totalSlope  // North component of descent direction
    
    // Calculate aspect angle (direction of steepest descent)
    // Aspect: 0° = North, 90° = East, 180° = South, 270° = West
    // atan2(x, y) where x=east, y=north gives angle from north (y-axis)
    // - atan2(1, 0) = 90° (east) ✓
    // - atan2(0, 1) = 0° (north) ✓
    // - atan2(-1, 0) = -90° = 270° (west) ✓
    // - atan2(0, -1) = 180° (south) ✓
    let aspect = Math.atan2(avgAspectX, avgAspectY) * (180 / Math.PI)
    aspect = (aspect + 360) % 360 // Normalize to 0-360
    
    // For viewing terrain, we want to look FROM the uphill side TO the downhill side
    // So bearing should be opposite of aspect (180° rotation)
    let bearing = (aspect + 180) % 360
    
    // Debug logging
    console.log('[Terrain Camera] Aspect calculation:', {
      avgAspectX: avgAspectX.toFixed(4),
      avgAspectY: avgAspectY.toFixed(4),
      aspect: aspect.toFixed(1) + '°',
      bearing: bearing.toFixed(1) + '°',
      avgSlope: (totalSlope / sampleCount).toFixed(4)
    })
    
    // Calculate average slope to determine pitch
    const avgSlope = totalSlope / sampleCount
    
    // Calculate elevation range for additional pitch adjustment
    const minElev = Math.min(...elevations)
    const maxElev = Math.max(...elevations)
    const elevRange = maxElev - minElev
    
    // Base pitch on slope and elevation range
    // Steeper terrain and larger elevation differences = higher pitch
    // Pitch range: 45-65 degrees
    let pitch = 45 + (avgSlope * 2) // Base pitch from slope
    if (elevRange > 500) {
      pitch += 10 // Add more pitch for dramatic elevation changes
    } else if (elevRange > 200) {
      pitch += 5
    }
    pitch = Math.min(65, Math.max(45, pitch)) // Clamp between 45-65 degrees
    
    return { bearing, pitch }
  }

  /**
   * Zoom to the extent of the currently selected glacier
   * Uses terrain-aware camera positioning in 3D mode
   */
  const zoomToGlacierExtent = () => {
    if (!map.value || !selectedGlacier.value) {
      console.warn('[GlacierNavigation] Cannot zoom: map or glacier not available')
      return
    }
    
    const mapboxId = selectedGlacier.value['mapbox-id'] || selectedGlacier.value.id
    if (!mapboxId) {
      console.warn('[GlacierNavigation] Cannot zoom: no mapbox-id found')
      return
    }
    
    // Find the glacier in the search index to get its bounds
    const glacierEntry = glacierSearchIndex.value.find(entry => entry.mapbox_id === mapboxId)
    
    if (!glacierEntry || !glacierEntry.bounds) {
      console.warn('[GlacierNavigation] Cannot zoom: glacier bounds not found in mapping data')
      return
    }
    
    const { min_lng, min_lat, max_lng, max_lat } = glacierEntry.bounds
    const bounds = { min_lng, min_lat, max_lng, max_lat }
    
    try {
      // Calculate center point
      const centerLng = (min_lng + max_lng) / 2
      const centerLat = (min_lat + max_lat) / 2
      
      // If 3D is enabled, use aspect_deg and slope_deg from mapping CSV
      let bearing = 0
      let pitch = 50 // Default pitch
      
      if (is3D.value) {
        // Use aspect_deg from mapping CSV if available
        if (glacierEntry.aspect_deg !== undefined && glacierEntry.aspect_deg !== null) {
          // Aspect is the direction the terrain faces (downhill)
          // For viewing, we want to look FROM the uphill side TO the downhill side
          // So bearing should be opposite of aspect (180° rotation)
          bearing = (glacierEntry.aspect_deg + 180) % 360
          console.log('[GlacierNavigation] Using aspect_deg from mapping:', {
            aspect_deg: glacierEntry.aspect_deg,
            bearing: bearing
          })
        } else {
          // Fallback to terrain calculation if aspect_deg not available
          const cameraAngle = calculateTerrainCameraAngle(bounds)
          bearing = cameraAngle.bearing
          pitch = cameraAngle.pitch
          console.log('[GlacierNavigation] Calculated terrain-based camera angle (aspect_deg not available):', { bearing, pitch })
        }
        
        // Use slope_deg from mapping CSV to calculate pitch if available
        if (glacierEntry.slope_deg !== undefined && glacierEntry.slope_deg !== null) {
          // Base pitch on slope: steeper slopes = higher pitch
          // Pitch range: 45-65 degrees
          pitch = 45 + (glacierEntry.slope_deg * 0.5) // Scale slope to pitch
          pitch = Math.min(65, Math.max(45, pitch)) // Clamp between 45-65 degrees
          console.log('[GlacierNavigation] Using slope_deg from mapping for pitch:', {
            slope_deg: glacierEntry.slope_deg,
            pitch: pitch
          })
        } else if (glacierEntry.aspect_deg === undefined || glacierEntry.aspect_deg === null) {
          // Only use terrain-calculated pitch if we also calculated bearing from terrain
          // (pitch was already set above in the fallback case)
        }
      }
      
      // If 3D is enabled, use fitBounds with bearing and pitch
      if (is3D.value) {
        // Ensure terrain is enabled
        if (!map.value.getSource('mapbox-dem')) {
          map.value.addSource('mapbox-dem', {
            type: 'raster-dem',
            url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
            tileSize: 256,
            maxzoom: 11,
          })
        }
        
        if (!map.value.getTerrain()) {
          map.value.setTerrain({
            source: 'mapbox-dem',
            exaggeration: 1.0,
          })
        }
        
        // Calculate camera parameters from bounds using cameraForBounds
        // This gives us the appropriate zoom level for the bounds
        const bounds = [[min_lng, min_lat], [max_lng, max_lat]]
        const padding = { top: 100, bottom: 100, left: 100, right: 100 }
        
        const cameraOptions = map.value.cameraForBounds(bounds, {
          padding: padding
        })
        
        // Use flyTo with the calculated zoom/center from bounds, plus bearing and pitch
        map.value.flyTo({
          center: cameraOptions.center || [centerLng, centerLat],
          zoom: cameraOptions.zoom,
          bearing: bearing,
          pitch: pitch,
          duration: 2000,
          essential: true
        })
        
        console.log('[GlacierNavigation] ✓ Flying to glacier bounds with 3D camera angle:', {
          bearing: bearing.toFixed(1) + '°',
          pitch: pitch.toFixed(1) + '°',
          zoom: calculatedZoom.toFixed(1)
        })
      } else {
        // 2D view - use cameraForBounds to calculate zoom, then zoom out a bit more
        const bounds = [[min_lng, min_lat], [max_lng, max_lat]]
        const padding = { top: 100, bottom: 100, left: 100, right: 100 }
        
        const cameraOptions = map.value.cameraForBounds(bounds, {
          padding: padding
        })
        
        // Zoom out a bit more by reducing zoom level by 0.5
        const zoomedOutZoom = cameraOptions.zoom ? cameraOptions.zoom - 0.5 : undefined
        
        map.value.flyTo({
          center: cameraOptions.center || [centerLng, centerLat],
          zoom: zoomedOutZoom,
          duration: 1000
        })
        
        console.log('[GlacierNavigation] ✓ Zoomed to glacier extent from mapping data (2D, zoomed out)')
      }
    } catch (error) {
      console.error('[GlacierNavigation] Error zooming to glacier extent:', error)
    }
  }

  return {
    calculateTerrainCameraAngle,
    zoomToGlacierExtent
  }
}

