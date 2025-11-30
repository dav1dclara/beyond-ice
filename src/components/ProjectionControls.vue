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
    
    <!-- Time Slider (outside dropdown, only when a scenario is selected, not "Current") -->
    <div v-if="selectedProjection && selectedProjection !== 'Current'" class="time-slider-wrapper">
      <div class="slider-labels-top">
        <div class="label-row">
          <span class="label">{{ minYear }}</span>
          <span class="label current-year">{{ currentYear }}</span>
          <span class="label">{{ maxYear }}</span>
        </div>
      </div>
      <div class="slider-controls">
        <button
          @click="togglePlay"
          class="play-button"
          :title="isPlaying ? 'Pause animation' : 'Play animation'"
        >
          <svg
            v-if="!isPlaying"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          <svg
            v-else
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
        </button>
        <input
          type="range"
          :min="minYear"
          :max="maxYear"
          :step="step"
          :value="currentYear"
          @input="handleSliderChange"
          class="time-slider"
        />
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
const isPlaying = ref(false);
let animationInterval = null;

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value;
};

const selectProjection = (projection) => {
  emit('projection-change', projection);
  isExpanded.value = false;
};

const handleSliderChange = (event) => {
  // Stop animation if user manually moves slider
  if (isPlaying.value) {
    stopAnimation();
  }
  
  const value = parseInt(event.target.value);
  currentYear.value = Math.round(value / props.step) * props.step;
  emit('year-change', currentYear.value);
};

const togglePlay = () => {
  if (isPlaying.value) {
    // Pause
    stopAnimation();
  } else {
    // Play
    startAnimation();
  }
};

const startAnimation = () => {
  if (isPlaying.value) return;
  
  isPlaying.value = true;
  
  // Animation speed: 500ms per step (adjust as needed)
  const animationSpeed = 500;
  
  animationInterval = setInterval(() => {
    // Increment year by step
    const nextYear = currentYear.value + props.step;
    
    if (nextYear > props.maxYear) {
      // Reached the end, stop animation
      stopAnimation();
      // Optionally loop: reset to minYear
      // currentYear.value = props.minYear;
      // emit('year-change', currentYear.value);
    } else {
      currentYear.value = nextYear;
      emit('year-change', currentYear.value);
    }
  }, animationSpeed);
};

const stopAnimation = () => {
  isPlaying.value = false;
  if (animationInterval) {
    clearInterval(animationInterval);
    animationInterval = null;
  }
};

// Sync with prop changes
watch(() => props.initialYear, (newYear) => {
  if (newYear !== currentYear.value) {
    currentYear.value = newYear;
  }
});

// Stop animation when projection changes or component unmounts
watch(() => props.selectedProjection, () => {
  stopAnimation();
});

onBeforeUnmount(() => {
  stopAnimation();
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

.time-slider-wrapper {
  position: absolute;
  top: 0;
  left: 100%;
  margin-left: 12px;
  padding: 12px 16px;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 1001;
  min-width: 400px;
}

.slider-controls {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
}

.play-button {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #87CEEB;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.1s;
  padding: 0;
}

.play-button:hover {
  background: #5F9EA0;
  transform: translateY(-1px);
}

.play-button:active {
  transform: translateY(0);
}

.play-button svg {
  width: 16px;
  height: 16px;
}

.slider-labels-top {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #666;
  min-width: 120px;
}

.label-row {
  display: flex;
  justify-content: space-between;
  width: 100%;
}

.slider-labels-top .label {
  font-weight: 500;
}

.slider-labels-top .label.current-year {
  font-weight: 700;
  color: #333;
  font-size: 14px;
}

.time-slider {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: #d0d0d0;
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
  background: #666;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: background 0.2s;
}

.time-slider::-webkit-slider-thumb:hover {
  background: #333;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.time-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #666;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: background 0.2s;
}

.time-slider::-moz-range-thumb:hover {
  background: #333;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}
</style>
