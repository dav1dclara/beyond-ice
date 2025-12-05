<template>
  <div v-if="mapLoaded" class="projection-time-controls-wrapper">
    <div 
      v-if="selectedProjection !== null"
      class="timeslider-container"
    >
      <div 
        v-if="selectedGlacier"
        class="bar-chart-container"
      >
        <div class="glacier-name">
          {{ selectedGlacier.name || 'Selected Glacier' }}
        </div>
        <div class="chart-header">
          <div class="chart-metric-toggle">
            <button
              @click="selectedMetric = 'area'"
              :class="{ active: selectedMetric === 'area' }"
              class="metric-button"
            >
              Area
            </button>
            <button
              @click="selectedMetric = 'volume'"
              :class="{ active: selectedMetric === 'volume' }"
              class="metric-button"
            >
              Volume
            </button>
          </div>
          <div class="chart-mode-toggle">
            <button
              @click="showPercentageChange = false"
              :class="{ active: !showPercentageChange }"
              class="mode-button"
            >
              Absolute
            </button>
            <button
              @click="showPercentageChange = true"
              :class="{ active: showPercentageChange }"
              class="mode-button"
            >
              Change %
            </button>
          </div>
        </div>
        <div class="chart-svg-wrapper" @mouseleave="hoveredBar = null">
          <!-- Load chart button (shown when chart not loaded) -->
          <div v-if="!chartLoaded && !chartLoading" class="chart-load-placeholder">
            <button @click="loadChartData" class="load-chart-button">
              Load Chart
            </button>
          </div>
          <!-- Loading state -->
          <div v-if="chartLoading" class="chart-load-placeholder">
            <span class="loading-text">Loading chart data...</span>
          </div>
          <!-- Chart (shown when loaded) -->
          <div v-if="chartLoaded" class="chart-container">
            <svg class="bar-chart-svg" :viewBox="`0 0 ${chartWidth} ${chartHeight}`" preserveAspectRatio="none">
              <!-- Y-axis line -->
              <!-- <line
                v-if="chartData.length > 0"
                :x1="chartWidth"
                :y1="0"
                :x2="chartWidth"
                :y2="chartHeight"
                stroke="#ccc"
                stroke-width="1"
              /> -->
              <!-- Year markers (vertical lines) -->
              <!-- <line
                v-for="(dataPoint, index) in chartData"
                :key="`marker-${index}`"
                :x1="getBarX(index) + barWidth / 2"
                :y1="0"
                :x2="getBarX(index) + barWidth / 2"
                :y2="chartHeight"
                stroke="#e0e0e0"
                stroke-width="1"
                opacity="0.5"
              /> -->
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
            <!-- Y-axis labels (outside SVG to prevent stretching) -->
            <!-- <div v-if="chartData.length > 0" class="y-axis-labels">
              <div
                v-for="(tick, index) in yAxisTicks"
                :key="`y-tick-${index}`"
                class="y-axis-tick"
                :style="{ top: `${getYAxisPosition(tick.value)}%` }"
              >
                {{ formatYAxisValue(tick.value) }}
              </div>
            </div> -->
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
          </div>
        </div>
      </div>
      <div class="timeslider-controls">
        <div class="slider-wrapper">
          <input
            type="range"
            :min="minYear"
            :max="maxYear"
            :step="step"
            :value="currentYear"
            @input="handleYearChange"
            class="time-slider"
            ref="sliderRef"
          />
          <div 
            class="year-above-thumb"
            :style="thumbYearStyle"
          >
            {{ currentYear }}
          </div>
        </div>
        <div class="year-labels">
          <span
            v-for="year in yearLabels"
            :key="year"
            :style="getYearLabelStyle(year)"
          >
            {{ year }}
          </span>
        </div>
        <!-- Play button -->
        <div class="play-controls">
          <button
            @click="toggleAnimation"
            class="play-button"
            :class="{ playing: isPlaying }"
          >
            <span v-if="!isPlaying">▶ Play</span>
            <span v-else>⏸ Pause</span>
          </button>
        </div>
      </div>
    </div>
    <div 
      class="toggle-background"
    >
      <div 
        class="toggle-container"
        :class="{ 'with-scenarios': selectedProjection !== null }"
      >
        <div 
          class="toggle-indicator"
          :class="{ 'on-projected': selectedProjection !== null }"
          :style="selectedProjection !== null ? getIndicatorStyle() : {}"
        ></div>
        <div 
          class="scenario-toggle-section"
        >
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
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'

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

const getIndicatorStyle = () => {
  if (props.selectedProjection === null) {
    return {}
  }
  // Indicator should cover the entire scenario section (400px)
  return {
    width: '400px',
    left: '0px'
  }
}

const handleYearChange = (event) => {
  const year = parseInt(event.target.value)
  // Stop animation if user manually changes year
  if (isPlaying.value) {
    toggleAnimation()
  }
  emit('year-change', year)
}

// Animation controls
const toggleAnimation = () => {
  if (isPlaying.value) {
    // Stop animation
    if (animationInterval.value) {
      clearInterval(animationInterval.value)
      animationInterval.value = null
    }
    isPlaying.value = false
  } else {
    // Start animation
    isPlaying.value = true
    const animate = () => {
      const current = props.currentYear
      const next = current + props.step
      
      if (next > props.maxYear) {
        // Loop back to start
        emit('year-change', props.minYear)
      } else {
        emit('year-change', next)
      }
    }
    
    // Start immediately, then repeat every 500ms
    animate()
    animationInterval.value = setInterval(animate, 500)
  }
}

// Clean up interval on unmount
onUnmounted(() => {
  if (animationInterval.value) {
    clearInterval(animationInterval.value)
  }
})

// Bar chart data and calculations
const chartData = ref([])
const chartWidth = 400
const chartHeight = 120
const barWidth = 8
const yAxisWidth = 50 // Space for y-axis labels
const selectedMetric = ref('area')
const showPercentageChange = ref(false)
const hoveredBar = ref(null)
const tooltipStyle = ref({})
const sliderRef = ref(null)
const isPlaying = ref(false)
const animationInterval = ref(null)
const chartLoaded = ref(false)
const chartLoading = ref(false)

const loadChartData = async () => {
  if (!props.selectedGlacier || !props.selectedGlacier['mapbox-id'] || !props.selectedProjection) {
    chartData.value = []
    chartLoaded.value = false
    return
  }

  chartLoading.value = true
  try {
    const mapboxId = props.selectedGlacier['mapbox-id']
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
        
        const feature = geojson.features.find(f => 
          f.properties?.['mapbox-id'] === mapboxId || 
          f.id === mapboxId
        )
        
        if (feature) {
          // Find area column - try different possible names
          const props = feature.properties || {}
          let areaValue = props['Area (km2)'] ?? props['area_km2'] ?? props['Area'] ?? null
          
          // If not found, search for any column with 'area' and 'km2' in the name
          if (areaValue === null || areaValue === undefined) {
            const areaKey = Object.keys(props).find(key => 
              key.toLowerCase().includes('area') && 
              (key.includes('km2') || key.includes('km²'))
            )
            areaValue = areaKey ? props[areaKey] : 0
          }
          
          // Find volume column - try different possible names
          const volumeValue = props['Volume (km3)'] ?? 
                             props['volume_km3'] ?? 
                             props['Volume'] ??
                             props['volume'] ?? 0
          
          // Find percentage change columns
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
        // Return 0 values if feature doesn't exist
        return {
          year,
          area: 0,
          volume: 0,
          areaChange: null,
          volumeChange: null
        }
      } catch (error) {
        console.warn(`[BarChart] Error loading data for year ${year}:`, error)
        // Return 0 values on error
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

// Get the chart value based on current mode (absolute or percentage change)
const getChartValue = (dataPoint) => {
  if (showPercentageChange.value) {
    // Use percentage change
    const changeValue = selectedMetric.value === 'area' ? dataPoint.areaChange : dataPoint.volumeChange
    return changeValue !== null && changeValue !== undefined ? changeValue : 0
  } else {
    // Use absolute value
    return selectedMetric.value === 'area' ? dataPoint.area : dataPoint.volume
  }
}

// Get tooltip unit based on current mode
const getTooltipUnit = () => {
  if (showPercentageChange.value) {
    return '%'
  } else {
    return selectedMetric.value === 'area' ? 'km²' : 'km³'
  }
}

// Get min and max values for the chart
const getChartMinMax = () => {
  if (chartData.value.length === 0) return { min: 0, max: 1 }
  const values = chartData.value.map(d => getChartValue(d)).filter(v => v !== null && v !== undefined)
  if (values.length === 0) return { min: 0, max: 1 }
  return {
    min: Math.min(...values),
    max: Math.max(...values)
  }
}

// Get Y position for a given value (returns percentage for CSS positioning)
const getYAxisPosition = (value) => {
  const { min, max } = getChartMinMax()
  const range = max - min || 1
  if (value === min) {
    // Bottom of chart (accounting for padding)
    return ((chartHeight - 2) / chartHeight) * 100
  }
  if (value === max) {
    // Top of chart (accounting for padding)
    return (2 / chartHeight) * 100
  }
  const position = chartHeight - ((value - min) / range) * (chartHeight - 20)
  return (position / chartHeight) * 100
}

// Generate Y-axis ticks
const yAxisTicks = computed(() => {
  if (chartData.value.length === 0) return []
  const { min, max } = getChartMinMax()
  const range = max - min || 1
  
  // Generate 4-5 ticks
  const numTicks = 5
  const ticks = []
  
  for (let i = 0; i < numTicks; i++) {
    const value = min + (range * i) / (numTicks - 1)
    ticks.push({ value })
  }
  
  return ticks
})

// Format Y-axis value
const formatYAxisValue = (value) => {
  if (showPercentageChange.value) {
    // For percentage, show integer with sign
    return value > 0 ? `+${Math.round(value)}%` : `${Math.round(value)}%`
  } else {
    // For absolute values, format appropriately
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
}

const getBarY = (value) => {
  if (chartData.value.length === 0) return chartHeight
  const { min, max } = getChartMinMax()
  const range = max - min || 1
  // For 0 values, show a small bar at the bottom instead of no bar
  if (value === 0 || value === null || value === undefined) {
    return chartHeight - 2 // 2px bar height for zero values
  }
  return chartHeight - ((value - min) / range) * (chartHeight - 20)
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

const currentYearIndex = computed(() => {
  return chartData.value.findIndex(d => d.year === props.currentYear)
})

const thumbYearStyle = computed(() => {
  const min = props.minYear
  const max = props.maxYear
  const value = props.currentYear
  
  // Calculate percentage position (0 to 100)
  const percentage = ((value - min) / (max - min)) * 100
  
  // Position the label centered above the thumb
  return {
    left: `${percentage}%`
  }
})

const handleBarHover = (dataPoint, index, event) => {
  hoveredBar.value = {
    year: dataPoint.year,
    value: getChartValue(dataPoint)
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
  
  // For percentage values (integers), format differently
  if (showPercentageChange.value) {
    // Percentage values are integers, show with sign
    return value > 0 ? `+${value}` : `${value}`
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

// Year labels every 10 years
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

// Watch for changes - reset chart loaded state when glacier or projection changes
watch([() => props.selectedGlacier, () => props.selectedProjection], () => {
  chartLoaded.value = false
  chartData.value = []
})

// Reload data when metric changes
watch([selectedMetric, showPercentageChange], () => {
  // Data is already loaded, just need to re-render
})
</script>

<style scoped>
.projection-time-controls-wrapper {
  position: absolute;
  bottom: 20px;
  left: 20px;
  right: 20px;
  z-index: 1001;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  /* outline: 2px solid red; */
}

.toggle-background {
  position: absolute;
  left: 0;
  bottom: 0;
  /* background: #e5e5e5; */
  /* border-radius: 10px; */
  width: 100%;
  height: 40px;
  padding: 0px;
  box-sizing: border-box;
  transition: width 0.3s ease, right 0.3s ease, height 0.3s ease;
  pointer-events: none;
  /* outline: 2px solid blue; */
}

.toggle-container {
  position: absolute;
  left: 0px;
  bottom: 0px;
  display: inline-flex;
  align-items: center;
  gap: 0;
  width: 400px;
  height: 40px;
  background: #e5e5e5;
  border-radius: 10px;
  pointer-events: auto;
  /* outline: 2px solid orange; */
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0s, box-shadow 0.15s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.toggle-container.with-scenarios {
  width: 400px;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}

.timeslider-container {
  position: absolute;
  bottom: 40px;
  left: 0;
  right: 0;
  background: white;
  border-radius: 10px;
  border: 1px solid #e5e5e5;
  border-bottom: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  /* clip-path: inset(0 0 10px 0); */
  box-sizing: border-box;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: auto;
  /* outline: 2px solid blue; */
  min-height: 300px;
  z-index: 1001;
}

.timeslider-controls {
  position: absolute;
  bottom: 16px;
  left: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: auto;
}

.play-controls {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}

.play-button {
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  background: #e5e5e5;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.play-button:hover {
  background: #d0d0d0;
  color: #000;
}

.play-button.playing {
  background: #4682B4;
  color: white;
}

.play-button.playing:hover {
  background: #3a6a9a;
}

.slider-wrapper {
  position: relative;
  width: 100%;
}

.year-above-thumb {
  position: absolute;
  top: -24px;
  transform: translateX(-50%);
  font-size: 12px;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
  pointer-events: none;
  background: white;
  padding: 2px 6px;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.bar-chart-container {
  position: absolute;
  top: 16px;
  left: 16px;
  right: 16px;
  bottom: 80px;
  max-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  pointer-events: auto;
  /* outline: 2px solid green; */
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

.load-chart-button {
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 500;
  color: white;
  background: #4682B4;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.load-chart-button:hover {
  background: #3a6a9a;
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
}

.bar-chart-svg {
  flex: 1;
  height: 100%;
  display: block;
}

.y-axis-labels {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 50px;
  pointer-events: none;
}

.y-axis-tick {
  position: absolute;
  right: 5px;
  font-size: 10px;
  color: #666;
  transform: translateY(-50%);
  white-space: nowrap;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
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

.time-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #e5e5e5;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
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

.play-controls {
  display: flex;
  justify-content: center;
  margin-top: 8px;
  padding-top: 8px;
}

.play-button {
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  background: #e5e5e5;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.play-button:hover {
  background: #d0d0d0;
  color: #000;
}

.play-button.playing {
  background: #4682B4;
  color: white;
}

.play-button.playing:hover {
  background: #3a6a9a;
}

.year-labels {
  position: relative;
  width: 100%;
  font-size: 12px;
  color: #666;
  padding: 0 4px;
  height: 16px;
}

.toggle-indicator {
  position: absolute;
  left: 0px;
  top: 0px;
  width: 400px;
  height: 40px;
  background: white;
  border-radius: 10px;
  box-sizing: border-box;
  transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0s, 
              border-radius 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0s,
              width 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0s;
  pointer-events: none;
  z-index: 1;
  clip-path: inset(-10px 0 0 0);
}

.toggle-indicator.on-projected {
  border-radius: 0 0 10px 10px;
  border: 1px solid #e5e5e5;
  border-top: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  /* clip-path: inset(-10px 0 10px 0); */
  z-index: 1002;
}




.scenario-toggle-section {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 400px;
  height: 40px;
  flex-shrink: 0;
  background: transparent;
  border-radius: 10px;
}

.toggle-option {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 500;
  color: #666;
  transition: color 0.2s ease, transform 0.15s ease;
  user-select: none;
  position: relative;
  z-index: 1003;
  cursor: pointer;
}

.toggle-option:hover {
  color: #333;
  transform: scale(1.05);
}

.toggle-option:active {
  transform: scale(0.98);
}

.toggle-option.selected {
  color: #333;
  font-weight: 600;
}



.scenario-toggle-option {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 500;
  color: #666;
  transition: color 0.2s ease, transform 0.15s ease, font-weight 0.2s ease;
  user-select: none;
  position: relative;
  z-index: 1003;
  cursor: pointer;
}

.scenario-toggle-option:hover {
  color: #333;
  transform: scale(1.08);
  font-weight: 600;
}

.scenario-toggle-option:active {
  transform: scale(0.95);
}

.scenario-toggle-option.selected {
  color: #333;
  font-weight: 700;
}
</style>

