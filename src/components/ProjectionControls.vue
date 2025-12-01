<template>
  <div v-if="mapLoaded" class="projection-controls">
    <button
      @click="toggleExpanded"
      class="projection-button"
      :class="{ expanded: isExpanded }"
      title="Select projection scenario"
    >
      <svg 
        class="icon" 
        width="16" 
        height="16" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        stroke-width="2" 
        stroke-linecap="round" 
        stroke-linejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
      <span>{{ selectedProjection || 'Projections' }}</span>
      <svg 
        class="dropdown-arrow" 
        :class="{ rotated: isExpanded }"
        width="12" 
        height="12" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        stroke-width="2" 
        stroke-linecap="round" 
        stroke-linejoin="round"
      >
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>
    
    <!-- Expanded content (expands downward) -->
    <div v-if="isExpanded" class="expanded-content">
      <!-- Current state button (full width) -->
      <button
        v-if="currentOption"
        @click="selectProjection(currentOption)"
        class="current-option"
        :class="{ active: selectedProjection === currentOption }"
      >
        {{ currentOption }}
      </button>
      
      <!-- Divider between Current and Projections -->
      <div v-if="currentOption && futureProjections.length > 0" class="divider"></div>
      
      <!-- Projections grid -->
      <div v-if="futureProjections.length > 0" class="projection-grid">
        <button
          v-for="option in futureProjections"
          :key="option"
          @click="selectProjection(option)"
          class="projection-option"
          :class="{ active: selectedProjection === option }"
        >
          {{ option }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  mapLoaded: {
    type: Boolean,
    default: false
  },
  selectedProjection: {
    type: String,
    default: null
  },
  projectionOptions: {
    type: Array,
    default: () => ["Current", "SSP1-2.6", "SSP2-4.5", "SSP3-7.0", "SSP5-8.5"]
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
  initialYear: {
    type: Number,
    default: 2020
  }
});

const emit = defineEmits(['projection-change', 'year-change']);

// Separate "Current" from projections
const currentOption = computed(() => {
  return props.projectionOptions.find(opt => opt === 'Current') || null;
});

const futureProjections = computed(() => {
  return props.projectionOptions.filter(opt => opt !== 'Current');
});

const currentYear = ref(props.initialYear);
const isExpanded = ref(false);

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value;
};

const selectProjection = (projection) => {
  emit('projection-change', projection);
  isExpanded.value = false;
};


// Sync with prop changes
watch(() => props.initialYear, (newYear) => {
  if (newYear !== currentYear.value) {
    currentYear.value = newYear;
  }
});


onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  const container = event.target.closest('.projection-controls');
  if (!container && isExpanded.value) {
    isExpanded.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});

// Commented out old functions
// const isScenarioDropdownOpen = ref(false);
// const currentYear = ref(props.initialYear);
// const selectCurrent = () => { ... }
// const selectProjected = () => { ... }
// const toggleScenarioDropdown = () => { ... }
// const selectScenario = (scenario) => { ... }
// const handleSliderChange = (event) => { ... }
</script>

<style scoped>
.projection-controls {
  position: absolute;
  top: 20px; /* Aligned with sidebar top */
  left: 544px; /* 20px (sidebar left) + 320px (sidebar width) + 12px (gap) + 180px (visualization selector) + 12px (gap) */
  z-index: 1000;
}

.projection-button {
  width: 180px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 12px;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: all 0.2s;
  color: #333;
  font-size: 14px;
  font-weight: 500;
  outline: none;
  box-sizing: border-box;
}

.projection-button .icon {
  flex-shrink: 0;
  color: #666;
}

.projection-button:hover {
  background: #f5f5f5;
  border-color: #d0d0d0;
}

.projection-button.expanded {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.dropdown-arrow {
  flex-shrink: 0;
  margin-left: 8px;
  color: #666;
  transition: transform 0.2s;
}

.dropdown-arrow.rotated {
  transform: rotate(180deg);
}

.expanded-content {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 500px;
  background: white;
  border: 1px solid #e5e5e5;
  border-top: none;
  border-radius: 0 0 8px 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 16px;
  animation: slideDown 0.3s ease-out;
  z-index: 1001;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.current-option {
  width: 100%;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f9f9f9;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: #333;
  font-size: 15px;
  font-weight: 600;
  text-align: center;
  padding: 12px;
  margin-bottom: 0;
}

.current-option:hover {
  background: #f5f5f5;
  border-color: #d0d0d0;
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.current-option.active {
  background: #e5e5e5;
  border-color: #87CEEB;
  color: #333;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.current-option.active:hover {
  background: #d0d0d0;
  border-color: #5F9EA0;
}

.divider {
  height: 1px;
  background: #e5e5e5;
  margin: 16px 0;
  width: 100%;
}

.projection-grid {
  display: flex;
  flex-direction: row;
  gap: 12px;
}

.projection-option {
  flex: 1;
  aspect-ratio: 1;
  min-width: 80px;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f9f9f9;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: #333;
  font-size: 14px;
  font-weight: 500;
  text-align: center;
  padding: 12px;
}

.projection-option:hover {
  background: #f5f5f5;
  border-color: #d0d0d0;
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.projection-option.active {
  background: #e5e5e5;
  border-color: #87CEEB;
  color: #333;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.projection-option.active:hover {
  background: #d0d0d0;
  border-color: #5F9EA0;
}
</style>
