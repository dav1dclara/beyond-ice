<template>
  <div class="evolution-graph">
    <div class="graph-header">
      <div class="graph-title">Evolution Over Time</div>
      <div class="graph-controls">
        <div class="metric-selector-wrapper">
          <button 
            @click="toggleMetricDropdown" 
            class="metric-selector-button"
            :class="{ 'open': isMetricDropdownOpen }"
          >
            <span>{{ selectedMetric === 'area' ? 'Area' : 'Volume' }}</span>
            <svg 
              class="dropdown-arrow" 
              :class="{ 'rotated': isMetricDropdownOpen }"
              width="12" 
              height="12" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="2" 
              stroke-linecap="round" 
              stroke-linejoin="round"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          <div v-if="isMetricDropdownOpen" class="metric-dropdown-menu">
            <button 
              @click="selectMetric('area')" 
              class="metric-option"
              :class="{ 'active': selectedMetric === 'area' }"
            >
              Area
            </button>
            <button 
              @click="selectMetric('volume')" 
              class="metric-option"
              :class="{ 'active': selectedMetric === 'volume' }"
            >
              Volume
            </button>
          </div>
        </div>
        <button 
          @click="loadAreaEvolution" 
          class="load-graph-button"
          :disabled="loadingData || !selectedGlacier"
        >
          <svg 
            v-if="!loadingData"
            width="14" 
            height="14" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            stroke-width="2" 
            stroke-linecap="round" 
            stroke-linejoin="round"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          <span v-else class="loading-spinner"></span>
          <span>{{ loadingData ? 'Loading...' : 'Load Graph' }}</span>
        </button>
      </div>
    </div>
    <div class="graph-placeholder">
      <div v-if="!hasLoadedData && !loadingData" class="graph-empty">
        Click "Load Graph" to view evolution data
      </div>
      <div v-else-if="loadingData" class="graph-loading">
        Loading data...
      </div>
      <div v-else-if="areaData.length === 0" class="graph-empty">
        No data available
      </div>
      <svg v-else class="graph-svg" viewBox="0 0 280 180" preserveAspectRatio="xMidYMid meet">
        <!-- Grid lines -->
        <defs>
          <pattern id="grid" width="40" height="30" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 30" fill="none" stroke="#e5e5e5" stroke-width="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)"/>
        
        <!-- Axes -->
        <line x1="30" y1="10" x2="30" y2="160" stroke="#666" stroke-width="1.5"/>
        <line x1="30" y1="160" x2="270" y2="160" stroke="#666" stroke-width="1.5"/>
        
        <!-- Area line/path -->
        <polyline
          v-if="areaData.length > 0"
          :points="graphPoints"
          fill="none"
          stroke="#87CEEB"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        
        <!-- Vertical line indicating current year -->
        <line
          v-if="getCurrentYearIndex >= 0"
          :x1="getPointX(getCurrentYearIndex)"
          :x2="getPointX(getCurrentYearIndex)"
          y1="10"
          y2="160"
          stroke="#4682B4"
          stroke-width="2"
          stroke-dasharray="4,4"
          opacity="0.6"
        />
        
        <!-- Area points -->
        <circle
          v-for="(d, i) in areaData"
          :key="`point-${i}`"
          :cx="getPointX(i)"
          :cy="getPointY(d.area)"
          :r="getCurrentYearIndex === i ? 5 : 3"
          :fill="getCurrentYearIndex === i ? '#4682B4' : '#87CEEB'"
          :stroke="getCurrentYearIndex === i ? '#2F4F4F' : 'white'"
          :stroke-width="getCurrentYearIndex === i ? 2 : 1"
          :class="{ 'current-year-point': getCurrentYearIndex === i }"
        />
        
        <!-- Axis labels -->
        <text x="150" y="175" text-anchor="middle" fill="#666" font-size="10" font-family="Arial, sans-serif">
          Year
        </text>
        
        <!-- Year labels on x-axis -->
        <text
          v-for="(d, i) in filteredYearLabels"
          :key="`year-${i}`"
          :x="getPointX(areaData.indexOf(d))"
          y="170"
          text-anchor="middle"
          fill="#666"
          font-size="9"
          font-family="Arial, sans-serif"
        >
          {{ d.year }}
        </text>
      </svg>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'

const props = defineProps({
  selectedGlacier: {
    type: Object,
    default: null
  },
  selectedProjection: {
    type: String,
    default: 'Current'
  },
  currentYear: {
    type: Number,
    default: null
  }
})

// Area evolution data
const areaData = ref([])
const loadingData = ref(false)
const selectedMetric = ref('area') // 'area' or 'volume'
const isMetricDropdownOpen = ref(false)
const hasLoadedData = ref(false) // Track if data has been loaded at least once

const toggleMetricDropdown = () => {
  isMetricDropdownOpen.value = !isMetricDropdownOpen.value
}

const selectMetric = (metric) => {
  selectedMetric.value = metric
  isMetricDropdownOpen.value = false
}

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  const container = event.target.closest('.metric-selector-wrapper')
  if (!container && isMetricDropdownOpen.value) {
    isMetricDropdownOpen.value = false
  }
}

// Get data file path based on projection and year
const getDataFilePath = (projection, yearValue) => {
  if (projection === 'Current') {
    return `${import.meta.env.BASE_URL}data/sgi2016.geojson`
  }
  
  const scenarioFolderMap = {
    'SSP1-2.6': 'SSP126',
    'SSP2-4.5': 'SSP245',
    'SSP3-7.0': 'SSP370',
    'SSP5-8.5': 'SSP585'
  }
  
  const folder = scenarioFolderMap[projection]
  if (!folder) {
    return `${import.meta.env.BASE_URL}data/sgi2016.geojson`
  }
  
  return `${import.meta.env.BASE_URL}data/${folder}/${yearValue}.geojson`
}

// Load area data for selected glacier across all timesteps
const loadAreaEvolution = async () => {
  if (!props.selectedGlacier || !props.selectedGlacier['mapbox-id']) {
    areaData.value = []
    hasLoadedData.value = false
    return
  }
  
  loadingData.value = true
  areaData.value = []
  hasLoadedData.value = true
  
  try {
    const mapboxId = props.selectedGlacier['mapbox-id']
    const dataPoints = []
    
    // For Current projection, only one data point
    if (props.selectedProjection === 'Current') {
      const url = getDataFilePath('Current', null)
      const response = await fetch(url)
      const geojson = await response.json()
      
      const feature = geojson.features.find(f => 
        f.properties?.['mapbox-id'] === mapboxId || 
        f.id === mapboxId
      )
      
      if (feature && feature.properties?.area_km2 !== undefined) {
        dataPoints.push({
          year: 2016,
          area: feature.properties.area_km2
        })
      }
    } else {
      // For projected scenarios, load data for all years (2020-2100, step 2)
      const years = []
      for (let year = 2020; year <= 2100; year += 2) {
        years.push(year)
      }
      
      // Load data for all years
      const promises = years.map(async (year) => {
        try {
          const url = getDataFilePath(props.selectedProjection, year)
          const response = await fetch(url)
          const geojson = await response.json()
          
          const feature = geojson.features.find(f => 
            f.properties?.['mapbox-id'] === mapboxId || 
            f.id === mapboxId
          )
          
          if (feature && feature.properties?.area_km2 !== undefined) {
            return {
              year,
              area: feature.properties.area_km2
            }
          }
          return null
        } catch (error) {
          console.warn(`[EvolutionGraph] Error loading data for year ${year}:`, error)
          return null
        }
      })
      
      const results = await Promise.all(promises)
      dataPoints.push(...results.filter(d => d !== null))
    }
    
    // Sort by year
    dataPoints.sort((a, b) => a.year - b.year)
    areaData.value = dataPoints
  } catch (error) {
    console.error('[EvolutionGraph] Error loading area evolution:', error)
    areaData.value = []
  } finally {
    loadingData.value = false
  }
}

// Track previous glacier and projection to detect changes
const previousGlacierId = ref(null)
const previousProjection = ref(null)

// Watch for changes in selected glacier or projection - clear data but don't reload
watch(() => [props.selectedGlacier?.['mapbox-id'], props.selectedProjection], ([newGlacierId, newProjection], [oldGlacierId, oldProjection]) => {
  // Only clear data if glacier ID or projection actually changed
  const glacierChanged = newGlacierId !== oldGlacierId
  const projectionChanged = newProjection !== oldProjection
  
  if (glacierChanged || projectionChanged) {
    // Clear data when glacier or projection changes, but don't auto-load
    areaData.value = []
    hasLoadedData.value = false
    previousGlacierId.value = newGlacierId
    previousProjection.value = newProjection
  }
  // If only year changes (not tracked here), keep the data
}, { deep: true })

// Computed properties for graph rendering
const graphPoints = computed(() => {
  if (areaData.value.length === 0) return ''
  
  const minArea = Math.min(...areaData.value.map(d => d.area))
  const maxArea = Math.max(...areaData.value.map(d => d.area))
  const range = maxArea - minArea || 1
  
  return areaData.value.map((d, i) => {
    const x = 30 + (i / (areaData.value.length - 1 || 1)) * 240
    const y = 160 - ((d.area - minArea) / range) * 140
    return `${x},${y}`
  }).join(' ')
})

const getPointY = (area) => {
  if (areaData.value.length === 0) return 160
  const minArea = Math.min(...areaData.value.map(d => d.area))
  const maxArea = Math.max(...areaData.value.map(d => d.area))
  const range = maxArea - minArea || 1
  return 160 - ((area - minArea) / range) * 140
}

const getPointX = (index) => {
  if (areaData.value.length === 0) return 30
  return 30 + (index / (areaData.value.length - 1 || 1)) * 240
}

const filteredYearLabels = computed(() => {
  if (areaData.value.length === 0) return []
  const step = Math.ceil(areaData.value.length / 5)
  return areaData.value.filter((_, i) => i % step === 0 || i === areaData.value.length - 1)
})

// Find the index of the current year in areaData, or the closest one
const getCurrentYearIndex = computed(() => {
  if (!props.currentYear || areaData.value.length === 0) return -1
  
  // Find exact match
  const exactIndex = areaData.value.findIndex(d => d.year === props.currentYear)
  if (exactIndex !== -1) return exactIndex
  
  // Find closest year
  let closestIndex = 0
  let minDiff = Math.abs(areaData.value[0].year - props.currentYear)
  
  for (let i = 1; i < areaData.value.length; i++) {
    const diff = Math.abs(areaData.value[i].year - props.currentYear)
    if (diff < minDiff) {
      minDiff = diff
      closestIndex = i
    }
  }
  
  // Only return if within reasonable range (e.g., within 2 years)
  return minDiff <= 2 ? closestIndex : -1
})

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.evolution-graph {
  margin-top: 0;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0;
}

.graph-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.graph-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.load-graph-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  color: white;
  background: #87CEEB;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  outline: none;
  white-space: nowrap;
}

.load-graph-button:hover:not(:disabled) {
  background: #5F9EA0;
  transform: translateY(-1px);
}

.load-graph-button:active:not(:disabled) {
  transform: translateY(0);
}

.load-graph-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.load-graph-button svg {
  width: 14px;
  height: 14px;
}

.loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.graph-title {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.metric-selector-wrapper {
  position: relative;
}

.metric-selector-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 500;
  color: #333;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  outline: none;
}

.metric-selector-button:hover {
  border-color: #87CEEB;
  background: #f9f9f9;
}

.metric-selector-button.open {
  border-color: #87CEEB;
  box-shadow: 0 0 0 2px rgba(135, 206, 235, 0.2);
}

.metric-selector-button .dropdown-arrow {
  width: 12px;
  height: 12px;
  color: #666;
  transition: transform 0.2s;
}

.metric-selector-button .dropdown-arrow.rotated {
  transform: rotate(180deg);
}

.metric-dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 100px;
  overflow: hidden;
}

.metric-option {
  display: block;
  width: 100%;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  color: #333;
  background: white;
  border: none;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s;
}

.metric-option:hover {
  background: #f5f5f5;
}

.metric-option.active {
  background: #e5e5e5;
  color: #333;
}

.graph-placeholder {
  width: 100%;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border-radius: 0;
  overflow: hidden;
  position: relative;
}

.graph-loading,
.graph-empty {
  color: #999;
  font-size: 14px;
  font-family: Arial, sans-serif;
}

.current-year-point {
  transition: r 0.2s, fill 0.2s, stroke-width 0.2s;
  filter: drop-shadow(0 0 3px rgba(70, 130, 180, 0.5));
}

.graph-svg {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
}
</style>
