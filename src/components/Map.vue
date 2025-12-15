<template>
  <div class="map-viewer">
    <div ref="mapboxCanvas" class="mapbox-canvas"></div>
    
    <Transition name="fade">
      <MapLoadOverlay v-if="!mapLoaded" @load="initializeMap" />
    </Transition>
    
    <div v-if="mapLoaded" class="top-left-controls">
      <button
        @click="handleZoomToExtent"
        class="control-button"
        title="Zoom to full extent of data"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <!-- Inner frame (the extent) -->
          <rect x="6" y="6" width="12" height="12" rx="1"></rect>
          <!-- Corner arrows pointing inward from outside -->
          <line x1="2" y1="2" x2="6" y2="6"></line>
          <polyline points="2 2 3 2 2 3"></polyline>
          <line x1="22" y1="2" x2="18" y2="6"></line>
          <polyline points="22 2 21 2 22 3"></polyline>
          <line x1="2" y1="22" x2="6" y2="18"></line>
          <polyline points="2 22 3 22 2 21"></polyline>
          <line x1="22" y1="22" x2="18" y2="18"></line>
          <polyline points="22 22 21 22 22 21"></polyline>
        </svg>
      </button>
      <button
        @click="handleResetBearing"
        class="control-button"
        title="Reset map to north"
      >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <!-- Upward triangle -->
        <polygon points="12 3 4 11 20 11"></polygon>

        <!-- Downward triangle -->
        <polygon points="4 13 20 13 12 21"></polygon>
      </svg>
      </button>
      <button
        @click="toggleTerrain"
        class="control-button toggle-3d-button"
        :class="{ 'is-3d': is3D }"
        :title="is3D ? 'Switch to 2D view' : 'Switch to 3D view'"
      >
        {{ is3D ? '2D' : '3D' }}
      </button>
      <div class="basemap-toggle">
        <button
          @click="toggleBasemap(false)"
          :class="{ active: !isSatellite }"
          class="basemap-toggle-button"
          title="Light map"
        >
          Light
        </button>
        <button
          @click="toggleBasemap(true)"
          :class="{ active: isSatellite }"
          class="basemap-toggle-button"
          title="Satellite map"
        >
          Satellite
        </button>
      </div>
    </div>
    
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
    
    <!-- Zoom to glacier button dropdown -->
    <Transition name="zoom-button-fade">
      <div v-if="mapLoaded && selectedGlacier" class="zoom-to-glacier-dropdown">
        <button
          @click="zoomToGlacierExtent"
          class="zoom-to-glacier-button"
          title="Zoom to glacier extent"
        >
          <span>Zoom to glacier</span>
        </button>
      </div>
    </Transition>
    
    <button
      v-if="mapLoaded"
      @click="showImprintModal = true"
      class="imprint-button"
      title="Imprint"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M12 16v-4"></path>
        <path d="M12 8h.01"></path>
      </svg>
    </button>
    
    <!-- Imprint Modal -->
    <div v-if="showImprintModal" class="imprint-modal-overlay" @click="showImprintModal = false">
      <div class="imprint-modal" @click.stop>
        <div class="imprint-modal-header">
          <h1 class="imprint-modal-title">BEYOND ICE</h1>
          <button @click="showImprintModal = false" class="imprint-modal-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="imprint-modal-content">
          <p class="project-description">
            This application was created by David Clara for the course Application Development in Cartography at ETH Zurich
          </p>
          <div class="data-attributions">
            <h2>Data Attributions</h2>
            <p class="attribution-line">
              Future glacier extent data: <a href="https://doi.org/10.1002/hyp.7055" target="_blank" rel="noopener noreferrer">Huss et al. (2008)</a>
            </p>
          </div>
          <div class="map-attributions">
            <h2>Map Attributions</h2>
            <p class="attribution-line">
              © <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener noreferrer">Mapbox</a>,
              © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>,
              © <a href="https://www.maxar.com/" target="_blank" rel="noopener noreferrer">Maxar</a>
            </p>
          </div>

        </div>
      </div>
    </div>
    
    <ProjectionTimeControls
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
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, watch, computed } from 'vue'
import { useMapboxMap } from '../composables/useMapboxMap.js'
import { useMapControls } from '../composables/useMapControls.js'
import { TILESET_IDS } from '../config/mapbox.js'
import { PROJECTION_CONFIG } from '../config/projections.js'
import { COLORS } from '../config/colors.js'
import SearchBar from './SearchBar.vue'
import ProjectionTimeControls from './ProjectionTimeControls.vue'
import MapLoadOverlay from './MapLoadOverlay.vue'

// Template ref for map container
const mapboxCanvas = ref(null)

// Initialize map using composable
const { map, mapLoaded, initializeMap } = useMapboxMap(mapboxCanvas)

// Map controls composable
const { is3D, toggleTerrain, resetBearing } = useMapControls(map)

// Basemap state
const isSatellite = ref(false)

// Imprint modal state
const showImprintModal = ref(false)


// Visualization state (kept for map color logic, always 'uniform')
const visualization = ref('uniform')

// Cleanup on unmount
onBeforeUnmount(() => {
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
    ? 'mapbox://styles/mapbox/satellite-v9'
    : 'mapbox://styles/mapbox/light-v11'
  
  // Reset loaded sources since style change removes all sources
  loadedSources.value.clear()
  // Reset click handler setup flag since map is being recreated
  mapClickHandlerSetup.value = false
  
  // When style changes, we need to wait for it to load before re-adding sources/layers
  map.value.once('style.load', () => {
    // Add dark overlay for satellite mode to make it darker
    if (isSatellite.value) {
      // Remove existing overlay if it exists
      if (map.value.getLayer('satellite-dark-overlay')) {
        map.value.removeLayer('satellite-dark-overlay')
      }
      if (map.value.getSource('satellite-dark-overlay')) {
        map.value.removeSource('satellite-dark-overlay')
      }
      
      // Add a dark overlay source and layer
      map.value.addSource('satellite-dark-overlay', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [-180, -90],
                [180, -90],
                [180, 90],
                [-180, 90],
                [-180, -90]
              ]]
            }
          }]
        }
      })
      
      map.value.addLayer({
        id: 'satellite-dark-overlay',
        type: 'fill',
        source: 'satellite-dark-overlay',
        paint: {
          'fill-color': '#000000',
          'fill-opacity': 0.25 // 25% dark overlay to darken the satellite imagery
        }
      })
    } else {
      // Remove dark overlay when switching back to light mode
      if (map.value.getLayer('satellite-dark-overlay')) {
        map.value.removeLayer('satellite-dark-overlay')
      }
      if (map.value.getSource('satellite-dark-overlay')) {
        map.value.removeSource('satellite-dark-overlay')
      }
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

const glacierSearchIndex = ref([])

// Helper function to get color based on percentage change
// Returns a color from blue (negative) to white (0) to red (positive)
const getColorForPercentage = (propertyName) => {
  return [
    'case',
    ['has', propertyName], // Check if property exists
    [
      'case',
      ['==', ['get', propertyName], null], COLORS.visualization.missing,
      [
        'interpolate',
        ['linear'],
        ['get', propertyName],
        -50, COLORS.visualization.negative,
        -25, COLORS.visualization.negativeLight,
        0, COLORS.visualization.neutral,
        25, COLORS.visualization.positiveLight,
        50, COLORS.visualization.positive
      ]
    ],
    COLORS.visualization.missing
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
    baseColor = COLORS.glacier.default
  }
  
  // In satellite mode, non-selected glaciers are white, selected keeps its color
  if (isSatellite.value) {
    if (selectedId !== null && selectedId !== undefined) {
      return [
        'case',
        ['==', ['id'], selectedId],
        COLORS.glacier.selected,
        '#FFFFFF'
      ]
    }
    return '#FFFFFF'
  }
  
  // If a feature is selected, highlight it in bright blue
  if (selectedId !== null && selectedId !== undefined) {
    return [
      'case',
      ['==', ['id'], selectedId],
      COLORS.glacier.selected,
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
    baseColor = COLORS.glacier.outline
  }
  
  // In satellite mode, all glaciers have blue outlines, selected glacier has selected color outline
  if (isSatellite.value) {
    if (selectedId !== null && selectedId !== undefined) {
      return [
        'case',
        ['==', ['id'], selectedId],
        COLORS.glacier.selected,
        COLORS.glacier.default
      ]
    }
    return COLORS.glacier.default
  }
  
  // If a feature is selected, highlight it in bright blue
  if (selectedId !== null && selectedId !== undefined) {
    return [
      'case',
      ['==', ['id'], selectedId],
      COLORS.glacier.selected,
      baseColor
    ]
  }
  
  return baseColor
}


// Function to get fill opacity based on basemap mode
const getFillOpacity = () => {
  // In satellite mode, use full opacity for better visibility
  return isSatellite.value ? 0.8 : 0.6
}

// Function to update layer colors
const updateLayerColors = () => {
  const layerId = currentLayerId.value
  const outlineId = currentOutlineId.value
  if (map.value && map.value.getLayer(layerId)) {
    map.value.setPaintProperty(layerId, 'fill-color', getFillColor())
    map.value.setPaintProperty(layerId, 'fill-opacity', getFillOpacity())
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
// Load glacier search index from CSV
const loadGlacierSearchIndex = async () => {
  try {
    // Use BASE_URL like the overall CSV files do (works in both dev and production)
    const csvUrl = `${import.meta.env.BASE_URL}data/mapping.csv`
    console.log('[MapNew] Loading glacier search index from', csvUrl)
    const response = await fetch(csvUrl)
    
    if (!response.ok) {
      console.error(`[MapNew] Could not load glacier search index: ${response.status} ${response.statusText}`)
      console.error(`[MapNew] Tried path: ${csvUrl}`)
      return
    }
    
    console.log('[MapNew] Successfully loaded mapping.csv')
    const text = await response.text()
    const lines = text.split('\n').filter(line => line.trim())
    
    console.log(`[MapNew] CSV loaded: ${lines.length} lines`)
    
    if (lines.length < 2) {
      console.warn('[MapNew] Search index CSV is empty or invalid')
      return
    }
    
    // Parse header to find column indices
    const header = lines[0].toLowerCase()
    const headerParts = []
    let current = ''
    let inQuotes = false
    for (let j = 0; j < header.length; j++) {
      const char = header[j]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        headerParts.push(current.trim().toLowerCase())
        current = ''
      } else {
        current += char
      }
    }
    headerParts.push(current.trim().toLowerCase())
    
    // Find column indices
    const mapboxIdIdx = headerParts.findIndex(col => col === 'mapbox-id' || col === 'mapbox_id')
    const nameIdx = headerParts.findIndex(col => col === 'name')
    const sgiIdIdx = headerParts.findIndex(col => col === 'sgi_id' || col === 'sgi-id')
    const minLngIdx = headerParts.findIndex(col => col === 'min_lng')
    const minLatIdx = headerParts.findIndex(col => col === 'min_lat')
    const maxLngIdx = headerParts.findIndex(col => col === 'max_lng')
    const maxLatIdx = headerParts.findIndex(col => col === 'max_lat')
    
    console.log('[MapNew] CSV columns found:', { mapboxIdIdx, nameIdx, sgiIdIdx, minLngIdx, minLatIdx, maxLngIdx, maxLatIdx, headerParts })
    
    if (mapboxIdIdx === -1 || nameIdx === -1) {
      console.error('[MapNew] Required columns not found in CSV. Header:', headerParts)
      return
    }
    
    const index = []
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      // Simple CSV parsing (handles quoted values)
      const values = []
      current = ''
      inQuotes = false
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      values.push(current.trim()) // Add last value
      
      const maxIdx = Math.max(
        mapboxIdIdx, 
        nameIdx, 
        sgiIdIdx >= 0 ? sgiIdIdx : -1,
        minLngIdx >= 0 ? minLngIdx : -1,
        minLatIdx >= 0 ? minLatIdx : -1,
        maxLngIdx >= 0 ? maxLngIdx : -1,
        maxLatIdx >= 0 ? maxLatIdx : -1
      )
      
      if (values.length > maxIdx) {
        const mapboxId = parseInt(values[mapboxIdIdx])
        if (!isNaN(mapboxId)) {
          const entry = {
            mapbox_id: mapboxId,
            name: values[nameIdx] || '',
            sgi_id: sgiIdIdx >= 0 ? (values[sgiIdIdx] || '') : ''
          }
          
          // Add bounds if available
          if (minLngIdx >= 0 && minLatIdx >= 0 && maxLngIdx >= 0 && maxLatIdx >= 0) {
            const minLng = parseFloat(values[minLngIdx])
            const minLat = parseFloat(values[minLatIdx])
            const maxLng = parseFloat(values[maxLngIdx])
            const maxLat = parseFloat(values[maxLatIdx])
            
            if (!isNaN(minLng) && !isNaN(minLat) && !isNaN(maxLng) && !isNaN(maxLat)) {
              entry.bounds = {
                min_lng: minLng,
                min_lat: minLat,
                max_lng: maxLng,
                max_lat: maxLat
              }
            } else {
              // Log if bounds couldn't be parsed for debugging
              if (index.length < 5) { // Only log first few to avoid spam
                console.warn(`[MapNew] Could not parse bounds for glacier ${mapboxId}:`, {
                  minLng: values[minLngIdx],
                  minLat: values[minLatIdx],
                  maxLng: values[maxLngIdx],
                  maxLat: values[maxLatIdx]
                })
              }
            }
          } else {
            // Log if bounds columns not found
            if (index.length < 5) {
              console.warn(`[MapNew] Bounds columns not found. Indices:`, {
                minLngIdx, minLatIdx, maxLngIdx, maxLatIdx
              })
            }
          }
          
          index.push(entry)
        }
      }
    }
    
    glacierSearchIndex.value = index
    console.log(`[MapNew] ✓ Successfully loaded ${index.length} glaciers into search index`)
    if (index.length > 0) {
      console.log('[MapNew] Sample entry:', index[0])
      // Check how many entries have bounds
      const entriesWithBounds = index.filter(e => e.bounds).length
      console.log(`[MapNew] Entries with bounds: ${entriesWithBounds} out of ${index.length}`)
      if (entriesWithBounds === 0) {
        console.warn('[MapNew] ⚠️ No entries have bounds! Check if CSV has min_lng, min_lat, max_lng, max_lat columns')
      }
    }
  } catch (error) {
    console.error('[MapNew] Error loading glacier search index:', error)
    console.error('[MapNew] Error details:', error.message, error.stack)
  }
}

const handleSearch = async (query) => {
  const trimmedQuery = query.trim().toLowerCase()
  
  if (!trimmedQuery) {
    searchResults.value = []
    showSearchResults.value = false
    return
  }
  
  // If search index is not loaded, try loading it
  if (glacierSearchIndex.value.length === 0) {
    console.log('[MapNew] Search index not loaded, attempting to load...')
    await loadGlacierSearchIndex()
    
    if (glacierSearchIndex.value.length === 0) {
      console.warn('[MapNew] Search index still not available after loading attempt')
      searchResults.value = []
      showSearchResults.value = false
      return
    }
  }
  
  // Search through the index
  const matches = glacierSearchIndex.value
    .filter(glacier => {
      const name = (glacier.name || '').toLowerCase()
      const sgiId = (glacier.sgi_id || '').toLowerCase()
      return name.includes(trimmedQuery) || sgiId.includes(trimmedQuery)
    })
    .slice(0, 10) // Limit to 10 results
    .map(glacier => ({
      id: glacier.mapbox_id,
      name: glacier.name || 'Unnamed Glacier',
      'sgi-id': glacier.sgi_id || null,
      'mapbox-id': glacier.mapbox_id,
      bounds: glacier.bounds || null
    }))
  
  searchResults.value = matches
  showSearchResults.value = matches.length > 0
  console.log(`[MapNew] Search for "${query}" found ${matches.length} results`)
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
      map.value.fitBounds(
        [[result.bounds.min_lng, result.bounds.min_lat], [result.bounds.max_lng, result.bounds.max_lat]],
        {
          padding: { top: 100, bottom: 100, left: 100, right: 100 },
          duration: 1000
        }
      )
      
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
      updateLayerColors()
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
    updateLayerColors()
    
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
          map.value.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
            padding: { top: 100, bottom: 100, left: 100, right: 100 },
            duration: 1000
          })
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

const zoomToGlacierExtent = () => {
  if (!map.value || !selectedGlacier.value) {
    console.warn('[MapNew] Cannot zoom: map or glacier not available')
    return
  }
  
  const mapboxId = selectedGlacier.value['mapbox-id'] || selectedGlacier.value.id
  if (!mapboxId) {
    console.warn('[MapNew] Cannot zoom: no mapbox-id found')
    return
  }
  
  // Find the glacier in the search index to get its bounds
  const glacierEntry = glacierSearchIndex.value.find(entry => entry.mapbox_id === mapboxId)
  
  if (!glacierEntry || !glacierEntry.bounds) {
    console.warn('[MapNew] Cannot zoom: glacier bounds not found in mapping data')
    return
  }
  
  const { min_lng, min_lat, max_lng, max_lat } = glacierEntry.bounds
  
  try {
    map.value.fitBounds(
      [[min_lng, min_lat], [max_lng, max_lat]],
      {
        padding: { top: 100, bottom: 100, left: 100, right: 100 },
        duration: 1000
      }
    )
    console.log('[MapNew] ✓ Zoomed to glacier extent from mapping data')
  } catch (error) {
    console.error('[MapNew] Error zooming to glacier extent:', error)
  }
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
      'fill-opacity': getFillOpacity(),
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

// Zoom to full extent (center of Switzerland)
const handleZoomToExtent = () => {
  if (!map.value) return
  
  try {
    // Zoom to center of Switzerland with zoom level 8
    map.value.flyTo({
      center: [8.3818, 46.3621], // Center of Switzerland
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

.top-left-controls {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 1000;
  display: flex;
  flex-direction: row;
  gap: 8px;
  align-items: center;
}

.control-button {
  width: 40px;
  height: 40px;
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
  padding: 0;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  box-sizing: border-box;
}

.control-button:hover {
  background: #f5f5f5;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.control-button svg {
  width: 20px;
  height: 20px;
}

.control-button.is-3d {
  background: white;
  color: #333;
  border-color: #e5e5e5;
}

.control-button.is-3d:hover {
  background: #f5f5f5;
}

.basemap-toggle {
  display: flex;
  gap: 4px;
  background: #e5e5e5;
  border-radius: 8px;
  padding: 2px;
  height: 40px;
  box-sizing: border-box;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.basemap-toggle-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  font-size: 14px;
  font-weight: 500;
  color: #666;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  height: 100%;
  font-family: inherit;
}

.basemap-toggle-button:hover {
  color: #333;
}

.basemap-toggle-button.active {
  background: white;
  color: #333;
  font-weight: 600;
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

.zoom-to-glacier-dropdown {
  position: absolute;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999;
  width: 300px;
  min-width: 300px;
  max-width: 500px;
  box-sizing: border-box;
}

.zoom-to-glacier-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  background: #f5f5f5;
  border: 1px solid #e5e5e5;
  border-top: none;
  border-radius: 0 0 8px 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  font-size: 14px;
  color: #666;
  transition: all 0.2s;
  margin-top: -1px;
  box-sizing: border-box;
}

.zoom-to-glacier-button:hover {
  background: #e8e8e8;
  color: var(--color-glacier-default);
}

.zoom-to-glacier-button svg {
  flex-shrink: 0;
  color: currentColor;
}

/* Smooth fade transition for zoom button */
.zoom-button-fade-enter-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.zoom-button-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.zoom-button-fade-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px);
}

.zoom-button-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px);
}

.zoom-button-fade-enter-to,
.zoom-button-fade-leave-from {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
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

.imprint-button {
  position: absolute;
  top: 20px;
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

/* Imprint Modal */
.imprint-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.imprint-modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.imprint-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e5e5;
}

.imprint-modal-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #333;
  letter-spacing: 2px;
}

.imprint-modal-close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  border-radius: 4px;
  transition: background-color 0.2s, color 0.2s;
}

.imprint-modal-close:hover {
  background: #f5f5f5;
  color: #333;
}

.imprint-modal-close svg {
  width: 20px;
  height: 20px;
}

.imprint-modal-content {
  padding: 24px;
}

.project-description {
  margin: 0 0 24px 0;
  font-size: 14px;
  color: #666;
  line-height: 1.6;
}

.map-attributions,
.data-attributions {
  font-size: 12px;
  color: #999;
  margin-bottom: 16px;
}

.data-attributions:last-child {
  margin-bottom: 0;
}

.map-attributions h2,
.data-attributions h2 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #666;
}

.attribution-line {
  margin: 0;
  font-size: 12px;
  color: #999;
  line-height: 1.4;
}

.map-attributions a,
.data-attributions a {
  color: #1E90FF;
  text-decoration: none;
  transition: color 0.2s;
  font-size: 12px;
}

.map-attributions a:hover,
.data-attributions a:hover {
  color: #0066CC;
  text-decoration: underline;
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
