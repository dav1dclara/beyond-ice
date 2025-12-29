<template>
  <div v-if="selectedProjection || isComparisonMode" class="graph-container" @mouseleave="hoveredBar = null">
    <!-- Loading state -->
    <div v-if="chartLoading" class="chart-load-placeholder">
      <span class="loading-text">Loading chart data...</span>
    </div>
    <!-- Chart (shown when loaded) -->
    <div v-if="chartLoaded && (chartData.length > 0 || comparisonChartData.length > 0)" class="chart-container">
      <div class="chart-title">
        {{ selectedGlacier?.name || 'Overall' }}
      </div>
      <div class="chart-content">
        <div class="y-axis-labels">
          <div 
            class="y-axis-label y-axis-max"
            :style="{ top: `${(getBarY(yAxisMax) / chartHeight) * 100}%` }"
          >
            {{ formatYAxisValue(yAxisMax) }}
          </div>
          <div 
            class="y-axis-label y-axis-middle"
            :style="{ top: '50%' }"
          >
            {{ getTooltipUnit() }}
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
          <template v-if="!isComparisonMode">
            <!-- Single bar mode (default/overlay) -->
            <path
              v-for="(dataPoint, index) in chartData"
              :key="`bar-${index}-${currentYear}`"
              :d="getBarPath(
                getBarX(index),
                getBarY(getChartValue(dataPoint)),
                barWidth,
                getChartValue(dataPoint) === null ? 0.1 : Math.max(2, chartHeight - getBarY(getChartValue(dataPoint)))
              )"
              :fill="dataPoint.year === currentYear ? '#d0d0d0' : COLORS.chart.barDefault"
              :opacity="getChartValue(dataPoint) === null ? 0 : (dataPoint.year === currentYear ? 1 : 0.7)"
              @mouseenter="getChartValue(dataPoint) !== null && handleBarHover(dataPoint, index, $event)"
              @mousemove="getChartValue(dataPoint) !== null && handleBarHover(dataPoint, index, $event)"
              @click="getChartValue(dataPoint) !== null && handleBarClick(dataPoint)"
              @mouseleave="hoveredBar = null"
              :style="{ cursor: getChartValue(dataPoint) !== null ? 'pointer' : 'default' }"
            />
          </template>
          <template v-else>
            <!-- Double bar mode (comparison) -->
            <template v-for="(dataPoint, index) in chartData" :key="`year-${dataPoint.year}`">
              <!-- Reference scenario bar (blue) -->
              <path
                v-if="getChartValue(dataPoint) !== null"
                :d="getBarPath(
                  getComparisonBarX(index, 'reference'),
                  getBarY(getChartValue(dataPoint)),
                  barWidth / 2,
                  Math.max(2, chartHeight - getBarY(getChartValue(dataPoint)))
                )"
                fill="#3B82F6"
                :opacity="dataPoint.year === currentYear ? 0.8 : 0.5"
                @mouseenter="handleBarHover(dataPoint, index, $event, 'reference')"
                @mousemove="handleBarHover(dataPoint, index, $event, 'reference')"
                @click="handleBarClick(dataPoint)"
                @mouseleave="hoveredBar = null"
                style="cursor: pointer"
              />
              <!-- Comparison scenario bar (orange) -->
              <path
                v-if="getComparisonValueForYear(dataPoint.year) !== null"
                :d="getBarPath(
                  getComparisonBarX(index, 'comparison'),
                  getBarY(getComparisonValueForYear(dataPoint.year)),
                  barWidth / 2,
                  Math.max(2, chartHeight - getBarY(getComparisonValueForYear(dataPoint.year)))
                )"
                fill="#F97316"
                :opacity="dataPoint.year === currentYear ? 0.8 : 0.5"
                @mouseenter="handleComparisonBarHover(dataPoint.year, index, $event)"
                @mousemove="handleComparisonBarHover(dataPoint.year, index, $event)"
                @click="handleComparisonBarClick(dataPoint.year)"
                @mouseleave="hoveredBar = null"
                style="cursor: pointer"
              />
            </template>
          </template>
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
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { COLORS } from '../config/colors.js'

console.log('[EvolutionGraph] Script setup executed')

const props = defineProps({
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
  mapLoaded: {
    type: Boolean,
    default: false
  },
  currentMode: {
    type: String,
    default: 'default'
  },
  referenceScenario: {
    type: String,
    default: 'SSP2-4.5'
  },
  comparisonScenario: {
    type: String,
    default: 'SSP5-8.5'
  }
})

const emit = defineEmits(['year-change'])

// Bar chart data and calculations
const chartData = ref([])
const comparisonChartData = ref([]) // Data for comparison scenario
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
const isComparisonMode = computed(() => {
  const result = props.currentMode === 'comparison'
  console.log('[EvolutionGraph] isComparisonMode computed:', {
    currentMode: props.currentMode,
    result: result,
    referenceScenario: props.referenceScenario,
    comparisonScenario: props.comparisonScenario
  })
  return result
})

// Debug: Log when component receives props
watch(() => props.currentMode, (newMode) => {
  console.log('[EvolutionGraph] currentMode changed:', newMode, 'isComparison:', isComparisonMode.value)
}, { immediate: true })

watch(() => [props.referenceScenario, props.comparisonScenario], ([ref, comp]) => {
  console.log('[EvolutionGraph] Scenarios changed:', { reference: ref, comparison: comp })
}, { immediate: true })

// Debug: Log component mount
onMounted(() => {
  console.log('[EvolutionGraph] Component mounted', {
    currentMode: props.currentMode,
    selectedProjection: props.selectedProjection,
    referenceScenario: props.referenceScenario,
    comparisonScenario: props.comparisonScenario,
    isComparisonMode: isComparisonMode.value
  })
})

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
    const csvUrl = `${import.meta.env.BASE_URL}data/${folder}_totals.csv`
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
  console.log('[EvolutionGraph] loadChartData called', {
    isComparisonMode: isComparisonMode.value,
    selectedProjection: props.selectedProjection,
    referenceScenario: props.referenceScenario,
    comparisonScenario: props.comparisonScenario,
    currentMode: props.currentMode
  })
  
  // In comparison mode, we need both scenarios
  if (isComparisonMode.value) {
    if (!props.referenceScenario || !props.comparisonScenario) {
      chartData.value = []
      comparisonChartData.value = []
      chartLoaded.value = false
      chartLoading.value = false
      return
    }
  } else {
    if (!props.selectedProjection) {
      chartData.value = []
      comparisonChartData.value = []
      chartLoaded.value = false
      chartLoading.value = false
      return
    }
  }

  // Clear existing chart data immediately
  chartData.value = []
  comparisonChartData.value = []
  chartLoaded.value = false
  chartLoading.value = true
  
  try {
    const years = []
    for (let year = props.minYear; year <= props.maxYear; year += props.step) {
      years.push(year)
    }

    const glacierId = props.selectedGlacier?.id ?? null
    const isOverallView = !glacierId
    
    // Helper function to load data for a single scenario
    const loadDataForScenario = async (projection) => {
      // For overall view, ALWAYS use CSV (no fallback to tileset)
      if (isOverallView) {
        const csvData = await loadOverallDataFromCSV(projection)
        
        if (csvData && csvData.length > 0) {
          // Filter to only years we need and sort
          return csvData
            .filter(d => years.includes(d.year))
            .sort((a, b) => a.year - b.year)
        }
        
        return []
      }
      
      // For individual glacier, use tileset
      if (!props.map || !props.getSourceId) {
        return []
      }
      
      // Wait for source to be ready (with retry logic)
      let retries = 0
      const maxRetries = 10
      const retryDelay = 100
      
      while (!isSourceReady(projection) && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        retries++
      }
      
      if (!isSourceReady(projection)) {
        console.warn(`[BarChart] Source not ready after ${maxRetries} retries for ${projection}`)
        return []
      }
      
      // Query features for each year
      const dataPoints = []
      for (const year of years) {
        const features = queryTilesetFeatures(projection, year)
        
        // Find the specific glacier
        const glacierFeature = features.find(f => {
          const fId = f.id || f.properties?.['mapbox-id'] || String(f.id)
          const gId = glacierId || String(glacierId)
          return String(fId) === String(gId) || fId === gId
        })
        
        if (glacierFeature) {
          const { area, volume } = extractAreaVolume(glacierFeature.properties)
          dataPoints.push({
            year,
            area,
            volume,
            exists: true
          })
        } else {
          // Glacier doesn't exist in this year
          dataPoints.push({
            year,
            area: 0,
            volume: 0,
            exists: false
          })
        }
      }
      
      return dataPoints
    }
    
    // Load data based on mode
    if (isComparisonMode.value) {
      // Load both scenarios in parallel
      const [refData, compData] = await Promise.all([
        loadDataForScenario(props.referenceScenario),
        loadDataForScenario(props.comparisonScenario)
      ])
      
      console.log('[EvolutionGraph] Comparison mode data loaded:', {
        reference: refData.length,
        comparison: compData.length,
        refScenario: props.referenceScenario,
        compScenario: props.comparisonScenario,
        refData: refData.slice(0, 3),
        compData: compData.slice(0, 3)
      })
      
      chartData.value = refData
      comparisonChartData.value = compData
      
      console.log('[EvolutionGraph] After assignment:', {
        chartDataLength: chartData.value.length,
        comparisonChartDataLength: comparisonChartData.value.length,
        chartDataYears: chartData.value.map(d => d.year),
        comparisonDataYears: comparisonChartData.value.map(d => d.year),
        firstRefData: chartData.value[0],
        firstCompData: comparisonChartData.value[0]
      })
    } else {
      // Load single scenario
      const data = await loadDataForScenario(props.selectedProjection)
      chartData.value = data
    }
    
    // Add small delay to ensure loading state is visible
    await new Promise(resolve => setTimeout(resolve, 200))
    
    chartLoaded.value = true
    chartLoading.value = false
    lastLoadedGlacierId.value = glacierId
    lastLoadedProjection.value = isComparisonMode.value ? `${props.referenceScenario}-${props.comparisonScenario}` : props.selectedProjection
  } catch (error) {
    console.error('[BarChart] Error loading chart data:', error)
    chartData.value = []
    chartLoaded.value = false
    chartLoading.value = false
  }
}

// Trigger chart load with optional force flag
const triggerChartLoad = async (force = false) => {
  const glacierId = props.selectedGlacier?.id ?? null
  const projectionKey = isComparisonMode.value 
    ? `${props.referenceScenario}-${props.comparisonScenario}`
    : props.selectedProjection
  
  // Skip if same glacier and projection (unless forced)
  if (!force && 
      lastLoadedGlacierId.value === glacierId && 
      lastLoadedProjection.value === projectionKey) {
    return
  }
  
  loadChartData()
}

const getBarX = (index) => {
  if (chartData.value.length === 0) return 0
  const spacing = (chartWidth - barWidth) / (chartData.value.length - 1 || 1)
  return index * spacing
}

// Get X position for comparison mode bars (half width, side by side)
const getComparisonBarX = (index, type) => {
  if (chartData.value.length === 0) return 0
  const spacing = (chartWidth - barWidth) / (chartData.value.length - 1 || 1)
  const baseX = index * spacing
  // Reference bar on left, comparison bar on right
  if (type === 'reference') {
    return baseX
  } else {
    return baseX + (barWidth / 2)
  }
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

// Get chart value for comparison scenario
const getComparisonChartValue = (dataPoint) => {
  const value = selectedMetric.value === 'area' ? dataPoint.area : dataPoint.volume
  if (dataPoint.exists === false) {
    return null
  }
  return value
}

// Get comparison value for a specific year (matches by year, not index)
const getComparisonValueForYear = (year) => {
  if (!comparisonChartData.value || comparisonChartData.value.length === 0) {
    return null
  }
  const compDataPoint = comparisonChartData.value.find(d => d.year === year)
  if (!compDataPoint) {
    return null
  }
  return getComparisonChartValue(compDataPoint)
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
  
  // In comparison mode, also include comparison data
  if (isComparisonMode.value && comparisonChartData.value.length > 0) {
    const comparisonValues = comparisonChartData.value.map(d => getComparisonChartValue(d)).filter(v => v !== null && v !== undefined)
    values.push(...comparisonValues)
  }
  
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

const handleBarHover = (dataPoint, index, event, scenarioType = null) => {
  // Get absolute value for display
  const absoluteValue = scenarioType === 'comparison' 
    ? getComparisonChartValue(dataPoint)
    : getChartValue(dataPoint)
  
  // Get relative change from first year
  let relativeChange = null
  const dataSource = scenarioType === 'comparison' ? comparisonChartData.value : chartData.value
  if (dataSource.length > 0) {
    const firstYearData = dataSource[0]
    const firstYearValue = selectedMetric.value === 'area' ? firstYearData.area : firstYearData.volume
    const currentValue = selectedMetric.value === 'area' ? dataPoint.area : dataPoint.volume
    
    if (firstYearValue > 0 && firstYearValue !== null && firstYearValue !== undefined) {
      relativeChange = ((currentValue - firstYearValue) / firstYearValue) * 100
    }
  }
  
  hoveredBar.value = {
    year: dataPoint.year,
    value: absoluteValue,
    change: relativeChange,
    scenario: scenarioType === 'comparison' ? props.comparisonScenario : (scenarioType === 'reference' ? props.referenceScenario : props.selectedProjection)
  }
  
  // Position tooltip near the cursor
  const svgElement = event.currentTarget.closest('.graph-container')
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

const handleBarClick = (dataPoint) => {
  emit('year-change', dataPoint.year)
}

const handleComparisonBarHover = (year, index, event) => {
  const compDataPoint = comparisonChartData.value.find(d => d.year === year)
  if (compDataPoint) {
    handleBarHover(compDataPoint, index, event, 'comparison')
  }
}

const handleComparisonBarClick = (year) => {
  emit('year-change', year)
}

const formatChange = (change) => {
  if (change === null || change === undefined) return ''
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(1)}%`
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

// Watch for map loaded - trigger initial load when map becomes ready
watch(() => props.mapLoaded, (loaded) => {
  if (loaded) {
    if (isComparisonMode.value) {
      if (props.referenceScenario && props.comparisonScenario) {
        triggerChartLoad(true)
      }
    } else {
      if (props.selectedProjection) {
        triggerChartLoad(true)
      }
    }
  }
})

// Watch for changes - auto-load chart when glacier, projection, mode, or scenarios change (NOT on year changes)
watch([() => props.selectedGlacier, () => props.selectedProjection, () => props.currentMode, () => props.referenceScenario, () => props.comparisonScenario], async (newValues, oldValues) => {
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
  const newMode = newValues[2]
  const oldMode = oldValues[2]
  const newRefScenario = newValues[3]
  const oldRefScenario = oldValues[3]
  const newCompScenario = newValues[4]
  const oldCompScenario = oldValues[4]
  
  // Check if anything changed - compare IDs, not object references
  // This prevents false positives when objects are recreated with same ID
  const glacierIdChanged = newGlacierId !== oldGlacierId
  const projectionChanged = newProjection !== oldProjection
  const modeChanged = newMode !== oldMode
  const refScenarioChanged = newRefScenario !== oldRefScenario
  const compScenarioChanged = newCompScenario !== oldCompScenario
  
  // Only proceed if glacier ID, projection, mode, or scenarios actually changed (NOT on year changes)
  if (!glacierIdChanged && !projectionChanged && !modeChanged && !refScenarioChanged && !compScenarioChanged) {
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
</script>

<style scoped>
.graph-container {
  position: relative;
  width: flex;
  height: 150px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
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
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.chart-title {
  font-size: 16px;
  font-weight: 500;
  color: #333;
  text-align: center;
  flex-shrink: 0;
}

.chart-content {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 8px;
  flex: 1;
  min-height: 0;
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
  padding-right: 0px;
  font-size: 12px;
  color: #666;
  width: var(--y-axis-width, 40px);
  height: 100%;
  position: relative;
}

.y-axis-label {
  white-space: nowrap;
  position: absolute;
}

.y-axis-max {
  transform: translateY(-50%);
}

.y-axis-middle {
  transform: translateY(-50%);
}

.y-axis-min {
  transform: translateY(-50%);
}

.bar-chart-svg {
  flex: 1;
  height: 100%;
  display: block;
}

.chart-svg-container .chart-metric-toggle {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  background: #FFFFFF;
  border-radius: 6px;
  padding: 2px;
  z-index: 10;
  border: 1px solid #e5e5e5;
}

.chart-metric-toggle {
  display: flex;
  gap: 4px;
  background: #FFFFFF;
  border-radius: 6px;
  padding: 2px;
}

.metric-button {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 400;
  color: #666666;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.metric-button:hover {
  background: #f5f5f5;
  color: #333333;
}

.metric-button.active {
  background: #f5f5f5;
  color: #333333;
  font-weight: 600;
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
</style>
