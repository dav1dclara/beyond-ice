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
      @zoom-to-extent="handleZoomToExtent"
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
    
    <div v-if="mapLoaded" class="debug-zoom">
      Zoom: {{ currentZoom.toFixed(2) }}
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { useMapboxMap } from '../composables/useMapboxMap.js'
import { useMapControls } from '../composables/useMapControls.js'
import { useGlacierLayers } from '../composables/useGlacierLayers.js'
import { useMapState } from '../composables/useMapState.js'
import { calculateFeatureBounds, calculateGeoJSONFileBounds } from '../utils/mapUtils.js'
import { PROJECTION_CONFIG } from '../config/projections.js'
import { TIMING } from '../config/timing.js'
import { TILESET_IDS } from '../config/mapbox.js'
import MapControls from './MapControls.vue'
import MapLoadOverlay from './MapLoadOverlay.vue'
import ProjectionTimeControls from './ProjectionTimeControlsNew.vue'
import SearchBar from './SearchBar.vue'

// ============================================
// Template Refs
// ============================================
const mapboxCanvas = ref(null)

// ============================================
// Debug State
// ============================================
const currentZoom = ref(0)

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
const { getOutlineLayerId } = layerManager

// Helper function to get feature ID from a feature (handles different property names)
const getFeatureId = (feature) => {
  // Try feature.id first (set by promoteId or from tileset)
  if (feature.id !== undefined && feature.id !== null) {
    return feature.id
  }
  
  // Try various property names (order matters - try most likely first)
  const props = feature.properties || {}
  return props['mapbox-id'] || props['Id'] || props['id'] || null
}

// Function to get color based on feature selection (from MapNew.vue approach)
// Uses ['id'] expression which matches the feature ID from the tileset
// Since tileset was created with --use-attribute-for-id=mapbox-id, feature.id = mapbox-id
// Also tries mapbox-id property as fallback in case promoteId doesn't work
const getFillColor = () => {
  if (selectedGlacier.value?.id !== null && selectedGlacier.value?.id !== undefined) {
    const selectedId = selectedGlacier.value.id
    return [
      'case',
      ['==', ['id'], selectedId],
      '#FF6B6B', // Red color for selected feature (matched by feature ID)
      ['==', ['get', 'mapbox-id'], selectedId],
      '#FF6B6B', // Red color for selected feature (matched by mapbox-id property as fallback)
      '#87CEEB'  // Default sky blue color
    ]
  }
  return '#87CEEB' // Default sky blue color
}

const getOutlineColor = () => {
  if (selectedGlacier.value?.id !== null && selectedGlacier.value?.id !== undefined) {
    const selectedId = selectedGlacier.value.id
    return [
      'case',
      ['==', ['id'], selectedId],
      '#FF6B6B', // Red color for selected feature (matched by feature ID)
      ['==', ['get', 'mapbox-id'], selectedId],
      '#FF6B6B', // Red color for selected feature (matched by mapbox-id property as fallback)
      '#87CEEB'  // Default sky blue color
    ]
  }
  return '#87CEEB' // Default sky blue color
}

// Function to update layer colors
const updateLayerColors = () => {
  if (!map.value || !activeLayerId.value) return
  
  const outlineLayerId = getOutlineLayerId(activeLayerId.value)
  
  if (map.value.getLayer(activeLayerId.value)) {
    map.value.setPaintProperty(activeLayerId.value, 'fill-color', getFillColor())
  }
  if (map.value.getLayer(outlineLayerId)) {
    map.value.setPaintProperty(outlineLayerId, 'line-color', getOutlineColor())
  }
}

// Helper function to query features from source (handles vector tilesets)
const querySourceFeatures = (sourceId) => {
  if (!map.value) return []
  
  const source = map.value.getSource(sourceId)
  if (!source) return []
  
  // For vector sources, need to specify source-layer (year)
  if (source.type === 'vector') {
    // Validate currentYear before using it
    if (currentYear.value === null || currentYear.value === undefined || isNaN(currentYear.value)) {
      console.warn('[Map] querySourceFeatures: Invalid currentYear:', currentYear.value)
      return []
    }
    
    const sourceLayerName = currentYear.value.toString()
    
    // Validate source-layer name is not empty
    if (!sourceLayerName || sourceLayerName === '') {
      console.warn('[Map] querySourceFeatures: Empty source-layer name')
      return []
    }
    
    try {
      return map.value.querySourceFeatures(sourceId, {
        sourceLayer: sourceLayerName
      })
    } catch (error) {
      // Silently handle errors - source-layer might not exist yet or source not fully loaded
      // This is expected during initial load or when switching years
      return []
    }
  }
  
  // Should not reach here if using tilesets only
  console.warn('[Map] querySourceFeatures: Unexpected source type:', source.type)
  return []
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
  
  // Ensure source is loaded before querying
  const source = map.value.getSource(activeLayerId.value)
  if (!source || (source.type === 'vector' && (!source.loaded || !source.loaded()))) {
    // Source not ready yet, retry
    setTimeout(() => applyFilterForFeature(mapboxId), 100)
    return
  }
  
  try {
    // Query all features from the source
    const features = querySourceFeatures(activeLayerId.value)
    
    // Find the feature with matching ID
    const matchingFeature = features.find(feature => {
      const featureId = getFeatureId(feature)
      return featureId === mapboxId || featureId === parseInt(mapboxId) || String(featureId) === String(mapboxId)
    })
    
    if (matchingFeature) {
      // Get the feature ID
      const featureId = getFeatureId(matchingFeature)
      
      if (featureId) {
        // Apply filter - try different property names
        // First try 'mapbox-id', then 'Id', then 'id'
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
  
  // Ensure source is loaded before querying
  const source = map.value.getSource(activeLayerId.value)
  if (!source || (source.type === 'vector' && (!source.loaded || !source.loaded()))) {
    // Source not ready yet, retry
    setTimeout(() => restoreSelection(mapboxId, wasFilterActive), 100)
    return
  }
  
  try {
    // Query all features from the source
    const features = querySourceFeatures(activeLayerId.value)
    
    // Find the feature with matching ID
    const matchingFeature = features.find(feature => {
      const featureId = getFeatureId(feature)
      return featureId === mapboxId || featureId === parseInt(mapboxId) || String(featureId) === String(mapboxId)
    })
    
    if (matchingFeature) {
      // Get the feature ID
      const featureId = getFeatureId(matchingFeature)
      
      if (featureId) {
        // Set feature state to selected
        try {
          map.value.setFeatureState(
            { source: activeLayerId.value, id: featureId },
            { selected: true }
          )
          console.log('[Map] Successfully restored feature state for ID:', featureId)
        } catch (error) {
          console.warn('[Map] Error restoring feature state:', error)
          // Try with integer ID if it's a string number
          if (typeof featureId === 'string' && !isNaN(featureId)) {
            try {
              const intId = parseInt(featureId)
              map.value.setFeatureState(
                { source: activeLayerId.value, id: intId },
                { selected: true }
              )
              console.log('[Map] Successfully restored feature state with integer ID:', intId)
            } catch (intError) {
              console.warn('[Map] Also failed with integer ID:', intError)
            }
          }
        }
        
        // Get mapbox-id from properties (try different property names)
        const mapboxIdFromProps = matchingFeature.properties?.['mapbox-id'] || 
                                  matchingFeature.properties?.['Id'] || 
                                  featureId
        
        // Update selected glacier state, preserving name if feature doesn't have one
        selectedGlacier.value = {
          id: featureId,
          name: matchingFeature.properties?.name || preservedName || null,
          'sgi-id': matchingFeature.properties?.['sgi-id'] || preservedSgiId || null,
          'mapbox-id': mapboxIdFromProps,
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
  
  // Ensure source is ready
  const source = map.value.getSource(activeLayerId.value)
  if (!source || (source.type === 'vector' && (!source.loaded || !source.loaded()))) {
    console.warn('[Map] Source not ready when clicking glacier, ignoring click')
    return
  }
  
  // Get feature ID - use feature.id if available, otherwise use mapbox-id from properties
  // Since tileset was created with --use-attribute-for-id=mapbox-id, feature.id should be mapbox-id
  const featureId = feature.id !== undefined && feature.id !== null 
    ? feature.id 
    : (feature.properties?.['mapbox-id'] || null)
  
  console.log('[Map] Feature clicked - ID:', featureId)
  console.log('[Map] Feature.id:', feature.id)
  console.log('[Map] Feature properties mapbox-id:', feature.properties?.['mapbox-id'])
  
  if (!featureId) {
    console.error('[Map] Cannot select feature: no valid ID found')
    return
  }
  
  // Toggle selected feature (click again to deselect)
  if (selectedGlacier.value?.id === featureId) {
    selectedGlacier.value = null
    selectedGlacierId.value = null
    searchQuery.value = ''
  } else {
    selectedGlacier.value = {
      id: featureId,
      name: feature.properties?.name || null,
      'sgi-id': feature.properties?.['sgi-id'] || null,
      'mapbox-id': feature.properties?.['mapbox-id'] || featureId,
    }
    selectedGlacierId.value = featureId
    // Update search bar with glacier name
    searchQuery.value = feature.properties?.name || ''
  }
  
  console.log('[Map] Selected glacier ID:', selectedGlacier.value?.id)
  
  // Update layer colors
  updateLayerColors()
  
  // If filter is active, update it to show only the newly selected glacier
  if (isFilterActive.value && activeLayerId.value && selectedGlacier.value) {
    try {
      const filter = ['==', ['get', 'mapbox-id'], featureId]
      map.value.setFilter(activeLayerId.value, filter)
      const outlineLayerId = getOutlineLayerId(activeLayerId.value)
      if (map.value.getLayer(outlineLayerId)) {
        map.value.setFilter(outlineLayerId, filter)
      }
    } catch (error) {
      console.warn('[Map] Error applying filter:', error)
    }
  }
}

// Handle click outside glaciers
const handleMapClick = (e) => {
  if (!activeLayerId.value) return
  
  // Ensure source is ready
  const source = map.value.getSource(activeLayerId.value)
  if (!source || (source.type === 'vector' && (!source.loaded || !source.loaded()))) {
    return
  }
  
  // Check if the click was on a glacier feature
  const features = map.value.queryRenderedFeatures(e.point, {
    layers: [activeLayerId.value]
  })
  
  // If no glacier was clicked, clear the selection
  if (features.length === 0 && selectedGlacier.value !== null) {
    selectedGlacier.value = null
    selectedGlacierId.value = null
    searchQuery.value = ''
    
    // Update layer colors
    updateLayerColors()
    
    // Reset filter to show all glaciers
    if (isFilterActive.value && activeLayerId.value && map.value) {
      try {
        map.value.setFilter(activeLayerId.value, null)
        const outlineLayerId = getOutlineLayerId(activeLayerId.value)
        if (map.value.getLayer(outlineLayerId)) {
          map.value.setFilter(outlineLayerId, null)
        }
        isFilterActive.value = false
      } catch (error) {
        console.warn('[Map] Error resetting filter:', error)
      }
    }
  }
}

// ============================================
// MAPBOX TILESET LOADING
// ============================================
const layerId = 'glacier-tileset'

// Function to add/update layers for a specific year and tileset
const addLayersForYear = (year, preserveSelection = false) => {
  if (!map.value || !activeLayerId.value) {
    console.warn('[Map] Cannot add layers: map or activeLayerId missing')
    return
  }
  
  // Validate year
  if (year === null || year === undefined || isNaN(year)) {
    console.error('[Map] Invalid year value:', year)
    return
  }
  
  const sourceLayerName = year.toString()
  const outlineId = getOutlineLayerId(layerId)
  
  // Verify source exists and is a vector source
  const source = map.value.getSource(layerId)
  if (!source) {
    console.error('[Map] Source does not exist:', layerId)
    return
  }
  
  if (source.type !== 'vector') {
    console.error('[Map] Source is not a vector source:', source.type)
    return
  }
  
  // Verify source-layer exists in tileset (if vectorLayers info is available)
  if (source.vectorLayers && source.vectorLayers.length > 0) {
    const availableLayers = source.vectorLayers.map(l => l.id)
    if (!availableLayers.includes(sourceLayerName)) {
      console.warn('[Map] Source-layer not found in tileset:', sourceLayerName)
      console.warn('[Map] Available source-layers:', availableLayers)
      // Don't return - still try to add the layer in case vectorLayers info is incomplete
    }
  }
  
  console.log('[Map] Adding layers for year:', year, 'source-layer:', sourceLayerName)
  
  // Preserve current paint properties if updating
  const fillPaint = map.value.getLayer(layerId) 
    ? map.value.getPaintProperty(layerId, 'fill-color')
    : null
  const fillOpacity = map.value.getLayer(layerId)
    ? map.value.getPaintProperty(layerId, 'fill-opacity')
    : null
  
  // Remove existing layers if they exist
  if (map.value.getLayer(layerId)) {
    map.value.removeLayer(layerId)
  }
  if (map.value.getLayer(outlineId)) {
    map.value.removeLayer(outlineId)
  }
  
  // Add fill layer for the selected year
  try {
    const layerConfig = {
      id: layerId,
      type: 'fill',
      source: layerId,
      'source-layer': sourceLayerName, // Required for vector sources
      paint: {
        'fill-color': fillPaint || getFillColor(),
        'fill-opacity': fillOpacity || 0.6,
      },
    }
    
    // Validate source-layer is set
    if (!layerConfig['source-layer'] || layerConfig['source-layer'] === '') {
      console.error('[Map] Cannot add layer: source-layer is missing or empty')
      return
    }
    
    map.value.addLayer(layerConfig)
    console.log('[Map] Added fill layer for year', year, 'with source-layer:', sourceLayerName)
  } catch (error) {
    console.error('[Map] Error adding fill layer:', error)
    console.error('[Map] Layer config:', { id: layerId, source: layerId, 'source-layer': sourceLayerName })
    return
  }
  
  // Add outline layer for the selected year
  try {
    const linePaint = map.value.getLayer(outlineId)
      ? map.value.getPaintProperty(outlineId, 'line-color')
      : null
    const lineWidth = map.value.getLayer(outlineId)
      ? map.value.getPaintProperty(outlineId, 'line-width')
      : null
    
    const outlineLayerConfig = {
      id: outlineId,
      type: 'line',
      source: layerId,
      'source-layer': sourceLayerName, // Required for vector sources
      paint: {
        'line-color': linePaint || getOutlineColor(),
        'line-width': lineWidth || 2,
      },
    }
    
    // Validate source-layer is set
    if (!outlineLayerConfig['source-layer'] || outlineLayerConfig['source-layer'] === '') {
      console.error('[Map] Cannot add outline layer: source-layer is missing or empty')
      return
    }
    
    map.value.addLayer(outlineLayerConfig)
    console.log('[Map] Added outline layer for year', year, 'with source-layer:', sourceLayerName)
  } catch (error) {
    console.error('[Map] Error adding outline layer:', error)
    console.error('[Map] Layer config:', { id: outlineId, source: layerId, 'source-layer': sourceLayerName })
    return
  }
  
  // Wait for layer to be added before setting up handlers and restoring selection
  map.value.once('idle', () => {
    setupLayerHandlers()
    
    // Restore selection if we had one - just update colors since selection state is preserved
    if (preserveSelection && selectedGlacier.value) {
      updateLayerColors()
      const wasFilterActive = isFilterActive.value
      if (wasFilterActive && selectedGlacier.value.id) {
        try {
          const filter = ['==', ['get', 'mapbox-id'], selectedGlacier.value.id]
          map.value.setFilter(activeLayerId.value, filter)
          const outlineLayerId = getOutlineLayerId(activeLayerId.value)
          if (map.value.getLayer(outlineLayerId)) {
            map.value.setFilter(outlineLayerId, filter)
          }
        } catch (error) {
          console.warn('[Map] Error restoring filter:', error)
        }
      }
    }
    
    // Apply current visualization
    setTimeout(() => {
      if (visualization.value) {
        updateLayerVisualization(visualization.value)
      }
    }, TIMING.VISUALIZATION_DELAY)
  })
}

// Function to load tileset for a projection
const loadTilesetForProjection = (proj, preserveSelection = false) => {
  if (!map.value || !mapLoaded.value) return
  
  const tilesetId = TILESET_IDS[proj]
  if (!tilesetId) {
    console.error('[Map] No tileset ID found for projection:', proj)
    return
  }
  
  console.log('[Map] Loading tileset for projection:', proj, 'tileset:', tilesetId)
  
  const source = map.value.getSource(layerId)
  
  // If source exists and is the same tileset, just update layers
  if (source && source.type === 'vector' && source.url === `mapbox://${tilesetId}`) {
    console.log('[Map] Tileset already loaded, updating layers for year', currentYear.value)
    addLayersForYear(currentYear.value, preserveSelection)
    return
  }
  
  // Remove existing source and layers if switching tilesets
  if (source) {
    if (map.value.getLayer(layerId)) {
      map.value.removeLayer(layerId)
    }
    const outlineId = getOutlineLayerId(layerId)
    if (map.value.getLayer(outlineId)) {
      map.value.removeLayer(outlineId)
    }
    map.value.removeSource(layerId)
  }
  
  // Clear search results when switching projections
  showSearchResults.value = false
  searchResults.value = []
  
  // Add new tileset source
  try {
    map.value.addSource(layerId, {
      type: 'vector',
      url: `mapbox://${tilesetId}`,
      promoteId: 'mapbox-id'  // Promote mapbox-id property to feature ID (matches test HTML)
    })
    console.log('[Map] Added tileset source:', layerId, 'for projection:', proj)
  } catch (error) {
    console.error('[Map] Error adding tileset source:', error)
    return
  }
  
  // Wait for source to load, then add layers
  const waitForSource = () => {
    const checkSource = map.value.getSource(layerId)
    if (checkSource && checkSource.loaded && checkSource.loaded()) {
      console.log('[Map] Tileset source loaded, adding layers for year', currentYear.value)
      addLayersForYear(currentYear.value, preserveSelection)
    } else {
      // Wait for source to load
      map.value.once('sourcedata', (e) => {
        if (e.sourceId === layerId && e.isSourceLoaded) {
          console.log('[Map] Tileset source loaded, adding layers for year', currentYear.value)
          addLayersForYear(currentYear.value, preserveSelection)
        }
      })
      
      // Also try after a short delay in case the event doesn't fire
      setTimeout(() => {
        const checkSourceAgain = map.value.getSource(layerId)
        if (checkSourceAgain && checkSourceAgain.loaded && checkSourceAgain.loaded()) {
          console.log('[Map] Tileset source loaded (timeout check), adding layers for year', currentYear.value)
          addLayersForYear(currentYear.value, preserveSelection)
        }
      }, 1000)
    }
  }
  
  waitForSource()
}

// Load tileset when map is ready
watch(mapLoaded, (loaded) => {
  if (loaded && map.value) {
    activeLayerId.value = layerId
    loadTilesetForProjection(projection.value, false)
    
    // Initialize zoom level
    currentZoom.value = map.value.getZoom()
    
    // Watch for zoom changes
    map.value.on('zoom', () => {
      currentZoom.value = map.value.getZoom()
    })
    
    // Also watch for moveend (catches programmatic zoom changes)
    map.value.on('moveend', () => {
      currentZoom.value = map.value.getZoom()
    })
    
    // Suppress expected errors for tiles and vector sources
    map.value.on('error', (e) => {
      // Filter out expected tile loading errors (404s are normal for missing tiles)
      if (e.error && e.error.status === 404) {
        // Silently ignore 404 errors - they're expected when tiles don't exist yet
        return
      }
      
      // Filter out "sourceLayer parameter must be provided" errors
      // These can occur when Mapbox internally queries vector sources
      // They're often harmless and don't affect functionality
      if (e.error && e.error.message && 
          e.error.message.includes('sourceLayer parameter must be provided')) {
        // Silently ignore - these are expected for vector sources during internal operations
        return
      }
      
      // Log other errors
      if (e.error) {
        console.error('[Map] Map error:', e.error)
      }
    })
    
    // Log available source-layers when tileset loads (for debugging)
    map.value.on('sourcedata', (e) => {
      if (e.sourceId === layerId && e.isSourceLoaded) {
        const source = map.value.getSource(layerId)
        if (source && source.vectorLayers) {
          console.log('[Map] Available source-layers in tileset:', source.vectorLayers.map(l => l.id))
        }
      }
    })
  }
})

// Watch for projection changes and switch tilesets
watch(projection, (newProjection) => {
  if (!map.value || !mapLoaded.value) return
  
  console.log('[Map] Projection changed to:', newProjection)
  
  // Preserve selection when switching projections
  const selectedMapboxId = selectedGlacier.value?.['mapbox-id'] || selectedGlacierId.value
  const wasFilterActive = isFilterActive.value
  const preserveSelection = selectedMapboxId !== null && selectedMapboxId !== undefined
  
  // Preserve glacier name and search query
  const preservedGlacier = selectedGlacier.value ? { ...selectedGlacier.value } : null
  const preservedSearchQuery = searchQuery.value
  
  // Load new tileset
  loadTilesetForProjection(newProjection, preserveSelection)
  
  // Restore preserved values if feature not found in new tileset
  if (preservedGlacier && selectedGlacier.value === null) {
    selectedGlacier.value = preservedGlacier
  }
  if (preservedGlacier && preservedSearchQuery) {
    searchQuery.value = preservedSearchQuery
  }
  
  // Clear selection state if there was no glacier selected
  if (selectedMapboxId === null || selectedMapboxId === undefined) {
    selectedGlacier.value = null
    selectedGlacierId.value = null
    searchQuery.value = ''
  }
})

// Watch for year changes and update the source-layer
watch(currentYear, (newYear) => {
  if (!map.value || !mapLoaded.value || !activeLayerId.value) return
  
  const source = map.value.getSource(activeLayerId.value)
  
  // Only update if using tileset (vector source)
  if (source && source.type === 'vector') {
    console.log('[Map] Year changed to', newYear, '- updating source-layer')
    
    // Preserve selection when switching years
    const selectedMapboxId = selectedGlacier.value?.['mapbox-id'] || selectedGlacierId.value
    const wasFilterActive = isFilterActive.value
    const preserveSelection = selectedMapboxId !== null && selectedMapboxId !== undefined
    
    addLayersForYear(newYear, preserveSelection)
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
  // Wrap in try-catch to handle any errors during handler setup
  try {
    map.value.on('click', activeLayerId.value, handleGlacierClick)
  } catch (error) {
    console.warn('[Map] Error setting up click handler:', error)
    // Retry after a short delay
    setTimeout(() => {
      if (map.value && map.value.getLayer(activeLayerId.value)) {
        try {
          map.value.on('click', activeLayerId.value, handleGlacierClick)
        } catch (retryError) {
          console.warn('[Map] Error retrying click handler setup:', retryError)
        }
      }
    }, 100)
  }
  
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

// Zoom to full extent of the current tileset data
const handleZoomToExtent = async () => {
  if (!map.value || !activeLayerId.value) return
  
  try {
    // Query features from the current tileset
    const features = querySourceFeatures(activeLayerId.value)
    
    if (!features || features.length === 0) {
      console.error('[Map] No features found in tileset to calculate bounds')
      return
    }
    
    // Calculate bounds from all features
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
    
    features.forEach(feature => {
      if (feature.geometry && feature.geometry.coordinates) {
        const coords = feature.geometry.type === 'Polygon' 
          ? feature.geometry.coordinates[0] 
          : feature.geometry.coordinates
        
        coords.forEach(coord => {
          const [lng, lat] = Array.isArray(coord[0]) ? coord : [coord]
          minLng = Math.min(minLng, lng)
          minLat = Math.min(minLat, lat)
          maxLng = Math.max(maxLng, lng)
          maxLat = Math.max(maxLat, lat)
        })
      }
    })
    
    if (minLng === Infinity) {
      console.error('[Map] Could not calculate bounds from tileset features')
      return
    }
    
    // Zoom to the calculated bounds with padding
    map.value.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
      padding: { top: 50, bottom: 50, left: 50, right: 50 },
      duration: 1000,
      maxZoom: 12 // Optional: limit max zoom level
    })
    
    console.log('[Map] Zoomed to full extent of tileset data')
  } catch (error) {
    console.error('[Map] Error zooming to extent:', error)
  }
}

// Handle year change from time slider
// The watcher on currentYear will handle updating the source-layer
const handleYearChange = (newYear) => {
  currentYear.value = newYear
  console.log('[Map] Year changed to:', newYear)
  // The watcher on currentYear will handle the tileset source-layer update
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
  
  // Check if source exists and has data (support both geojson and vector sources)
  const source = map.value.getSource(activeLayerId.value)
  if (!source || (source.type !== 'geojson' && source.type !== 'vector')) {
    console.warn('[Map] Source not available for area visualization. Source type:', source?.type)
    return
  }
  
  // Function to actually apply the colors
  const doApplyColors = () => {
    try {
      const features = querySourceFeatures(activeLayerId.value)
      
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
  
  // Check if source exists (support both geojson and vector sources)
  const source = map.value.getSource(activeLayerId.value)
  if (!source || (source.type !== 'geojson' && source.type !== 'vector')) {
    console.warn('[Map] Source not available for outlines only visualization. Source type:', source?.type)
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
// The watcher on projection will handle switching tilesets
const handleProjectionChange = (newProjection) => {
  projection.value = newProjection
  console.log('[Map] Projection changed to:', newProjection)
  // The watcher on projection will handle the tileset switching
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
  
  // Update layer colors
  updateLayerColors()
  
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
    const features = querySourceFeatures(activeLayerId.value)
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

.debug-zoom {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 8px 12px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  font-weight: bold;
  pointer-events: none;
  user-select: none;
}

</style>