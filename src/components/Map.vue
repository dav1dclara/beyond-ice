<template>
  <div class="map-viewer">
    <div ref="mapboxCanvas" class="mapbox-canvas"></div>
    
    <Transition name="fade">
      <MapLoadOverlay v-if="!mapLoaded" @load="initializeMap" />
    </Transition>
    
    <!-- Visualization controls below the toggle button (only in dynamic mode) -->
    <div v-if="mapLoaded && mapMode === 'dynamic'" class="visualization-controls-wrapper">
      <VisualizationControls 
        v-model="visualization"
        :is-static-mode="mapMode === 'overlay'"
        @update:modelValue="handleVisualizationChange"
      />
    </div>
    
    <!-- Year toggle bar in overlay mode -->
    <div v-if="mapLoaded && mapMode === 'overlay'" class="year-toggle-bar">
      <div class="year-toggle-header">
        <span class="year-toggle-title">Years</span>
        <button
          @click="toggleAllYears"
          class="year-toggle-all-button"
          :title="allYearsVisible ? 'Hide all' : 'Show all'"
        >
          {{ allYearsVisible ? 'Hide All' : 'Show All' }}
        </button>
      </div>
      <div class="year-toggle-options">
        <label
          v-for="year in decadeYears"
          :key="year"
          class="year-toggle-option"
          :class="{ 'active': visibleYears.has(year) }"
        >
          <input
            type="checkbox"
            :checked="visibleYears.has(year)"
            @change="toggleYear(year)"
            class="year-toggle-checkbox"
          />
          <div 
            class="year-toggle-color-indicator"
            :style="{ backgroundColor: getYearColor(year) }"
          ></div>
          <span class="year-toggle-label">{{ year }}</span>
        </label>
      </div>
    </div>
    
    <!-- Tooltip for glacier properties -->
    <div 
      v-if="tooltip.visible && tooltip.feature" 
      class="glacier-tooltip"
      :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
    >
      <div class="tooltip-content">
        <div v-if="tooltip.feature.properties?.name" class="tooltip-title">
          {{ tooltip.feature.properties.name }}
        </div>
        <div class="tooltip-properties">
          <div v-if="tooltip.feature.properties?.['sgi-id']" class="tooltip-row">
            <span class="tooltip-label">SGI ID:</span>
            <span class="tooltip-value">{{ tooltip.feature.properties['sgi-id'] }}</span>
          </div>
          <div v-if="tooltip.feature.properties?.['Area change (%)'] !== undefined" class="tooltip-row">
            <span class="tooltip-label">Area Change:</span>
            <span class="tooltip-value">{{ tooltip.feature.properties['Area change (%)']?.toFixed(1) }}%</span>
          </div>
          <div v-if="tooltip.feature.properties?.['Volume change (%)'] !== undefined" class="tooltip-row">
            <span class="tooltip-label">Volume Change:</span>
            <span class="tooltip-value">{{ tooltip.feature.properties['Volume change (%)']?.toFixed(1) }}%</span>
          </div>
          <div v-if="tooltip.feature.properties?.Area !== undefined" class="tooltip-row">
            <span class="tooltip-label">Area:</span>
            <span class="tooltip-value">{{ tooltip.feature.properties.Area?.toFixed(2) }} km²</span>
          </div>
          <div v-if="tooltip.feature.properties?.Volume !== undefined" class="tooltip-row">
            <span class="tooltip-label">Volume:</span>
            <span class="tooltip-value">{{ tooltip.feature.properties.Volume?.toFixed(2) }} km³</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Map controls in top-right corner -->
    <div v-if="mapLoaded" class="top-right-controls">
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
          title="Aerial map"
        >
          Aerial
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
    
    <ProjectionControls 
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
import { TILESET_IDS } from '../config/mapbox.js'
import { PROJECTION_CONFIG } from '../config/projections.js'
import { COLORS } from '../config/colors.js'
import { swissImage } from '../config/mapStyles.js'
import SearchBar from './SearchBar.vue'
// import ProjectionTimeControls from './ProjectionTimeControls.vue'
import MapLoadOverlay from './MapLoadOverlay.vue'
import VisualizationControls from './VisualizationControls.vue'
import ProjectionControls from './ProjectionControls.vue'

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
  }
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

// Handle visualization change
const handleVisualizationChange = (mode) => {
  visualization.value = mode
  // Update the layer colors
  updateLayerColors()
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
    : 'mapbox://styles/mapbox/light-v11'
  
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

// Comparison mode state
const referenceScenario = ref('SSP2-4.5')
const comparisonScenario = ref('SSP5-8.5')

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

// Function to get color based on visualization mode
const getFillColor = () => {
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
    // Uniform visualization - default blue
    return COLORS.glacier.default
  }
}

const getOutlineColor = () => {
  // Use same color as fill for outline
  return getFillColor()
}

// Get outline width
const getOutlineWidth = () => {
  return 2
}


// Function to get fill opacity based on basemap mode
const getFillOpacity = () => {
  return isSatellite.value ? 0.8 : 0.6
}

// Function to update layer colors
const updateLayerColors = () => {
  const layerId = currentLayerId.value
  const outlineId = currentOutlineId.value
  
  if (!map.value) {
    return
  }
  
  if (map.value.getLayer(layerId)) {
    const fillColor = getFillColor()
    const fillOpacity = getFillOpacity()
    map.value.setPaintProperty(layerId, 'fill-color', fillColor)
    map.value.setPaintProperty(layerId, 'fill-opacity', fillOpacity)
  }
  
  // Update outline layer filter and color to show only selected glacier
  if (map.value.getLayer(outlineId)) {
    const filter = selectedFeatureId.value 
      ? ['==', ['id'], selectedFeatureId.value]
      : ['literal', false]
    map.value.setFilter(outlineId, filter)
    // Update outline color to match fill
    const outlineColor = getFillColor()
    map.value.setPaintProperty(outlineId, 'line-color', outlineColor)
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
    const slopeDegIdx = headerParts.findIndex(col => col === 'slope_deg' || col === 'slope-deg')
    const aspectDegIdx = headerParts.findIndex(col => col === 'aspect_deg' || col === 'aspect-deg')
    
    console.log('[MapNew] CSV columns found:', { mapboxIdIdx, nameIdx, sgiIdIdx, minLngIdx, minLatIdx, maxLngIdx, maxLatIdx, slopeDegIdx, aspectDegIdx, headerParts })
    
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
        maxLatIdx >= 0 ? maxLatIdx : -1,
        slopeDegIdx >= 0 ? slopeDegIdx : -1,
        aspectDegIdx >= 0 ? aspectDegIdx : -1
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
          
          // Add slope_deg and aspect_deg if available
          if (slopeDegIdx >= 0 && values.length > slopeDegIdx) {
            const slopeDeg = parseFloat(values[slopeDegIdx])
            if (!isNaN(slopeDeg)) {
              entry.slope_deg = slopeDeg
            }
          }
          
          if (aspectDegIdx >= 0 && values.length > aspectDegIdx) {
            const aspectDeg = parseFloat(values[aspectDegIdx])
            if (!isNaN(aspectDeg)) {
              entry.aspect_deg = aspectDeg
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

// Calculate optimal bearing and pitch from terrain
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
        console.log('[MapNew] Using aspect_deg from mapping:', {
          aspect_deg: glacierEntry.aspect_deg,
          bearing: bearing
        })
      } else {
        // Fallback to terrain calculation if aspect_deg not available
        const cameraAngle = calculateTerrainCameraAngle(bounds)
        bearing = cameraAngle.bearing
        pitch = cameraAngle.pitch
        console.log('[MapNew] Calculated terrain-based camera angle (aspect_deg not available):', { bearing, pitch })
      }
      
      // Use slope_deg from mapping CSV to calculate pitch if available
      if (glacierEntry.slope_deg !== undefined && glacierEntry.slope_deg !== null) {
        // Base pitch on slope: steeper slopes = higher pitch
        // Pitch range: 45-65 degrees
        pitch = 45 + (glacierEntry.slope_deg * 0.5) // Scale slope to pitch
        pitch = Math.min(65, Math.max(45, pitch)) // Clamp between 45-65 degrees
        console.log('[MapNew] Using slope_deg from mapping for pitch:', {
          slope_deg: glacierEntry.slope_deg,
          pitch: pitch
        })
      } else if (glacierEntry.aspect_deg === undefined || glacierEntry.aspect_deg === null) {
        // Only use terrain-calculated pitch if we also calculated bearing from terrain
        // (pitch was already set above in the fallback case)
      }
    }
    
    // Calculate appropriate zoom level based on bounds
    // This approximates what fitBounds would calculate
    const lngDiff = max_lng - min_lng
    const latDiff = max_lat - min_lat
    const maxDiff = Math.max(lngDiff, latDiff)
    
    // Calculate zoom level (approximation of fitBounds algorithm)
    // Account for padding (100px on each side = 200px total)
    const paddingFactor = 1.2 // Approximate padding adjustment
    const adjustedDiff = maxDiff * paddingFactor
    
    // Estimate zoom: smaller features need higher zoom
    let targetZoom = 12 // Default zoom
    if (adjustedDiff < 0.01) {
      targetZoom = 14 // Very small glacier
    } else if (adjustedDiff < 0.05) {
      targetZoom = 13 // Small glacier
    } else if (adjustedDiff < 0.1) {
      targetZoom = 12 // Medium glacier
    } else if (adjustedDiff < 0.2) {
      targetZoom = 11 // Large glacier
    } else {
      targetZoom = 10 // Very large glacier
    }
    
    // If 3D is enabled, fly to with terrain-based camera angle
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
      
      // Fly directly from current camera position to target
      map.value.flyTo({
        center: [centerLng, centerLat],
        zoom: targetZoom,
        bearing: bearing,
        pitch: pitch,
        duration: 2000,
        essential: true
      })
      console.log('[MapNew] ✓ Flying to glacier with 3D camera angle:', {
        bearing: bearing.toFixed(1) + '°',
        pitch: pitch.toFixed(1) + '°',
        zoom: targetZoom.toFixed(1)
      })
    } else {
      // 2D view - use fitBounds
      map.value.fitBounds(
        [[min_lng, min_lat], [max_lng, max_lat]],
        {
          padding: { top: 100, bottom: 100, left: 100, right: 100 },
          duration: 1000
        }
      )
      console.log('[MapNew] ✓ Zoomed to glacier extent from mapping data')
    }
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
// Function to get color for a specific year in overlay mode (gradient from 2020 to 2100)
const getYearColor = (year) => {
  const minYear = PROJECTION_CONFIG.MIN_YEAR
  const maxYear = PROJECTION_CONFIG.MAX_YEAR
  // Normalize year to 0-1 range (0 = 2020, 1 = 2100)
  const normalized = (year - minYear) / (maxYear - minYear)
  
  // Interpolate from blue (2020) to red (2100) for better visual distinction
  // Blue: #60A5FA (rgb(96, 165, 250))
  // Red: #EF4444 (rgb(239, 68, 68))
  const blue = { r: 96, g: 165, b: 250 }  // #60A5FA
  const red = { r: 239, g: 68, b: 68 }    // #EF4444
  
  const r = Math.round(blue.r + (red.r - blue.r) * normalized)
  const g = Math.round(blue.g + (red.g - blue.g) * normalized)
  const b = Math.round(blue.b + (red.b - blue.b) * normalized)
  
  return `rgb(${r}, ${g}, ${b})`
}

// Helper to get layer ID for a specific year in overlay mode
const getStaticLayerId = (proj, year) => `glacier-layer-${proj}-${year}`

// Helper to get layer ID for comparison mode
const getComparisonLayerId = (proj) => `glacier-layer-comparison-${proj}`
const getComparisonOutlineId = (proj) => `glacier-outline-comparison-${proj}`

// Clean up all overlay mode layers for a specific projection
const cleanupStaticLayers = (proj) => {
  if (!map.value) return
  
  // Remove all overlay layers for this projection
  for (let year = PROJECTION_CONFIG.MIN_YEAR; year <= PROJECTION_CONFIG.MAX_YEAR; year += 10) {
    const layerId = getStaticLayerId(proj, year)
    if (map.value.getLayer(layerId)) {
      map.value.removeLayer(layerId)
    }
  }
}

// Clean up all overlay mode layers for all projections
const cleanupAllStaticLayers = () => {
  if (!map.value) return
  
  // Get all available projections
  const projections = Object.keys(TILESET_IDS).filter(proj => TILESET_IDS[proj] !== null)
  
  // Remove all overlay layers for all projections
  projections.forEach(proj => {
    cleanupStaticLayers(proj)
  })
  
  console.log('[MapNew] Cleaned up all overlay mode layers')
}

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
      console.warn('[MapNew] Sources not ready for comparison mode')
      return
    }
    
    const refLayerId = getComparisonLayerId(referenceScenario.value)
    const compLayerId = getComparisonLayerId(comparisonScenario.value)
    
    // Create reference scenario layer (bottom layer, more transparent)
    map.value.addLayer({
      id: refLayerId,
      type: 'fill',
      source: refSourceId,
      'source-layer': sourceLayerName,
      paint: {
        'fill-color': '#60A5FA', // Blue for reference
        'fill-opacity': 0.5,
      },
    })
    
    // Create comparison scenario layer (top layer, less transparent)
    map.value.addLayer({
      id: compLayerId,
      type: 'fill',
      source: compSourceId,
      'source-layer': sourceLayerName,
      paint: {
        'fill-color': '#EF4444', // Red for comparison
        'fill-opacity': 0.6,
      },
    })
    
    console.log('[MapNew] Comparison mode layers created for reference:', referenceScenario.value, 'comparison:', comparisonScenario.value, 'year:', year)
    
    // Setup click handlers for comparison layers
    // Use a small delay to ensure layers are fully added to the map
    setTimeout(async () => {
      await setupClickHandler()
    }, 150)
    
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
    
    console.log(`[MapNew] ${mapMode.value} mode layers created for projection:`, proj, 'years:', decadeYears)
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
      'line-color': getFillColor(), // Match fill color
      'line-width': 3,
      'line-opacity': 1,
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
            updateLayerColors()
            
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
  // In comparison mode, query features from both layers at the click point
  // This ensures we get features even when layers overlap
  let features = []
  if (mapMode.value === 'comparison') {
    const refLayerId = getComparisonLayerId(referenceScenario.value)
    const compLayerId = getComparisonLayerId(comparisonScenario.value)
    
    // Query features from both layers at the click point
    const allFeatures = map.value.queryRenderedFeatures(e.point, {
      layers: [refLayerId, compLayerId]
    })
    
    console.log('[MapNew] Query found', allFeatures.length, 'features at click point in comparison mode', {
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
      console.warn('[MapNew] No features found at click point in comparison mode')
      return
    }
    
    features = allFeatures
  } else {
    // Regular mode: use features from event
    if (!e.features || e.features.length === 0) return
    features = e.features
  }
  
  // Use the topmost feature (first in array, which is the comparison layer in comparison mode)
  let selectedFeature = features[0]
  
  // If we have multiple features in comparison mode, prefer the comparison layer feature
  if (mapMode.value === 'comparison' && features.length > 1) {
    const compLayerId = getComparisonLayerId(comparisonScenario.value)
    const compFeature = features.find(f => f.layer?.id === compLayerId)
    if (compFeature) {
      selectedFeature = compFeature
    }
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
    
    console.log('[MapNew] Feature ID not in id field, trying properties:', {
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
    console.warn('[MapNew] Selected feature has no valid ID in any form', {
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
    console.warn('[MapNew] Feature ID is string "null", cannot use')
    return
  }
  
  console.log('[MapNew] Feature selected - ID:', featureId, 'from layer:', selectedFeature.layer?.id, 'total features:', features.length)
  
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
        
        console.log('[MapNew] 🧭 Using aspect_deg from mapping CSV:', {
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
          console.log('[MapNew] 🧭 Calculated bearing from terrain (mapping CSV not available):', {
            bearing: cameraAngle.bearing.toFixed(1) + '°',
            pitch: cameraAngle.pitch.toFixed(1) + '°',
            aspect: ((cameraAngle.bearing + 180) % 360).toFixed(1) + '°'
          })
        }
      }
    } catch (error) {
      console.warn('[MapNew] Error calculating bearing:', error)
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
  
  console.log('[MapNew] Comparing feature IDs:', {
    currentId,
    currentIdNormalized,
    newFeatureId: normalizedFeatureId,
    currentType: typeof currentId,
    newType: typeof normalizedFeatureId,
    isSameFeature,
    strictEqual: currentIdNormalized === normalizedFeatureId
  })
  
  // In comparison mode, don't allow deselection by clicking the same feature
  // (since overlapping layers can make it confusing)
  // Only allow deselection by clicking outside
  if (isSameFeature && mapMode.value !== 'comparison') {
    console.log('[MapNew] Deselecting feature (clicked same feature again)')
    selectedGlacier.value = null
    selectedFeatureId.value = null
    searchQuery.value = ''
  } else {
    console.log('[MapNew] Selecting feature, setting ID:', normalizedFeatureId, isSameFeature ? '(same feature, but keeping selected in comparison mode)' : '(new feature)')
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
  
  console.log('[MapNew] ✓ Feature selection updated, ID locked:', selectedFeatureId.value, {
    selectedGlacier: selectedGlacier.value,
    selectedFeatureId: selectedFeatureId.value
  })
}

// Named click-outside handler (set up only once)
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
      console.log('[MapNew] ✓ Deselected (clicked outside glacier)')
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
      console.log('[MapNew] ✓ Deselected (clicked outside glacier)')
    }
  }
}

// Setup click handler for feature selection
const setupClickHandler = async () => {
  if (!map.value) {
    console.warn('[MapNew] Cannot setup click handler: map not available')
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
        
        // In comparison mode, query both layers to get features even when overlapping
        let features = []
        if (mapMode.value === 'comparison') {
          const refLayerId = getComparisonLayerId(referenceScenario.value)
          const compLayerId = getComparisonLayerId(comparisonScenario.value)
          features = map.value.queryRenderedFeatures(e.point, {
            layers: [refLayerId, compLayerId]
          })
        } else {
          features = e.features || []
        }
        
        if (features.length > 0) {
          // Prefer comparison layer feature if available
          const compLayerId = mapMode.value === 'comparison' 
            ? getComparisonLayerId(comparisonScenario.value)
            : null
          const feature = compLayerId 
            ? features.find(f => f.layer?.id === compLayerId) || features[0]
            : features[0]
          
          const pointX = e.point.x
          const pointY = e.point.y
          
          tooltipTimer = setTimeout(() => {
            tooltip.value = {
              visible: true,
              feature: feature,
              x: pointX + 10,
              y: pointY - 10
            }
            tooltipTimer = null
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
      // Check if it's a comparison layer key (contains '-')
      if (oldLayerId.includes('-') && oldLayerId.includes('comparison')) {
        // It's a comparison layer key, try to remove from both layers
        const [refLayer, compLayer] = oldLayerId.split('-').slice(-2)
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
          tooltip.value = {
            visible: true,
            feature: feature,
            x: pointX + 10,
            y: pointY - 10
          }
          tooltipTimer = null
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

// Don't auto-initialize - wait for user to click "Load map"

// Watch for mode changes
watch(mapMode, (newMode, oldMode) => {
  if (!mapLoaded.value || !map.value) return
  
  if (newMode === 'overlay') {
    // When entering overlay mode, show all years by default
    visibleYears.value = new Set(decadeYears)
  } else if (oldMode === 'overlay') {
    // When switching away from overlay mode, clean up ALL overlay layers first
    cleanupAllStaticLayers()
  }
  
  // Clean up comparison layers when switching away from comparison mode
  if (oldMode === 'comparison') {
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
  updateLayerColors()
  
  if (newMode === 'dynamic') {
    // When switching to dynamic mode, setup click handler
    setupClickHandler()
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

/* Glacier tooltip */
.glacier-tooltip {
  position: absolute;
  pointer-events: none;
  z-index: 2000;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 0;
  max-width: 280px;
  font-size: 12px;
  line-height: 1.5;
}

.tooltip-content {
  padding: 12px;
}

.tooltip-title {
  font-weight: 600;
  font-size: 13px;
  color: #333;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e5e5;
}

.tooltip-properties {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}

.tooltip-label {
  color: #666;
  font-weight: 500;
  flex-shrink: 0;
}

.tooltip-value {
  color: #333;
  text-align: right;
  font-weight: 600;
}

.top-right-controls {
  position: absolute;
  top: 20px;
  right: 60px; /* Make room for imprint button */
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

.year-toggle-bar {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 1000;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  padding: 12px;
  min-width: 250px;
  box-sizing: border-box;
}

.year-toggle-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.year-toggle-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.year-toggle-all-button {
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 500;
  color: #666;
  background: #f5f5f5;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.year-toggle-all-button:hover {
  background: #e8e8e8;
  color: #333;
  border-color: #d0d0d0;
}

.year-toggle-options {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.year-toggle-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  user-select: none;
}

.year-toggle-option:hover {
  background: #f5f5f5;
}

.year-toggle-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
  margin: 0;
  flex-shrink: 0;
}

.year-toggle-color-indicator {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.year-toggle-label {
  font-size: 13px;
  color: #666;
  font-weight: 500;
  cursor: pointer;
}

.year-toggle-option.active .year-toggle-label {
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
  margin-left: 8px;
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
