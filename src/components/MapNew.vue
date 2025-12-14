<template>
  <div class="map-viewer">
    <div ref="mapboxCanvas" class="mapbox-canvas"></div>
    
    <div v-if="!mapLoaded" class="map-load-overlay">
      <button @click="initializeMap" class="load-map-button">
        Load map
      </button>
    </div>
    
    <button
      v-if="mapLoaded"
      @click="toggleTerrain"
      class="toggle-3d-button"
      :title="is3D ? 'Switch to 2D view' : 'Switch to 3D view'"
    >
      {{ is3D ? '2D' : '3D' }}
    </button>
    
    <button
      v-if="mapLoaded"
      @click="toggleBasemap"
      class="toggle-basemap-button"
      :title="isSatellite ? 'Switch to light map' : 'Switch to satellite map'"
    >
      {{ isSatellite ? 'Map' : 'Sat' }}
    </button>
    
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
      @reset-bearing="handleResetBearing"
      @toggle="toggleTerrain"
      @zoom-to-extent="handleZoomToExtent"
      class="map-controls-top-right"
    />
    
    <div v-if="mapLoaded" class="visualization-selector" ref="visualizationSelector">
      <button
        @click.stop="showVisualizationMenu = !showVisualizationMenu"
        class="visualization-button"
        :title="`Current: ${getVisualizationLabel(visualization)}`"
      >
        {{ getVisualizationLabel(visualization) }}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      <div v-if="showVisualizationMenu" class="visualization-menu">
        <button
          @click.stop="setVisualization('uniform')"
          class="visualization-option"
          :class="{ active: visualization === 'uniform' }"
        >
          Uniform
        </button>
        <button
          @click.stop="setVisualization('area-change')"
          class="visualization-option"
          :class="{ active: visualization === 'area-change' }"
        >
          Area Change (%)
        </button>
        <button
          @click.stop="setVisualization('volume-change')"
          class="visualization-option"
          :class="{ active: visualization === 'volume-change' }"
        >
          Volume Change (%)
        </button>
      </div>
    </div>
    
    <button
      v-if="mapLoaded"
      class="imprint-button"
      title="Imprint"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M12 16v-4"></path>
        <path d="M12 8h.01"></path>
      </svg>
    </button>
    
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
import { ref, onMounted, onBeforeUnmount, nextTick, watch, computed } from 'vue'
import { useMapboxMap } from '../composables/useMapboxMap.js'
import { useMapControls } from '../composables/useMapControls.js'
import { TILESET_IDS } from '../config/mapbox.js'
import { PROJECTION_CONFIG } from '../config/projections.js'
import SearchBar from './SearchBar.vue'
import ProjectionTimeControls from './ProjectionTimeControlsNew.vue'
import MapControls from './MapControls.vue'

// Template ref for map container
const mapboxCanvas = ref(null)

// Initialize map using composable
const { map, mapLoaded, initializeMap } = useMapboxMap(mapboxCanvas)

// Map controls composable
const { is3D, toggleTerrain, resetBearing } = useMapControls(map)

// Basemap state
const isSatellite = ref(false)

// Visualization state
const visualization = ref('uniform') // 'uniform', 'area-change', 'volume-change'
const showVisualizationMenu = ref(false)
const visualizationSelector = ref(null)

// Close visualization menu when clicking outside
const handleClickOutside = (event) => {
  if (visualizationSelector.value && !visualizationSelector.value.contains(event.target)) {
    showVisualizationMenu.value = false
  }
}

// Watch for clicks outside the menu
watch(showVisualizationMenu, (isOpen) => {
  if (isOpen) {
    nextTick(() => {
      document.addEventListener('click', handleClickOutside)
    })
  } else {
    document.removeEventListener('click', handleClickOutside)
  }
})

// Cleanup event listener on unmount
onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  
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

// Toggle basemap between light and satellite
const toggleBasemap = () => {
  if (!map.value) return
  
  // Store current 3D state before style change
  const was3D = is3D.value
  const currentPitch = map.value.getPitch()
  const currentTerrain = map.value.getTerrain()
  
  isSatellite.value = !isSatellite.value
  
  const newStyle = isSatellite.value
    ? 'mapbox://styles/mapbox/satellite-v9'
    : 'mapbox://styles/mapbox/light-v11'
  
  // Reset loaded sources since style change removes all sources
  loadedSources.value.clear()
  // Reset click handler setup flag since map is being recreated
  mapClickHandlerSetup.value = false
  
  // When style changes, we need to wait for it to load before re-adding sources/layers
  map.value.once('style.load', () => {
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
      updateLayerColors()
      setupClickHandler()
    }
    
    reinitializeLayers()
  })
  
  map.value.setStyle(newStyle)
}

// Helper functions to generate source and layer IDs for each projection
const getSourceId = (proj) => `glacier-tileset-${proj}`
const getLayerId = (proj) => `glacier-layer-${proj}`
const getOutlineId = (proj) => `glacier-outline-${proj}`

// Projection and year state
const projection = ref(PROJECTION_CONFIG.DEFAULT_PROJECTION)
const currentYear = ref(PROJECTION_CONFIG.DEFAULT_YEAR)

// Computed IDs for current projection
const currentSourceId = computed(() => getSourceId(projection.value))
const currentLayerId = computed(() => getLayerId(projection.value))
const currentOutlineId = computed(() => getOutlineId(projection.value))

// Track which sources are loaded
const loadedSources = ref(new Set())

// Selection state - store feature ID separately to persist across layer changes
const selectedGlacier = ref(null)
const selectedFeatureId = ref(null) // Lock the feature ID across year/scenario changes

// Search state
const searchQuery = ref('')
const searchResults = ref([])
const showSearchResults = ref(false)

// Helper function to get color based on percentage change
// Returns a color from blue (negative) to white (0) to red (positive)
const getColorForPercentage = (propertyName) => {
  return [
    'case',
    ['has', propertyName], // Check if property exists
    [
      'case',
      ['==', ['get', propertyName], null], '#E5E5E5', // Gray for null
      [
        'interpolate',
        ['linear'],
        ['get', propertyName],
        -50, '#1E3A8A', // Dark blue for -50%
        -25, '#3B82F6', // Blue for -25%
        0, '#FFFFFF',   // White for 0%
        25, '#F87171',  // Light red for +25%
        50, '#DC2626'   // Red for +50%
      ]
    ],
    '#E5E5E5' // Gray for missing property
  ]
}

// Function to get color based on feature state and visualization mode
const getFillColor = () => {
  const selectedId = selectedGlacier.value?.id
  
  // Base color expression based on visualization mode
  let baseColor
  
  if (visualization.value === 'area-change') {
    baseColor = getColorForPercentage('Area change (%)')
  } else if (visualization.value === 'volume-change') {
    baseColor = getColorForPercentage('Volume change (%)')
  } else {
    // Uniform visualization
    baseColor = '#87CEEB' // Default sky blue color
  }
  
  // If a feature is selected, highlight it in red
  if (selectedId !== null && selectedId !== undefined) {
    return [
      'case',
      ['==', ['id'], selectedId],
      '#FF6B6B', // Red color for selected feature
      baseColor
    ]
  }
  
  return baseColor
}

const getOutlineColor = () => {
  const selectedId = selectedGlacier.value?.id
  
  // For outlines, use a darker version of the fill or default
  let baseColor
  
  if (visualization.value === 'area-change' || visualization.value === 'volume-change') {
    // For percentage visualizations, use a darker outline
    baseColor = '#333333'
  } else {
    baseColor = '#87CEEB' // Default sky blue color
  }
  
  // If a feature is selected, highlight it in red
  if (selectedId !== null && selectedId !== undefined) {
    return [
      'case',
      ['==', ['id'], selectedId],
      '#FF6B6B', // Red color for selected feature
      baseColor
    ]
  }
  
  return baseColor
}

// Get visualization label for display
const getVisualizationLabel = (viz) => {
  switch (viz) {
    case 'uniform':
      return 'Uniform'
    case 'area-change':
      return 'Area %'
    case 'volume-change':
      return 'Volume %'
    default:
      return 'Uniform'
  }
}

// Set visualization mode
const setVisualization = (viz) => {
  visualization.value = viz
  showVisualizationMenu.value = false
  updateLayerColors()
}

// Function to update layer colors
const updateLayerColors = () => {
  const layerId = currentLayerId.value
  const outlineId = currentOutlineId.value
  if (map.value && map.value.getLayer(layerId)) {
    map.value.setPaintProperty(layerId, 'fill-color', getFillColor())
  }
  if (map.value && map.value.getLayer(outlineId)) {
    map.value.setPaintProperty(outlineId, 'line-color', getOutlineColor())
  }
}

// Helper function to query features from source (handles vector tilesets)
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

// Search handlers (placeholder for now)
const handleSearch = (query) => {
  console.log('[MapNew] Search:', query)
  // TODO: Implement search functionality
}

const handleSearchClear = () => {
  // Deselect feature (same as clicking outside)
  selectedGlacier.value = null
  selectedFeatureId.value = null
  searchQuery.value = ''
  searchResults.value = []
  showSearchResults.value = false
  updateLayerColors()
  console.log('[MapNew] ✓ Deselected (search cleared)')
}

const handleGlacierSelect = (result) => {
  console.log('[MapNew] Glacier selected:', result)
  // TODO: Implement glacier selection
  showSearchResults.value = false
}

// Function to load a tileset source
const loadTilesetSource = (proj) => {
  if (!map.value) return Promise.resolve()

  const tilesetId = TILESET_IDS[proj]
  if (!tilesetId) {
    console.warn('[MapNew] No tileset ID found for projection:', proj)
    return Promise.resolve()
  }

  const sourceId = getSourceId(proj)
  
  // If source already exists, return
  if (map.value.getSource(sourceId)) {
    return Promise.resolve()
  }

  console.log('[MapNew] Loading tileset for projection:', proj, 'tileset:', tilesetId)

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
        console.log('[MapNew] ✓ Tileset loaded for projection:', proj)
        resolve()
      }
    }
    map.value.on('sourcedata', onSourceData)
  })
}

// Function to create layers for a projection and year
const createLayersForProjectionYear = (proj, year) => {
  if (!map.value) return

  const sourceId = getSourceId(proj)
  const layerId = getLayerId(proj)
  const outlineId = getOutlineId(proj)
  const sourceLayerName = year.toString()

  // Check if source exists
  if (!map.value.getSource(sourceId)) {
    console.warn('[MapNew] Source not found for projection:', proj, '- it may still be loading')
    return
  }

  // Clean up handlers before removing layers
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

  // Remove existing layers if they exist
  if (map.value.getLayer(layerId)) {
    map.value.removeLayer(layerId)
  }
  if (map.value.getLayer(outlineId)) {
    map.value.removeLayer(outlineId)
  }

  // Add fill layer (always visible when created, as it's for the active projection)
  map.value.addLayer({
    id: layerId,
    type: 'fill',
    source: sourceId,
    'source-layer': sourceLayerName,
    paint: {
      'fill-color': getFillColor(),
      'fill-opacity': 0.6,
    },
  })

  // Add outline layer
  map.value.addLayer({
    id: outlineId,
    type: 'line',
    source: sourceId,
    'source-layer': sourceLayerName,
    paint: {
      'line-color': getOutlineColor(),
      'line-width': 2,
    },
  })

  console.log('[MapNew] Layers created for projection:', proj, 'year:', year)
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
    
    // Use nextTick to batch layer operations
    nextTick(() => {
      // Recreate layers for current projection with new year (source is already loaded, so this is fast)
      createLayersForProjectionYear(proj, year)
      
      // Update colors
      updateLayerColors()
      
  // Restore selection if we had a selected feature ID
  if (preservedFeatureId !== null && preservedFeatureId !== undefined) {
    // Wait for map to be idle (layers fully rendered) before restoring selection
    map.value.once('idle', () => {
      // Additional small delay to ensure features are queryable
      setTimeout(() => {
        restoreSelectionByFeatureId(preservedFeatureId)
      }, 200)
    })
    // Setup click handler
    setupClickHandler()
  } else {
    // Setup click handler immediately if no selection to restore
    setupClickHandler()
  }
    })
  }, 100) // 100ms debounce
}

// Handle projection change
const handleProjectionChange = (newProjection) => {
  console.log('[MapNew] Projection changed to:', newProjection)
  
  // Preserve selected feature ID before changing projection
  const preservedFeatureId = selectedFeatureId.value
  
  // Remove old projection layers
  const oldLayerId = getLayerId(projection.value)
  const oldOutlineId = getOutlineId(projection.value)
  if (map.value.getLayer(oldLayerId)) {
    map.value.removeLayer(oldLayerId)
  }
  if (map.value.getLayer(oldOutlineId)) {
    map.value.removeLayer(oldOutlineId)
  }
  
  // Update projection
  projection.value = newProjection
  
  // Create layers for new projection with current year (source is already loaded, so this is fast)
  createLayersForProjectionYear(newProjection, currentYear.value)
  
  // Update colors for new projection
  updateLayerColors()
  
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

// Function to restore selection by feature ID (with retry logic)
const restoreSelectionByFeatureId = (featureId, retryCount = 0) => {
  if (!map.value) return
  
  const maxRetries = 5
  const retryDelay = 200
  
  try {
    const features = querySourceFeatures()
    console.log('[MapNew] Attempting to restore selection for feature ID:', featureId, 'Found', features?.length || 0, 'features')
    
    if (!features || features.length === 0) {
      // No features found yet, retry if we haven't exceeded max retries
      if (retryCount < maxRetries) {
        console.log('[MapNew] No features found yet, retrying...', retryCount + 1, '/', maxRetries)
        setTimeout(() => {
          restoreSelectionByFeatureId(featureId, retryCount + 1)
        }, retryDelay)
      } else {
        console.warn('[MapNew] Could not restore selection: no features found after', maxRetries, 'retries')
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
      console.log('[MapNew] ✓ Selection restored for feature ID:', featureId)
    } else {
      // Feature not found in new layer, clear selection
      selectedGlacier.value = null
      searchQuery.value = ''
      updateLayerColors()
      console.log('[MapNew] Feature ID', featureId, 'not found in current layer (checked', features.length, 'features)')
    }
  } catch (error) {
    console.error('[MapNew] Error restoring selection:', error)
    // Retry on error if we haven't exceeded max retries
    if (retryCount < maxRetries) {
      setTimeout(() => {
        restoreSelectionByFeatureId(featureId, retryCount + 1)
      }, retryDelay)
    }
  }
}

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

// Zoom to full extent of the current tileset data
const handleZoomToExtent = async () => {
  if (!map.value) return
  
  try {
    // Query features from the current tileset
    const features = querySourceFeatures()
    
    if (!features || features.length === 0) {
      console.error('[MapNew] No features found in tileset to calculate bounds')
      return
    }
    
    // Calculate bounds from all features
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
    
    features.forEach(feature => {
      if (feature.geometry && feature.geometry.coordinates) {
        const processCoordinates = (coords) => {
          if (Array.isArray(coords[0])) {
            if (Array.isArray(coords[0][0])) {
              // MultiPolygon or nested arrays
              coords.forEach(ring => {
                if (Array.isArray(ring[0])) {
                  ring.forEach(coord => {
                    const [lng, lat] = coord
                    minLng = Math.min(minLng, lng)
                    minLat = Math.min(minLat, lat)
                    maxLng = Math.max(maxLng, lng)
                    maxLat = Math.max(maxLat, lat)
                  })
                }
              })
            } else {
              // Polygon ring
              coords.forEach(coord => {
                const [lng, lat] = coord
                minLng = Math.min(minLng, lng)
                minLat = Math.min(minLat, lat)
                maxLng = Math.max(maxLng, lng)
                maxLat = Math.max(maxLat, lat)
              })
            }
          } else {
            // Single coordinate
            const [lng, lat] = coords
            minLng = Math.min(minLng, lng)
            minLat = Math.min(minLat, lat)
            maxLng = Math.max(maxLng, lng)
            maxLat = Math.max(maxLat, lat)
          }
        }

        if (feature.geometry.type === 'Polygon') {
          processCoordinates(feature.geometry.coordinates[0])
        } else if (feature.geometry.type === 'MultiPolygon') {
          feature.geometry.coordinates.forEach(polygon => {
            processCoordinates(polygon[0])
          })
        }
      }
    })
    
    if (minLng === Infinity) {
      console.error('[MapNew] Could not calculate bounds from tileset features')
      return
    }
    
    // Zoom to the calculated bounds with padding
    map.value.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
      padding: { top: 50, bottom: 50, left: 50, right: 50 },
      duration: 1000,
      maxZoom: 12 // Optional: limit max zoom level
    })
    
    console.log('[MapNew] Zoomed to full extent of tileset data')
  } catch (error) {
    console.error('[MapNew] Error zooming to extent:', error)
  }
}

// Track which layer has handlers set up to avoid duplicate handlers
const handlerLayerId = ref(null)
const mapClickHandlerSetup = ref(false)

// Store handler function references so they can be properly removed
let currentMousemoveHandler = null
let currentMouseleaveHandler = null

const handleGlacierClick = (e) => {
  if (!e.features || e.features.length === 0) return
  
  const selectedFeature = e.features[0]
  
  // Get feature ID from the selected feature
  if (selectedFeature.id === undefined || selectedFeature.id === null) {
    console.warn('[MapNew] Selected feature has no ID')
    return
  }
  
  const featureId = selectedFeature.id
  
  console.log('[MapNew] Feature selected - ID:', featureId)
  
  // Toggle selected feature (click again to deselect)
  if (selectedGlacier.value?.id === featureId) {
    selectedGlacier.value = null
    selectedFeatureId.value = null
    searchQuery.value = ''
  } else {
    selectedGlacier.value = {
      id: featureId,
      name: selectedFeature.properties?.name || null,
      'sgi-id': selectedFeature.properties?.['sgi-id'] || null,
    }
    // Lock the feature ID so it persists across year/scenario changes
    selectedFeatureId.value = featureId
    // Update search bar
    searchQuery.value = selectedFeature.properties?.name || ''
  }
  
  // Update layer colors
  updateLayerColors()
  
  console.log('[MapNew] ✓ Feature selection updated, ID locked:', selectedFeatureId.value)
}

// Named click-outside handler (set up only once)
const handleMapClick = (e) => {
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
    console.log('[MapNew] ✓ Deselected (clicked outside glacier)')
  }
}

// Setup click handler for feature selection
const setupClickHandler = () => {
  if (!map.value) {
    console.warn('[MapNew] Cannot setup click handler: map not available')
    return
  }
  
  const layerId = currentLayerId.value
  
  // If handlers are already set up for this layer, skip
  if (handlerLayerId.value === layerId) {
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
      // Remove handlers using stored references if available
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
    } catch (error) {
      // Ignore errors when removing handlers from non-existent layers
      console.log('[MapNew] Error removing old handlers (layer may not exist):', error)
    }
    // Clear old handler references
    currentMousemoveHandler = null
    currentMouseleaveHandler = null
  }
  
  // Create new handler functions and store references
  currentMousemoveHandler = () => {
    if (map.value) {
      map.value.getCanvas().style.cursor = 'pointer'
    }
  }
  
  currentMouseleaveHandler = () => {
    if (map.value) {
      map.value.getCanvas().style.cursor = ''
    }
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

// Don't auto-initialize - wait for user to click "Load map"

// Load all tilesets when map is loaded
watch(mapLoaded, async (loaded) => {
  if (!loaded || !map.value) return

  console.log('[MapNew] Map loaded, preloading all tilesets...')

  // Get all available projections
  const projections = Object.keys(TILESET_IDS).filter(proj => TILESET_IDS[proj] !== null)

  // Load all tileset sources in parallel
  const loadPromises = projections.map(proj => loadTilesetSource(proj))
  
  try {
    await Promise.all(loadPromises)
    console.log('[MapNew] ✓ All tilesets loaded')

    // Create layers only for current projection and year (sources are preloaded, so this is fast)
    createLayersForProjectionYear(projection.value, currentYear.value)
    updateLayerColors()

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

.toggle-3d-button {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 1000;
  min-height: 40px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: box-shadow 0.2s, border-color 0.2s, background 0.2s;
  color: #333;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  box-sizing: border-box;
}

.toggle-3d-button:hover {
  background: #f5f5f5;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.toggle-basemap-button {
  position: absolute;
  top: 76px;
  left: 20px;
  z-index: 1000;
  min-height: 40px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: box-shadow 0.2s, border-color 0.2s, background 0.2s;
  color: #333;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  box-sizing: border-box;
}

.toggle-basemap-button:hover {
  background: #f5f5f5;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
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

.visualization-selector {
  position: absolute;
  top: 76px;
  right: 20px;
  z-index: 1000;
}

.visualization-button {
  min-height: 40px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: box-shadow 0.2s, border-color 0.2s, background 0.2s;
  color: #333;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  box-sizing: border-box;
  min-width: 120px;
}

.visualization-button:hover {
  background: #f5f5f5;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.visualization-button svg {
  flex-shrink: 0;
  transition: transform 0.2s;
}

.visualization-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  min-width: 160px;
  z-index: 1001;
}

.visualization-option {
  width: 100%;
  padding: 12px 16px;
  text-align: left;
  background: white;
  border: none;
  border-bottom: 1px solid #f5f5f5;
  cursor: pointer;
  color: #333;
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  transition: background-color 0.2s;
}

.visualization-option:last-child {
  border-bottom: none;
}

.visualization-option:hover {
  background: #f5f5f5;
}

.visualization-option.active {
  background: #E3F2FD;
  color: #1976D2;
  font-weight: 600;
}

.imprint-button {
  position: absolute;
  top: 132px;
  right: 20px;
  z-index: 1000;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: box-shadow 0.2s, border-color 0.2s, background 0.2s;
  color: #333;
  padding: 0;
  font-family: inherit;
  box-sizing: border-box;
}

.imprint-button:hover {
  background: #f5f5f5;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.imprint-button svg {
  width: 16px;
  height: 16px;
}

.map-load-overlay {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 2000;
}

.load-map-button {
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 500;
  color: white;
  background: #007bff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.load-map-button:hover {
  background: #0056b3;
}
</style>
