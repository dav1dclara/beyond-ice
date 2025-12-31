<template>
  <div
    class="legend-container"
    :class="{ 'legend-container-fixed-width': currentMode === 'default' }"
  >
    <div v-if="currentMode === 'default'" class="legend-dropdown-wrapper">
      <span class="legend-visualization-label"> Visualization </span>
      <div
        class="legend-dropdown"
        @click.stop="showVisualizationDropdown = !showVisualizationDropdown"
      >
        <button class="legend-dropdown-button">
          <span>{{ getVisualizationLabel(currentVisualization) }}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            :class="{ rotated: showVisualizationDropdown }"
          >
            <polyline points="9 6 15 12 9 18"></polyline>
          </svg>
        </button>
        <Transition name="dropdown">
          <div
            v-if="showVisualizationDropdown"
            class="legend-dropdown-menu"
            @click.stop
          >
            <button
              @click.stop="handleVisualizationChange('uniform')"
              :class="{ active: currentVisualization === 'uniform' }"
              class="legend-dropdown-item"
            >
              Uniform
            </button>
            <button
              @click.stop="handleVisualizationChange('area-change')"
              :class="{ active: currentVisualization === 'area-change' }"
              class="legend-dropdown-item"
            >
              Area Change
            </button>
            <button
              @click.stop="handleVisualizationChange('volume-change')"
              :class="{ active: currentVisualization === 'volume-change' }"
              class="legend-dropdown-item"
            >
              Volume Change
            </button>
            <button
              @click.stop="handleVisualizationChange('bivariate')"
              :class="{ active: currentVisualization === 'bivariate' }"
              class="legend-dropdown-item"
            >
              Area & Volume Change
            </button>
          </div>
        </Transition>
      </div>
      <div
        v-if="
          currentVisualization === 'area-change' ||
          currentVisualization === 'volume-change'
        "
        class="legend-gradient-content"
      >
        <div class="legend-since-label">since {{ YEAR_CONFIG.MIN_YEAR }}</div>
        <div class="legend-gradient-bar-horizontal">
          <div
            class="legend-gradient-horizontal"
            :style="{
              background: `linear-gradient(to right, rgb(59, 130, 246) 0%, rgb(249, 115, 22) 100%)`,
            }"
          ></div>
          <div class="legend-labels-horizontal">
            <span class="legend-label-left">0%</span>
            <span class="legend-label-right">-100%</span>
          </div>
        </div>
      </div>
      <div
        v-if="currentVisualization === 'bivariate'"
        class="legend-bivariate"
        style="--canvas-size: 160px"
      >
        <div class="legend-since-label">since {{ YEAR_CONFIG.MIN_YEAR }}</div>
        <div class="legend-bivariate-wrapper">
          <div>
            <div class="legend-bivariate-canvas-wrapper">
              <canvas
                ref="bivariateCanvas"
                class="legend-bivariate-canvas"
                :width="160"
                :height="160"
              ></canvas>
              <div class="legend-bivariate-axis-container-vertical">
                <div class="legend-bivariate-axis-vertical">
                  <span class="legend-label-top">0%</span>
                  <span class="legend-label-bottom">-100%</span>
                </div>
                <div class="legend-bivariate-axis-label-vertical">
                  <span class="legend-label">Volume Change</span>
                </div>
              </div>
            </div>
            <div class="legend-bivariate-axis-container-horizontal">
              <div class="legend-bivariate-axis">
                <span class="legend-label-top">0%</span>
                <span class="legend-label-bottom">-100%</span>
              </div>
              <div class="legend-bivariate-axis-label">
                <span class="legend-label">Area Change</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="currentMode === 'overlay'" class="overlay-legend-content">
      <div class="overlay-legend-options">
        <div
          v-for="year in decadeYears"
          :key="year"
          class="overlay-legend-option"
          :class="{ active: visibleYearsSet.has(year) }"
        >
          <button
            @click="handleToggleYear(year)"
            class="overlay-legend-year-toggle-button"
            :title="visibleYearsSet.has(year) ? 'Hide' : 'Show'"
          >
            <svg
              v-if="visibleYearsSet.has(year)"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <svg
              v-else
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
              ></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
          </button>
          <div
            class="overlay-legend-year-color-box"
            :style="{ backgroundColor: getYearColor(year) }"
          ></div>
          <span class="overlay-legend-year-label">{{ year }}</span>
        </div>
      </div>
      <div class="overlay-legend-footer">
        <button
          @click="handleToggleAllYears"
          class="overlay-legend-toggle-all-button"
          :title="allYearsVisible ? 'Hide all' : 'Show all'"
        >
          {{ allYearsVisible ? 'Hide all' : 'Show all' }}
        </button>
      </div>
    </div>
    <div
      v-else-if="currentMode === 'comparison'"
      class="comparison-legend-content"
    >
      <div class="comparison-legend-options">
        <div
          class="comparison-legend-option"
          :class="{ active: visibleScenariosSet.has('reference') }"
        >
          <button
            @click="handleToggleScenario('reference')"
            class="comparison-legend-year-toggle-button"
            :title="visibleScenariosSet.has('reference') ? 'Hide' : 'Show'"
          >
            <svg
              v-if="visibleScenariosSet.has('reference')"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <svg
              v-else
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
              ></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
          </button>
          <div
            class="comparison-legend-year-color-box"
            :style="{ backgroundColor: 'rgba(59, 130, 246, 0.6)' }"
          ></div>
          <span class="comparison-legend-year-label">{{
            referenceScenario
          }}</span>
        </div>
        <div
          class="comparison-legend-option"
          :class="{ active: visibleScenariosSet.has('comparison') }"
        >
          <button
            @click="handleToggleScenario('comparison')"
            class="comparison-legend-year-toggle-button"
            :title="visibleScenariosSet.has('comparison') ? 'Hide' : 'Show'"
          >
            <svg
              v-if="visibleScenariosSet.has('comparison')"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <svg
              v-else
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
              ></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
          </button>
          <div
            class="comparison-legend-year-color-box"
            :style="{ backgroundColor: 'rgba(249, 115, 22, 0.6)' }"
          ></div>
          <span class="comparison-legend-year-label">{{
            comparisonScenario
          }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  computed,
  ref,
  onMounted,
  onBeforeUnmount,
  nextTick,
  watch,
} from 'vue';
import { YEAR_CONFIG } from '../config/years.js';
import { SCENARIO_DEFAULTS } from '../config/scenarios.js';
import { getBivariateColor } from '../utils/bivariateColor.js';

const props = defineProps({
  currentMode: {
    type: String,
    default: 'default',
  },
  currentVisualization: {
    type: String,
    default: 'uniform',
  },
  visibleYears: {
    type: Set,
    default: () => new Set(),
  },
  minYear: {
    type: Number,
    default: YEAR_CONFIG.MIN_YEAR,
  },
  maxYear: {
    type: Number,
    default: YEAR_CONFIG.MAX_YEAR,
  },
  referenceScenario: {
    type: String,
    default: SCENARIO_DEFAULTS.DEFAULT_REFERENCE_SCENARIO,
  },
  comparisonScenario: {
    type: String,
    default: SCENARIO_DEFAULTS.DEFAULT_COMPARISON_SCENARIO,
  },
  visibleScenarios: {
    type: Set,
    default: () => new Set(['reference', 'comparison']),
  },
});

const emit = defineEmits([
  'year-toggle',
  'toggle-all-years',
  'scenario-toggle',
  'visualization-change',
]);

const showVisualizationDropdown = ref(false);
const bivariateCanvas = ref(null);

const decadeYears = computed(() => {
  const years = [];
  for (let y = props.minYear; y <= props.maxYear; y += 10) {
    years.push(y);
  }
  return years;
});

const visibleYearsSet = computed(() => props.visibleYears);
const visibleScenariosSet = computed(() => props.visibleScenarios);

const allYearsVisible = computed(() => {
  return decadeYears.value.every((year) => visibleYearsSet.value.has(year));
});

const getYearColor = (year) => {
  const normalized = (year - props.minYear) / (props.maxYear - props.minYear);
  const blue = { r: 59, g: 130, b: 246 };
  const orange = { r: 249, g: 115, b: 22 };

  const r = Math.round(blue.r + (orange.r - blue.r) * normalized);
  const g = Math.round(blue.g + (orange.g - blue.g) * normalized);
  const b = Math.round(blue.b + (orange.b - blue.b) * normalized);

  return `rgb(${r}, ${g}, ${b})`;
};

const handleToggleYear = (year) => {
  emit('year-toggle', year);
};

const handleToggleAllYears = () => {
  emit('toggle-all-years');
};

const handleToggleScenario = (scenario) => {
  emit('scenario-toggle', scenario);
};

const getVisualizationLabel = (mode) => {
  const labels = {
    uniform: 'Uniform',
    'area-change': 'Area Change',
    'volume-change': 'Volume Change',
    bivariate: 'Area & Volume Change',
  };
  return labels[mode] || 'Uniform';
};

let isDrawing = false;

const drawBivariateLegend = () => {
  if (!bivariateCanvas.value) {
    setTimeout(() => {
      if (
        bivariateCanvas.value &&
        props.currentVisualization === 'bivariate' &&
        props.currentMode === 'default'
      ) {
        drawBivariateLegend();
      }
    }, 100);
    return;
  }

  if (isDrawing) return;
  isDrawing = true;

  try {
    const canvas = bivariateCanvas.value;
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.clearRect(0, 0, width, height);

    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let y = 2; y < height; y++) {
      for (let x = 2; x < width; x++) {
        const areaChange = -((x + 0.5) / width) * 100;
        const volumeChange = -((y + 0.5) / height) * 100;
        const rgb = getBivariateColor(areaChange, volumeChange);

        const index = (y * width + x) * 4;
        data[index] = rgb.r;
        data[index + 1] = rgb.g;
        data[index + 2] = rgb.b;
        data[index + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  } finally {
    isDrawing = false;
  }
};

const handleVisualizationChange = (mode) => {
  showVisualizationDropdown.value = false;

  if (props.currentVisualization === mode) {
    return;
  }

  emit('visualization-change', mode);

  if (mode === 'bivariate' && props.currentMode === 'default') {
    nextTick(() => {
      if (bivariateCanvas.value) {
        drawBivariateLegend();
      } else {
        setTimeout(() => {
          if (bivariateCanvas.value) {
            drawBivariateLegend();
          }
        }, 100);
      }
    });
  }
};

const handleClickOutside = (event) => {
  if (!event.target.closest('.legend-container')) {
    showVisualizationDropdown.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);

  if (props.currentVisualization === 'bivariate') {
    nextTick(() => {
      drawBivariateLegend();
    });
  }
});

watch(
  () => props.currentVisualization,
  (newVal) => {
    if (newVal === 'bivariate' && props.currentMode === 'default') {
      nextTick(() => {
        if (bivariateCanvas.value) {
          drawBivariateLegend();
        }
      });
    }
  }
);

watch(
  () => props.currentMode,
  (newMode) => {
    if (newMode === 'default' && props.currentVisualization === 'bivariate') {
      nextTick(() => {
        setTimeout(() => {
          if (bivariateCanvas.value) {
            drawBivariateLegend();
          }
        }, 50);
      });
    }
  }
);

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.legend-container {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 1000;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  padding: 6px;
  min-width: 105px;
  box-sizing: border-box;
}

.legend-container-fixed-width {
  width: 240px;
}

.legend-dropdown-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.legend-visualization-label {
  font-size: 10px;
  font-weight: 500;
  color: #888888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.legend-dropdown {
  position: relative;
  z-index: 1003;
  overflow: visible;
  width: 100%;
}

.legend-dropdown-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  width: 100%;
  min-width: 140px;
  background: #ffffff;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: #333333;
  transition: all 0.2s;
  font-family: inherit;
  box-sizing: border-box;
}

.legend-dropdown-button:hover {
  background: #f5f5f5;
  border-color: #d0d0d0;
  color: #333333;
}

.legend-dropdown-button svg {
  transition: transform 0.2s;
  flex-shrink: 0;
}

.legend-dropdown-button svg.rotated {
  transform: rotate(180deg);
}

.legend-dropdown-menu {
  position: absolute;
  top: 0;
  left: calc(100% + 4px);
  width: max-content;
  white-space: nowrap;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 1002;
}

.legend-dropdown-item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: #666666;
  transition: all 0.2s;
  font-family: inherit;
}

.legend-dropdown-item:hover {
  background: #f5f5f5;
  color: #333333;
}

.legend-dropdown-item.active {
  color: #333333;
  font-weight: 600;
}

.overlay-legend-content {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.overlay-legend-footer {
  display: flex;
  align-items: center;
  margin-top: 8px;
}

.overlay-legend-toggle-all-button {
  padding: 4px 8px;
  background: transparent;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  width: 100%;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: #666;
  transition: all 0.2s;
  font-family: inherit;
}

.overlay-legend-toggle-all-button:hover {
  background: #f5f5f5;
  color: #333;
  border-color: #d0d0d0;
}

.overlay-legend-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.overlay-legend-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 6px;
  padding-right: 6px;
}

.overlay-legend-year-toggle-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #666;
  transition: color 0.2s;
  flex-shrink: 0;
}

.overlay-legend-year-toggle-button svg {
  width: 100%;
  height: 100%;
}

.overlay-legend-year-color-box {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.overlay-legend-year-label {
  font-size: 12px;
  color: #666;
  font-weight: 400;
}

.overlay-legend-option.active .overlay-legend-year-label {
  color: #333;
  font-weight: 500;
}

.comparison-legend-content {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.comparison-legend-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.comparison-legend-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 6px;
  padding-right: 6px;
}

.comparison-legend-year-toggle-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #666;
  transition: color 0.2s;
  flex-shrink: 0;
}

.comparison-legend-year-toggle-button svg {
  width: 100%;
  height: 100%;
}

.comparison-legend-year-color-box {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.comparison-legend-year-label {
  font-size: 12px;
  color: #666;
  font-weight: 400;
}

.comparison-legend-option.active .comparison-legend-year-label {
  color: #333;
  font-weight: 500;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

.dropdown-enter-to,
.dropdown-leave-from {
  opacity: 1;
  transform: translateX(0);
}

.legend-bivariate {
  display: flex;
  flex-direction: column;
}

.legend-bivariate-wrapper {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.legend-bivariate-canvas-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-bivariate-canvas {
  width: var(--canvas-size, 160px);
  height: var(--canvas-size, 160px);
  display: block;
  box-sizing: border-box;
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
  padding: 0;
  margin: 0;
}

.legend-bivariate-axis-container-horizontal {
  display: flex;
  flex-direction: column;
  width: var(--canvas-size, 160px);
  box-sizing: border-box;
  margin-top: 4px;
}

.legend-bivariate-axis {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 0;
  margin: 0;
}

.legend-bivariate-axis-label {
  font-size: 12px;
  color: #666;
  font-weight: 500;
  text-align: center;
  width: 100%;
  margin-top: 4px;
}

.legend-bivariate-axis-container-vertical {
  display: flex;
  flex-direction: row;
  align-items: center;
  height: var(--canvas-size, 160px);
  box-sizing: border-box;
}

.legend-bivariate-axis-vertical {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  align-items: flex-start;
}

.legend-bivariate-axis-label-vertical {
  display: flex;
  align-items: center;
  justify-content: center;
  height: var(--canvas-size, 160px);
  font-size: 12px;
  color: #666;
  font-weight: 500;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  margin-left: 4px;
}

.legend-label-top,
.legend-label-bottom {
  font-size: 12px;
  color: #666;
}

.legend-gradient-content {
  margin-top: 0px;
  width: 100%;
}

.legend-since-label {
  font-size: 11px;
  color: #888888;
  text-align: left;
  margin-bottom: 6px;
  font-weight: 400;
  margin-left: 4px;
}

.legend-gradient-bar-horizontal {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.legend-gradient-horizontal {
  width: 100%;
  height: 20px;
  border-radius: 4px;
  border: none;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
}

.legend-labels-horizontal {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  padding: 0 2px;
}

.legend-label-left,
.legend-label-right {
  font-size: 12px;
  color: #666;
}
</style>

