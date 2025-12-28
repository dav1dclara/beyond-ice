<template>
  <div class="map-viewer">
    <div ref="mapboxCanvas" class="mapbox-canvas"></div>
    
    <Transition name="fade">
      <MapLoadOverlay v-if="!mapLoaded" @load="initializeMap" />
    </Transition>
    
    <!-- Legend -->
    <Legend 
      v-if="mapLoaded"
      :current-mode="mapMode === 'dynamic' ? 'default' : mapMode"
      :current-visualization="visualization"
      :visible-years="visibleYears"
      :min-year="PROJECTION_CONFIG.MIN_YEAR"
      :max-year="PROJECTION_CONFIG.MAX_YEAR"
      :reference-scenario="referenceScenario"
      :comparison-scenario="comparisonScenario"
      :visible-scenarios="visibleScenarios"
      @year-toggle="toggleYear"
      @toggle-all-years="toggleAllYears"
      @scenario-toggle="toggleScenario"
      @visualization-change="handleVisualizationChange"
    />
    

    
    <!-- Tooltip for glacier properties -->
    <GlacierTooltip ref="tooltipElement" :tooltip="tooltip" />
    
    <!-- Map controls in top-right corner -->
    <MapControls
      :map-loaded="mapLoaded"
      :is3D="is3D"
      :is-satellite="isSatellite"
      @zoom-to-extent="handleZoomToExtent"
      @reset-bearing="handleResetBearing"
      @toggle-terrain="toggleTerrain"
      @toggle-basemap="toggleBasemap"
    />
    
    <SearchBar
      :model-value="searchQuery"
      :map-loaded="mapLoaded"
      :show-search-results="showSearchResults"
      :search-results="searchResults"
      :selected-glacier="selectedGlacier"
      @search="handleSearch"
      @clear="handleSearchClear"
      @update:model-value="searchQuery = $event"
      @select="handleGlacierSelect"
      @zoom-to-glacier="zoomToGlacierExtent"
      class="searchbar-top-center"
    />
    
    <ImprintModal :map-loaded="mapLoaded" />
    
    <!-- <ProjectionTimeControls
      :map-loaded="mapLoaded"
      :selected-projection="projection"
      :selected-glacier="selectedGlacier"
      :current-year="currentYear"
      :min-year="PROJECTION_CONFIG.MIN_YEAR"
      :max-year="PROJECTION_CONFIG.MAX_YEAR"
      :step="PROJECTION_CONFIG.YEAR_STEP"
      :map="map"
      :get-source-id="getSourceId"
      @projection-change="handleProjectionChange"
      @year-change="handleYearChange"
      @mode-change="handleModeChange"
    /> -->
    
    <ControlPanel 
      :current-year="currentYear"
      :min-year="PROJECTION_CONFIG.MIN_YEAR"
      :max-year="PROJECTION_CONFIG.MAX_YEAR"
      :step="PROJECTION_CONFIG.YEAR_STEP"
      :selected-projection="projection"
      :selected-glacier="selectedGlacier"
      :map="map"
      :get-source-id="getSourceId"
      :map-loaded="mapLoaded"
      :reference-scenario="referenceScenario"
      :comparison-scenario="comparisonScenario"
      @year-change="handleYearChange"
      @projection-change="handleProjectionChange"
      @mode-change="handleModeChange"
      @reference-scenario-change="handleReferenceScenarioChange"
      @comparison-scenario-change="handleComparisonScenarioChange"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, watch, computed } from 'vue'
import mapboxgl from 'mapbox-gl'
import { useMapboxMap } from '../composables/useMapboxMap.js'
import { useMapControls } from '../composables/useMapControls.js'
import { useGlacierNavigation } from '../composables/useGlacierNavigation.js'
import { useMapLayers } from '../composables/useMapLayers.js'
import { useGlacierSearch } from '../composables/useGlacierSearch.js'
import { useFeatureSelection } from '../composables/useFeatureSelection.js'
import { useLayerVisualization } from '../composables/useLayerVisualization.js'
import { TILESET_IDS } from '../config/mapbox.js'
import { PROJECTION_CONFIG } from '../config/projections.js'
import { COLORS } from '../config/colors.js'
import { swissImage } from '../config/mapStyles.js'
import SearchBar from './SearchBar.vue'
// import ProjectionTimeControls from './ProjectionTimeControls.vue'
import MapLoadOverlay from './MapLoadOverlay.vue'
import ControlPanel from './ControlPanel.vue'
import Legend from './Legend.vue'
import MapControls from './MapControls.vue'
import GlacierTooltip from './GlacierTooltip.vue'
import ImprintModal from './ImprintModal.vue'

// Template ref for map container
const mapboxCanvas = ref(null)
const tooltipElement = ref(null)

// Initialize map using composable
const { map, mapLoaded, initializeMap } = useMapboxMap(mapboxCanvas)

// Map controls composable
const { is3D, toggleTerrain, resetBearing } = useMapControls(map)

// Basemap state
const isSatellite = ref(false)


// Visualization state
const visualization = ref('uniform')

// Map mode state: 'overlay', 'dynamic', or 'comparison'
const mapMode = ref('dynamic')

// Year visibility state for overlay mode
const decadeYears = []
for (let y = PROJECTION_CONFIG.MIN_YEAR; y <= PROJECTION_CONFIG.MAX_YEAR; y += 10) {
  decadeYears.push(y)
}
const visibleYears = ref(new Set(decadeYears)) // All years visible by default

// Computed to check if all years are visible
const allYearsVisible = computed(() => {
  return decadeYears.every(year => visibleYears.value.has(year))
})

// Toggle year visibility in overlay mode
const toggleYear = (year) => {
  if (visibleYears.value.has(year)) {
    visibleYears.value.delete(year)
  } else {
    visibleYears.value.add(year)
  }
  
  // Recreate all layers to maintain proper ordering
  if (map.value && mapMode.value === 'overlay') {
    createLayersForProjectionYear(projection.value, currentYear.value)
    // Update outline after layers are recreated
    setTimeout(() => {
      updateOverlayOutline()
    }, 200)
    // Update click handlers after layers are recreated
    setTimeout(async () => {
      await setupClickHandler()
    }, 150)
  }
}

// Toggle all years visibility
const toggleAllYears = () => {
  if (allYearsVisible.value) {
    // Hide all years
    visibleYears.value.clear()
  } else {
    // Show all years
    visibleYears.value = new Set(decadeYears)
  }
  
  // Recreate all layers to maintain proper ordering
  if (map.value && mapMode.value === 'overlay') {
    createLayersForProjectionYear(projection.value, currentYear.value)
    // Update outline after layers are recreated
    setTimeout(() => {
      updateOverlayOutline()
    }, 200)
  }
}

// Toggle scenario visibility in comparison mode
const toggleScenario = (scenario) => {
  if (visibleScenarios.value.has(scenario)) {
    visibleScenarios.value.delete(scenario)
  } else {
    visibleScenarios.value.add(scenario)
  }
  
  // Update layer visibility
  if (map.value && mapMode.value === 'comparison') {
    updateComparisonLayerVisibility()
  }
}

// Update comparison layer visibility based on visibleScenarios
const updateComparisonLayerVisibility = () => {
  if (!map.value || mapMode.value !== 'comparison') return
  
  const refLayerId = getComparisonLayerId(referenceScenario.value)
  const compLayerId = getComparisonLayerId(comparisonScenario.value)
  
  // Show/hide reference layer
  if (map.value.getLayer(refLayerId)) {
    const visibility = visibleScenarios.value.has('reference') ? 'visible' : 'none'
    map.value.setLayoutProperty(refLayerId, 'visibility', visibility)
  }
  
  // Show/hide comparison layer
  if (map.value.getLayer(compLayerId)) {
    const visibility = visibleScenarios.value.has('comparison') ? 'visible' : 'none'
    map.value.setLayoutProperty(compLayerId, 'visibility', visibility)
  }
}

// Update comparison layer opacity for selected glaciers
const updateComparisonLayerOpacity = () => {
  if (!map.value || mapMode.value !== 'comparison') return
  
  const refLayerId = getComparisonLayerId(referenceScenario.value)
  const compLayerId = getComparisonLayerId(comparisonScenario.value)
  
  // Higher opacity for selected glacier (1.0), base opacity for others
  const fillOpacity = selectedFeatureId.value
    ? [
        'case',
        ['==', ['id'], selectedFeatureId.value],
        1.0, // Selected glacier: full opacity
        0.6 // Other glaciers: base opacity
      ]
    : 0.6
  
  // Update reference layer opacity
  if (map.value.getLayer(refLayerId)) {
    map.value.setPaintProperty(refLayerId, 'fill-opacity', fillOpacity)
  }
  
  // Update comparison layer opacity
  if (map.value.getLayer(compLayerId)) {
    map.value.setPaintProperty(compLayerId, 'fill-opacity', fillOpacity)
  }
}

// Update overlay outline layer for selected glacier (2020 year only)
const updateOverlayOutline = () => {
  if (!map.value || mapMode.value !== 'overlay') return
  
  const overlayOutlineId = getOverlayOutlineId(projection.value)
  
  if (map.value.getLayer(overlayOutlineId)) {
    const filter = selectedFeatureId.value 
      ? ['==', ['id'], selectedFeatureId.value]
      : ['literal', false]
    map.value.setFilter(overlayOutlineId, filter)
    
    // Update outline color to match 2020 layer color
    const minYear = PROJECTION_CONFIG.MIN_YEAR
    const yearColor = getYearColor(minYear)
    map.value.setPaintProperty(overlayOutlineId, 'line-color', yearColor)
  }
}

// Wrapper function to update both regular and comparison layer colors/opacity
const updateAllLayerColors = () => {
  updateLayerColors()
  updateComparisonLayerOpacity()
  updateOverlayOutline()
}

// Tooltip state
const tooltip = ref({
  visible: false,
  feature: null,
  x: 0,
  y: 0
})

// Tooltip delay timer
let tooltipTimer = null
const TOOLTIP_DELAY = 500 // milliseconds

// Calculate tooltip position with boundary checking
const calculateTooltipPosition = (pointX, pointY) => {
  if (!mapboxCanvas.value || !map.value) {
    return { x: pointX + 10, y: pointY - 10 }
  }
  
  const canvas = mapboxCanvas.value
  const canvasWidth = canvas.offsetWidth
  const canvasHeight = canvas.offsetHeight
  
  // Get actual tooltip dimensions if available, otherwise use estimates
  let tooltipWidth = 200
  let tooltipHeight = 100
  
  if (tooltipElement.value?.$el) {
    const tooltipEl = tooltipElement.value.$el
    if (tooltipEl.offsetWidth > 0 && tooltipEl.offsetHeight > 0) {
      tooltipWidth = tooltipEl.offsetWidth
      tooltipHeight = tooltipEl.offsetHeight
    }
  }
  
  // Default: place tooltip to the right and below cursor (attached, no gap)
  let x = pointX
  let y = pointY
  
  // Check if tooltip would overflow on the right - flip to left if needed
  const wouldOverflowRight = x + tooltipWidth > canvasWidth
  if (wouldOverflowRight) {
    // Place tooltip to the left of cursor, attached (no gap)
    x = pointX - tooltipWidth
  } else {
    // If cursor is on the very left and we're placing to the right, add offset to avoid weird gap
    if (pointX < 50) {
      x = pointX + 50
    }
  }
  
  // Check if tooltip would overflow on the bottom - flip above if needed
  if (y + tooltipHeight > canvasHeight) {
    // Place tooltip above cursor, attached (no gap)
    y = pointY - tooltipHeight
  }
  
  // Final boundary checks to ensure tooltip stays within canvas
  if (x < 0) {
    x = 0
  }
  if (x + tooltipWidth > canvasWidth) {
    x = canvasWidth - tooltipWidth
  }
  if (y < 0) {
    y = 0
  }
  if (y + tooltipHeight > canvasHeight) {
    y = canvasHeight - tooltipHeight
  }
  
  return { x, y }
}

// Handle visualization change
const handleVisualizationChange = (mode) => {
  visualization.value = mode
  // Update the layer colors
  updateAllLayerColors()
}

// Cleanup on unmount
onBeforeUnmount(() => {
  // Clear tooltip timer
  if (tooltipTimer) {
    clearTimeout(tooltipTimer)
    tooltipTimer = null
  }
  
  // Clear year change timer
  clearYearChangeTimer()
  
  
  // Clean up all map event handlers
  if (map.value) {
    // Remove all handlers for the current layer
    if (handlerLayerId.value) {
      try {
        const layerId = handlerLayerId.value
        if (currentMousemoveHandler) {
          map.value.off('mousemove', layerId, currentMousemoveHandler)
        } else {
          map.value.off('mousemove', layerId)
        }
        if (currentMouseleaveHandler) {
          map.value.off('mouseleave', layerId, currentMouseleaveHandler)
        } else {
          map.value.off('mouseleave', layerId)
        }
        map.value.off('click', layerId, handleGlacierClick)
      } catch (error) {
        // Ignore errors
      }
    }
    
    // Remove map click handler
    if (mapClickHandlerSetup.value) {
      try {
        map.value.off('click', handleMapClick)
      } catch (error) {
        // Ignore errors
      }
    }
  }
})

// Toggle basemap between light and aerial (Swisstopo SWISSIMAGE)
const toggleBasemap = (satellite) => {
  if (!map.value) return
  
  // Don't do anything if already in the requested state
  if (isSatellite.value === satellite) return
  
  // Store current 3D state before style change
  const was3D = is3D.value
  const currentPitch = map.value.getPitch()
  const currentTerrain = map.value.getTerrain()
  
  isSatellite.value = satellite
  
  const newStyle = isSatellite.value
    ? swissImage
    : 'mapbox://styles/davidclara/cmjqbpgl6009001qy10ju7edu'
  
  // Reset loaded sources since style change removes all sources
  loadedSources.value.clear()
  // Reset click handler setup flag since map is being recreated
  mapClickHandlerSetup.value = false
  
  // When style changes, we need to wait for it to load before re-adding sources/layers
  map.value.once('style.load', () => {
    // Ensure globe projection is set for custom styles
    if (isSatellite.value) {
      map.value.setProjection('globe')
    }
    
    // Restore 3D state if it was enabled before style change
    if (was3D) {
      // Add terrain source
      if (!map.value.getSource('mapbox-dem')) {
        map.value.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 256,
          maxzoom: 11,
        })
      }
      
      // Enable terrain
      map.value.setTerrain({
        source: 'mapbox-dem',
        exaggeration: 1.0,
      })
      
      // Restore pitch
      map.value.easeTo({
        pitch: currentPitch || 50,
        duration: 0, // Instant since we're restoring state
      })
    }
    
    // Re-add all tileset sources and layers after style change
    const reinitializeLayers = async () => {
      // Get all available projections
      const projections = Object.keys(TILESET_IDS).filter(proj => TILESET_IDS[proj] !== null)
      
      // Reload all tileset sources
      const loadPromises = projections.map(proj => loadTilesetSource(proj))
      await Promise.all(loadPromises)
      
      // Recreate layers for current projection and year
      createLayersForProjectionYear(projection.value, currentYear.value)
      updateAllLayerColors()
      setupClickHandler()
    }
    
    reinitializeLayers()
  })
  
  map.value.setStyle(newStyle)
}

// Projection and year state
const projection = ref(PROJECTION_CONFIG.DEFAULT_PROJECTION)
const currentYear = ref(PROJECTION_CONFIG.DEFAULT_YEAR)

// Comparison mode state
const referenceScenario = ref('SSP2-4.5')
const comparisonScenario = ref('SSP5-8.5')
const visibleScenarios = ref(new Set(['reference', 'comparison']))

// Glacier search composable (no dependencies, can be initialized early)
const {
  searchQuery,
  searchResults,
  showSearchResults,
  glacierSearchIndex,
  loadGlacierSearchIndex,
  handleSearch,
  handleSearchClear: clearSearch
} = useGlacierSearch()



// querySourceFeatures will be defined after composables are initialized

// Search handlers - now using useGlacierSearch composable
// handleSearch and loadGlacierSearchIndex are available from useGlacierSearch

// Wrapper for handleSearchClear that also clears selection
const handleSearchClear = () => {
  clearSearch()
  clearSelection()
  console.log('[MapNew] ✓ Deselected (search cleared)')
}

const handleGlacierSelect = async (result) => {
  console.log('[MapNew] Glacier selected:', result)
  showSearchResults.value = false
  
  if (!result || !result['mapbox-id']) {
    console.warn('[MapNew] Invalid glacier selection result')
    return
  }
  
  const mapboxId = result['mapbox-id']
  
  // If bounds are available, fly to them first to ensure the feature is loaded
  if (result.bounds) {
    console.log('[MapNew] Flying to glacier bounds before selecting...')
    try {
      const bounds = [[result.bounds.min_lng, result.bounds.min_lat], [result.bounds.max_lng, result.bounds.max_lat]]
      const padding = { top: 100, bottom: 100, left: 100, right: 100 }
      const centerLng = (result.bounds.min_lng + result.bounds.max_lng) / 2
      const centerLat = (result.bounds.min_lat + result.bounds.max_lat) / 2
      const boundsObj = { min_lng: result.bounds.min_lng, min_lat: result.bounds.min_lat, max_lng: result.bounds.max_lng, max_lat: result.bounds.max_lat }
      
      if (is3D.value) {
        // 3D mode - use same terrain-aware camera positioning as zoom button
        // Find the glacier in the search index to get aspect_deg and slope_deg
        const glacierEntry = glacierSearchIndex.value.find(entry => entry.mapbox_id === mapboxId)
        
        let bearing = 0
        let pitch = 50 // Default pitch
        
        if (glacierEntry) {
          // Use aspect_deg from mapping CSV if available
          if (glacierEntry.aspect_deg !== undefined && glacierEntry.aspect_deg !== null) {
            // Aspect is the direction the terrain faces (downhill)
            // For viewing, we want to look FROM the uphill side TO the downhill side
            // So bearing should be opposite of aspect (180° rotation)
            bearing = (glacierEntry.aspect_deg + 180) % 360
          } else {
            // Fallback to terrain calculation if aspect_deg not available
            const cameraAngle = calculateTerrainCameraAngle(boundsObj)
            bearing = cameraAngle.bearing
            pitch = cameraAngle.pitch
          }
          
          // Use slope_deg from mapping CSV to calculate pitch if available
          if (glacierEntry.slope_deg !== undefined && glacierEntry.slope_deg !== null) {
            // Base pitch on slope: steeper slopes = higher pitch
            // Pitch range: 45-65 degrees
            pitch = 45 + (glacierEntry.slope_deg * 0.5) // Scale slope to pitch
            pitch = Math.min(65, Math.max(45, pitch)) // Clamp between 45-65 degrees
          }
        } else {
          // If glacier entry not found, use terrain calculation
          const cameraAngle = calculateTerrainCameraAngle(boundsObj)
          bearing = cameraAngle.bearing
          pitch = cameraAngle.pitch
        }
        
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
      } else {
        // 2D mode - use cameraForBounds and zoom out a bit more
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
      }
      
      // Wait for the map to finish flying and tiles to load
      await new Promise(resolve => {
        map.value.once('idle', () => {
          setTimeout(() => resolve(), 300) // Small delay to ensure tiles are loaded
        })
      })
      console.log('[MapNew] Finished flying to bounds')
    } catch (error) {
      console.warn('[MapNew] Error flying to bounds:', error)
    }
  }
  
  // Find the feature in the current tileset
  const sourceId = getSourceId(projection.value)
  if (!sourceId || !map.value) {
    console.warn('[MapNew] Cannot select glacier: source not available')
    return
  }
  
  try {
    // Query the tileset for the feature with this mapbox-id
    const source = map.value.getSource(sourceId)
    if (!source || source.type !== 'vector') {
      console.warn('[MapNew] Source not available or not a vector source')
      return
    }
    
    // Get the current year's source layer
    const sourceLayerName = currentYear.value.toString()
    
    // Helper function to find feature
    const findFeature = () => {
      let features = map.value.querySourceFeatures(sourceId, {
        sourceLayer: sourceLayerName
      })
      
      // Try finding by ID first
      let feature = features.find(f => f.id === mapboxId)
      
      // If not found, try filtering by mapbox-id property
      if (!feature) {
        try {
          features = map.value.querySourceFeatures(sourceId, {
            sourceLayer: sourceLayerName,
            filter: ['==', ['get', 'mapbox-id'], mapboxId]
          })
          if (features.length > 0) {
            feature = features[0]
          }
        } catch (e) {
          // Filter might not work, continue
        }
      }
      
      // If still not found, try string comparison
      if (!feature) {
        features = map.value.querySourceFeatures(sourceId, {
          sourceLayer: sourceLayerName
        })
        feature = features.find(f => {
          const fId = f.id
          const fMapboxId = f.properties?.['mapbox-id']
          return fId === mapboxId || fId === String(mapboxId) || 
                 fMapboxId === mapboxId || fMapboxId === String(mapboxId)
        })
      }
      
      return feature
    }
    
    // Try to find the feature (should be available after flying to bounds)
    let feature = findFeature()
    
    // If still not found, try with retries (tiles might still be loading)
    let retries = 0
    const maxRetries = 5
    while (!feature && retries < maxRetries) {
      console.log(`[MapNew] Feature not found, retrying... (${retries + 1}/${maxRetries})`)
      await new Promise(resolve => setTimeout(resolve, 300))
      feature = findFeature()
      retries++
    }
    
    if (!feature) {
      console.warn(`[MapNew] Glacier with mapbox-id ${mapboxId} not found after ${maxRetries} retries`)
      // Still set selection - it will work when feature becomes visible
      selectedGlacier.value = {
        id: mapboxId,
        name: result.name || null,
        'sgi-id': result['sgi-id'] || null,
        'mapbox-id': mapboxId
      }
      selectedFeatureId.value = mapboxId
      searchQuery.value = result.name || ''
      updateAllLayerColors()
      return
    }
    
    // Feature found - set selection with actual feature data
    selectedGlacier.value = {
      id: feature.id || mapboxId,
      name: result.name || feature.properties?.name || null,
      'sgi-id': result['sgi-id'] || feature.properties?.['sgi-id'] || null,
      'mapbox-id': mapboxId
    }
    selectedFeatureId.value = feature.id || mapboxId
    searchQuery.value = result.name || ''
    
    // Update layer colors to highlight the selected feature
    updateAllLayerColors()
    
    // If we didn't use bounds to fly, zoom to the feature geometry for fine-tuning
    if (!result.bounds && feature.geometry) {
      try {
        // Calculate bounds from geometry
        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
        
        const processCoords = (coords) => {
          if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
            // It's an array of coordinates
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
            // It's a single coordinate
            const [lng, lat] = coords
            minLng = Math.min(minLng, lng)
            minLat = Math.min(minLat, lat)
            maxLng = Math.max(maxLng, lng)
            maxLat = Math.max(maxLat, lat)
          }
        }
        
        if (feature.geometry.type === 'Polygon') {
          feature.geometry.coordinates[0].forEach(processCoords)
        } else if (feature.geometry.type === 'MultiPolygon') {
          feature.geometry.coordinates.forEach(polygon => {
            polygon[0].forEach(processCoords)
          })
        }
        
        if (minLng !== Infinity && minLat !== Infinity) {
          const bounds = [[minLng, minLat], [maxLng, maxLat]]
          const padding = { top: 100, bottom: 100, left: 100, right: 100 }
          const centerLng = (minLng + maxLng) / 2
          const centerLat = (minLat + maxLat) / 2
          const boundsObj = { min_lng: minLng, min_lat: minLat, max_lng: maxLng, max_lat: maxLat }
          
          if (is3D.value) {
            // 3D mode - use same terrain-aware camera positioning as zoom button
            // Find the glacier in the search index to get aspect_deg and slope_deg
            const glacierEntry = glacierSearchIndex.value.find(entry => entry.mapbox_id === mapboxId)
            
            let bearing = 0
            let pitch = 50 // Default pitch
            
            if (glacierEntry) {
              // Use aspect_deg from mapping CSV if available
              if (glacierEntry.aspect_deg !== undefined && glacierEntry.aspect_deg !== null) {
                // Aspect is the direction the terrain faces (downhill)
                // For viewing, we want to look FROM the uphill side TO the downhill side
                // So bearing should be opposite of aspect (180° rotation)
                bearing = (glacierEntry.aspect_deg + 180) % 360
              } else {
                // Fallback to terrain calculation if aspect_deg not available
                const cameraAngle = calculateTerrainCameraAngle(boundsObj)
                bearing = cameraAngle.bearing
                pitch = cameraAngle.pitch
              }
              
              // Use slope_deg from mapping CSV to calculate pitch if available
              if (glacierEntry.slope_deg !== undefined && glacierEntry.slope_deg !== null) {
                // Base pitch on slope: steeper slopes = higher pitch
                // Pitch range: 45-65 degrees
                pitch = 45 + (glacierEntry.slope_deg * 0.5) // Scale slope to pitch
                pitch = Math.min(65, Math.max(45, pitch)) // Clamp between 45-65 degrees
              }
            } else {
              // If glacier entry not found, use terrain calculation
              const cameraAngle = calculateTerrainCameraAngle(boundsObj)
              bearing = cameraAngle.bearing
              pitch = cameraAngle.pitch
            }
            
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
          } else {
            // 2D mode - use cameraForBounds and zoom out a bit more
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
          }
        }
      } catch (error) {
        console.warn('[MapNew] Could not zoom to glacier:', error)
      }
    }
    
    console.log('[MapNew] ✓ Glacier selected and highlighted:', selectedGlacier.value)
  } catch (error) {
    console.error('[MapNew] Error selecting glacier:', error)
  }
}



// Debounce timer for year changes to prevent lag
let yearChangeTimer = null

// Cleanup function for year change timer
const clearYearChangeTimer = () => {
  if (yearChangeTimer) {
    clearTimeout(yearChangeTimer)
    yearChangeTimer = null
  }
}

// Function to update layers for current year (recreate with new source-layer)
const updateLayersForCurrentYear = () => {
  // Clear any pending year change
  clearYearChangeTimer()
  
  // Debounce the layer update to prevent lag from rapid changes
  yearChangeTimer = setTimeout(() => {
    const proj = projection.value
    const year = currentYear.value
    
    // Preserve selected feature ID before recreating layers
    const preservedFeatureId = selectedFeatureId.value
    
    // If in comparison mode, recreate layers for both scenarios with new year
    if (mapMode.value === 'comparison') {
      createLayersForProjectionYear(proj, year)
      return
    }
    
    // Use nextTick to batch layer operations
    nextTick(() => {
      // Recreate layers for current projection with new year (source is already loaded, so this is fast)
      createLayersForProjectionYear(proj, year)
      
      // Wait for map to be idle to ensure new source-layer data is loaded
      if (map.value) {
        // Wait for the new source-layer data to be available
        map.value.once('idle', () => {
          // Small delay to ensure tiles are fully loaded
          setTimeout(() => {
            // Force color update by re-setting paint properties with fresh expressions
            const layerId = getLayerId(proj)
            
            if (map.value.getLayer(layerId)) {
              // Get fresh color expression (will use new source-layer data)
              const fillColor = getFillColor()
              const fillOpacity = getFillOpacity()
              // Force update by setting to a different value first, then back
              map.value.setPaintProperty(layerId, 'fill-color', COLORS.glacier.default)
              setTimeout(() => {
                map.value.setPaintProperty(layerId, 'fill-color', fillColor)
                map.value.setPaintProperty(layerId, 'fill-opacity', fillOpacity)
              }, 10)
            }
            // Update all colors
            updateAllLayerColors()
            
            // Restore selection if we had a selected feature ID
            if (preservedFeatureId !== null && preservedFeatureId !== undefined) {
              setTimeout(() => {
                restoreSelectionByFeatureId(preservedFeatureId)
              }, 200)
            }
          }, 100)
        })
      }
      
      // Setup click handler
      setupClickHandler()
      
      // Setup click handler
      setupClickHandler()
    })
  }, 100) // 100ms debounce
}

// Handle mode change
const handleModeChange = (mode) => {
  console.log('[MapNew] Mode changed to:', mode)
  // Map 'default' to 'dynamic', keep 'overlay' and 'comparison' as is
  const mappedMode = mode === 'default' ? 'dynamic' : mode
  mapMode.value = mappedMode
  // When switching to overlay mode, the visualization is handled by the overlay mode layers
  // When switching to dynamic mode, restore the previous visualization
  // When switching to comparison mode, create layers for both scenarios
  if (mappedMode === 'comparison') {
    createLayersForProjectionYear(projection.value, currentYear.value)
  }
}

// Handle reference scenario change in comparison mode
const handleReferenceScenarioChange = (scenario) => {
  console.log('[MapNew] Reference scenario changed to:', scenario)
  referenceScenario.value = scenario
  if (mapMode.value === 'comparison') {
    createLayersForProjectionYear(projection.value, currentYear.value)
  }
}

// Handle comparison scenario change in comparison mode
const handleComparisonScenarioChange = (scenario) => {
  console.log('[MapNew] Comparison scenario changed to:', scenario)
  comparisonScenario.value = scenario
  if (mapMode.value === 'comparison') {
    createLayersForProjectionYear(projection.value, currentYear.value)
  }
}

const handleProjectionChange = (newProjection) => {
  console.log('[MapNew] Projection changed to:', newProjection)
  
  // Preserve selected feature ID before changing projection
  const preservedFeatureId = selectedFeatureId.value
  
  // Get old projection before updating
  const oldProjection = projection.value
  
  // Remove old projection layers
  const oldLayerId = getLayerId(oldProjection)
  const oldOutlineId = getOutlineId(oldProjection)
  if (map.value.getLayer(oldLayerId)) {
    map.value.removeLayer(oldLayerId)
  }
  if (map.value.getLayer(oldOutlineId)) {
    map.value.removeLayer(oldOutlineId)
  }
  
  // If in overlay mode, clean up old projection's overlay layers
  if (mapMode.value === 'overlay') {
    cleanupStaticLayers(oldProjection)
    console.log('[MapNew] Cleaned up overlay layers for old projection:', oldProjection)
  }
  
  // Update projection
  projection.value = newProjection
  
  // Create layers for new projection with current year (source is already loaded, so this is fast)
  createLayersForProjectionYear(newProjection, currentYear.value)
  
  // Update colors for new projection
  updateAllLayerColors()
  
  // Setup click handler for new layer
  setupClickHandler()
  
  // Restore selection if we had a selected feature ID
  if (preservedFeatureId !== null && preservedFeatureId !== undefined) {
    // Wait for map to be idle (layers fully rendered) before restoring selection
    map.value.once('idle', () => {
      // Additional small delay to ensure features are queryable
      setTimeout(() => {
        restoreSelectionByFeatureId(preservedFeatureId)
      }, 200)
    })
  } else {
    // Clear selection only if no feature ID was preserved
    selectedGlacier.value = null
    searchQuery.value = ''
  }
}

// restoreSelectionByFeatureId is now available from useFeatureSelection composable

// Handle year change
const handleYearChange = (newYear) => {
  console.log('[MapNew] Year changed to:', newYear)
  currentYear.value = newYear
  
  // Update layers for current projection with new year (this will restore selection if feature ID exists)
  updateLayersForCurrentYear()
}

// Reset bearing handler (delegates to composable)
const handleResetBearing = () => {
  resetBearing()
}

// Zoom to full extent (center of Switzerland)
const handleZoomToExtent = () => {
  if (!map.value) return
  
  try {
    // Zoom to center of Switzerland with zoom level 8
    map.value.flyTo({
      center: [8.5143, 46.3803], // Center of Switzerland
      zoom: 8,
      duration: 1000
    })
    
    console.log('[MapNew] Zoomed to full extent (center of Switzerland)')
  } catch (error) {
    console.error('[MapNew] Error zooming to extent:', error)
  }
}

// Track which layer has handlers set up to avoid duplicate handlers
const handlerLayerId = ref(null)
const mapClickHandlerSetup = ref(false)
const lastModeSwitchTime = ref(0)
const selectionTime = ref(0)

// Store handler function references so they can be properly removed
let currentMousemoveHandler = null
let currentMouseleaveHandler = null

// handleGlacierClick and handleMapClick are now available from useFeatureSelection composable

// Clean up handlers from overlay layers
const cleanupOverlayHandlers = () => {
  if (!map.value) return
  
  // Remove handlers from all possible overlay layers (not just the ones in handlerLayerId)
  // This ensures we clean up even if handlerLayerId is not set correctly
  decadeYears.forEach(year => {
    const layerId = getStaticLayerId(projection.value, year)
    try {
      // Try to remove handlers with the stored handler references first
      if (currentMousemoveHandler) {
        map.value.off('mousemove', layerId, currentMousemoveHandler)
      }
      if (currentMouseleaveHandler) {
        map.value.off('mouseleave', layerId, currentMouseleaveHandler)
      }
      // Always try to remove click handler (even without stored reference)
      map.value.off('click', layerId, handleGlacierClick)
    } catch (error) {
      // Ignore errors when removing handlers (layer might not exist or have handlers)
    }
  })
  
  // Also clean up based on handlerLayerId if it exists
  if (handlerLayerId.value && handlerLayerId.value.startsWith('overlay-')) {
    const oldKey = handlerLayerId.value.replace('overlay-', '')
    const oldLayerIds = oldKey.split('-').filter(id => id)
    
    oldLayerIds.forEach(oldLayerId => {
      try {
        if (currentMousemoveHandler) {
          map.value.off('mousemove', oldLayerId, currentMousemoveHandler)
        }
        if (currentMouseleaveHandler) {
          map.value.off('mouseleave', oldLayerId, currentMouseleaveHandler)
        }
        map.value.off('click', oldLayerId, handleGlacierClick)
      } catch (error) {
        // Ignore errors
      }
    })
  }
  
  // Clear handler references
  currentMousemoveHandler = null
  currentMouseleaveHandler = null
  handlerLayerId.value = null
  console.log('[MapNew] Cleaned up overlay handlers')
}

// Setup click handler for feature selection
const setupClickHandler = async () => {
  if (!map.value) {
    console.warn('[MapNew] Cannot setup click handler: map not available')
    return
  }
  
  // In overlay mode, set up handlers for all visible overlay layers
  if (mapMode.value === 'overlay') {
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
      console.warn('[MapNew] Cannot setup click handler: no visible overlay layers')
      return
    }
    
    // Check if handlers are already set up for these layers
    const overlayLayerKey = `overlay-${overlayLayerIds.join('-')}`
    if (handlerLayerId.value === overlayLayerKey) {
      return
    }
    
    console.log('[MapNew] Setting up click handlers for overlay layers:', overlayLayerIds)
    
    // Remove old handlers first
    if (handlerLayerId.value && handlerLayerId.value.startsWith('overlay-')) {
      // Extract old layer IDs from the key
      const oldKey = handlerLayerId.value.replace('overlay-', '')
      const oldLayerIds = oldKey.split('-').filter(id => id)
      oldLayerIds.forEach(oldLayerId => {
        try {
          map.value.off('mousemove', oldLayerId, currentMousemoveHandler)
          map.value.off('mouseleave', oldLayerId, currentMouseleaveHandler)
          map.value.off('click', oldLayerId, handleGlacierClick)
        } catch (error) {
          // Ignore errors when removing handlers
        }
      })
    }
    
    // Add handlers to all visible overlay layers
    try {
      overlayLayerIds.forEach(layerId => {
        map.value.on('mousemove', layerId, currentMousemoveHandler)
        map.value.on('mouseleave', layerId, currentMouseleaveHandler)
        map.value.on('click', layerId, handleGlacierClick)
        console.log('[MapNew] ✓ Handlers attached to overlay layer:', layerId)
      })
      
      handlerLayerId.value = overlayLayerKey
      
      // Setup map click handler (only once)
      if (!mapClickHandlerSetup.value) {
        map.value.on('click', handleMapClick)
        mapClickHandlerSetup.value = true
        console.log('[MapNew] ✓ Map click handler set up')
      }
    } catch (error) {
      console.error('[MapNew] Error attaching handlers to overlay layers:', error)
    }
    
    return
  }
  
  // In comparison mode, set up handlers for both layers
  if (mapMode.value === 'comparison') {
    const refLayerId = getComparisonLayerId(referenceScenario.value)
    const compLayerId = getComparisonLayerId(comparisonScenario.value)
    
    // Check if handlers are already set up
    const comparisonLayerKey = `${refLayerId}-${compLayerId}`
    if (handlerLayerId.value === comparisonLayerKey) {
      return
    }
    
    // Ensure both layers exist - retry if not found immediately
    let retries = 0
    const maxRetries = 5
    while ((!map.value.getLayer(refLayerId) || !map.value.getLayer(compLayerId)) && retries < maxRetries) {
      if (retries > 0) {
        console.log(`[MapNew] Layers not ready, retrying... (${retries}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      retries++
    }
    
    if (!map.value.getLayer(refLayerId) || !map.value.getLayer(compLayerId)) {
      console.warn('[MapNew] Cannot setup click handler: comparison layers not found after retries:', { 
        refLayerId, 
        compLayerId,
        refLayerExists: !!map.value.getLayer(refLayerId),
        compLayerExists: !!map.value.getLayer(compLayerId)
      })
      return
    }
    
    console.log('[MapNew] Setting up click handlers for comparison layers:', { refLayerId, compLayerId })
    
    // Remove old handlers first
    if (handlerLayerId.value) {
      const oldKey = handlerLayerId.value
      try {
        // Check if old key is a comparison layer key
        if (oldKey.includes('-') && oldKey.includes('comparison')) {
          // Try to extract layer IDs from old key or use current scenarios
          const oldRefLayerId = getComparisonLayerId(referenceScenario.value)
          const oldCompLayerId = getComparisonLayerId(comparisonScenario.value)
          if (currentMousemoveHandler) {
            map.value.off('mousemove', oldRefLayerId, currentMousemoveHandler)
            map.value.off('mousemove', oldCompLayerId, currentMousemoveHandler)
          }
          if (currentMouseleaveHandler) {
            map.value.off('mouseleave', oldRefLayerId, currentMouseleaveHandler)
            map.value.off('mouseleave', oldCompLayerId, currentMouseleaveHandler)
          }
          map.value.off('click', oldRefLayerId, handleGlacierClick)
          map.value.off('click', oldCompLayerId, handleGlacierClick)
        } else {
          // Regular layer
          if (currentMousemoveHandler) {
            map.value.off('mousemove', oldKey, currentMousemoveHandler)
          }
          if (currentMouseleaveHandler) {
            map.value.off('mouseleave', oldKey, currentMouseleaveHandler)
          }
          map.value.off('click', oldKey, handleGlacierClick)
        }
      } catch (error) {
        console.log('[MapNew] Error removing old handlers:', error)
      }
      // Clear old handler references
      currentMousemoveHandler = null
      currentMouseleaveHandler = null
    }
    
    // Create handler functions
    currentMousemoveHandler = (e) => {
      if (map.value) {
        map.value.getCanvas().style.cursor = 'pointer'
        
        if (tooltipTimer) {
          clearTimeout(tooltipTimer)
          tooltipTimer = null
        }
        
        // In comparison mode or overlay mode, query all relevant layers to get features even when overlapping
        let features = []
        if (mapMode.value === 'comparison') {
          const refLayerId = getComparisonLayerId(referenceScenario.value)
          const compLayerId = getComparisonLayerId(comparisonScenario.value)
          features = map.value.queryRenderedFeatures(e.point, {
            layers: [refLayerId, compLayerId]
          })
        } else if (mapMode.value === 'overlay') {
          const overlayLayerIds = []
          decadeYears.forEach(year => {
            if (visibleYears.value.has(year)) {
              const layerId = getStaticLayerId(projection.value, year)
              if (map.value.getLayer(layerId)) {
                overlayLayerIds.push(layerId)
              }
            }
          })
          features = map.value.queryRenderedFeatures(e.point, {
            layers: overlayLayerIds
          })
        } else {
          features = e.features || []
        }
        
        if (features.length > 0) {
          // Prefer comparison layer feature if available, or topmost overlay layer feature
          let feature = features[0]
          if (mapMode.value === 'comparison') {
            const compLayerId = getComparisonLayerId(comparisonScenario.value)
            feature = features.find(f => f.layer?.id === compLayerId) || features[0]
          } else if (mapMode.value === 'overlay') {
            // In overlay mode, prefer the most recent year (topmost layer)
            // Features are returned in layer order, so the last one is the topmost
            feature = features[features.length - 1]
          }
          
          const pointX = e.point.x
          const pointY = e.point.y
          
          tooltipTimer = setTimeout(() => {
            const position = calculateTooltipPosition(pointX, pointY)
            tooltip.value = {
              visible: true,
              feature: feature,
              x: position.x,
              y: position.y
            }
            tooltipTimer = null
            // Recalculate position with actual tooltip dimensions after rendering
            nextTick(() => {
              if (tooltip.value.visible) {
                const actualPosition = calculateTooltipPosition(pointX, pointY)
                tooltip.value.x = actualPosition.x
                tooltip.value.y = actualPosition.y
              }
            })
          }, TOOLTIP_DELAY)
        } else {
          tooltip.value.visible = false
          tooltip.value.feature = null
        }
      }
    }
    
    currentMouseleaveHandler = () => {
      if (map.value) {
        map.value.getCanvas().style.cursor = ''
      }
      if (tooltipTimer) {
        clearTimeout(tooltipTimer)
        tooltipTimer = null
      }
      tooltip.value.visible = false
      tooltip.value.feature = null
    }
    
    // Add handlers to both layers
    try {
      map.value.on('mousemove', refLayerId, currentMousemoveHandler)
      map.value.on('mouseleave', refLayerId, currentMouseleaveHandler)
      map.value.on('click', refLayerId, handleGlacierClick)
      console.log('[MapNew] ✓ Handlers attached to reference layer:', refLayerId)
      
      map.value.on('mousemove', compLayerId, currentMousemoveHandler)
      map.value.on('mouseleave', compLayerId, currentMouseleaveHandler)
      map.value.on('click', compLayerId, handleGlacierClick)
      console.log('[MapNew] ✓ Handlers attached to comparison layer:', compLayerId)
      
      handlerLayerId.value = comparisonLayerKey
      
      // Setup map click handler (only once)
      if (!mapClickHandlerSetup.value) {
        map.value.on('click', handleMapClick)
        mapClickHandlerSetup.value = true
        console.log('[MapNew] ✓ Map click handler set up')
      }
    } catch (error) {
      console.error('[MapNew] Error attaching handlers to comparison layers:', error)
    }
    
    return
  }
  
  // Regular mode: single layer
  const layerId = currentLayerId.value
  
  // If handlers are already set up for this layer and it's not an overlay/comparison key, skip
  if (handlerLayerId.value === layerId && !handlerLayerId.value.startsWith('overlay-') && !handlerLayerId.value.includes('comparison')) {
    return
  }
  
  // Ensure layers exist
  if (!map.value.getLayer(layerId)) {
    console.warn('[MapNew] Cannot setup click handler: layer not found:', layerId)
    return
  }
  
  console.log('[MapNew] Setting up click handlers for layer:', layerId)
  
  // Remove old handlers first (if any) - use the stored layer ID and handler references
  if (handlerLayerId.value) {
    const oldLayerId = handlerLayerId.value
    try {
      // Check if it's an overlay layer key
      if (oldLayerId.startsWith('overlay-')) {
        // Extract old layer IDs from the key
        const oldKey = oldLayerId.replace('overlay-', '')
        const oldLayerIds = oldKey.split('-').filter(id => id)
        oldLayerIds.forEach(oldLayerId => {
          try {
            if (currentMousemoveHandler) {
              map.value.off('mousemove', oldLayerId, currentMousemoveHandler)
            }
            if (currentMouseleaveHandler) {
              map.value.off('mouseleave', oldLayerId, currentMouseleaveHandler)
            }
            map.value.off('click', oldLayerId, handleGlacierClick)
          } catch (error) {
            // Ignore errors when removing handlers
          }
        })
      } else if (oldLayerId.includes('-') && oldLayerId.includes('comparison')) {
        // It's a comparison layer key, try to remove from both layers
        const refLayerId = getComparisonLayerId(referenceScenario.value)
        const compLayerId = getComparisonLayerId(comparisonScenario.value)
        if (currentMousemoveHandler) {
          map.value.off('mousemove', refLayerId, currentMousemoveHandler)
          map.value.off('mousemove', compLayerId, currentMousemoveHandler)
        }
        if (currentMouseleaveHandler) {
          map.value.off('mouseleave', refLayerId, currentMouseleaveHandler)
          map.value.off('mouseleave', compLayerId, currentMouseleaveHandler)
        }
        map.value.off('click', refLayerId, handleGlacierClick)
        map.value.off('click', compLayerId, handleGlacierClick)
      } else {
        // Regular layer
        if (currentMousemoveHandler) {
          map.value.off('mousemove', oldLayerId, currentMousemoveHandler)
        } else {
          map.value.off('mousemove', oldLayerId)
        }
        if (currentMouseleaveHandler) {
          map.value.off('mouseleave', oldLayerId, currentMouseleaveHandler)
        } else {
          map.value.off('mouseleave', oldLayerId)
        }
        map.value.off('click', oldLayerId, handleGlacierClick)
      }
    } catch (error) {
      // Ignore errors when removing handlers from non-existent layers
      console.log('[MapNew] Error removing old handlers (layer may not exist):', error)
    }
    // Clear old handler references
    currentMousemoveHandler = null
    currentMouseleaveHandler = null
  }
  
  // Create new handler functions and store references
  currentMousemoveHandler = (e) => {
    if (map.value) {
      map.value.getCanvas().style.cursor = 'pointer'
      
      // Clear any existing tooltip timer
      if (tooltipTimer) {
        clearTimeout(tooltipTimer)
        tooltipTimer = null
      }
      
      // Show tooltip with feature properties after delay
      if (e.features && e.features.length > 0) {
        const feature = e.features[0]
        const pointX = e.point.x
        const pointY = e.point.y
        
        // Set timer to show tooltip after delay
        tooltipTimer = setTimeout(() => {
          const position = calculateTooltipPosition(pointX, pointY)
          tooltip.value = {
            visible: true,
            feature: feature,
            x: position.x,
            y: position.y
          }
          tooltipTimer = null
          // Recalculate position with actual tooltip dimensions after rendering
          nextTick(() => {
            if (tooltip.value.visible) {
              const actualPosition = calculateTooltipPosition(pointX, pointY)
              tooltip.value.x = actualPosition.x
              tooltip.value.y = actualPosition.y
            }
          })
        }, TOOLTIP_DELAY)
      } else {
        // Hide tooltip immediately if no feature
        tooltip.value.visible = false
        tooltip.value.feature = null
      }
    }
  }
  
  currentMouseleaveHandler = () => {
    if (map.value) {
      map.value.getCanvas().style.cursor = ''
    }
    // Clear tooltip timer
    if (tooltipTimer) {
      clearTimeout(tooltipTimer)
      tooltipTimer = null
    }
    // Hide tooltip immediately
    tooltip.value.visible = false
    tooltip.value.feature = null
  }
  
  // Add handlers with stored references
  map.value.on('mousemove', layerId, currentMousemoveHandler)
  map.value.on('mouseleave', layerId, currentMouseleaveHandler)
  
  // Handle click on glacier - use named function so it can be properly removed
  try {
    map.value.on('click', layerId, handleGlacierClick)
  } catch (error) {
    console.warn('[MapNew] Error setting up click handler:', error)
    // Retry after a short delay
    setTimeout(() => {
      if (map.value && map.value.getLayer(layerId)) {
        try {
          map.value.on('click', layerId, handleGlacierClick)
        } catch (retryError) {
          console.warn('[MapNew] Error retrying click handler setup:', retryError)
        }
      }
    }, 100)
  }
  
  // Setup map click handler (only once) - like Map.vue does
  if (!mapClickHandlerSetup.value) {
    map.value.on('click', handleMapClick)
    mapClickHandlerSetup.value = true
    console.log('[MapNew] Map click handler set up (once)')
  }
  
  // Update tracked layer ID
  handlerLayerId.value = layerId
  
  console.log('[MapNew] Click handlers setup complete for layer:', layerId)
}

// Handler cleanup function for layer management
const cleanupHandlersForLayer = (layerId) => {
  if (handlerLayerId.value === layerId) {
    try {
      // Remove event handlers using stored references
      if (currentMousemoveHandler) {
        map.value.off('mousemove', layerId, currentMousemoveHandler)
      } else {
        map.value.off('mousemove', layerId)
      }
      if (currentMouseleaveHandler) {
        map.value.off('mouseleave', layerId, currentMouseleaveHandler)
      } else {
        map.value.off('mouseleave', layerId)
      }
      map.value.off('click', layerId, handleGlacierClick)
      handlerLayerId.value = null
      currentMousemoveHandler = null
      currentMouseleaveHandler = null
    } catch (error) {
      // Ignore errors
      console.log('[MapNew] Error cleaning up handlers:', error)
    }
  }
}

// Create refs for selection (will be used by composables)
const selectedGlacier = ref(null)
const selectedFeatureId = ref(null)

// Define color functions early (they don't depend on computed IDs)
// These will be used by useMapLayers and useLayerVisualization
const getFillColor = () => {
  if (visualization.value === 'area-change') {
    return [
      'interpolate',
      ['linear'],
      ['get', 'Area change (%)'],
      -100, COLORS.visualization.negative,
      0, COLORS.visualization.neutral
    ]
  } else if (visualization.value === 'volume-change') {
    return [
      'interpolate',
      ['linear'],
      ['get', 'Volume change (%)'],
      -100, COLORS.visualization.negative,
      0, COLORS.visualization.neutral
    ]
  } else if (visualization.value === 'bivariate') {
    // Piecewise angular bivariate choropleth
    // Angle controls hue via piecewise interpolation, radius controls lightness
    
    const areaChange = ['get', 'Area change (%)']
    const volumeChange = ['get', 'Volume change (%)']
    
    // STEP 1: Normalize inputs
    const areaRel = ['/', areaChange, 100]  // [-1, 0]
    const volumeRel = ['/', volumeChange, 100]  // [-1, 0]
    
    // STEP 2: Compute coordinates
    // x = -volume_change, y = -area_change
    const x = ['*', volumeRel, -1]  // x ∈ [0, 1]
    const y = ['*', areaRel, -1]    // y ∈ [0, 1]
    
    // STEP 3: Compute angle from downward axis
    // θ = atan2(x, y) in radians, then convert to degrees
    // Mapbox doesn't support atan2, so approximate for first quadrant (x >= 0, y >= 0)
    // Simple approximation: θ ≈ (x / (x + y)) * (π/2) for first quadrant
    const pi = 3.141592653589793
    const piOver2 = 1.5707963267948966 // π/2
    
    // Handle edge cases: y = 0 → 90°, x = 0 → 0°
    const isYZero = ['==', y, 0]
    const isXZero = ['==', x, 0]
    
    // For non-edge cases: approximate atan2(x, y) using ratio
    const ratio = ['/', x, ['+', x, y]]
    const thetaRadApprox = ['*', ratio, piOver2]
    
    // Use case to handle edge cases
    const thetaRad = [
      'case',
      isYZero, piOver2,  // y = 0 → 90° (π/2)
      isXZero, 0,        // x = 0 → 0°
      thetaRadApprox     // Otherwise use approximation
    ]
    
    const thetaDeg = ['*', ['/', thetaRad, pi], 180] // ∈ [0, 90]
    
    // STEP 4: Define angular anchor colors
    // 0° → C0 (orange), 30° → C1 (yellow-orange), 60° → C2 (cyan), 90° → C3 (blue)
    const C0R = 255, C0G = 165, C0B = 0   // Orange
    const C1R = 255, C1G = 220, C1B = 100 // Yellow-orange
    const C2R = 100, C2G = 200, C2B = 255 // Cyan/light blue
    const C3R = 0, C3G = 100, C3B = 255  // Blue
    
    // STEP 5: Piecewise angular interpolation
    // Narrower central section (35-55°) to make diagonal transition thinner
    // 0-35°: lerp(C0, C1)
    // 35-55°: lerp(C1, C2)
    // 55-90°: lerp(C2, C3)
    const t0_35 = ['/', thetaDeg, 35] // ∈ [0, 1] for 0-35°
    const t35_55 = ['/', ['-', thetaDeg, 35], 20] // ∈ [0, 1] for 35-55°
    const t55_90 = ['/', ['-', thetaDeg, 55], 35] // ∈ [0, 1] for 55-90°
    
    const baseR = [
      'case',
      ['<=', thetaDeg, 35],
      ['+', C0R, ['*', ['-', C1R, C0R], t0_35]],
      ['<=', thetaDeg, 55],
      ['+', C1R, ['*', ['-', C2R, C1R], t35_55]],
      ['+', C2R, ['*', ['-', C3R, C2R], t55_90]]
    ]
    const baseG = [
      'case',
      ['<=', thetaDeg, 35],
      ['+', C0G, ['*', ['-', C1G, C0G], t0_35]],
      ['<=', thetaDeg, 55],
      ['+', C1G, ['*', ['-', C2G, C1G], t35_55]],
      ['+', C2G, ['*', ['-', C3G, C2G], t55_90]]
    ]
    const baseB = [
      'case',
      ['<=', thetaDeg, 35],
      ['+', C0B, ['*', ['-', C1B, C0B], t0_35]],
      ['<=', thetaDeg, 55],
      ['+', C1B, ['*', ['-', C2B, C1B], t35_55]],
      ['+', C2B, ['*', ['-', C3B, C2B], t55_90]]
    ]
    
    // STEP 6: Compute radius and lightness
    // r = sqrt(x² + y²) / sqrt(2) ∈ [0, 1]
    const radius = ['sqrt', ['+', ['*', x, x], ['*', y, y]]]
    const sqrt2 = 1.4142135623730951
    const rNormalized = ['min', ['/', radius, sqrt2], 1]
    
    // Smooth compression: m = 1 - exp(-r / r0)
    // Approximate exp(-x) ≈ 1 / (1 + x + x²/2) for x = r/r0 (simplified)
    const r0 = 0.4
    const rOverR0 = ['/', rNormalized, r0]
    const rOverR0Squared = ['*', rOverR0, rOverR0]
    // exp(-r/r0) ≈ 1 / (1 + r/r0 + 0.5*(r/r0)²)
    const denominator = ['+', 1, ['+', rOverR0, ['*', 0.5, rOverR0Squared]]]
    const expNeg = ['/', 1, denominator]
    const m = ['-', 1, expNeg] // m = 1 - exp(-r/r0) ∈ [0, 1)
    
    // Apply lightness (inverted: r=0 → dark, r=1 → light)
    // Interpolate from dark (black) to base_color using m
    const darkR = 0, darkG = 0, darkB = 0
    const finalR = ['+', darkR, ['*', ['-', baseR, darkR], m]]
    const finalG = ['+', darkG, ['*', ['-', baseG, darkG], m]]
    const finalB = ['+', darkB, ['*', ['-', baseB, darkB], m]]
    
    // STEP 7: Clamp and round final RGB values
    const r = ['round', ['max', 0, ['min', 255, finalR]]]
    const g = ['round', ['max', 0, ['min', 255, finalG]]]
    const b = ['round', ['max', 0, ['min', 255, finalB]]]
    
    // Clamp RGB values
    const clamp = (value) => ['max', 0, ['min', 255, value]]
    
    return [
      'case',
      ['all', ['has', 'Area change (%)'], ['has', 'Volume change (%)']],
      ['rgb', clamp(r), clamp(g), clamp(b)],
      COLORS.visualization.missing
    ]
  } else {
    // Uniform visualization: white when aerial basemap, blue otherwise
    return isSatellite.value ? '#FFFFFF' : COLORS.glacier.default
  }
}

const getFillOpacity = () => {
  return isSatellite.value ? 0.8 : 0.6
}

// Get outline color - blue for selected glaciers in uniform mode with aerial basemap
const getOutlineColor = () => {
  // In uniform visualization with aerial basemap and selected glacier, use blue outline
  if (visualization.value === 'uniform' && isSatellite.value && selectedFeatureId.value) {
    return COLORS.glacier.default // Blue color
  }
  // Otherwise, match fill color
  return getFillColor()
}

// Map layers composable (initialized with color functions)
const {
  loadedSources,
  getSourceId,
  getLayerId,
  getOutlineId,
  getStaticLayerId,
  getComparisonLayerId,
  getComparisonOutlineId,
  getOverlayOutlineId,
  getYearColor,
  loadTilesetSource,
  createLayersForProjectionYear,
  cleanupStaticLayers,
  cleanupAllStaticLayers
} = useMapLayers(
  map,
  mapMode,
  visibleYears,
  referenceScenario,
  comparisonScenario,
  visibleScenarios,
  selectedFeatureId,
  getFillColor,
  getFillOpacity,
  getOutlineColor,
  setupClickHandler,
  cleanupHandlersForLayer
)

// Computed IDs for current projection (using composable functions)
const currentSourceId = computed(() => getSourceId(projection.value))
const currentLayerId = computed(() => getLayerId(projection.value))
const currentOutlineId = computed(() => getOutlineId(projection.value))

// Layer visualization composable (uses the same color functions, provides updateLayerColors)
const {
  updateLayerColors
} = useLayerVisualization(
  map,
  visualization,
  isSatellite,
  selectedFeatureId,
  currentLayerId,
  currentOutlineId,
  getFillColor, // Pass the functions we defined
  getFillOpacity
)

// Helper function to query features from source (handles vector tilesets)
// Must be defined after currentSourceId is computed
const querySourceFeatures = () => {
  if (!map.value) return []

  const sourceId = currentSourceId.value
  const source = map.value.getSource(sourceId)
  if (!source) return []

  // For vector sources, need to specify source-layer (year)
  if (source.type === 'vector') {
    const sourceLayerName = currentYear.value.toString()
    try {
      return map.value.querySourceFeatures(sourceId, {
        sourceLayer: sourceLayerName
      })
    } catch (error) {
      // Silently handle errors - source-layer might not exist yet or source not fully loaded
      return []
    }
  }

  return []
}

// Glacier navigation composable (needs selectedGlacier and glacierSearchIndex)
const { calculateTerrainCameraAngle, zoomToGlacierExtent } = useGlacierNavigation(
  map,
  selectedGlacier,
  glacierSearchIndex,
  is3D
)

// Feature selection composable (initialized after all dependencies are available)
const {
  handleGlacierClick,
  handleMapClick,
  restoreSelectionByFeatureId,
  clearSelection
} = useFeatureSelection(
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
  updateAllLayerColors,
  querySourceFeatures,
  lastModeSwitchTime,
  selectionTime
)

// Don't auto-initialize - wait for user to click "Load map"

// Watch for selection changes to update comparison layer opacity and overlay outline
watch(selectedFeatureId, () => {
  if (mapMode.value === 'comparison') {
    updateComparisonLayerOpacity()
  } else if (mapMode.value === 'overlay') {
    updateOverlayOutline()
  }
})

// Watch for mode changes
watch(mapMode, (newMode, oldMode) => {
  if (!mapLoaded.value || !map.value) return
  
  // IMPORTANT: Clear selection FIRST when switching FROM overlay mode
  // This must happen before any handlers are set up to prevent deselection issues
  if (oldMode === 'overlay' && newMode !== 'overlay') {
    selectedGlacier.value = null
    selectedFeatureId.value = null
    searchQuery.value = ''
    selectionTime.value = 0
    lastModeSwitchTime.value = Date.now()
    console.log('[MapNew] Cleared selection when switching from overlay to', newMode)
  }
  
  // Clear selection when switching between any modes
  if (oldMode && oldMode !== newMode && oldMode !== 'overlay') {
    selectedGlacier.value = null
    selectedFeatureId.value = null
    searchQuery.value = ''
    selectionTime.value = 0
    lastModeSwitchTime.value = Date.now()
    console.log('[MapNew] Cleared selection when switching from', oldMode, 'to', newMode)
  }
  
  if (newMode === 'overlay') {
    // When entering overlay mode, show all years by default
    visibleYears.value = new Set(decadeYears)
  } else if (oldMode === 'overlay') {
    // When switching away from overlay mode, clean up handlers first, then layers
    cleanupOverlayHandlers()
    cleanupAllStaticLayers()
  }
  
  // Clean up comparison layers when switching away from comparison mode
  if (oldMode === 'comparison') {
    // Clean up comparison handlers first
    if (handlerLayerId.value && handlerLayerId.value.includes('comparison')) {
      const refLayerId = getComparisonLayerId(referenceScenario.value)
      const compLayerId = getComparisonLayerId(comparisonScenario.value)
      try {
        if (currentMousemoveHandler) {
          map.value.off('mousemove', refLayerId, currentMousemoveHandler)
          map.value.off('mousemove', compLayerId, currentMousemoveHandler)
        }
        if (currentMouseleaveHandler) {
          map.value.off('mouseleave', refLayerId, currentMouseleaveHandler)
          map.value.off('mouseleave', compLayerId, currentMouseleaveHandler)
        }
        map.value.off('click', refLayerId, handleGlacierClick)
        map.value.off('click', compLayerId, handleGlacierClick)
        currentMousemoveHandler = null
        currentMouseleaveHandler = null
        handlerLayerId.value = null
      } catch (error) {
        console.log('[MapNew] Error removing comparison handlers:', error)
      }
    }
    
    const allProjections = Object.keys(TILESET_IDS).filter(p => TILESET_IDS[p] !== null)
    allProjections.forEach(p => {
      const compLayerId = getComparisonLayerId(p)
      const compOutlineId = getComparisonOutlineId(p)
      if (map.value.getLayer(compLayerId)) map.value.removeLayer(compLayerId)
      if (map.value.getLayer(compOutlineId)) map.value.removeLayer(compOutlineId)
    })
  }
  
  // Recreate layers when switching modes
  createLayersForProjectionYear(projection.value, currentYear.value)
  updateAllLayerColors()
  
  // Reset handler layer ID when switching modes to ensure clean setup
  handlerLayerId.value = null
  
  if (newMode === 'dynamic') {
    // When switching to dynamic mode, setup click handler after a delay to ensure layers are created
    setTimeout(async () => {
      await setupClickHandler()
    }, 150)
  } else if (newMode === 'overlay') {
    // When switching to overlay mode, setup click handler
    setTimeout(async () => {
      await setupClickHandler()
    }, 150)
  }
})

// Watch for projection changes in overlay mode
watch([projection, mapMode], ([newProjection, mode], [oldProjection, oldMode]) => {
  if (!mapLoaded.value || !map.value || mode !== 'overlay') return
  
  // Clean up old projection's overlay layers if projection changed
  if (oldProjection && oldProjection !== newProjection) {
    cleanupStaticLayers(oldProjection)
    console.log('[MapNew] Cleaned up overlay layers for old projection:', oldProjection)
  }
  
  // Recreate overlay layers for new projection
  createLayersForProjectionYear(newProjection, currentYear.value)
})

// Load all tilesets when map is loaded
watch(mapLoaded, async (loaded) => {
  if (!loaded || !map.value) return

  console.log('[MapNew] Map loaded, preloading all tilesets...')

  // Load glacier search index
  await loadGlacierSearchIndex()

  
  // No need for moveend handler - button stays visible when glacier is selected

  // Get all available projections
  const projections = Object.keys(TILESET_IDS).filter(proj => TILESET_IDS[proj] !== null)

  // Load all tileset sources in parallel
  const loadPromises = projections.map(proj => loadTilesetSource(proj))
  
  try {
    await Promise.all(loadPromises)
    console.log('[MapNew] ✓ All tilesets loaded')

    // Create layers only for current projection and year (sources are preloaded, so this is fast)
    createLayersForProjectionYear(projection.value, currentYear.value)
    updateAllLayerColors()

    // Setup click handler
    setupClickHandler()

    console.log('[MapNew] ✓ Initial layers created and ready')
  } catch (error) {
    console.error('[MapNew] Error loading tilesets:', error)
  }
})
</script>

<style scoped>
.map-viewer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.mapbox-canvas {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
}




.visualization-controls-wrapper {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 1000;
}

.visualization-controls-wrapper :deep(.top-left-visualization) {
  position: relative !important;
  top: 0 !important;
  left: 0 !important;
}


.searchbar-top-center {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
}


.map-controls-top-right {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 1000;
}

.map-controls-top-right :deep(.map-controls-bar) {
  position: relative !important;
  top: 0 !important;
  right: 0 !important;
  bottom: auto !important;
  left: auto !important;
}


/* Fade transition for map load overlay */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.6s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

</style>
