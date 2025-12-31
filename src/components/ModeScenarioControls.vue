<template>
  <div class="mode-scenario-control-panel">
    <div class="visualization-mode-section">
      <span
        class="visualization-mode-label"
        @mouseenter="showTooltip"
        @mouseleave="hideTooltip"
      >
        Visualization Mode
        <Transition name="tooltip">
          <div v-if="tooltipVisible" class="tooltip tooltip-left-aligned">
            <p>Choose how to visualize glacier extents:</p>
            <ul>
              <li>
                <strong>Temporal Evolution</strong>: View the evolution of
                glacier extents over time for a single scenario
              </li>
              <li>
                <strong>Multi-year Overlay</strong>: Overlay glacier extents
                every 10 years for a single scenario (static)
              </li>
              <li>
                <strong>Scenario Comparison</strong>: Compare the evolution of
                glacier extents over time for two scenarios
              </li>
            </ul>
          </div>
        </Transition>
      </span>
      <div
        class="visualization-mode-dropdown"
        @click.stop="showDropdown = !showDropdown"
      >
        <button class="visualization-mode-dropdown-button">
          <span>{{ modeLabels[selectedMode] }}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            :class="{ rotated: showDropdown }"
          >
            <polyline points="6 15 12 9 18 15"></polyline>
          </svg>
        </button>
        <Transition name="dropdown">
          <div
            v-if="showDropdown"
            class="visualization-mode-dropdown-menu"
            @click.stop
          >
            <button
              v-for="mode in modes"
              :key="mode"
              class="visualization-mode-dropdown-item"
              :class="{ active: selectedMode === mode }"
              @click="selectMode(mode)"
            >
              {{ modeLabels[mode] }}
            </button>
          </div>
        </Transition>
      </div>
    </div>
    <div
      v-if="
        selectedMode === 'default' ||
        selectedMode === 'overlay' ||
        selectedMode === 'comparison'
      "
      class="vertical-divider"
    ></div>
    <div
      v-if="selectedMode === 'default' || selectedMode === 'overlay'"
      class="scenario-section"
    >
      <span
        class="scenario-label"
        @mouseenter="showScenarioTooltip"
        @mouseleave="hideScenarioTooltip"
      >
        scenario
        <Transition name="tooltip">
          <div
            v-if="scenarioTooltipVisible"
            class="tooltip"
            @mouseenter="showScenarioTooltip"
            @mouseleave="hideScenarioTooltip"
          >
            <p>Select a Shared Socioeconomic Pathway (SSP) scenario:</p>
            <ul>
              <li>
                <strong>SSP1-2.6</strong>: Sustainability<br />(Low challenges
                to mitigation and adaptation)
              </li>
              <li>
                <strong>SSP2-4.5</strong>: Middle of the Road<br />(Medium
                challenges to mitigation and adaptation)
              </li>
              <li>
                <strong>SSP3-7.0</strong>: Regional Rivalry<br />(High
                challenges to mitigation and adaptation)
              </li>
              <li>
                <strong>SSP5-8.5</strong>: Fossil-fueled Development<br />(High
                challenges to mitigation, low challenges to adaptation)
              </li>
            </ul>
            <p class="tooltip-link">
              <a
                href="https://www.dkrz.de/en/communication/climate-simulations/cmip6-en/the-ssp-scenarios"
                target="_blank"
                rel="noopener noreferrer"
                class="tooltip-link-anchor"
                >Learn more about SSP scenarios</a
              >
            </p>
          </div>
        </Transition>
      </span>
      <div class="scenario-toggles">
        <button
          v-for="scenario in scenarios"
          :key="scenario"
          class="scenario-toggle"
          :class="{ active: selectedScenario === scenario }"
          @click="selectScenario(scenario)"
        >
          {{ scenario }}
        </button>
      </div>
    </div>
    <div v-if="selectedMode === 'comparison'" class="comparison-scenarios">
      <div class="scenario-section">
        <span class="scenario-label no-tooltip">
          <span
            class="scenario-color-indicator scenario-color-reference"
          ></span>
          reference
        </span>
        <div
          class="scenario-dropdown"
          @click.stop="showReferenceDropdown = !showReferenceDropdown"
        >
          <button class="scenario-dropdown-button">
            <span>{{ selectedReferenceScenario }}</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              :class="{ rotated: showReferenceDropdown }"
            >
              <polyline points="6 15 12 9 18 15"></polyline>
            </svg>
          </button>
          <Transition name="dropdown">
            <div
              v-if="showReferenceDropdown"
              class="scenario-dropdown-menu"
              @click.stop
            >
              <button
                v-for="scenario in scenarios"
                :key="`ref-${scenario}`"
                class="scenario-dropdown-item"
                :class="{ active: selectedReferenceScenario === scenario }"
                @click="selectReferenceScenario(scenario)"
              >
                {{ scenario }}
              </button>
            </div>
          </Transition>
        </div>
      </div>
      <div class="scenario-section">
        <span class="scenario-label no-tooltip">
          <span
            class="scenario-color-indicator scenario-color-comparison"
          ></span>
          comparison
        </span>
        <div
          class="scenario-dropdown"
          @click.stop="showComparisonDropdown = !showComparisonDropdown"
        >
          <button class="scenario-dropdown-button">
            <span>{{ selectedComparisonScenario }}</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              :class="{ rotated: showComparisonDropdown }"
            >
              <polyline points="6 15 12 9 18 15"></polyline>
            </svg>
          </button>
          <Transition name="dropdown">
            <div
              v-if="showComparisonDropdown"
              class="scenario-dropdown-menu"
              @click.stop
            >
              <button
                v-for="scenario in scenarios"
                :key="`comp-${scenario}`"
                class="scenario-dropdown-item"
                :class="{ active: selectedComparisonScenario === scenario }"
                @click="selectComparisonScenario(scenario)"
              >
                {{ scenario }}
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { SCENARIO_CONFIG } from '../config/scenarios.js';

const props = defineProps({
  selectedProjection: {
    type: String,
    default: null,
  },
});

const emit = defineEmits([
  'mode-change',
  'scenario-change',
  'reference-scenario-change',
  'comparison-scenario-change',
]);

const modes = ['default', 'overlay', 'comparison'];
const modeLabels = {
  default: 'Temporal Evolution',
  overlay: 'Multi-year Overlay',
  comparison: 'Scenario Comparison',
};
const scenarios = ['SSP1-2.6', 'SSP2-4.5', 'SSP3-7.0', 'SSP5-8.5'];
const selectedMode = ref('default');
const selectedScenario = ref(SCENARIO_CONFIG.DEFAULT_SCENARIO);
const selectedReferenceScenario = ref(
  SCENARIO_CONFIG.DEFAULT_REFERENCE_SCENARIO
);
const selectedComparisonScenario = ref(
  SCENARIO_CONFIG.DEFAULT_COMPARISON_SCENARIO
);
const showDropdown = ref(false);
const showReferenceDropdown = ref(false);
const showComparisonDropdown = ref(false);
const tooltipVisible = ref(false);
let tooltipTimeout = null;
const scenarioTooltipVisible = ref(false);
let scenarioTooltipTimeout = null;
watch(
  () => props.selectedProjection,
  (newProjection) => {
    if (newProjection && scenarios.includes(newProjection)) {
      selectedScenario.value = newProjection;
    }
  },
  { immediate: true }
);

const selectMode = (mode) => {
  selectedMode.value = mode;
  showDropdown.value = false;
  emit('mode-change', mode);
};

const showTooltip = () => {
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout);
  }
  tooltipTimeout = setTimeout(() => {
    tooltipVisible.value = true;
  }, 750);
};

const hideTooltip = () => {
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout);
    tooltipTimeout = null;
  }
  tooltipVisible.value = false;
};

const showScenarioTooltip = () => {
  if (scenarioTooltipTimeout) {
    clearTimeout(scenarioTooltipTimeout);
  }
  if (scenarioTooltipVisible.value) {
    scenarioTooltipTimeout = null;
    return;
  }
  scenarioTooltipTimeout = setTimeout(() => {
    scenarioTooltipVisible.value = true;
    scenarioTooltipTimeout = null;
  }, 750);
};

const hideScenarioTooltip = () => {
  if (scenarioTooltipTimeout) {
    clearTimeout(scenarioTooltipTimeout);
  }
  scenarioTooltipTimeout = setTimeout(() => {
    scenarioTooltipVisible.value = false;
    scenarioTooltipTimeout = null;
  }, 100);
};
const handleClickOutside = (event) => {
  if (!event.target.closest('.visualization-mode-dropdown')) {
    showDropdown.value = false;
  }
  if (!event.target.closest('.scenario-dropdown')) {
    showReferenceDropdown.value = false;
    showComparisonDropdown.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout);
  }
  if (scenarioTooltipTimeout) {
    clearTimeout(scenarioTooltipTimeout);
  }
});

const selectScenario = (scenario) => {
  if (selectedScenario.value !== scenario) {
    selectedScenario.value = scenario;
    emit('scenario-change', scenario);
  }
};

const selectReferenceScenario = (scenario) => {
  selectedReferenceScenario.value = scenario;
  showReferenceDropdown.value = false;
  emit('reference-scenario-change', scenario);
};

const selectComparisonScenario = (scenario) => {
  selectedComparisonScenario.value = scenario;
  showComparisonDropdown.value = false;
  emit('comparison-scenario-change', scenario);
};
</script>

<style scoped>
.mode-scenario-control-panel {
  position: absolute;
  left: 10px;
  bottom: 100%;
  margin-bottom: 0;
  padding: 6px 6px 0;
  background: white;
  border: 1px solid #e5e5e5;
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
  border-bottom: none;
  font-size: 12px;
  font-weight: 400;
  color: #666;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.15);
  clip-path: inset(-500px -10px 0 -10px);
  transition: all 0.2s;
  z-index: 1001;
  font-family: inherit;
  min-height: 24px;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 0;
  flex-shrink: 0;
  white-space: nowrap;
  overflow: visible;
}

.visualization-mode-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  justify-content: center;
}

.scenario-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  justify-content: center;
}

.visualization-mode-label {
  font-size: 10px;
  font-weight: 500;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;
  position: relative;
  cursor: help;
}

.scenario-label {
  font-size: 10px;
  font-weight: 500;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;
  position: relative;
  cursor: help;
  display: flex;
  align-items: center;
  gap: 6px;
}

.scenario-label.no-tooltip {
  cursor: default;
}

.tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: #e8e8e8;
  color: #333;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 400;
  font-style: normal;
  text-transform: none;
  letter-spacing: normal;
  white-space: normal;
  min-width: 370px;
  max-width: 400px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1004;
  pointer-events: auto;
}

.tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: #e8e8e8;
}

.tooltip-left-aligned {
  left: 0;
  transform: none;
}

.tooltip-left-aligned::after {
  left: 60px;
  transform: translateX(-50%);
}

.tooltip p {
  margin: 0 0 8px 0;
  font-weight: 500;
}

.tooltip ul {
  margin: 0;
  padding-left: 20px;
  list-style: disc;
}

.tooltip li {
  margin: 4px 0;
  line-height: 1.4;
}

.tooltip strong {
  font-weight: 600;
}

.tooltip-link {
  margin-top: 8px;
  margin-bottom: 0;
}

.tooltip-link-anchor {
  color: #0066cc;
  text-decoration: underline;
}

/* Tooltip transitions */
.tooltip-enter-active,
.tooltip-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(4px);
}

.tooltip-enter-to,
.tooltip-leave-from {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.tooltip-left-aligned.tooltip-enter-from,
.tooltip-left-aligned.tooltip-leave-to {
  transform: translateY(4px);
}

.tooltip-left-aligned.tooltip-enter-to,
.tooltip-left-aligned.tooltip-leave-from {
  transform: translateY(0);
}

.visualization-mode-dropdown {
  position: relative;
  z-index: 1003;
  overflow: visible;
  width: 180px;
}

.visualization-mode-dropdown-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  width: 100%;
  min-width: 140px;
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
  color: #333;
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
  bottom: calc(100% + 4px);
  left: 0;
  right: 0;
  min-width: 120px;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15);
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
  color: #333;
  font-weight: 600;
}

.vertical-divider {
  width: 1px;
  background: #e5e5e5;
  margin: 0 6px;
  flex-shrink: 0;
  align-self: stretch;
  min-height: 100%;
}

.scenario-toggles {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.scenario-toggle {
  flex: 1;
  padding: 8px 12px;
  background: transparent;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 400;
  color: #666;
  transition: all 0.2s;
  font-family: inherit;
  text-align: center;
  min-width: 100px;
  white-space: nowrap;
}

.scenario-toggle:hover {
  background: #f5f5f5;
  color: #333;
}

.scenario-toggle.active {
  background: #f5f5f5;
  color: #333;
  font-weight: 600;
}

.scenario-color-indicator {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  flex-shrink: 0;
}

.scenario-color-reference {
  background-color: rgba(59, 130, 246, 0.7);
}

.scenario-color-comparison {
  background-color: rgba(249, 115, 22, 0.7);
}

.scenario-dropdown {
  position: relative;
  z-index: 1003;
  overflow: visible;
}

.scenario-dropdown-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  min-width: 120px;
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

.scenario-dropdown-button:hover {
  background: #f5f5f5;
  border-color: #d0d0d0;
  color: #333;
}

.scenario-dropdown-button svg {
  transition: transform 0.2s;
  flex-shrink: 0;
}

.scenario-dropdown-button svg.rotated {
  transform: rotate(180deg);
}

.scenario-dropdown-menu {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  right: 0;
  min-width: 120px;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 1002;
}

.scenario-dropdown-item {
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

.scenario-dropdown-item:hover {
  background: #f5f5f5;
  color: #333;
}

.scenario-dropdown-item.active {
  color: #333;
  font-weight: 600;
}

.comparison-scenarios {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.dropdown-enter-active,
.dropdown-enter-active,
.dropdown-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.dropdown-enter-to,
.dropdown-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
