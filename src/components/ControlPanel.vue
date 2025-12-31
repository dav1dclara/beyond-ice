<template>
  <div class="control-panel-container">
    <ModeScenarioControls
      :selected-projection="selectedProjection"
      @mode-change="handleModeChange"
      @scenario-change="handleScenarioChange"
      @reference-scenario-change="handleReferenceScenarioChange"
      @comparison-scenario-change="handleComparisonScenarioChange"
    />
    <button
      @click="toggleGraph"
      class="graph-toggle-button"
      :class="{ active: showGraph, disabled: currentMode === 'overlay' }"
      :disabled="currentMode === 'overlay'"
    >
      <span>{{
        showGraph ? 'Hide evolution graph' : 'Show evolution graph'
      }}</span>
      <span class="graph-toggle-icon">{{ showGraph ? '▼' : '▲' }}</span>
    </button>
    <div v-if="showGraph" class="evolution-graph-wrapper">
      <EvolutionGraph
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
    </div>
    <TimeSlider
      :current-year="currentYear"
      :min-year="minYear"
      :max-year="maxYear"
      :step="step"
      :disabled="currentMode === 'overlay'"
      @year-change="handleYearChange"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { YEAR_CONFIG } from '../config/years.js';
import { SCENARIO_DEFAULTS } from '../config/scenarios.js';
import TimeSlider from './TimeSlider.vue';
import EvolutionGraph from './EvolutionGraph.vue';
import ModeScenarioControls from './ModeScenarioControls.vue';

defineProps({
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
  selectedProjection: {
    type: String,
    default: null,
  },
  selectedGlacier: {
    type: Object,
    default: null,
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
  referenceScenario: {
    type: String,
    default: SCENARIO_DEFAULTS.DEFAULT_REFERENCE_SCENARIO,
  },
  comparisonScenario: {
    type: String,
    default: SCENARIO_DEFAULTS.DEFAULT_COMPARISON_SCENARIO,
  },
});

const emit = defineEmits([
  'year-change',
  'mode-change',
  'projection-change',
  'reference-scenario-change',
  'comparison-scenario-change',
]);

const showGraph = ref(false);
const currentMode = ref('default');

const toggleGraph = () => {
  if (currentMode.value === 'overlay') return;
  showGraph.value = !showGraph.value;
};

const handleYearChange = (year) => {
  emit('year-change', year);
};

const handleModeChange = (mode) => {
  currentMode.value = mode;
  if (mode === 'overlay') {
    showGraph.value = false;
  }
  emit('mode-change', mode);
};

const handleScenarioChange = (scenario) => {
  emit('projection-change', scenario);
};

const handleReferenceScenarioChange = (scenario) => {
  emit('reference-scenario-change', scenario);
};

const handleComparisonScenarioChange = (scenario) => {
  emit('comparison-scenario-change', scenario);
};
</script>

<style scoped>
.control-panel-container {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  min-height: 20px;
  background: white;
  border-top: 1px solid #e5e5e5;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 10px;
  gap: 10px;
}

.graph-toggle-button {
  position: absolute;
  right: 10px;
  bottom: 100%;
  margin-bottom: 0;
  width: 160px;
  padding: 4px 12px 0px 12px;
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
  min-height: 18px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 8px;
  flex-shrink: 0;
  white-space: nowrap;
}

.graph-toggle-button.disabled {
  cursor: not-allowed;
  pointer-events: none;
}

.graph-toggle-button.disabled span,
.graph-toggle-button.disabled .graph-toggle-icon {
  opacity: 0.5;
}

.evolution-graph-wrapper {
  margin-bottom: 4px;
  padding-right: 6px;
}

.graph-toggle-icon {
  font-size: 12px;
  color: #666;
  flex-shrink: 0;
}
</style>
