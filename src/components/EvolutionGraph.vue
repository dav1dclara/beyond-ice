<template>
  <div
    v-if="selectedProjection || isComparisonMode"
    class="chart-wrapper"
    @mouseleave="hoveredBar = null"
  >
    <div v-if="chartLoading" class="chart-load-placeholder">
      <span class="loading-text">Loading chart data...</span>
    </div>
    <div
      v-if="
        chartLoaded && (chartData.length > 0 || comparisonChartData.length > 0)
      "
      class="chart-container"
    >
      <div class="chart-title">
        {{ selectedGlacier?.name || 'Overall' }}
      </div>
      <div class="chart-content">
        <div class="y-axis-ticks">
          <div
            class="y-axis-label y-axis-max"
            :style="{ top: `${(getBarY(yAxisMax) / chartHeight) * 100}%` }"
          >
            {{ formatYAxisValue(yAxisMax) }}
          </div>
          <div class="y-axis-label y-axis-middle" :style="{ top: '50%' }">
            {{ getTooltipUnit(selectedMetric) }}
          </div>
          <div class="y-axis-label y-axis-min" :style="{ top: '100%' }">0</div>
        </div>
        <div class="chart-svg-container">
          <svg
            class="bar-chart-svg"
            :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
            preserveAspectRatio="none"
          >
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
            <template v-if="!isComparisonMode">
              <!-- Single scenario bars -->
              <path
                v-for="(dataPoint, index) in chartData"
                :key="`bar-${index}-${currentYear}`"
                :d="
                  getBarPath(
                    getBarX(index),
                    getBarY(getChartValue(dataPoint)),
                    barWidth,
                    getChartValue(dataPoint) === null
                      ? 0.1
                      : Math.max(
                          2,
                          chartHeight - getBarY(getChartValue(dataPoint))
                        )
                  )
                "
                :fill="dataPoint.year === currentYear ? '#d0d0d0' : '#e5e5e5'"
                :opacity="
                  getChartValue(dataPoint) === null
                    ? 0
                    : dataPoint.year === currentYear
                      ? 1
                      : 0.7
                "
                @mouseenter="
                  getChartValue(dataPoint) !== null &&
                  handleBarHover(dataPoint, index, $event)
                "
                @mousemove="
                  getChartValue(dataPoint) !== null &&
                  handleBarHover(dataPoint, index, $event)
                "
                @click="
                  getChartValue(dataPoint) !== null && handleBarClick(dataPoint)
                "
                @mouseleave="hoveredBar = null"
                :style="{
                  cursor:
                    getChartValue(dataPoint) !== null ? 'pointer' : 'default',
                }"
              />
            </template>
            <template v-else>
              <!-- Comparison mode: side-by-side bars for reference and comparison scenarios -->
              <template
                v-for="(dataPoint, index) in chartData"
                :key="`year-${dataPoint.year}`"
              >
                <path
                  v-if="getChartValue(dataPoint) !== null"
                  :d="
                    getBarPath(
                      getComparisonBarX(index, 'reference'),
                      getBarY(getChartValue(dataPoint)),
                      barWidth / 2,
                      Math.max(
                        2,
                        chartHeight - getBarY(getChartValue(dataPoint))
                      )
                    )
                  "
                  fill="#3B82F6"
                  :opacity="dataPoint.year === currentYear ? 0.8 : 0.5"
                  @mouseenter="
                    handleBarHover(dataPoint, index, $event, 'reference')
                  "
                  @mousemove="
                    handleBarHover(dataPoint, index, $event, 'reference')
                  "
                  @click="handleBarClick(dataPoint)"
                  @mouseleave="hoveredBar = null"
                  style="cursor: pointer"
                />
                <path
                  v-if="getComparisonValueForYear(dataPoint.year) !== null"
                  :d="
                    getBarPath(
                      getComparisonBarX(index, 'comparison'),
                      getBarY(getComparisonValueForYear(dataPoint.year)),
                      barWidth / 2,
                      Math.max(
                        2,
                        chartHeight -
                          getBarY(getComparisonValueForYear(dataPoint.year))
                      )
                    )
                  "
                  fill="#F97316"
                  :opacity="dataPoint.year === currentYear ? 0.8 : 0.5"
                  @mouseenter="
                    handleComparisonBarHover(dataPoint.year, index, $event)
                  "
                  @mousemove="
                    handleComparisonBarHover(dataPoint.year, index, $event)
                  "
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
    <div v-if="hoveredBar !== null" class="chart-tooltip" :style="tooltipStyle">
      <div class="tooltip-year">{{ hoveredBar.year }}</div>
      <div class="tooltip-value">
        {{ formatValue(hoveredBar.value) }} {{ getTooltipUnit(selectedMetric) }}
      </div>
      <div
        v-if="hoveredBar.change !== null && hoveredBar.change !== undefined"
        class="tooltip-change"
      >
        {{ formatChange(hoveredBar.change) }} since
        {{ YEAR_CONFIG.MIN_YEAR }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { YEAR_CONFIG } from '../config/years.js';
import { SCENARIO_DEFAULTS } from '../config/scenarios.js';
import {
  formatValue,
  formatChange,
  formatYAxisValue,
  getTooltipUnit,
} from '../utils/chartFormatters.js';
import { useEvolutionGraphData } from '../composables/useEvolutionGraphData.js';

/**
 * Evolution Graph Component
 * Displays a bar chart showing glacier area/volume evolution over time
 * Supports single scenario view and comparison mode with two scenarios
 */
const props = defineProps({
  selectedProjection: {
    type: String,
    default: null,
  },
  selectedGlacier: {
    type: Object,
    default: null,
  },
  currentYear: {
    type: Number,
    default: YEAR_CONFIG.DEFAULT_YEAR,
  },
  minYear: {
    type: Number,
    default: YEAR_CONFIG.MIN_YEAR,
  },
  maxYear: {
    type: Number,
    default: YEAR_CONFIG.MAX_YEAR,
  },
  step: {
    type: Number,
    default: YEAR_CONFIG.YEAR_STEP,
  },
  map: {
    type: Object,
    default: null,
  },
  getSourceId: {
    type: Function,
    default: null,
  },
  mapLoaded: {
    type: Boolean,
    default: false,
  },
  currentMode: {
    type: String,
    default: 'default',
  },
  referenceScenario: {
    type: String,
    default: SCENARIO_DEFAULTS.DEFAULT_REFERENCE_SCENARIO,
  },
  comparisonScenario: {
    type: String,
    default: SCENARIO_DEFAULTS.DEFAULT_COMPARISON_SCENARIO,
  },
});

const emit = defineEmits(['year-change']);

const isComparisonMode = computed(() => props.currentMode === 'comparison');

const {
  chartData,
  comparisonChartData,
  chartLoaded,
  chartLoading,
  triggerChartLoad,
} = useEvolutionGraphData(props, isComparisonMode);

// Chart dimensions
const chartWidth = 400;
const chartHeight = 120;
const barWidth = 8;

// UI state
const selectedMetric = ref('area');
const hoveredBar = ref(null);
const tooltipStyle = ref({});

// Calculate X position for single scenario bars
const getBarX = (index) => {
  if (chartData.value.length === 0) return 0;
  const spacing = (chartWidth - barWidth) / (chartData.value.length - 1 || 1);
  return index * spacing;
};

// Calculate X position for comparison mode bars (side by side, half width each)
const getComparisonBarX = (index, type) => {
  if (chartData.value.length === 0) return 0;
  const spacing = (chartWidth - barWidth) / (chartData.value.length - 1 || 1);
  const baseX = index * spacing;
  if (type === 'reference') {
    return baseX;
  } else {
    return baseX + barWidth / 2;
  }
};

// Get value for a single scenario data point
const getChartValue = (dataPoint) => {
  const value =
    selectedMetric.value === 'area' ? dataPoint.area : dataPoint.volume;
  if (dataPoint.exists === false) {
    return null;
  }
  return value;
};

// Get comparison value for a specific year (matches by year, not index)
// Used when rendering comparison bars to find matching data point
const getComparisonValueForYear = (year) => {
  if (!comparisonChartData.value || comparisonChartData.value.length === 0) {
    return null;
  }
  const compDataPoint = comparisonChartData.value.find((d) => d.year === year);
  if (!compDataPoint) {
    return null;
  }
  return getChartValue(compDataPoint);
};

// Get minimum and maximum values for the chart
const getChartMinMax = () => {
  if (chartData.value.length === 0) return { min: 0, max: 1 };
  const values = chartData.value
    .map((d) => getChartValue(d))
    .filter((v) => v !== null && v !== undefined);

  if (isComparisonMode.value && comparisonChartData.value.length > 0) {
    const comparisonValues = comparisonChartData.value
      .map((d) => getChartValue(d))
      .filter((v) => v !== null && v !== undefined);
    values.push(...comparisonValues);
  }

  if (values.length === 0) return { min: 0, max: 1 };
  return {
    min: 0,
    max: Math.max(...values),
  };
};

// Calculate rounded Y-axis maximum using rounded increments for better readability
const yAxisMax = computed(() => {
  const { max } = getChartMinMax();
  if (max === 0) return 1;

  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  const normalized = max / magnitude;
  const roundedIncrements = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10];
  const rounded = roundedIncrements.find((n) => n > normalized) || 10;

  return rounded * magnitude;
});

// Calculate Y position for bar top (chart uses bottom-up coordinate system)
// Returns chartHeight for null/undefined (hides bar) or 0 values (shows 2px bar)
const getBarY = (value) => {
  if (chartData.value.length === 0) return chartHeight;
  const max = yAxisMax.value;
  const range = max || 1;
  if (value === null || value === undefined) {
    return chartHeight;
  }
  if (value === 0) {
    return chartHeight - 2;
  }
  return chartHeight - (value / range) * chartHeight;
};

// Generate SVG path for bar with rounded top corners only
const getBarPath = (x, y, width, height) => {
  const radius = 4;
  return `M ${x + radius} ${y} 
          L ${x + width - radius} ${y} 
          Q ${x + width} ${y} ${x + width} ${y + radius} 
          L ${x + width} ${y + height} 
          L ${x} ${y + height} 
          L ${x} ${y + radius} 
          Q ${x} ${y} ${x + radius} ${y} 
          Z`;
};

// Handle bar hover: calculate tooltip data and position
// Calculates percentage change relative to first year in dataset
const handleBarHover = (dataPoint, index, event, scenarioType = null) => {
  const absoluteValue = getChartValue(dataPoint);

  let relativeChange = null;
  const dataSource =
    scenarioType === 'comparison' ? comparisonChartData.value : chartData.value;
  if (dataSource.length > 0) {
    const firstYearData = dataSource[0];
    const firstYearValue =
      selectedMetric.value === 'area'
        ? firstYearData.area
        : firstYearData.volume;
    const currentValue =
      selectedMetric.value === 'area' ? dataPoint.area : dataPoint.volume;

    if (
      firstYearValue > 0 &&
      firstYearValue !== null &&
      firstYearValue !== undefined
    ) {
      relativeChange = ((currentValue - firstYearValue) / firstYearValue) * 100;
    }
  }

  hoveredBar.value = {
    year: dataPoint.year,
    value: absoluteValue,
    change: relativeChange,
    scenario:
      scenarioType === 'comparison'
        ? props.comparisonScenario
        : scenarioType === 'reference'
          ? props.referenceScenario
          : props.selectedProjection,
  };

  const svgElement = event.currentTarget.closest('.chart-wrapper');
  if (svgElement) {
    const rect = svgElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const tooltipWidth = 100;
    const tooltipHeight = 50;
    let left = x + 10;
    let top = y - 40;

    if (left + tooltipWidth > rect.width) {
      left = x - tooltipWidth - 10;
    }
    if (top < 0) {
      top = y + 20;
    }
    if (top + tooltipHeight > rect.height) {
      top = rect.height - tooltipHeight - 10;
    }

    tooltipStyle.value = {
      left: `${Math.max(0, left)}px`,
      top: `${Math.max(0, top)}px`,
    };
  }
};

const handleBarClick = (dataPoint) => {
  emit('year-change', dataPoint.year);
};

const handleComparisonBarHover = (year, index, event) => {
  const compDataPoint = comparisonChartData.value.find((d) => d.year === year);
  if (compDataPoint) {
    handleBarHover(compDataPoint, index, event, 'comparison');
  }
};

const handleComparisonBarClick = (year) => {
  emit('year-change', year);
};

// Watch for map loaded state - trigger initial chart load when map is ready
watch(
  () => props.mapLoaded,
  (loaded) => {
    if (loaded) {
      if (isComparisonMode.value) {
        if (props.referenceScenario && props.comparisonScenario) {
          triggerChartLoad(true);
        }
      } else {
        if (props.selectedProjection) {
          triggerChartLoad(true);
        }
      }
    }
  }
);

// Watch for data source changes (glacier, projection, mode, scenarios)
// Compares IDs to avoid false positives from object reference changes
// Includes 500ms delay for visual feedback when switching data sources
watch(
  [
    () => props.selectedGlacier,
    () => props.selectedProjection,
    () => props.currentMode,
    () => props.referenceScenario,
    () => props.comparisonScenario,
  ],
  async (newValues, oldValues) => {
    if (oldValues === undefined) {
      await triggerChartLoad();
      return;
    }

    const newGlacier = newValues[0];
    const oldGlacier = oldValues[0];
    const newGlacierId = newGlacier?.id ?? null;
    const oldGlacierId = oldGlacier?.id ?? null;
    const newProjection = newValues[1];
    const oldProjection = oldValues[1];
    const newMode = newValues[2];
    const oldMode = oldValues[2];
    const newRefScenario = newValues[3];
    const oldRefScenario = oldValues[3];
    const newCompScenario = newValues[4];
    const oldCompScenario = oldValues[4];

    const glacierIdChanged = newGlacierId !== oldGlacierId;
    const projectionChanged = newProjection !== oldProjection;
    const modeChanged = newMode !== oldMode;
    const refScenarioChanged = newRefScenario !== oldRefScenario;
    const compScenarioChanged = newCompScenario !== oldCompScenario;

    if (
      !glacierIdChanged &&
      !projectionChanged &&
      !modeChanged &&
      !refScenarioChanged &&
      !compScenarioChanged
    ) {
      return;
    }

    chartData.value = [];
    chartLoaded.value = false;
    chartLoading.value = true;

    await new Promise((resolve) => setTimeout(resolve, 500));

    await triggerChartLoad();
  },
  { immediate: true }
);

// Watch for metric changes (area/volume toggle)
// Restores existing data after delay since data contains both metrics
watch(
  () => selectedMetric.value,
  async () => {
    const currentData =
      chartData.value.length > 0 ? [...chartData.value] : null;

    chartData.value = [];
    chartLoaded.value = false;
    chartLoading.value = true;
    hoveredBar.value = null;

    await new Promise((resolve) => setTimeout(resolve, 500));

    if (props.selectedProjection && currentData) {
      chartData.value = currentData;
      chartLoading.value = false;
      chartLoaded.value = true;
    } else {
      chartLoading.value = false;
    }
  }
);
</script>

<style scoped>
.chart-wrapper {
  position: relative;
  width: 100%;
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

.y-axis-ticks {
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

.chart-metric-toggle {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  background: white;
  border-radius: 6px;
  padding: 2px;
  z-index: 10;
  border: 1px solid #e5e5e5;
}

.metric-button {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 400;
  color: #666;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.metric-button:hover {
  background: #f5f5f5;
  color: #333;
}

.metric-button.active {
  background: #f5f5f5;
  color: #333;
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
