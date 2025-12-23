<template>
  <div>
    <!-- <div
      class="right-side-container"
      :style="{ bottom: showGraph ? '200px' : '100px' }"
    >
      <div class="visualization-mode-label">visualization mode</div>
      <div class="visualization-mode-dropdown" @click.stop="showVisualizationDropdown = !showVisualizationDropdown">
        <button class="visualization-mode-dropdown-button">
          <span>{{ selectedComparisonMode }}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="{ rotated: showVisualizationDropdown }">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <Transition name="dropdown">
          <div v-if="showVisualizationDropdown" class="visualization-mode-dropdown-menu" @click.stop>
            <button
              v-for="mode in comparisonModes"
              :key="mode"
              class="visualization-mode-dropdown-item"
              :class="{ 'active': selectedComparisonMode === mode }"
              @click="selectComparisonMode(mode)"
            >
              {{ mode }}
            </button>
          </div>
        </Transition>
      </div>
      <div v-if="selectedComparisonMode === 'default' || selectedComparisonMode === 'overlay'" class="scenario-toggles">
        <button
          v-for="scenario in scenarios"
          :key="scenario"
          class="scenario-toggle-button"
          :class="{ 'selected': selectedScenario === scenario }"
          @click="selectScenario(scenario)"
        >
          {{ scenario }}
        </button>
      </div>
    </div> -->
    <div 
      class="projection-controls-container" 
      :class="{ expanded: showGraph }"
    >
      <ProjectionControlButton 
        :selected-projection="selectedProjection"
        @mode-change="handleModeChange"
        @scenario-change="handleScenarioChange"
        @reference-scenario-change="handleReferenceScenarioChange"
        @comparison-scenario-change="handleComparisonScenarioChange"
      />
      <button
        @click="toggleGraph"
        class="graph-toggle-button"
        :class="{ 'active': showGraph, 'disabled': currentMode === 'overlay' }"
        :disabled="currentMode === 'overlay'"
      >
        <span>{{ showGraph ? 'Hide evolution graph' : 'Show evolution graph' }}</span>
        <span class="graph-toggle-icon">{{ showGraph ? '▼' : '▲' }}</span>
      </button>
      <EvolutionGraph
        v-if="showGraph"
        :selected-projection="selectedProjection"
        :selected-glacier="selectedGlacier"
        :current-year="currentYear"
        :min-year="minYear"
        :max-year="maxYear"
        :step="step"
        :map="map"
        :get-source-id="getSourceId"
        :map-loaded="mapLoaded"
        :current-mode="currentMode"
        :reference-scenario="referenceScenario"
        :comparison-scenario="comparisonScenario"
        @year-change="handleYearChange"
      />
      <TimeSlider
        :current-year="currentYear"
        :min-year="minYear"
        :max-year="maxYear"
        :step="step"
        :disabled="currentMode === 'overlay'"
        @year-change="handleYearChange"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { PROJECTION_CONFIG } from '../config/projections.js'
import TimeSlider from './TimeSlider.vue'
import EvolutionGraph from './EvolutionGraph.vue'
import ProjectionControlButton from './ProjectionControlButton.vue'

const props = defineProps({
  currentYear: {
    type: Number,
    default: 2020
  },
  minYear: {
    type: Number,
    default: PROJECTION_CONFIG.MIN_YEAR
  },
  maxYear: {
    type: Number,
    default: PROJECTION_CONFIG.MAX_YEAR
  },
  step: {
    type: Number,
    default: PROJECTION_CONFIG.YEAR_STEP
  },
  selectedProjection: {
    type: String,
    default: null
  },
  selectedGlacier: {
    type: Object,
    default: null
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
  referenceScenario: {
    type: String,
    default: 'SSP2-4.5'
  },
  comparisonScenario: {
    type: String,
    default: 'SSP5-8.5'
  }
})

const emit = defineEmits(['year-change', 'mode-change', 'projection-change', 'reference-scenario-change', 'comparison-scenario-change'])

const showGraph = ref(false)
const currentMode = ref('default')

const toggleGraph = () => {
  if (currentMode.value === 'overlay') return // Disable in overlay mode
  showGraph.value = !showGraph.value
}

// Comparison mode state
const selectedComparisonMode = ref('default')
const comparisonModes = ['default', 'overlay', 'comparison']
const showVisualizationDropdown = ref(false)

const selectComparisonMode = (mode) => {
  selectedComparisonMode.value = mode
  showVisualizationDropdown.value = false
  // No functionality yet - just update the selection
}

// Close dropdown when clicking outside
const handleVisualizationClickOutside = (event) => {
  if (!event.target.closest('.visualization-mode-dropdown')) {
    showVisualizationDropdown.value = false
  }
}

// Scenario state
const scenarios = ['SSP1-2.6', 'SSP2-4.5', 'SSP3-7.0', 'SSP5-8.5']
const selectedScenario = ref('SSP2-4.5')

const selectScenario = (scenario) => {
  selectedScenario.value = scenario
  // No functionality yet - just update the selection
}

// Setup click outside handler for dropdown
onMounted(() => {
  document.addEventListener('click', handleVisualizationClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleVisualizationClickOutside)
})

const handleYearChange = (year) => {
  emit('year-change', year)
}

const handleModeChange = (mode) => {
  currentMode.value = mode
  // Close graph if switching to overlay mode
  if (mode === 'overlay') {
    showGraph.value = false
  }
  emit('mode-change', mode)
}

const handleScenarioChange = (scenario) => {
  emit('projection-change', scenario)
}

const handleReferenceScenarioChange = (scenario) => {
  emit('reference-scenario-change', scenario)
}

const handleComparisonScenarioChange = (scenario) => {
  emit('comparison-scenario-change', scenario)
}
</script>

<style scoped>
.projection-controls-container {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  min-height: 20px;
  background: white;
  border-top: 1px solid #e5e5e5;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 10px;
  gap: 10px;
  outline: orange solid 1px;
}

.graph-toggle-button {
  position: absolute;
  right: 10px;
  bottom: 100%;
  margin-bottom: 0;
  width: 180px;
  padding: 6px 12px;
  background: white;
  border: 1px solid #e5e5e5;
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  border-bottom: none;
  cursor: pointer;
  font-size: 12px;
  font-weight: 400;
  color: #666;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.15);
  clip-path: inset(-10px -10px 0 -10px);
  transition: all 0.2s;
  z-index: 1001;
  font-family: inherit;
  min-height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-shrink: 0;
  white-space: nowrap;
}

.graph-toggle-button:hover:not(.disabled) {
  background: #f5f5f5;
  color: #333;
}

.graph-toggle-button.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.graph-toggle-icon {
  font-size: 12px;
  color: #666;
  flex-shrink: 0;
}

/* .right-side-container {
  position: fixed;
  right: 10px;
  padding: 10px 12px;
  background: white;
  border: 1px solid #e5e5e5;
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  border-bottom: none;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.15);
  transition: bottom 0.3s ease, all 0.2s;
  z-index: 1001;
  font-family: inherit;
  min-height: 32px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.visualization-mode-label {
  font-size: 12px;
  font-weight: 500;
  color: #666;
  margin-bottom: 4px;
}

.visualization-mode-dropdown {
  position: relative;
}

.visualization-mode-dropdown-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 12px;
  width: 100%;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: #333;
  transition: all 0.2s;
  font-family: inherit;
  box-sizing: border-box;
}

.visualization-mode-dropdown-button:hover {
  background: #f5f5f5;
  border-color: #d0d0d0;
}

.visualization-mode-dropdown-button svg {
  transition: transform 0.2s;
  flex-shrink: 0;
}

.visualization-mode-dropdown-button svg.rotated {
  transform: rotate(180deg);
}

.visualization-mode-dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 1002;
}

.visualization-mode-dropdown-item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: #666;
  transition: all 0.2s;
  font-family: inherit;
}

.visualization-mode-dropdown-item:hover {
  background: #f5f5f5;
  color: #333;
}

.visualization-mode-dropdown-item.active {
  background: #e8f4f8;
  color: #333;
  font-weight: 600;
}

.scenario-toggles {
  display: flex;
  gap: 4px;
  background: #e5e5e5;
  border-radius: 6px;
  padding: 2px;
  flex-wrap: wrap;
}

.scenario-toggle-button {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  color: #666;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.scenario-toggle-button:hover {
  color: #333;
}

.scenario-toggle-button.selected {
  background: white;
  color: #333;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* Dropdown transitions */
/* .dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.dropdown-enter-to,
.dropdown-leave-from {
  opacity: 1;
  transform: translateY(0);
} */
</style>
