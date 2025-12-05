<template>
  <div class="map-viewer">
    <div ref="mapboxCanvas" class="mapbox-canvas"></div>
    
    <MapLoadOverlay 
      v-if="!mapLoaded" 
      @load="initializeMap" 
    />
    
    <SearchBar
      :model-value="searchQuery"
      :map-loaded="mapLoaded"
      :show-search-results="showSearchResults"
      :search-results="searchResults"
      @search="handleSearch"
      @clear="handleSearchClear"
      @update:model-value="searchQuery = $event"
      @select="handleGlacierSelect"
      class="searchbar-top-center"
    />
    
    <MapControls
      v-if="mapLoaded"
      :is-3d="is3D"
      @reset-view="handleResetView"
      @reset-bearing="handleResetBearing"
      @toggle="toggleTerrain"
      class="map-controls-top-right"
    />
    
    <ProjectionTimeControls
      :map-loaded="mapLoaded"
      :selected-projection="projection"
      :selected-glacier="selectedGlacier"
      :current-year="currentYear"
      :min-year="PROJECTION_CONFIG.MIN_YEAR"
      :max-year="PROJECTION_CONFIG.MAX_YEAR"
      :step="PROJECTION_CONFIG.YEAR_STEP"
      @projection-change="handleProjectionChange"
      @year-change="handleYearChange"
    />
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { useMapboxMap } from '../composables/useMapboxMap.js'
import { useMapControls } from '../composables/useMapControls.js'
import { useGlacierLayers } from '../composables/useGlacierLayers.js'
import { useGlacierDataLoading } from '../composables/useGlacierDataLoading.js'
import { useMapState } from '../composables/useMapState.js'
import { calculateFeatureBounds } from '../utils/mapUtils.js'
import { PROJECTION_CONFIG } from '../config/projections.js'
import { TIMING } from '../config/timing.js'
import MapControls from './MapControls.vue'
import MapLoadOverlay from './MapLoadOverlay.vue'
import ProjectionTimeControls from './ProjectionTimeControls.vue'
import SearchBar from './SearchBar.vue'

// ============================================
// Template Refs
// ============================================
const mapboxCanvas = ref(null)

// ============================================
// Layer State
// ============================================
const activeLayer = ref(null)
const activeLayerId = ref(null)

// ============================================
// Composables - Map & Data
// ============================================
const { map, mapLoaded, initializeMap } = useMapboxMap(mapboxCanvas)
const { is3D, toggleTerrain, resetBearing } = useMapControls(map)

// ============================================
// Composables - State Management
// ============================================
// Note: activeLayerId is set later, but useMapState will handle it gracefully
const {
  // Projection and visualization
  currentYear,
  projection,
  visualization,
  // Selection
  selectedGlacier,
  selectedGlacierId,
  isFilterActive,
  // Search
  searchQuery,
  searchResults,
  showSearchResults,
  search: performSearch,
  clearSearch
} = useMapState(map, activeLayerId)

// Use glacier layers composable
const layerManager = useGlacierLayers(map)
const { loadGeoJSONLayer, getOutlineLayerId } = layerManager

// Use glacier data loading composable with callbacks
const { getDataFilePath, loadDataSmooth, loadDataFull } = useGlacierDataLoading(map, layerManager, {
  onSelectionRestore: (selectedMapboxId, wasFilterActive) => {
    restoreSelection(selectedMapboxId, wasFilterActive)
  },
  onFilterApply: (mapboxId) => {
    applyFilterForFeature(mapboxId)
  },
  onHandlersSetup: () => {
    setupLayerHandlers()
  },
  onVisualizationApply: () => {
    if (visualization.value) {
      updateLayerVisualization(visualization.value)
    }
  },
  onSearchClear: () => {
    // Only clear search results, not the search query when projection changes
    showSearchResults.value = false
    searchResults.value = []
    // Don't clear searchQuery - preserve the glacier name in the search bar
  }
})

// Load data smoothly by updating existing source instead of recreating
const loadProjectionDataSmooth = async (yearValue = null) => {
  if (!map.value || !activeLayerId.value) return
  
  const targetYear = yearValue !== null ? yearValue : currentYear.value
  const selectedMapboxId = selectedGlacier.value?.['mapbox-id'] || selectedGlacierId.value
  const wasFilterActive = isFilterActive.value
  
  loadDataSmooth({
    layerId: activeLayerId.value,
    projection: projection.value,
    year: targetYear,
    selectedMapboxId,
    wasFilterActive
  })
}

// Load data for the current projection and year (full reload - used for initial load and scenario changes)
const loadProjectionData = () => {
  if (!map.value || !activeLayerId.value) return
  
  const selectedMapboxId = selectedGlacier.value?.['mapbox-id'] || selectedGlacierId.value
  const wasFilterActive = isFilterActive.value
  
  // Preserve the selectedGlacier object and search query before loading new data
  const preservedGlacier = selectedGlacier.value ? { ...selectedGlacier.value } : null
  const preservedSearchQuery = searchQuery.value
  
  loadDataFull({
    layerId: activeLayerId.value,
    projection: projection.value,
    year: currentYear.value,
    selectedMapboxId,
    wasFilterActive,
    selectedGlacierId: selectedGlacierId.value
  })
  
  // Restore the preserved glacier object if it existed
  // The restoreSelection callback will update it if the feature is found in new data
  if (preservedGlacier && selectedGlacier.value === null) {
    selectedGlacier.value = preservedGlacier
  }
  
  // Restore the search query to preserve the glacier name in the search bar
  if (preservedGlacier && preservedSearchQuery) {
    searchQuery.value = preservedSearchQuery
  }
  
  // Only clear selection state if there was no glacier selected before
  if (selectedMapboxId === null || selectedMapboxId === undefined) {
    selectedGlacier.value = null
    selectedGlacierId.value = null
    searchQuery.value = ''
  }
}

// Apply filter for a feature by mapbox-id (used to prevent flash of all features)
const applyFilterForFeature = (mapboxId) => {
  if (!map.value || !activeLayerId.value) return
  
  // Ensure layers exist before applying filter
  if (!map.value.getLayer(activeLayerId.value)) {
    console.warn('[Map] Layer not found when applying filter, will retry')
    // Retry after a short delay
    setTimeout(() => applyFilterForFeature(mapboxId), 50)
    return
  }
  
  try {
    // Query all features from the source
    const features = map.value.querySourceFeatures(activeLayerId.value)
    
    // Find the feature with matching mapbox-id
    const matchingFeature = features.find(feature => {
      const featureMapboxId = feature.id !== undefined && feature.id !== null
        ? feature.id
        : feature.properties?.['mapbox-id']
      return featureMapboxId === mapboxId || featureMapboxId === parseInt(mapboxId)
    })
    
    if (matchingFeature) {
      // Get the feature ID
      const featureId = matchingFeature.id !== undefined && matchingFeature.id !== null
        ? matchingFeature.id
        : matchingFeature.properties?.['mapbox-id']
      
      if (featureId) {
        // Apply filter immediately to prevent showing all features
        const filter = ['==', ['get', 'mapbox-id'], featureId]
        map.value.setFilter(activeLayerId.value, filter)
        const outlineLayerId = getOutlineLayerId(activeLayerId.value)
        if (map.value.getLayer(outlineLayerId)) {
          map.value.setFilter(outlineLayerId, filter)
        }
        console.log('[Map] Applied filter immediately for mapbox-id:', mapboxId, 'feature-id:', featureId)
      }
    } else {
      console.warn('[Map] Feature not found when applying filter for mapbox-id:', mapboxId)
    }
  } catch (error) {
    console.error('[Map] Error applying filter:', error)
  }
}

// Restore selection by finding feature with matching mapbox-id
const restoreSelection = (mapboxId, wasFilterActive = false) => {
  if (!map.value || !activeLayerId.value) return
  
  // Preserve the existing glacier name if we have one
  const preservedName = selectedGlacier.value?.name || null
  const preservedSgiId = selectedGlacier.value?.['sgi-id'] || null
  
  try {
    // Query all features from the source
    const features = map.value.querySourceFeatures(activeLayerId.value)
    
    // Find the feature with matching mapbox-id
    const matchingFeature = features.find(feature => {
      const featureMapboxId = feature.id !== undefined && feature.id !== null
        ? feature.id
        : feature.properties?.['mapbox-id']
      return featureMapboxId === mapboxId || featureMapboxId === parseInt(mapboxId)
    })
    
    if (matchingFeature) {
      // Get the feature ID
      const featureId = matchingFeature.id !== undefined && matchingFeature.id !== null
        ? matchingFeature.id
        : matchingFeature.properties?.['mapbox-id']
      
      if (featureId) {
        // Set feature state to selected
        map.value.setFeatureState(
          { source: activeLayerId.value, id: featureId },
          { selected: true }
        )
        
        // Update selected glacier state, preserving name if feature doesn't have one
        selectedGlacier.value = {
          id: featureId,
          name: matchingFeature.properties?.name || preservedName || null,
          'sgi-id': matchingFeature.properties?.['sgi-id'] || preservedSgiId || null,
          'mapbox-id': matchingFeature.properties?.['mapbox-id'] || featureId,
        }
        selectedGlacierId.value = featureId
        
        // Restore filter if it was active before
        if (wasFilterActive) {
          const filter = ['==', ['get', 'mapbox-id'], featureId]
          map.value.setFilter(activeLayerId.value, filter)
          const outlineLayerId = getOutlineLayerId(activeLayerId.value)
          if (map.value.getLayer(outlineLayerId)) {
            map.value.setFilter(outlineLayerId, filter)
          }
          isFilterActive.value = true
        }
        
        console.log('[Map] Restored selection for mapbox-id:', mapboxId, 'feature-id:', featureId)
      } else {
        console.warn('[Map] Found matching feature but no valid ID:', matchingFeature)
        // Keep selection state with preserved name
        if (selectedGlacier.value && preservedName) {
          selectedGlacier.value.name = preservedName
        }
      }
    } else {
      console.log('[Map] No matching feature found for mapbox-id:', mapboxId, '- keeping selection state')
      // Preserve the glacier name even if feature doesn't exist in this projection
      if (selectedGlacier.value && preservedName) {
        selectedGlacier.value.name = preservedName
        selectedGlacier.value['mapbox-id'] = mapboxId
      } else if (mapboxId && !selectedGlacier.value) {
        // Create a minimal glacier object to preserve the name
        selectedGlacier.value = {
          id: mapboxId,
          name: preservedName || 'Selected Glacier',
          'sgi-id': preservedSgiId,
          'mapbox-id': mapboxId,
        }
      }
    }
  } catch (error) {
    console.error('[Map] Error restoring selection:', error)
    // Preserve the glacier name on error
    if (selectedGlacier.value && preservedName) {
      selectedGlacier.value.name = preservedName
    } else if (mapboxId && !selectedGlacier.value) {
      selectedGlacier.value = {
        id: mapboxId,
        name: preservedName || 'Selected Glacier',
        'sgi-id': preservedSgiId,
        'mapbox-id': mapboxId,
      }
    }
  }
}

// Handle glacier click on the active layer
const handleGlacierClick = (e) => {
  const feature = e.features[0]
  if (!feature || !activeLayerId.value) return
  
  // Get the feature ID - use mapbox-id as the primary ID
  // 1. feature.id (set by promoteId from mapbox-id)
  // 2. feature.properties['mapbox-id'] (fallback)
  const featureId = feature.id !== undefined && feature.id !== null 
    ? feature.id 
    : (feature.properties?.['mapbox-id'] !== undefined && feature.properties?.['mapbox-id'] !== null
      ? feature.properties['mapbox-id']
      : null)
  
  console.log('[Map] Feature clicked - ID:', featureId, 'on layer:', activeLayerId.value)
  console.log('[Map] Feature properties:', feature.properties)
  console.log('[Map] Feature.id:', feature.id)
  
  if (!featureId) {
    console.error('[Map] Cannot select feature: no valid ID found')
    return
  }
  
  // Clear previous selection
  if (selectedGlacierId.value !== null && activeLayerId.value) {
    map.value.setFeatureState(
      { source: activeLayerId.value, id: selectedGlacierId.value },
      { selected: false }
    )
  }
  
  // Set new selection
  map.value.setFeatureState(
    { source: activeLayerId.value, id: featureId },
    { selected: true }
  )
  
  // Update selected glacier state
  selectedGlacier.value = {
    id: featureId,
    name: feature.properties?.name || null,
    'sgi-id': feature.properties?.['sgi-id'] || null,
    'mapbox-id': feature.properties?.['mapbox-id'] || null,
  }
  selectedGlacierId.value = featureId
  
  // Update search bar with glacier name
  searchQuery.value = feature.properties?.name || ''
  
  // If filter is active, update it to show only the newly selected glacier
  if (isFilterActive.value && activeLayerId.value) {
    const filter = ['==', ['get', 'mapbox-id'], featureId]
    map.value.setFilter(activeLayerId.value, filter)
    const outlineLayerId = getOutlineLayerId(activeLayerId.value)
    if (map.value.getLayer(outlineLayerId)) {
      map.value.setFilter(outlineLayerId, filter)
    }
  }
}

// Handle click outside glaciers
const handleMapClick = (e) => {
  if (!activeLayerId.value) return
  
  // Check if the click was on a glacier feature
  const features = map.value.queryRenderedFeatures(e.point, {
    layers: [activeLayerId.value]
  })
  
  // If no glacier was clicked, clear the selection
  if (features.length === 0 && selectedGlacierId.value !== null) {
    map.value.setFeatureState(
      { source: activeLayerId.value, id: selectedGlacierId.value },
      { selected: false }
    )
    selectedGlacier.value = null
    selectedGlacierId.value = null
    searchQuery.value = ''
    
    // Reset filter to show all glaciers
    if (isFilterActive.value && activeLayerId.value && map.value) {
      map.value.setFilter(activeLayerId.value, null)
      const outlineLayerId = getOutlineLayerId(activeLayerId.value)
      if (map.value.getLayer(outlineLayerId)) {
        map.value.setFilter(outlineLayerId, null)
      }
      isFilterActive.value = false
    }
  }
}

// Load GeoJSON layer when map is ready
watch(mapLoaded, (loaded) => {
  if (loaded && map.value) {
    // Load initial data based on default projection
    const geojsonUrl = getDataFilePath(projection.value, currentYear.value)
    const layerId = 'geojson-data'
    
    activeLayer.value = loadGeoJSONLayer(geojsonUrl, layerId)
    activeLayerId.value = layerId
    
    // Wait for layer to be added before setting up handlers
    map.value.once('idle', () => {
      setupLayerHandlers()
      
      // Apply default visualization (Outlines Only)
      setTimeout(() => {
        if (visualization.value) {
          updateLayerVisualization(visualization.value)
        }
      }, TIMING.VISUALIZATION_DELAY)
    })
  }
})

// Setup event handlers for the active layer
const setupLayerHandlers = () => {
  if (!map.value || !activeLayerId.value) {
    console.warn('[Map] Cannot setup handlers: map or activeLayerId missing')
    return
  }
  
  // Check if layer exists
  if (!map.value.getLayer(activeLayerId.value)) {
    console.warn('[Map] Layer does not exist:', activeLayerId.value)
    return
  }
  
  console.log('[Map] Setting up handlers for layer:', activeLayerId.value)
  
  // Remove old handlers if they exist
  map.value.off('mousemove', activeLayerId.value)
  map.value.off('mouseleave', activeLayerId.value)
  map.value.off('click', activeLayerId.value)
  
  // Add hover handler to change cursor
  map.value.on('mousemove', activeLayerId.value, () => {
    map.value.getCanvas().style.cursor = 'pointer'
  })
  
  // Reset cursor when mouse leaves the layer
  map.value.on('mouseleave', activeLayerId.value, () => {
    map.value.getCanvas().style.cursor = ''
  })
  
  // Add click handler for the active layer
  map.value.on('click', activeLayerId.value, handleGlacierClick)
  
  // Setup map click handler (only once)
  if (!mapClickHandlerSetup.value) {
    map.value.on('click', handleMapClick)
    mapClickHandlerSetup.value = true
  }
}

const mapClickHandlerSetup = ref(false)

// Reset view handler - resets to initial center and zoom
const handleResetView = () => {
  if (!map.value) return
  map.value.easeTo({
    center: [8.2275, 46.8182], // Center of Switzerland
    zoom: 7,
    bearing: 0,
    pitch: 0,
    duration: 1000,
  })
  // Also reset terrain if in 3D mode
  if (is3D.value) {
    toggleTerrain()
  }
}

// Reset bearing handler (delegates to composable)
const handleResetBearing = () => {
  resetBearing()
}

// Handle year change from time slider
// Debounce timer for year changes to ensure smooth transitions
let yearChangeTimeout = null
let pendingYearUpdate = null

const handleYearChange = (newYear) => {
  currentYear.value = newYear
  console.log('[Map] Year changed to:', newYear)
  
  // Clear any pending updates
  if (yearChangeTimeout) {
    clearTimeout(yearChangeTimeout)
  }
  
  // Store the pending year update
  pendingYearUpdate = newYear
  
  // Debounce the data loading to prevent rapid updates during slider drag
  yearChangeTimeout = setTimeout(() => {
    // Reload data for the current projection
    loadProjectionDataSmooth(pendingYearUpdate)
    pendingYearUpdate = null
  }, TIMING.YEAR_CHANGE_DEBOUNCE)
}

// Handle visualization change from visualization selector
const handleVisualizationChange = (newVisualization) => {
  visualization.value = newVisualization
  console.log('[Map] Visualization changed to:', newVisualization)
  updateLayerVisualization(newVisualization)
}

// Update layer colors based on visualization type
const updateLayerVisualization = (visualization) => {
  if (!map.value || !activeLayerId.value) {
    console.warn('[Map] Cannot update visualization: map or layer not available')
    return
  }
  
  console.log('[Map] Updating visualization to:', visualization)
  
  if (visualization === 'Area') {
    // Apply area visualization - it will wait for idle state internally
    applyAreaVisualization()
  } else if (visualization === 'Outlines Only') {
    // Apply outlines only visualization
    applyOutlinesOnlyVisualization()
  } else {
    // For other visualizations or null, use default colors
    resetToDefaultColors()
  }
}

// Apply area-based color visualization
const applyAreaVisualization = () => {
  if (!map.value || !activeLayerId.value) {
    console.warn('[Map] Cannot apply area visualization: map or layer not available')
    return
  }
  
  // Check if source exists and has data
  const source = map.value.getSource(activeLayerId.value)
  if (!source || source.type !== 'geojson') {
    console.warn('[Map] Source not available for area visualization')
    return
  }
  
  // Function to actually apply the colors
  const doApplyColors = () => {
    try {
      const features = map.value.querySourceFeatures(activeLayerId.value)
      
      console.log('[Map] Applying area visualization, features found:', features?.length || 0)
      
      if (!features || features.length === 0) {
        console.warn('[Map] No features found in source for area visualization')
        resetToDefaultColors()
        return
      }
      
      // Debug: log first few features to check property names
      if (features.length > 0) {
        console.log('[Map] Sample feature properties:', Object.keys(features[0].properties || {}))
      }
      
      // Find area column name - try different possible names
      const firstFeature = features[0]
      const props = firstFeature?.properties || {}
      let areaKey = 'Area (km2)' // Default to most likely name
      
      if (!(areaKey in props)) {
        // Try other common names
        areaKey = Object.keys(props).find(key => 
          key.toLowerCase().includes('area') && 
          (key.includes('km2') || key.includes('km²'))
        ) || 'Area (km2)'
      }
      
      console.log('[Map] Using area column:', areaKey)
      
      // Extract area values
      const areas = features
        .map(f => {
          const area = f.properties?.[areaKey]
          return area !== null && area !== undefined && !isNaN(area) && area > 0 ? area : null
        })
        .filter(area => area !== null)
      
      console.log('[Map] Valid area values found:', areas.length, 'out of', features.length)
      
      if (areas.length === 0) {
        console.warn('[Map] No valid area data found in features')
        resetToDefaultColors()
        return
      }
      
      const minArea = Math.min(...areas)
      const maxArea = Math.max(...areas)
      
      console.log('[Map] Area range:', minArea, 'to', maxArea, 'km²')
      
      // Create color scale: light blue (small) to dark blue (large)
      const fillColorExpression = [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        '#4682B4', // Steel blue when selected (always same color)
        [
          'interpolate',
          ['linear'],
          ['get', areaKey],
          minArea, '#E6F3FF', // Very light blue for smallest
          minArea + (maxArea - minArea) * 0.25, '#B3D9FF', // Light blue
          minArea + (maxArea - minArea) * 0.5, '#80C0FF', // Medium blue
          minArea + (maxArea - minArea) * 0.75, '#4DA6FF', // Medium-dark blue
          maxArea, '#1A8CFF', // Dark blue for largest
        ]
      ]
      
      const outlineLayerId = getOutlineLayerId(activeLayerId.value)
      
      // Constant outline color for all glaciers (same for all, except selected)
      const lineColorExpression = [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        '#4682B4', // Steel blue when selected
        '#87CEEB', // Default sky blue for all outlines
      ]
      
      // Update fill layer
      if (map.value.getLayer(activeLayerId.value)) {
        map.value.setPaintProperty(activeLayerId.value, 'fill-color', fillColorExpression)
        console.log('[Map] Updated fill-color with area visualization')
      } else {
        console.warn('[Map] Fill layer not found:', activeLayerId.value)
      }
      
      // Update outline layer with constant color
      if (map.value.getLayer(outlineLayerId)) {
        map.value.setPaintProperty(outlineLayerId, 'line-color', lineColorExpression)
        map.value.setPaintProperty(outlineLayerId, 'line-opacity', 1)
        console.log('[Map] Updated outline with constant color for area visualization')
      }
    } catch (error) {
      console.error('[Map] Error applying area visualization:', error)
      resetToDefaultColors()
    }
  }
  
  // Wait for map to be idle to ensure features are queryable
  if (map.value.isStyleLoaded()) {
    // If style is already loaded, try immediately, but also wait for idle
    map.value.once('idle', doApplyColors)
    // Also try immediately in case data is already loaded
    setTimeout(doApplyColors, 100)
    } else {
    map.value.once('idle', doApplyColors)
  }
}

// Apply outlines only visualization (transparent fill, visible outlines)
const applyOutlinesOnlyVisualization = () => {
  if (!map.value || !activeLayerId.value) {
    console.warn('[Map] Cannot apply outlines only visualization: map or layer not available')
    return
  }
  
  // Check if source exists
  const source = map.value.getSource(activeLayerId.value)
  if (!source || source.type !== 'geojson') {
    console.warn('[Map] Source not available for outlines only visualization')
    return
  }
  
  // Function to actually apply the visualization
  const doApplyVisualization = () => {
    try {
      const outlineLayerId = getOutlineLayerId(activeLayerId.value)
      
      // Very transparent fill (except for selected features)
      const fillColorExpression = [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        '#4682B4', // Steel blue when selected
        'rgba(135, 206, 235, 0.2)', // Slightly transparent sky blue for all others
      ]
      
      // Visible outlines
      const lineColorExpression = [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        '#4682B4', // Steel blue when selected
        '#87CEEB', // Default sky blue for all outlines
      ]
      
      // Update fill layer
      if (map.value.getLayer(activeLayerId.value)) {
        map.value.setPaintProperty(activeLayerId.value, 'fill-color', fillColorExpression)
        console.log('[Map] Updated fill-color for outlines only visualization')
      }
      
      // Update outline layer
      if (map.value.getLayer(outlineLayerId)) {
        map.value.setPaintProperty(outlineLayerId, 'line-color', lineColorExpression)
        map.value.setPaintProperty(outlineLayerId, 'line-opacity', 1)
        console.log('[Map] Updated outline for outlines only visualization')
      }
    } catch (error) {
      console.error('[Map] Error applying outlines only visualization:', error)
      resetToDefaultColors()
    }
  }
  
  // Wait for map to be idle to ensure layers are ready
  if (map.value.isStyleLoaded()) {
    map.value.once('idle', doApplyVisualization)
    setTimeout(doApplyVisualization, 100)
  } else {
    map.value.once('idle', doApplyVisualization)
  }
}

// Reset to default colors (no visualization)
const resetToDefaultColors = () => {
  if (!map.value || !activeLayerId.value) return
  
  const outlineLayerId = getOutlineLayerId(activeLayerId.value)
  
  const defaultFillColor = [
    'case',
    ['boolean', ['feature-state', 'selected'], false],
    '#4682B4', // Steel blue when selected
    '#87CEEB', // Default sky blue
  ]
  
  const defaultLineColor = [
    'case',
    ['boolean', ['feature-state', 'selected'], false],
    '#4682B4', // Steel blue when selected
    '#87CEEB', // Default sky blue
  ]
  
  if (map.value.getLayer(activeLayerId.value)) {
    map.value.setPaintProperty(activeLayerId.value, 'fill-color', defaultFillColor)
  }
  
  // Reset outline layer (make it visible again)
  if (map.value.getLayer(outlineLayerId)) {
    map.value.setPaintProperty(outlineLayerId, 'line-color', defaultLineColor)
    map.value.setPaintProperty(outlineLayerId, 'line-opacity', 1)
  }
}

// Handle projection change from projection controls
const handleProjectionChange = (newProjection) => {
  projection.value = newProjection
  console.log('[Map] Projection changed to:', newProjection)
  loadProjectionData()
}


// Search handler - delegate to composable
const handleSearch = (query) => {
  performSearch(query)
}

// Select a glacier from the search results
const handleGlacierSelect = (result) => {
  if (!map.value || !activeLayerId.value || !result.feature) return
  
  // Get the feature ID - use mapbox-id as the primary ID
  const feature = result.feature
  const featureId = feature.id !== undefined && feature.id !== null
    ? feature.id
    : (feature.properties?.['mapbox-id'] !== undefined && feature.properties?.['mapbox-id'] !== null
      ? feature.properties['mapbox-id']
      : result.id)
  
  if (!featureId) {
    console.error('[Map] Cannot select feature from search: no valid ID found')
    return
  }
  
  // Clear previous selection
  if (selectedGlacierId.value !== null) {
    map.value.setFeatureState(
      { source: activeLayerId.value, id: selectedGlacierId.value },
      { selected: false }
    )
  }
  
  // Set new selection
  map.value.setFeatureState(
    { source: activeLayerId.value, id: featureId },
    { selected: true }
  )
  
  // Update selected glacier state
  selectedGlacier.value = {
    id: featureId,
    name: result.name,
    'sgi-id': result['sgi-id'],
    'mapbox-id': result['mapbox-id'] || result.feature?.properties?.['mapbox-id'] || null,
  }
  selectedGlacierId.value = featureId
  
  // Update search bar with glacier name
  searchQuery.value = result.name || ''
  
  
  // Zoom to the selected glacier
  const bounds = calculateFeatureBounds(result.feature)
  if (bounds) {
    map.value.fitBounds(bounds, { padding: 100, duration: 1000 })
  }
  
  // Hide search results
  showSearchResults.value = false
  searchResults.value = []
}

const handleSearchClear = () => {
  // Clear search results
  clearSearch()
  
  // Reset filter to show all glaciers
  if (isFilterActive.value && activeLayerId.value && map.value) {
    map.value.setFilter(activeLayerId.value, null)
    const outlineLayerId = getOutlineLayerId(activeLayerId.value)
    if (map.value.getLayer(outlineLayerId)) {
      map.value.setFilter(outlineLayerId, null)
    }
    isFilterActive.value = false
  }
}

// Zoom to glacier
const handleZoomToGlacier = () => {
  if (!selectedGlacier.value || !map.value || !activeLayerId.value) return
  
  try {
    // Query the map to find the selected feature
    const features = map.value.querySourceFeatures(activeLayerId.value)
    const feature = features.find(f => {
      const featureId = f.id !== undefined && f.id !== null 
        ? f.id 
        : f.properties?.['mapbox-id']
      return featureId === selectedGlacierId.value
    })
    
    if (feature) {
      const bounds = calculateFeatureBounds(feature)
      if (bounds) {
        map.value.fitBounds(bounds, { padding: 100, duration: 1000 })
      }
    }
  } catch (error) {
    console.error('[Map] Error zooming to glacier:', error)
  }
}

// Toggle between showing all glaciers or only the selected one
const handleToggleFilter = () => {
  if (!map.value || !activeLayerId.value || selectedGlacierId.value === null) return
  
  isFilterActive.value = !isFilterActive.value
  const outlineLayerId = getOutlineLayerId(activeLayerId.value)
  
  if (isFilterActive.value) {
    // Show only the selected glacier
    // Use 'mapbox-id' property since promoteId is set to 'mapbox-id'
    const featureId = selectedGlacierId.value
    const filter = ['==', ['get', 'mapbox-id'], featureId]
    map.value.setFilter(activeLayerId.value, filter)
    // Also apply filter to outline layer
    if (map.value.getLayer(outlineLayerId)) {
      map.value.setFilter(outlineLayerId, filter)
    }
  } else {
    // Show all glaciers (remove filter)
    map.value.setFilter(activeLayerId.value, null)
    if (map.value.getLayer(outlineLayerId)) {
      map.value.setFilter(outlineLayerId, null)
    }
  }
}

// Close search dropdown when clicking outside
const handleClickOutside = (event) => {
  const searchbar = event.target.closest('.searchbar-wrapper')
  if (!searchbar && showSearchResults.value) {
    showSearchResults.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
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

/* Hide Mapbox logo but keep attribution control */
.mapbox-canvas :deep(.mapboxgl-ctrl-logo) {
  display: none !important;
}

.searchbar-top-center {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  width: auto;
  min-width: 300px;
  max-width: 500px;
}

.searchbar-top-center :deep(.searchbar-wrapper) {
  position: relative !important;
  top: 0 !important;
  left: 0 !important;
  width: 100%;
  margin: 0;
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

</style>