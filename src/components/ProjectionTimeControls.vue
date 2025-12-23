<template>
  <div v-if="mapLoaded" class="projection-time-controls-wrapper">
    <div class="scenario-container">
      <div class="scenario-toggle-section">
        <span
          v-for="scenario in scenarios"
          :key="scenario"
          class="scenario-toggle-option"
          :class="{ 'selected': selectedProjection === scenario }"
          @click="selectScenario(scenario)"
        >
          {{ scenario }}
        </span>
      </div>
    </div>
    <div class="comparison-toggle-container">
      <div class="comparison-toggle-section">
        <span
          v-for="mode in comparisonModes"
          :key="mode"
          class="comparison-toggle-option"
          :class="{ 'selected': selectedComparisonMode === mode }"
          @click="selectComparisonMode(mode)"
        >
          {{ mode }}
        </span>
      </div>
    </div>
    <button
      @click="toggleExpand"
      class="expand-button"
      :title="isExpanded ? 'Collapse' : 'Expand'"
    >
      <div class="expand-button-content">
        <div class="title-row title-name">
          <span v-if="selectedGlacier">
            {{ selectedGlacier.name || 'Selected Glacier' }}
          </span>
          <span v-else>
            Overall
          </span>
        </div>
        <div class="title-row title-year">
          Year: {{ currentYear }}<span v-if="selectedProjection" class="change-indicator"> ({{ selectedProjection }})</span>
        </div>
        <div v-if="displayArea !== null" class="title-row title-area-volume">
          Area: {{ formatAreaVolume(displayArea) }} km²
          <span v-if="areaChange2020 !== null && currentYear !== 2020" class="change-indicator">
            ({{ formatChange(areaChange2020) }} since 2020)
          </span>
        </div>
        <div v-if="displayVolume !== null" class="title-row title-area-volume">
          Volume: {{ formatAreaVolume(displayVolume) }} km³
          <span v-if="volumeChange2020 !== null && currentYear !== 2020" class="change-indicator">
            ({{ formatChange(volumeChange2020) }} since 2020)
          </span>
        </div>
      </div>
      <span class="expand-icon">{{ isExpanded ? '▼' : '▲' }}</span>
    </button>
    <div class="main-container" :class="{ expanded: isExpanded }">
      <EvolutionGraph
        v-if="isExpanded"
        :selected-projection="selectedProjection"
        :selected-glacier="selectedGlacier"
        :current-year="currentYear"
        :min-year="minYear"
        :max-year="maxYear"
        :step="step"
        :map="map"
        :get-source-id="getSourceId"
        :map-loaded="mapLoaded"
        @year-change="handleBarClick"
      />
      <button
        @click="toggleNewButton"
        class="play-button new-button"
        :class="{ active: isNewButtonActive }"
        :title="isNewButtonActive ? 'Static mode (click to unlock and switch to dynamic)' : 'Dynamic mode (click to lock and switch to static)'"
      >
        <!-- Static mode icon: lock (when active) -->
        <svg v-if="isNewButtonActive" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="5" y="11" width="14" height="10" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <!-- Dynamic mode icon: unlock (when inactive) -->
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="5" y="11" width="14" height="10" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 8.13-3.13"/>
          <line x1="12" y1="11" x2="12" y2="7"/>
        </svg>
      </button>
      <button
        @click="togglePlay"
        class="play-button"
        :class="{ disabled: isNewButtonActive }"
        :disabled="isNewButtonActive"
        :title="isNewButtonActive ? 'Disabled' : (isPlaying ? 'Pause animation' : 'Play animation')"
      >
        <svg v-if="!isPlaying" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
        </svg>
      </button>
      <div class="timeslider-container">
        <!-- <div class="year-markers" :class="{ expanded: isExpanded }">
          <div
            v-for="year in yearMarkers"
            :key="year"
            class="year-marker"
            :style="getYearMarkerStyle(year)"
          ></div>
        </div> -->
        <div class="timeslider-wrapper">
          <input
            type="range"
            :min="minYear"
            :max="maxYear"
            :step="step"
            :value="currentYear"
            @input="handleYearChange"
            :disabled="isNewButtonActive"
            class="time-slider"
            :class="{ disabled: isNewButtonActive }"
          />
          <div class="year-labels">
          <span
            v-for="year in yearLabels"
            :key="year"
            :style="getYearLabelStyle(year)"
          >
            {{ year }}
          </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { COLORS } from '../config/colors.js'
import EvolutionGraph from './EvolutionGraph.vue'

const props = defineProps({
  mapLoaded: {
    type: Boolean,
    default: false
  },
  selectedProjection: {
    type: String,
    default: null
  },
  selectedGlacier: {
    type: Object,
    default: null
  },
  currentYear: {
    type: Number,
    default: 2020
  },
  minYear: {
    type: Number,
    default: 2020
  },
  maxYear: {
    type: Number,
    default: 2100
  },
  step: {
    type: Number,
    default: 2
  },
  map: {
    type: Object,
    default: null
  },
  getSourceId: {
    type: Function,
    default: null
  },
})

const emit = defineEmits(['projection-change', 'year-change', 'mode-change'])

// Play animation state
const isPlaying = ref(false)
let playInterval = null
const playSpeed = 500 // milliseconds per year step

// New button state
const isNewButtonActive = ref(false)

// Comparison mode state
const selectedComparisonMode = ref('default')
const comparisonModes = ['default', 'overlay', 'comparison']

const selectComparisonMode = (mode) => {
  selectedComparisonMode.value = mode
  // No functionality yet - just update the selection
}

const toggleNewButton = () => {
  isNewButtonActive.value = !isNewButtonActive.value
  // Stop animation if it's playing when disabling
  if (isNewButtonActive.value && isPlaying.value) {
    stopAnimation()
  }
  // Emit mode change event: 'static' when active, 'dynamic' when inactive
  emit('mode-change', isNewButtonActive.value ? 'static' : 'dynamic')
}

const scenarios = ['SSP1-2.6', 'SSP2-4.5', 'SSP3-7.0', 'SSP5-8.5']

const selectScenario = (scenario) => {
  // Only emit if not already on this scenario
  if (props.selectedProjection !== scenario) {
    emit('projection-change', scenario)
  }
}

const isExpanded = ref(false)

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
}

const handleYearChange = (event) => {
  // Don't allow year changes if new button is active
  if (isNewButtonActive.value) {
    return
  }
  const year = parseInt(event.target.value)
  // If user manually changes year while playing, stop animation
  if (isPlaying.value) {
    stopAnimation()
  }
  emit('year-change', year)
}

const handleBarClick = (year) => {
  // If user clicks on a bar while playing, stop animation
  if (isPlaying.value) {
    stopAnimation()
  }
  emit('year-change', year)
}

// Toggle play/pause animation
const togglePlay = () => {
  // Don't allow play if new button is active
  if (isNewButtonActive.value) {
    return
  }
  if (isPlaying.value) {
    stopAnimation()
  } else {
    startAnimation()
  }
}

// Check if selected glacier exists in a given year
const glacierExistsInYear = (year) => {
  if (!props.selectedGlacier || !props.selectedGlacier.id) {
    return true // If no glacier selected, always return true (for overall view)
  }
  
  const glacierId = props.selectedGlacier.id
  const features = queryTilesetFeatures(props.selectedProjection, year)
  
  // Check if the glacier exists in this year
  const exists = features.some(f => 
    f.id === glacierId || 
    String(f.id) === String(glacierId) ||
    f.properties?.['mapbox-id'] === glacierId ||
    String(f.properties?.['mapbox-id']) === String(glacierId)
  )
  
  return exists
}

// Start the animation
const startAnimation = () => {
  if (isPlaying.value) return
  
  isPlaying.value = true
  let currentYearValue = props.currentYear
  
  playInterval = setInterval(() => {
    // Calculate next year
    const nextYear = currentYearValue + props.step
    
    // If we've reached the max year, stop
    if (nextYear > props.maxYear) {
      currentYearValue = props.maxYear
      stopAnimation()
      return
    }
    
    // If a glacier is selected, check if it still exists in the next year
    if (props.selectedGlacier && props.selectedGlacier.id) {
      if (!glacierExistsInYear(nextYear)) {
        // Glacier no longer exists, stop at current year (last year it exists)
        stopAnimation()
        return
      }
    }
    
    // Move to next year
    currentYearValue = nextYear
    
    // Emit the year change
    emit('year-change', currentYearValue)
  }, playSpeed)
}

// Stop the animation
const stopAnimation = () => {
  isPlaying.value = false
  if (playInterval) {
    clearInterval(playInterval)
    playInterval = null
  }
}

// Watch for reaching max year and stop animation
watch(() => props.currentYear, (newYear) => {
  // If we've reached the max year while playing, stop
  if (newYear >= props.maxYear && isPlaying.value) {
    stopAnimation()
  }
})

// Cleanup on unmount
onBeforeUnmount(() => {
  stopAnimation()
})

const yearLabels = computed(() => {
  const labels = []
  const startYear = Math.ceil(props.minYear / 10) * 10
  const endYear = Math.floor(props.maxYear / 10) * 10
  
  for (let year = startYear; year <= endYear; year += 10) {
    labels.push(year)
  }
  
  // Always include min and max years if they're not already included
  if (labels[0] !== props.minYear) {
    labels.unshift(props.minYear)
  }
  if (labels[labels.length - 1] !== props.maxYear) {
    labels.push(props.maxYear)
  }
  
  return labels
})

const getYearLabelStyle = (year) => {
  const min = props.minYear
  const max = props.maxYear
  const percentage = ((year - min) / (max - min)) * 100
  
  return {
    position: 'absolute',
    left: `${percentage}%`,
    transform: 'translateX(-50%)'
  }
}

const yearMarkers = computed(() => {
  const markers = []
  for (let year = props.minYear; year <= props.maxYear; year += props.step) {
    markers.push(year)
  }
  return markers
})

const getYearMarkerStyle = (year) => {
  const min = props.minYear
  const max = props.maxYear
  const percentage = ((year - min) / (max - min)) * 100
  
  return {
    position: 'absolute',
    left: `${percentage}%`,
    transform: 'translateX(-50%)'
  }
}

// Chart-related code has been moved to EvolutionGraph.vue component

// Helper function to check if source is ready
const isSourceReady = (projection) => {
  if (!props.map || !props.getSourceId) return false
  
  const sourceId = props.getSourceId(projection)
  const source = props.map.getSource(sourceId)
  if (!source) return false
  
  // Check if source is loaded (for vector sources)
  if (source.type === 'vector') {
    // Check if source has loaded property or is ready
    if (source.loaded && typeof source.loaded === 'function') {
      return source.loaded()
    }
    // If no loaded function, assume it's ready if source exists
    return true
  }
  
  return false
}

// Helper function to query features from tileset for a specific year and projection
const queryTilesetFeatures = (projection, year) => {
  if (!props.map || !props.getSourceId) {
    console.warn('[BarChart] Cannot query: map or getSourceId not available')
    return []
  }
  
  const sourceId = props.getSourceId(projection)
  const source = props.map.getSource(sourceId)
  if (!source) {
    console.warn(`[BarChart] Source not found: ${sourceId} for projection: ${projection}`)
    return []
  }
  
  // For vector sources, need to specify source-layer (year)
  if (source.type === 'vector') {
    const sourceLayerName = year.toString()
    try {
      const features = props.map.querySourceFeatures(sourceId, {
        sourceLayer: sourceLayerName
      })
      return features || []
    } catch (error) {
      console.warn(`[BarChart] Error querying features for ${projection}/${year}:`, error)
      return []
    }
  }
  
  return []
}

// Helper to extract area/volume from feature properties
const extractAreaVolume = (featureProps) => {
  let areaValue = featureProps['Area (km2)'] ?? featureProps['area_km2'] ?? featureProps['Area'] ?? null
  
  if (areaValue === null || areaValue === undefined) {
    const areaKey = Object.keys(featureProps).find(key => 
      key.toLowerCase().includes('area') && 
      (key.includes('km2') || key.includes('km²'))
    )
    areaValue = areaKey ? featureProps[areaKey] : 0
  }
  
  const volumeValue = featureProps['Volume (km3)'] ?? 
                     featureProps['volume_km3'] ?? 
                     featureProps['Volume'] ??
                     featureProps['volume'] ?? 0

  return {
    area: areaValue ?? 0,
    volume: volumeValue ?? 0
  }
}

// Load overall data from CSV (much faster and more reliable)
const loadOverallDataFromCSV = async (projection) => {
  const scenarioFolderMap = {
    'SSP1-2.6': 'SSP126',
    'SSP2-4.5': 'SSP245',
    'SSP3-7.0': 'SSP370',
    'SSP5-8.5': 'SSP585'
  }
  
  const folder = scenarioFolderMap[projection]
  if (!folder) {
    console.warn(`[BarChart] Unknown projection: ${projection}`)
    return null
  }
  
  try {
    const csvUrl = `${import.meta.env.BASE_URL}data/${folder}_overall_totals.csv`
    const response = await fetch(csvUrl)
    
    if (!response.ok) {
      console.error(`[BarChart] CSV not found at ${csvUrl}`)
      return null
    }
    
    const csvText = await response.text()
    const lines = csvText.trim().split('\n')
    const headers = lines[0].split(',')
    
    // Find column indices
    const yearIndex = headers.indexOf('year')
    const areaIndex = headers.findIndex(h => h.toLowerCase().includes('area'))
    const volumeIndex = headers.findIndex(h => h.toLowerCase().includes('volume'))
    
    if (yearIndex === -1 || areaIndex === -1 || volumeIndex === -1) {
      console.warn('[BarChart] CSV missing required columns')
      return null
    }
    
    // Parse CSV data
    const data = []
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',')
      const year = parseInt(values[yearIndex])
      const area = parseFloat(values[areaIndex]) || 0
      const volume = parseFloat(values[volumeIndex]) || 0
      
      if (!isNaN(year)) {
        data.push({ year, area, volume })
      }
    }
    
    // Calculate percentage changes from 2020
    const baseline2020 = data.find(d => d.year === 2020)
    if (baseline2020) {
      return data.map(d => ({
        year: d.year,
        area: d.area,
        volume: d.volume,
        areaChange: baseline2020.area > 0 ? ((d.area - baseline2020.area) / baseline2020.area) * 100 : null,
        volumeChange: baseline2020.volume > 0 ? ((d.volume - baseline2020.volume) / baseline2020.volume) * 100 : null
      }))
    }
    
    return data.map(d => ({
      year: d.year,
      area: d.area,
      volume: d.volume,
      areaChange: null,
      volumeChange: null
    }))
  } catch (error) {
    console.warn('[BarChart] Error loading CSV:', error)
    return null
  }
}

// loadChartData has been moved to EvolutionGraph.vue component

// Chart-related functions have been moved to EvolutionGraph.vue component

// Area and volume for title display
const displayArea = ref(null)
const displayVolume = ref(null)
const areaChange2020 = ref(null)
const volumeChange2020 = ref(null)

const getAreaVolumeFromFeature = (feature) => {
  const props = feature.properties || {}
  let areaValue = props['Area (km2)'] ?? props['area_km2'] ?? props['Area'] ?? null
  
  if (areaValue === null || areaValue === undefined) {
    const areaKey = Object.keys(props).find(key => 
      key.toLowerCase().includes('area') && 
      (key.includes('km2') || key.includes('km²'))
    )
    areaValue = areaKey ? props[areaKey] : 0
  }
  
  const volumeValue = props['Volume (km3)'] ?? 
                     props['volume_km3'] ?? 
                     props['Volume'] ??
                     props['volume'] ?? 0

  return {
    area: areaValue ?? 0,
    volume: volumeValue ?? 0
  }
}

const loadAreaVolumeData = async () => {
  if (!props.selectedProjection) {
    displayArea.value = null
    displayVolume.value = null
    areaChange2020.value = null
    volumeChange2020.value = null
    return
  }

  const isOverallView = !props.selectedGlacier || !props.selectedGlacier.id

  // For overall view, use CSV data
  if (isOverallView) {
    try {
      const csvData = await loadOverallDataFromCSV(props.selectedProjection)
      
      if (csvData && csvData.length > 0) {
        // Find current year data
        const currentYearData = csvData.find(d => d.year === props.currentYear)
        const baseline2020 = csvData.find(d => d.year === 2020)
        
        if (currentYearData) {
          displayArea.value = currentYearData.area
          displayVolume.value = currentYearData.volume
          areaChange2020.value = currentYearData.areaChange
          volumeChange2020.value = currentYearData.volumeChange
        } else {
          displayArea.value = null
          displayVolume.value = null
          areaChange2020.value = null
          volumeChange2020.value = null
        }
      } else {
        displayArea.value = null
        displayVolume.value = null
        areaChange2020.value = null
        volumeChange2020.value = null
      }
      return
    } catch (error) {
      console.error('[Title] Error loading overall data from CSV:', error)
      displayArea.value = null
      displayVolume.value = null
      areaChange2020.value = null
      volumeChange2020.value = null
      return
    }
  }

  // For individual glacier, use tileset
  if (!props.map || !props.getSourceId) {
    displayArea.value = null
    displayVolume.value = null
    areaChange2020.value = null
    volumeChange2020.value = null
    return
  }

  // Wait for source to be ready (with retry logic)
  let retries = 0
  const maxRetries = 10
  const retryDelay = 100
  
  while (!isSourceReady(props.selectedProjection) && retries < maxRetries) {
    await new Promise(resolve => setTimeout(resolve, retryDelay))
    retries++
  }
  
  if (!isSourceReady(props.selectedProjection)) {
    console.warn(`[Title] Source not ready after ${maxRetries} retries for projection: ${props.selectedProjection}`)
    displayArea.value = null
    displayVolume.value = null
    areaChange2020.value = null
    volumeChange2020.value = null
    return
  }

  try {
    // Query current year data from tileset
    const currentYearFeatures = queryTilesetFeatures(props.selectedProjection, props.currentYear)
    
    // Query 2020 data for comparison
    const year2020Features = queryTilesetFeatures(props.selectedProjection, 2020)

    let currentArea = 0
    let currentVolume = 0
    let area2020 = 0
    let volume2020 = 0

    // Get area and volume for selected glacier
    const glacierId = props.selectedGlacier.id
    const currentFeature = currentYearFeatures.find(f => 
      f.id === glacierId || 
      String(f.id) === String(glacierId)
    )
    const feature2020 = year2020Features.find(f => 
      f.id === glacierId || 
      String(f.id) === String(glacierId)
    )

    if (currentFeature) {
      const current = getAreaVolumeFromFeature(currentFeature)
      currentArea = current.area
      currentVolume = current.volume
    }

    if (feature2020) {
      const baseline = getAreaVolumeFromFeature(feature2020)
      area2020 = baseline.area
      volume2020 = baseline.volume
    }

    displayArea.value = currentArea
    displayVolume.value = currentVolume

    // Calculate relative change since 2020
    if (area2020 > 0) {
      areaChange2020.value = ((currentArea - area2020) / area2020) * 100
    } else {
      areaChange2020.value = null
    }

    if (volume2020 > 0) {
      volumeChange2020.value = ((currentVolume - volume2020) / volume2020) * 100
    } else {
      volumeChange2020.value = null
    }
  } catch (error) {
    console.error('[Title] Error loading area/volume data:', error)
    displayArea.value = null
    displayVolume.value = null
    areaChange2020.value = null
    volumeChange2020.value = null
  }
}

const formatChange = (changePercent) => {
  if (changePercent === null || changePercent === undefined) return ''
  const sign = changePercent >= 0 ? '+' : ''
  return `${sign}${changePercent.toFixed(1)}%`
}

const formatAreaVolume = (value) => {
  if (value === null || value === undefined) return '0'
  if (value < 0.01) {
    return value.toExponential(2)
  } else if (value < 1) {
    return value.toFixed(3)
  } else if (value < 100) {
    return value.toFixed(2)
  } else {
    return value.toFixed(1)
  }
}

// Chart-related watchers have been moved to EvolutionGraph.vue component

// Watch for changes to load area/volume data
watch([() => props.selectedGlacier, () => props.selectedProjection, () => props.currentYear], () => {
  loadAreaVolumeData()
}, { immediate: true })
</script>

<style scoped>
.projection-time-controls-wrapper {
  position: absolute;
  bottom: 10px;
  left: 10px;
  right: 10px;
  z-index: 1001;
  box-sizing: border-box;
  /* outline: 2px solid red; */
}

.scenario-container {
  position: absolute;
  bottom: 100%;
  right: 10px;
  margin-bottom: 0;
  /* outline: 2px solid blue; */
  z-index: 1012;
}

.scenario-toggle-section {
  position: relative;
  display: flex;
  align-items: stretch;
  width: 400px;
  height: 32px;
  flex-shrink: 0;
  background: #e5e5e5;
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  clip-path: inset(-10px -10px 0 -10px);
  gap: 2px;
  /* outline: 2px solid red; */
  z-index: 1011;
}


.scenario-toggle-option {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 400;
  color: #666;
  transition: color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              font-weight 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              background 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              border-radius 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              margin-bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              padding-bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  position: relative;
  z-index: 1003;
  cursor: pointer;
  background: transparent;
  border: none;
  height: 100%;
  border-radius: 0;
}

.scenario-toggle-option:hover {
  color: #333;
  font-weight: 500;
}

.scenario-toggle-option:active {
  transform: scale(0.95);
}

.scenario-toggle-option.selected {
  color: #333;
  font-weight: 600;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
  border-bottom-left-radius: 0px;
  border-bottom-right-radius: 0px;
  z-index: 1010;
  position: relative;
  transform: scale(1.05);
  margin-bottom: -5px;
  padding-bottom: 5px;
  /* outline: 2px solid red; */
  transition: color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              font-weight 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              background 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              border-radius 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              margin-bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              padding-bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}


.main-container {
  --y-axis-width: 40px;
  position: relative;
  width: 100%;
  max-width: 100%;
  background: white;
  padding: 20px;
  padding-bottom: 10px;
  padding-left: 10px;
  padding-top: 10px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: padding-top 0.3s ease, min-height 0.3s ease;
  min-height: auto;
  z-index: 1001;
  /* outline: 2px solid blue; */
}

.main-container.expanded {
  height: calc(100%);
}

.title-container {
  position: relative;
  width: 100%;
  padding: 10px 0;
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  /* outline: 2px dashed red; */
}

.title-row {
  width: 100%;
  text-align: left;
}

.title-name {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.title-year {
  font-size: 14px;
  font-weight: 500;
  color: #666;
}

.title-area-volume {
  font-size: 14px;
  font-weight: 500;
  color: #666;
  white-space: nowrap;
}

.change-indicator {
  font-size: 12px;
  color: #999;
}

/* Chart-related CSS has been moved to EvolutionGraph.vue component */

.play-button {
  position: absolute;
  left: 56px; /* Moved right to make room for new button (16px + 32px + 8px gap) */
  bottom: 11px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  cursor: pointer;
  /* box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15); */
  transition: all 0.2s;
  color: #333;
  padding: 0;
  z-index: 1002;
}

.play-button.new-button {
  left: 16px; /* Position to the left of play button */
}

.play-button:hover:not(.disabled) {
  background: #f5f5f5;
  transform: scale(1.05);
  border-color: #d0d0d0;
}

.play-button.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.play-button.new-button.active {
  background: #e5e5e5;
  border-color: #d0d0d0;
}

.play-button svg {
  width: 16px;
  height: 16px;
}

.timeslider-container {
  position: relative;
  margin-left: calc(var(--y-axis-width, 40px) + 64px); /* Increased from 24px to 64px to accommodate both buttons (32px + 8px gap + 32px + 8px margin) */
  margin-right: 8px;
  width: calc(100% - var(--y-axis-width, 40px) - 64px);
  padding-bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  --thumb-width: 18px;
  --thumb-offset: calc(var(--thumb-width) / 2);
  /* outline: orange dashed 2px; */
}

.timeslider-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.year-markers {
  position: absolute;
  bottom: 24px;
  left: var(--thumb-offset);
  right: var(--thumb-offset);
  height: 6px;
  pointer-events: none;
  margin: 0;
  padding: 0;
  transition: height 0.3s ease, bottom 0.3s ease;
  /* outline: green solid 2px; */
}

.year-markers.expanded {
  height: 100px;
  bottom: 20px;
}

.year-marker {
  position: absolute;
  top: 0;
  width: 1px;
  height: 100%;
  background: #d0d0d0;
  opacity: 0.5;
}

.expand-button {
  position: absolute;
  bottom: 100%;
  left: 10px;
  margin-bottom: 0;
  min-width: 24px;
  width: auto;
  min-height: 32px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  background: white;
  border: 1px solid #e5e5e5;
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  border-bottom: none;
  cursor: pointer;
  font-size: 12px;
  color: #666;
  transition: all 0.2s;
  z-index: 10;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.15);
}

.expand-button-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  flex: 1;
  text-align: left;
}

.expand-button:hover {
  background: #f5f5f5;
  color: #333;
}

.expand-icon {
  font-size: 12px;
  color: #666;
  flex-shrink: 0;
  margin-top: 2px;
}


.comparison-toggle-container {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 0;
  z-index: 1012;
}

.comparison-toggle-section {
  position: relative;
  display: flex;
  align-items: stretch;
  width: 300px;
  height: 32px;
  flex-shrink: 0;
  background: #e5e5e5;
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  clip-path: inset(-10px -10px 0 -10px);
  gap: 2px;
  z-index: 1011;
}

.comparison-toggle-option {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 400;
  color: #666;
  transition: color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              font-weight 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              background 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              border-radius 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              margin-bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              padding-bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  position: relative;
  z-index: 1003;
  cursor: pointer;
  background: transparent;
  border: none;
  height: 100%;
  border-radius: 0;
}

.comparison-toggle-option:hover {
  color: #333;
  font-weight: 500;
}

.comparison-toggle-option:active {
  transform: scale(0.95);
}

.comparison-toggle-option.selected {
  color: #333;
  font-weight: 600;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
  border-bottom-left-radius: 0px;
  border-bottom-right-radius: 0px;
  z-index: 1010;
  position: relative;
  transform: scale(1.05);
  margin-bottom: -5px;
  padding-bottom: 5px;
  transition: color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              font-weight 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              background 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              border-radius 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              margin-bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              padding-bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.time-slider {
  position: relative;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #e5e5e5;
  -webkit-appearance: none;
  appearance: none;
  margin: 0 0 24px 0;
  padding: 0;
  z-index: 1;
  /* outline: green solid 2px; */
}

.time-slider.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.time-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-glacier-default);
  border: 2px solid white;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.time-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-glacier-default);
  border: 2px solid white;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.year-labels {
  position: absolute;
  bottom: 0;
  left: var(--thumb-offset);
  right: var(--thumb-offset);
  font-size: 12px;
  color: #666;
  height: 16px;
  box-sizing: border-box;
  z-index: 2;
  /* outline: blue solid 2px; */
}

.year-labels span {
  position: absolute;
  bottom: -4px;
  white-space: nowrap;
  /* outline: orange solid 2px; */
}

</style>
