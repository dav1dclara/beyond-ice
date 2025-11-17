<template>
  <div class="scenario-selector-container">
    <button
      @click="toggleDropdown"
      class="scenario-selector-button"
      :class="{ active: isOpen }"
    >
      <span class="selected-scenario">{{ selectedScenario || 'Select Scenario' }}</span>
      <span class="dropdown-arrow">▼</span>
    </button>
    <div v-if="isOpen" class="dropdown-menu">
      <button
        v-for="scenario in scenarios"
        :key="scenario"
        @click="selectScenario(scenario)"
        class="dropdown-option"
        :class="{ active: selectedScenario === scenario }"
      >
        {{ scenario }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";

const props = defineProps({
  scenarios: {
    type: Array,
    default: () => ["SSP1-1.9", "SSP1-2.6", "SSP2-4.5", "SSP3-7.0", "SSP5-8.5"], // Default SSP scenarios
  },
});

const emit = defineEmits(['change']);

const isOpen = ref(false);
const selectedScenario = ref(null);

const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
};

const selectScenario = (scenario) => {
  selectedScenario.value = scenario;
  isOpen.value = false;
  emit('change', scenario);
};

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  const container = event.target.closest('.scenario-selector-container');
  if (!container) {
    isOpen.value = false;
  }
};

// Add click outside listener when component is mounted
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.scenario-selector-container {
  position: absolute;
  bottom: 20px;
  left: 280px; /* Position to the right of CurrentProjectedToggle (160px width + 20px left + 40px gap) */
  z-index: 1000;
}

.scenario-selector-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 180px;
  height: 36px;
  padding: 0 12px;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: all 0.2s;
  color: #333;
  font-size: 14px;
  font-weight: 600;
  box-sizing: border-box;
}

.scenario-selector-button:hover {
  background: #f5f5f5;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.scenario-selector-button.active {
  border-color: #87CEEB;
  box-shadow: 0 2px 12px rgba(0, 136, 136, 0.2);
}

.selected-scenario {
  flex: 1;
  text-align: left;
  color: #333;
}

.scenario-selector-button.active .selected-scenario {
  color: #87CEEB;
}

.dropdown-arrow {
  margin-left: 8px;
  font-size: 10px;
  color: #666;
  transition: transform 0.2s;
}

.scenario-selector-button.active .dropdown-arrow {
  transform: rotate(180deg);
  color: #87CEEB;
}

.dropdown-menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  margin-bottom: 4px;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 1001;
}

.dropdown-option {
  width: 100%;
  padding: 10px 12px;
  background: white;
  border: none;
  border-bottom: 1px solid #eee;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s;
  color: #333;
  font-size: 14px;
  font-weight: 500;
}

.dropdown-option:last-child {
  border-bottom: none;
}

.dropdown-option:hover {
  background: #f5f5f5;
}

.dropdown-option.active {
  background: #87CEEB;
  color: white;
}

.dropdown-option.active:hover {
  background: #B0E0E6;
}
</style>

