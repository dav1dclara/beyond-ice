<template>
  <div class="projection-control-button">
    <div class="visualization-mode-content">
      <span class="visualization-mode-label">visualization mode</span>
      <div class="visualization-mode-dropdown" @click.stop="showDropdown = !showDropdown">
        <button class="visualization-mode-dropdown-button">
          <span>{{ selectedMode }}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="{ rotated: showDropdown }">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <Transition name="dropdown">
          <div v-if="showDropdown" class="visualization-mode-dropdown-menu" @click.stop>
            <button
              v-for="mode in modes"
              :key="mode"
              class="visualization-mode-dropdown-item"
              :class="{ 'active': selectedMode === mode }"
              @click="selectMode(mode)"
            >
              {{ mode }}
            </button>
          </div>
        </Transition>
      </div>
    </div>
    <div v-if="selectedMode === 'default' || selectedMode === 'overlay' || selectedMode === 'comparison'" class="divider"></div>
    <div v-if="selectedMode === 'default' || selectedMode === 'overlay'" class="scenario-section">
      <span class="scenario-label">climate change scenario</span>
      <div class="scenario-toggles">
        <button
          v-for="scenario in scenarios"
          :key="scenario"
          class="scenario-toggle"
          :class="{ 'active': selectedScenario === scenario }"
          @click="selectScenario(scenario)"
        >
          {{ scenario }}
        </button>
      </div>
    </div>
    <div v-if="selectedMode === 'default' || selectedMode === 'overlay'" class="divider"></div>
    <div v-if="selectedMode === 'comparison'" class="comparison-scenarios">
      <div class="scenario-section">
        <span class="scenario-label">
          <span class="scenario-color-indicator" style="background-color: #60A5FA;"></span>
          reference scenario
        </span>
        <div class="scenario-dropdown" @click.stop="showReferenceDropdown = !showReferenceDropdown">
          <button class="scenario-dropdown-button">
            <span>{{ selectedReferenceScenario }}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="{ rotated: showReferenceDropdown }">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          <Transition name="dropdown">
            <div v-if="showReferenceDropdown" class="scenario-dropdown-menu" @click.stop>
              <button
                v-for="scenario in scenarios"
                :key="`ref-${scenario}`"
                class="scenario-dropdown-item"
                :class="{ 'active': selectedReferenceScenario === scenario }"
                @click="selectReferenceScenario(scenario)"
              >
                {{ scenario }}
              </button>
            </div>
          </Transition>
        </div>
      </div>
      <div class="scenario-section">
        <span class="scenario-label">
          <span class="scenario-color-indicator" style="background-color: #EF4444;"></span>
          comparison scenario
        </span>
        <div class="scenario-dropdown" @click.stop="showComparisonDropdown = !showComparisonDropdown">
          <button class="scenario-dropdown-button">
            <span>{{ selectedComparisonScenario }}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="{ rotated: showComparisonDropdown }">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          <Transition name="dropdown">
            <div v-if="showComparisonDropdown" class="scenario-dropdown-menu" @click.stop>
              <button
                v-for="scenario in scenarios"
                :key="`comp-${scenario}`"
                class="scenario-dropdown-item"
                :class="{ 'active': selectedComparisonScenario === scenario }"
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
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

const props = defineProps({
  selectedProjection: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['mode-change', 'scenario-change', 'reference-scenario-change', 'comparison-scenario-change'])

const modes = ['default', 'overlay', 'comparison']
const scenarios = ['SSP1-2.6', 'SSP2-4.5', 'SSP3-7.0', 'SSP5-8.5']
const selectedMode = ref('default')
const selectedScenario = ref('SSP2-4.5')
const selectedReferenceScenario = ref('SSP2-4.5')
const selectedComparisonScenario = ref('SSP5-8.5')
const showDropdown = ref(false)
const showReferenceDropdown = ref(false)
const showComparisonDropdown = ref(false)

// Sync selectedScenario with prop
watch(() => props.selectedProjection, (newProjection) => {
  if (newProjection && scenarios.includes(newProjection)) {
    selectedScenario.value = newProjection
  }
}, { immediate: true })

const selectMode = (mode) => {
  selectedMode.value = mode
  showDropdown.value = false
  emit('mode-change', mode)
}

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  if (!event.target.closest('.visualization-mode-dropdown')) {
    showDropdown.value = false
  }
  if (!event.target.closest('.scenario-dropdown')) {
    showReferenceDropdown.value = false
    showComparisonDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})

const selectScenario = (scenario) => {
  // Only emit if not already on this scenario
  if (selectedScenario.value !== scenario) {
    selectedScenario.value = scenario
    emit('scenario-change', scenario)
  }
}

const selectReferenceScenario = (scenario) => {
  selectedReferenceScenario.value = scenario
  showReferenceDropdown.value = false
  emit('reference-scenario-change', scenario)
}

const selectComparisonScenario = (scenario) => {
  selectedComparisonScenario.value = scenario
  showComparisonDropdown.value = false
  emit('comparison-scenario-change', scenario)
}
</script>

<style scoped>
.projection-control-button {
  position: absolute;
  left: 10px;
  bottom: 100%;
  margin-bottom: 0;
  padding: 6px 12px;
  background: white;
  border: 1px solid #e5e5e5;
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  border-bottom: none;
  font-size: 12px;
  font-weight: 400;
  color: #666;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.15);
  clip-path: inset(-200px -10px 0 -10px);
  transition: all 0.2s;
  z-index: 1001;
  font-family: inherit;
  min-height: 24px;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 0;
  flex-shrink: 0;
  white-space: nowrap;
  overflow: visible;
}

.visualization-mode-content {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.divider {
  width: 1px;
  background: #e5e5e5;
  margin: 6px 12px 6px 12px;
  flex-shrink: 0;
  align-self: stretch;
  min-height: calc(100% - 12px);
}

.scenario-section {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
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
  background: #e8f4f8;
  color: #333;
  font-weight: 600;
  border-color: #4a90e2;
}

.scenario-label {
  font-size: 12px;
  font-weight: 500;
  font-style: italic;
  color: #666;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}


.scenario-color-indicator {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  flex-shrink: 0;
  border: 1px solid rgba(0, 0, 0, 0.1);
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
  font-weight: 400;
  color: #666;
  transition: all 0.2s;
  font-family: inherit;
  box-sizing: border-box;
}

.scenario-dropdown-button:hover {
  background: #f5f5f5;
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
  background: #e8f4f8;
  color: #333;
  font-weight: 600;
}

.comparison-scenarios {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.visualization-mode-label {
  font-size: 12px;
  font-weight: 500;
  font-style: italic;
  color: #666;
  flex-shrink: 0;
}

.visualization-mode-dropdown {
  position: relative;
  z-index: 1003;
  overflow: visible;
}

.visualization-mode-dropdown-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  width: 100%;
  min-width: 120px;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 400;
  color: #666;
  transition: all 0.2s;
  font-family: inherit;
  box-sizing: border-box;
}

.visualization-mode-dropdown-button:hover {
  background: #f5f5f5;
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
  background: #e8f4f8;
  color: #333;
  font-weight: 600;
}

/* Dropdown transitions */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
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
