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
          <span v-if="areaChange2020 !== null" class="change-indicator">
            ({{ formatChange(areaChange2020) }})
          </span>
        </div>
        <div v-if="displayVolume !== null" class="title-row title-area-volume">
          Volume: {{ formatAreaVolume(displayVolume) }} km³
          <span v-if="volumeChange2020 !== null" class="change-indicator">
            ({{ formatChange(volumeChange2020) }})
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
                    Math.max(2, chartHeight - getBarY(getChartValue(dataPoint)))
                  )"
                  :fill="dataPoint.year === currentYear ? '#4682B4' : '#87CEEB'"
                  @mouseenter="handleBarHover(dataPoint, index, $event)"
                  @mousemove="handleBarHover(dataPoint, index, $event)"
                  style="cursor: pointer;"
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
              Change: {{ formatChange(hoveredBar.change) }}
            </div>
          </div>
        </div>
      </div>
      <div class="timeslider-container">
        <!-- <div class="year-markers" :class="{ expanded: isExpanded }">
          <div
            v-for="year in yearMarkers"
            :key="year"
            class="year-marker"
            :style="getYearMarkerStyle(year)"
          ></div>
        </div> -->
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
</template>

<script setup>
import { ref, computed, watch } from 'vue'

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
  }
})

const emit = defineEmits(['projection-change', 'year-change'])

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
  emit('year-change', year)
}

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
    const scenarioFolderMap = {
      'SSP1-2.6': 'SSP126',
      'SSP2-4.5': 'SSP245',
      'SSP3-7.0': 'SSP370',
      'SSP5-8.5': 'SSP585'
    }
    
    const folder = scenarioFolderMap[props.selectedProjection]
    if (!folder) {
      chartData.value = []
      return
    }

    const years = []
    for (let year = props.minYear; year <= props.maxYear; year += props.step) {
      years.push(year)
    }

    const promises = years.map(async (year) => {
      try {
        const url = `${import.meta.env.BASE_URL}data/${folder}/${year}.geojson`
        const response = await fetch(url)
        const geojson = await response.json()
        
        if (props.selectedGlacier && props.selectedGlacier['mapbox-id']) {
          // Get data for selected glacier
          const mapboxId = props.selectedGlacier['mapbox-id']
          const feature = geojson.features.find(f => 
            f.properties?.['mapbox-id'] === mapboxId || 
            f.id === mapboxId
          )
          
          if (feature) {
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
            
            const areaChangePercent = props['Area change (%)'] ?? null
            const volumeChangePercent = props['Volume change (%)'] ?? null
            
            return {
              year,
              area: areaValue ?? 0,
              volume: volumeValue ?? 0,
              areaChange: areaChangePercent,
              volumeChange: volumeChangePercent
            }
          }
          return {
            year,
            area: 0,
            volume: 0,
            areaChange: null,
            volumeChange: null
          }
        } else {
          // Sum up all glaciers for overall view
          let totalArea = 0
          let totalVolume = 0

          geojson.features.forEach(feature => {
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

            totalArea += areaValue ?? 0
            totalVolume += volumeValue ?? 0
          })

          // Calculate percentage change from 2020 for overall
          // We'll need to load 2020 data for comparison
          let area2020 = 0
          let volume2020 = 0
          try {
            const url2020 = `${import.meta.env.BASE_URL}data/${folder}/2020.geojson`
            const response2020 = await fetch(url2020)
            const geojson2020 = await response2020.json()
            
            geojson2020.features.forEach(feature => {
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

              area2020 += areaValue ?? 0
              volume2020 += volumeValue ?? 0
            })
          } catch (error) {
            // If 2020 data can't be loaded, set to null
          }

          const areaChangePercent = area2020 > 0 ? ((totalArea - area2020) / area2020) * 100 : null
          const volumeChangePercent = volume2020 > 0 ? ((totalVolume - volume2020) / volume2020) * 100 : null

          return {
            year,
            area: totalArea,
            volume: totalVolume,
            areaChange: areaChangePercent,
            volumeChange: volumeChangePercent
          }
        }
      } catch (error) {
        console.warn(`[BarChart] Error loading data for year ${year}:`, error)
        return {
          year,
          area: 0,
          volume: 0,
          areaChange: null,
          volumeChange: null
        }
      }
    })

    const results = await Promise.all(promises)
    // Clear existing data before setting new data to prevent rendering old data
    chartData.value = []
    chartLoaded.value = false
    // Set new data
    chartData.value = results
    chartLoaded.value = true
  } catch (error) {
    console.error('[BarChart] Error loading chart data:', error)
    chartData.value = []
    chartLoaded.value = false
  } finally {
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
  return selectedMetric.value === 'area' ? dataPoint.area : dataPoint.volume
}

// Get tooltip unit
const getTooltipUnit = () => {
  return selectedMetric.value === 'area' ? 'km²' : 'km³'
}

// Get min and max values for the chart
const getChartMinMax = () => {
  if (chartData.value.length === 0) return { min: 0, max: 1 }
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
  // For 0 values, show a small bar at the bottom instead of no bar
  if (value === 0 || value === null || value === undefined) {
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

  try {
    const scenarioFolderMap = {
      'SSP1-2.6': 'SSP126',
      'SSP2-4.5': 'SSP245',
      'SSP3-7.0': 'SSP370',
      'SSP5-8.5': 'SSP585'
    }
    
    const folder = scenarioFolderMap[props.selectedProjection]
    if (!folder) {
      displayArea.value = null
      displayVolume.value = null
      areaChange2020.value = null
      volumeChange2020.value = null
      return
    }

    // Load current year data
    const currentYearUrl = `${import.meta.env.BASE_URL}data/${folder}/${props.currentYear}.geojson`
    const currentYearResponse = await fetch(currentYearUrl)
    const currentYearGeojson = await currentYearResponse.json()

    // Load 2020 data for comparison
    const year2020 = 2020
    const year2020Url = `${import.meta.env.BASE_URL}data/${folder}/${year2020}.geojson`
    const year2020Response = await fetch(year2020Url)
    const year2020Geojson = await year2020Response.json()

    let currentArea = 0
    let currentVolume = 0
    let area2020 = 0
    let volume2020 = 0

    if (props.selectedGlacier && props.selectedGlacier['mapbox-id']) {
      // Get area and volume for selected glacier
      const mapboxId = props.selectedGlacier['mapbox-id']
      const currentFeature = currentYearGeojson.features.find(f => 
        f.properties?.['mapbox-id'] === mapboxId || 
        f.id === mapboxId
      )
      const feature2020 = year2020Geojson.features.find(f => 
        f.properties?.['mapbox-id'] === mapboxId || 
        f.id === mapboxId
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
    } else {
      // Sum up total area and volume for all glaciers
      currentYearGeojson.features.forEach(feature => {
        const values = getAreaVolumeFromFeature(feature)
        currentArea += values.area
        currentVolume += values.volume
      })

      year2020Geojson.features.forEach(feature => {
        const values = getAreaVolumeFromFeature(feature)
        area2020 += values.area
        volume2020 += values.volume
      })
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

// Watch for changes - auto-load chart when glacier or projection changes (not on year changes)
watch([() => props.selectedGlacier, () => props.selectedProjection], () => {
  // Only reload if we have a projection
  if (props.selectedProjection) {
    const currentMapboxId = props.selectedGlacier?.['mapbox-id'] ?? null
    
    // Only reload if glacier or projection actually changed (not on year changes)
    const glacierChanged = currentMapboxId !== lastLoadedGlacierId.value
    const projectionChanged = props.selectedProjection !== lastLoadedProjection.value
    
    if (glacierChanged || projectionChanged) {
      // Clear chart immediately before loading
      chartData.value = []
      chartLoaded.value = false
      chartLoading.value = false
      lastLoadedGlacierId.value = currentMapboxId
      lastLoadedProjection.value = props.selectedProjection
      loadChartData()
    }
    // If same glacier and projection, don't reload - chart data is already loaded
  } else {
    // Clear chart if no projection
    chartData.value = []
    chartLoaded.value = false
    chartLoading.value = false
    lastLoadedGlacierId.value = null
    lastLoadedProjection.value = null
  }
}, { immediate: true })

// Watch for metric changes - clear chart and show loading state
watch(() => selectedMetric.value, () => {
  // Store current data before clearing
  const currentData = chartData.value.length > 0 ? [...chartData.value] : null
  
  // Clear chart data and show loading state
  chartData.value = []
  chartLoaded.value = false
  chartLoading.value = true
  hoveredBar.value = null
  
  // Add small delay before showing chart again (data already has both area and volume)
  setTimeout(() => {
    if (props.selectedProjection && currentData) {
      // Restore the data - it already contains both area and volume
      chartData.value = currentData
      chartLoading.value = false
      chartLoaded.value = true
    } else {
      chartLoading.value = false
    }
  }, 150)
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
  background: rgba(0, 0, 0, 0.85);
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

.timeslider-container {
  position: relative;
  width: calc(100% - var(--y-axis-width, 40px) - 8px);
  padding-bottom: 0;
  margin-left: calc(var(--y-axis-width, 40px) + 8px);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  --thumb-width: 18px;
  --thumb-offset: calc(var(--thumb-width) / 2);
  /* outline: orange dashed 2px; */
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
  background: #87CEEB;
  border: 2px solid white;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.time-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #87CEEB;
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
