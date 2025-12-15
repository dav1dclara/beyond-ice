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
      <div v-if="isExpanded" class="graph-container">
        <div v-if="selectedProjection" class="chart-svg-wrapper" @mouseleave="hoveredBar = null">
          <!-- Loading state -->
          <div v-if="chartLoading" class="chart-load-placeholder">
            <span class="loading-text">Loading chart data...</span>
          </div>
          <!-- Chart (shown when loaded) -->
          <div v-if="chartLoaded" class="chart-container">
            <div class="y-axis-labels">
              <div 
                class="y-axis-label y-axis-max"
                :style="{ top: `${(getBarY(yAxisMax) / chartHeight) * 100}%` }"
              >
                {{ formatYAxisValue(yAxisMax) }}
              </div>
              <div 
                class="y-axis-label y-axis-min"
                :style="{ top: `${(chartHeight / chartHeight) * 100}%` }"
              >
                0
              </div>
            </div>
            <div class="chart-svg-container">
              <svg class="bar-chart-svg" :viewBox="`0 0 ${chartWidth} ${chartHeight}`" preserveAspectRatio="none">
                <!-- Horizontal reference lines -->
                <line
                  :x1="-10"
                  :y1="chartHeight"
                  :x2="chartWidth"
                  :y2="chartHeight"
                  stroke="#d0d0d0"
                  stroke-width="1"
                  opacity="0.5"
                />
                <line
                  :x1="-10"
                  :y1="getBarY(yAxisMax)"
                  :x2="chartWidth"
                  :y2="getBarY(yAxisMax)"
                  stroke="#d0d0d0"
                  stroke-width="1"
                  opacity="0.5"
                />
                <!-- Bars -->
                <path
                  v-for="(dataPoint, index) in chartData"
                  :key="`bar-${index}`"
                  :d="getBarPath(
                    getBarX(index),
                    getBarY(getChartValue(dataPoint)),
                    barWidth,
                    getChartValue(dataPoint) === null ? 0.1 : Math.max(2, chartHeight - getBarY(getChartValue(dataPoint)))
                  )"
                  :fill="dataPoint.year === currentYear ? COLORS.chart.barCurrentYear : COLORS.chart.barDefault"
                  :opacity="getChartValue(dataPoint) === null ? 0 : 1"
                  @mouseenter="getChartValue(dataPoint) !== null && handleBarHover(dataPoint, index, $event)"
                  @mousemove="getChartValue(dataPoint) !== null && handleBarHover(dataPoint, index, $event)"
                  @click="getChartValue(dataPoint) !== null && handleBarClick(dataPoint)"
                  :style="{ cursor: getChartValue(dataPoint) !== null ? 'pointer' : 'default' }"
                />
              </svg>
              <div class="chart-metric-toggle">
                <button
                  @click="selectedMetric = 'area'"
                  :class="{ active: selectedMetric === 'area' }"
                  class="metric-button"
                >
                  Area (km²)
                </button>
                <button
                  @click="selectedMetric = 'volume'"
                  :class="{ active: selectedMetric === 'volume' }"
                  class="metric-button"
                >
                  Volume (km³)
                </button>
              </div>
            </div>
          </div>
          <!-- Tooltip -->
          <div 
            v-if="hoveredBar !== null"
            class="chart-tooltip"
            :style="tooltipStyle"
          >
            <div class="tooltip-year">{{ hoveredBar.year }}</div>
            <div class="tooltip-value">
              {{ formatValue(hoveredBar.value) }} {{ getTooltipUnit() }}
            </div>
            <div v-if="hoveredBar.change !== null && hoveredBar.change !== undefined" class="tooltip-change">
              {{ formatChange(hoveredBar.change) }} since 2020
            </div>
          </div>
        </div>
      </div>
      <button
        @click="togglePlay"
        class="play-button"
        :title="isPlaying ? 'Pause animation' : 'Play animation'"
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
            class="time-slider"
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
  }
})

const emit = defineEmits(['projection-change', 'year-change'])

// Play animation state
const isPlaying = ref(false)
let playInterval = null
const playSpeed = 500 // milliseconds per year step

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
  const year = parseInt(event.target.value)
  // If user manually changes year while playing, stop animation
  if (isPlaying.value) {
    stopAnimation()
  }
  emit('year-change', year)
}

const handleBarClick = (dataPoint) => {
  // If user clicks on a bar while playing, stop animation
  if (isPlaying.value) {
    stopAnimation()
  }
  emit('year-change', dataPoint.year)
}

// Toggle play/pause animation
const togglePlay = () => {
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

// Bar chart data and calculations
const chartData = ref([])
const chartWidth = 400
const chartHeight = 120
const barWidth = 8
const selectedMetric = ref('area')
const hoveredBar = ref(null)
const tooltipStyle = ref({})
const chartLoaded = ref(false)
const chartLoading = ref(false)
const lastLoadedGlacierId = ref(null)
const lastLoadedProjection = ref(null)

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

const loadChartData = async () => {
  if (!props.selectedProjection) {
    chartData.value = []
    chartLoaded.value = false
    chartLoading.value = false
    return
  }

  // Clear existing chart data immediately
  chartData.value = []
  chartLoaded.value = false
  chartLoading.value = true
  
  try {
    const years = []
    for (let year = props.minYear; year <= props.maxYear; year += props.step) {
      years.push(year)
    }

    const glacierId = props.selectedGlacier?.id ?? null
    const isOverallView = !glacierId
    
    // For overall view, ALWAYS use CSV (no fallback to tileset)
    if (isOverallView) {
      const csvData = await loadOverallDataFromCSV(props.selectedProjection)
      
      if (csvData && csvData.length > 0) {
        // Filter to only years we need and sort
        const filteredData = csvData
          .filter(d => years.includes(d.year))
          .sort((a, b) => a.year - b.year)
        
        // Add small delay to ensure loading state is visible
        await new Promise(resolve => setTimeout(resolve, 200))
        
        chartData.value = filteredData
        chartLoaded.value = true
        chartLoading.value = false
        return
      }
      
      // CSV not available - show error/empty state (no fallback)
      console.error('[BarChart] CSV file not available for overall view. Please generate CSV files first.')
      await new Promise(resolve => setTimeout(resolve, 200))
      chartData.value = []
      chartLoaded.value = false
      chartLoading.value = false
      return
    }
    
    // For individual glacier, use tileset
    if (!props.map || !props.getSourceId) {
      chartData.value = []
      chartLoaded.value = false
      chartLoading.value = false
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
      console.error(`[BarChart] Source not ready after ${maxRetries} retries for projection: ${props.selectedProjection}`)
      chartData.value = []
      chartLoaded.value = false
      chartLoading.value = false
      return
    }
    
    const results = []
    
    // Process all years for individual glacier (overall view uses CSV only)
    const processYears = async () => {
      try {
        // Process all years at once for individual glacier (fast)
        const batchSize = years.length
        
        for (let i = 0; i < years.length; i += batchSize) {
          const batch = years.slice(i, Math.min(i + batchSize, years.length))
          
          // Process batch synchronously
          for (const year of batch) {
            try {
              const features = queryTilesetFeatures(props.selectedProjection, year)
              
              // Get data for selected glacier (overall view uses CSV only)
              const feature = features.find(f => 
                f.id === glacierId || 
                String(f.id) === String(glacierId)
              )
              
              if (feature) {
                const featureProps = feature.properties || {}
                const { area, volume } = extractAreaVolume(featureProps)
                const areaChangePercent = featureProps['Area change (%)'] ?? null
                const volumeChangePercent = featureProps['Volume change (%)'] ?? null
                
                results.push({
                  year,
                  area,
                  volume,
                  areaChange: areaChangePercent,
                  volumeChange: volumeChangePercent,
                  exists: true
                })
              } else {
                // Glacier doesn't exist in this year - set values to null to hide the bar
                results.push({
                  year,
                  area: null,
                  volume: null,
                  areaChange: null,
                  volumeChange: null,
                  exists: false
                })
              }
            } catch (error) {
              console.warn(`[BarChart] Error loading data for year ${year}:`, error)
              results.push({
                year,
                area: null,
                volume: null,
                areaChange: null,
                volumeChange: null,
                exists: false
              })
            }
          }
          
          // Update chart incrementally
          chartData.value = [...results].sort((a, b) => a.year - b.year)
        }
        
        // Final update - ensure sorted
        chartData.value = results.sort((a, b) => a.year - b.year)
        chartLoaded.value = true
        chartLoading.value = false
      } catch (error) {
        console.error('[BarChart] Error in processYears:', error)
        // Show what we have so far
        chartData.value = results.sort((a, b) => a.year - b.year)
        chartLoaded.value = true
        chartLoading.value = false
      }
    }
    
    // Start processing
    processYears()
  } catch (error) {
    console.error('[BarChart] Error loading chart data:', error)
    chartData.value = []
    chartLoaded.value = false
    chartLoading.value = false
  }
}

const getBarX = (index) => {
  if (chartData.value.length === 0) return 0
  const spacing = (chartWidth - barWidth) / (chartData.value.length - 1 || 1)
  return index * spacing
}

// Get the chart value - always use absolute value
const getChartValue = (dataPoint) => {
  const value = selectedMetric.value === 'area' ? dataPoint.area : dataPoint.volume
  // Return null if glacier doesn't exist (to hide the bar)
  if (dataPoint.exists === false) {
    return null
  }
  return value
}

// Get tooltip unit
const getTooltipUnit = () => {
  return selectedMetric.value === 'area' ? 'km²' : 'km³'
}

// Get min and max values for the chart
const getChartMinMax = () => {
  if (chartData.value.length === 0) return { min: 0, max: 1 }
  // Filter out null values (glaciers that don't exist) for y-axis calculation
  const values = chartData.value.map(d => getChartValue(d)).filter(v => v !== null && v !== undefined)
  if (values.length === 0) return { min: 0, max: 1 }
  return {
    min: 0, // Always start from 0
    max: Math.max(...values)
  }
}

// Calculate rounded up max value for Y-axis
const yAxisMax = computed(() => {
  const { max } = getChartMinMax()
  if (max === 0) return 1
  
  // Round up to a nice number, but keep it closer to the actual max
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)))
  const normalized = max / magnitude
  
  // Nice numbers to round to
  const niceNumbers = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10]
  
  // Find the next nice number that's strictly greater than normalized
  // If normalized exactly matches a nice number, use the next one
  const rounded = niceNumbers.find(n => n > normalized) || 10
  
  return rounded * magnitude
})

// Format Y-axis value
const formatYAxisValue = (value) => {
  if (value < 0.01) {
    return value.toExponential(1)
  } else if (value < 1) {
    return value.toFixed(2)
  } else if (value < 100) {
    return value.toFixed(1)
  } else {
    return Math.round(value).toLocaleString()
  }
}

const getBarY = (value) => {
  if (chartData.value.length === 0) return chartHeight
  const max = yAxisMax.value // Use rounded max for scaling
  const range = max || 1
  // If glacier doesn't exist (value is null), hide the bar completely
  if (value === null || value === undefined) {
    return chartHeight // Bar height will be 0
  }
  // For 0 values, show a small bar at the bottom instead of no bar
  if (value === 0) {
    return chartHeight - 2 // 2px bar height for zero values
  }
  return chartHeight - ((value / range) * chartHeight)
}

const getBarPath = (x, y, width, height) => {
  const radius = 4
  // Path for rectangle with only top corners rounded
  // Start from top-left (after rounded corner)
  return `M ${x + radius} ${y} 
          L ${x + width - radius} ${y} 
          Q ${x + width} ${y} ${x + width} ${y + radius} 
          L ${x + width} ${y + height} 
          L ${x} ${y + height} 
          L ${x} ${y + radius} 
          Q ${x} ${y} ${x + radius} ${y} 
          Z`
}

const handleBarHover = (dataPoint, index, event) => {
  // Get absolute value for display
  const absoluteValue = getChartValue(dataPoint)
  
  // Get relative change from first year
  let relativeChange = null
  if (chartData.value.length > 0) {
    const firstYearData = chartData.value[0]
    const firstYearValue = selectedMetric.value === 'area' ? firstYearData.area : firstYearData.volume
    const currentValue = selectedMetric.value === 'area' ? dataPoint.area : dataPoint.volume
    
    if (firstYearValue > 0 && firstYearValue !== null && firstYearValue !== undefined) {
      relativeChange = ((currentValue - firstYearValue) / firstYearValue) * 100
    }
  }
  
  hoveredBar.value = {
    year: dataPoint.year,
    value: absoluteValue,
    change: relativeChange
  }
  
  // Position tooltip near the cursor
  const svgElement = event.currentTarget.closest('.chart-svg-wrapper')
  if (svgElement) {
    const rect = svgElement.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    // Calculate tooltip position, keeping it within bounds
    const tooltipWidth = 100 // Approximate tooltip width
    const tooltipHeight = 50 // Approximate tooltip height
    let left = x + 10
    let top = y - 40
    
    // Keep tooltip within wrapper bounds
    if (left + tooltipWidth > rect.width) {
      left = x - tooltipWidth - 10
    }
    if (top < 0) {
      top = y + 20
    }
    if (top + tooltipHeight > rect.height) {
      top = rect.height - tooltipHeight - 10
    }
    
    tooltipStyle.value = {
      left: `${Math.max(0, left)}px`,
      top: `${Math.max(0, top)}px`
    }
  }
}

const formatValue = (value) => {
  if (value === null || value === undefined || value === 0) {
    return '0'
  }
  
  // Format with appropriate decimal places for absolute values
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

// Helper to trigger chart loading
const triggerChartLoad = async (force = false) => {
  // Only reload if we have a projection
  if (!props.selectedProjection) {
    return
  }
  
  // For overall view, we don't need map to be loaded (uses CSV)
  const isOverallView = !props.selectedGlacier || !props.selectedGlacier.id
  if (!isOverallView && !props.mapLoaded) {
    return
  }
  
  const currentGlacierId = props.selectedGlacier?.id ?? null
  
  // Check if view type changed (overall <-> glacier) or glacier changed
  const wasOverallView = lastLoadedGlacierId.value === null
  const isNowOverallView = currentGlacierId === null
  const viewTypeChanged = wasOverallView !== isNowOverallView
  const glacierChanged = currentGlacierId !== lastLoadedGlacierId.value
  const projectionChanged = props.selectedProjection !== lastLoadedProjection.value
  
  // IMPORTANT: Only reload if glacier or projection changed, NOT on year changes
  const hasActualChange = viewTypeChanged || glacierChanged || projectionChanged
  
  // Only proceed if forced, or if there's an actual change
  // If chartLoading is already true but there's no actual change, don't reload
  if (!force && !hasActualChange) {
    // No actual change detected - don't reload
    // This prevents reloads when only year changes
    return
  }
  
  // Ensure loading state is shown
  if (!chartLoading.value) {
    chartData.value = []
    chartLoaded.value = false
    chartLoading.value = true
  }
  
  // Update tracking variables AFTER we've determined we should load
  // This ensures the next change will be detected
  lastLoadedGlacierId.value = currentGlacierId
  lastLoadedProjection.value = props.selectedProjection
  
  // If projection changed, add a small delay to ensure source is ready
  if (projectionChanged) {
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  
  loadChartData()
}

// Watch for map loaded - trigger initial load when map becomes ready
watch(() => props.mapLoaded, (loaded) => {
  if (loaded && props.selectedProjection) {
    // Map just became ready, trigger initial load
    triggerChartLoad(true)
  }
})

// Watch for changes - auto-load chart when glacier or projection changes (NOT on year changes)
watch([() => props.selectedGlacier, () => props.selectedProjection], async (newValues, oldValues) => {
  // Skip on initial immediate call if values haven't changed
  if (oldValues === undefined) {
    await triggerChartLoad()
    return
  }
  
  // Extract IDs for comparison (not object references)
  const newGlacier = newValues[0]
  const oldGlacier = oldValues[0]
  const newGlacierId = newGlacier?.id ?? null
  const oldGlacierId = oldGlacier?.id ?? null
  const newProjection = newValues[1]
  const oldProjection = oldValues[1]
  
  // Check if anything changed - compare IDs, not object references
  // This prevents false positives when objects are recreated with same ID
  const glacierIdChanged = newGlacierId !== oldGlacierId
  const projectionChanged = newProjection !== oldProjection
  
  // Only proceed if glacier ID or projection actually changed (NOT on year changes)
  if (!glacierIdChanged && !projectionChanged) {
    // Nothing changed, don't reload - this prevents reloads on year changes
    return
  }
  
  // If glacier or projection changed, clear chart immediately and wait 0.5 seconds
  // Clear chart immediately - make it blank
  chartData.value = []
  chartLoaded.value = false
  chartLoading.value = true
  
  // Wait 0.5 seconds before loading new data (chart stays blank during this time)
  await new Promise(resolve => setTimeout(resolve, 500))
  
  await triggerChartLoad()
}, { immediate: true })

// Watch for metric changes - clear chart and show loading state
watch(() => selectedMetric.value, async () => {
  // Store current data before clearing
  const currentData = chartData.value.length > 0 ? [...chartData.value] : null
  
  // Clear chart data immediately - make it blank
  chartData.value = []
  chartLoaded.value = false
  chartLoading.value = true
  hoveredBar.value = null
  
  // Wait 0.5 seconds before showing chart again (chart stays blank during this time)
  await new Promise(resolve => setTimeout(resolve, 500))
  
  if (props.selectedProjection && currentData) {
    // Restore the data - it already contains both area and volume
    chartData.value = currentData
    chartLoading.value = false
    chartLoaded.value = true
  } else {
    chartLoading.value = false
  }
})

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

.graph-container {
  position: relative;
  width: calc(100%);
  height: 150px;
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  /* outline: 2px dashed green; */
}

.glacier-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  gap: 8px;
}

.chart-metric-toggle {
  display: flex;
  gap: 4px;
  background: #e5e5e5;
  border-radius: 6px;
  padding: 2px;
}

.chart-mode-toggle {
  display: flex;
  gap: 4px;
  background: #e5e5e5;
  border-radius: 6px;
  padding: 2px;
}

.metric-button,
.mode-button {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  color: #666;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.metric-button:hover,
.mode-button:hover {
  color: #333;
}

.metric-button.active,
.mode-button.active {
  background: white;
  color: #333;
  font-weight: 600;
}

.chart-svg-wrapper {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 0;
}

.chart-load-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 120px;
}

.loading-text {
  font-size: 14px;
  color: #666;
}

.chart-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.chart-svg-container {
  position: relative;
  flex: 1;
  display: flex;
  align-items: stretch;
}

.y-axis-labels {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding-right: 8px;
  font-size: 12px;
  color: #666;
  width: var(--y-axis-width, 40px);
  height: 100%;
  position: relative;
  /* outline: 2px dashed red; */
}

.y-axis-label {
  white-space: nowrap;
  position: absolute;
  /* outline: 2px dashed blue; */
}

.y-axis-max {
  transform: translateY(-50%);
}

.y-axis-min {
  transform: translateY(-50%);
}

.bar-chart-svg {
  flex: 1;
  height: 100%;
  display: block;
  /* outline: green solid 2px; */
}

.chart-svg-container .chart-metric-toggle {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  background: #e5e5e5 !important;
  border-radius: 6px;
  padding: 2px;
  z-index: 10;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.chart-tooltip {
  position: absolute;
  background: rgba(117, 116, 116, 0.85);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  pointer-events: none;
  z-index: 1000;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.tooltip-year {
  font-weight: 600;
  margin-bottom: 2px;
}

.tooltip-value {
  font-size: 11px;
  opacity: 0.9;
}

.tooltip-change {
  font-size: 11px;
  opacity: 0.8;
  margin-top: 2px;
}

.play-button {
  position: absolute;
  left: 16px;
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

.play-button:hover {
  background: #f5f5f5;
  transform: scale(1.05);
  border-color: #d0d0d0;
}

.play-button svg {
  width: 16px;
  height: 16px;
}

.timeslider-container {
  position: relative;
  margin-left: calc(var(--y-axis-width, 40px) + 24px);
  margin-right: 8px;
  width: calc(100% - var(--y-axis-width, 40px) - 24px);
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
