<template>
  <div class="time-slider-group">
    <button
      @click="togglePlay"
      class="play-button"
      :class="{ 'disabled': disabled }"
      :disabled="disabled"
      :title="isPlaying ? 'Pause animation' : 'Play animation'"
    >
      <svg v-if="!isPlaying" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z"/>
      </svg>
      <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
      </svg>
    </button>
    <div class="timeslider-container">
      <input
        type="range"
        :min="minYear"
        :max="maxYear"
        :step="step"
        :value="currentYear"
        @input="handleYearChange"
        class="time-slider"
        :class="{ 'disabled': disabled }"
        :disabled="disabled"
      />
      <div class="year-labels" :class="{ 'disabled': disabled }">
        <span
          v-for="year in yearLabels"
          :key="year"
          :style="getYearLabelStyle(year)"
        >
          {{ year }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  currentYear: {
    type: Number,
    required: true
  },
  minYear: {
    type: Number,
    required: true
  },
  maxYear: {
    type: Number,
    required: true
  },
  step: {
    type: Number,
    default: 2
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['year-change'])

// Play animation state
const isPlaying = ref(false)
let playInterval = null
const playSpeed = 500 // milliseconds per year step

const handleYearChange = (event) => {
  const year = parseInt(event.target.value)
  // If user manually changes year while playing, stop animation
  if (isPlaying.value) {
    stopAnimation()
  }
  emit('year-change', year)
}

// Toggle play/pause animation
const togglePlay = () => {
  if (props.disabled) return
  if (isPlaying.value) {
    stopAnimation()
  } else {
    startAnimation()
  }
}

// Start the animation
const startAnimation = () => {
  if (isPlaying.value) return
  
  isPlaying.value = true
  let currentYearValue = props.currentYear
  
  playInterval = setInterval(() => {
    // Calculate next year
    const nextYear = currentYearValue + props.step
    
    // If we've reached the max year, stop
    if (nextYear > props.maxYear) {
      currentYearValue = props.maxYear
      stopAnimation()
      return
    }
    
    // Move to next year
    currentYearValue = nextYear
    
    // Emit the year change
    emit('year-change', currentYearValue)
  }, playSpeed)
}

// Stop the animation
const stopAnimation = () => {
  isPlaying.value = false
  if (playInterval) {
    clearInterval(playInterval)
    playInterval = null
  }
}

// Watch for reaching max year and stop animation
watch(() => props.currentYear, (newYear) => {
  // If we've reached the max year while playing, stop
  if (newYear >= props.maxYear && isPlaying.value) {
    stopAnimation()
  }
})

// Cleanup on unmount
onBeforeUnmount(() => {
  stopAnimation()
})

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
</script>

<style scoped>
.time-slider-group {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  /* outline: red solid 1px; */
  padding-right: 4px;
  padding-left: 4px;
}

.play-button {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: box-shadow 0.2s, border-color 0.2s, background 0.2s;
  color: #333;
  padding: 0;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  box-sizing: border-box;
  flex-shrink: 0;
}

.play-button:hover:not(.disabled) {
  background: #f5f5f5;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.play-button.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.play-button svg {
  width: 16px;
  height: 16px;
}

.timeslider-container {
  position: relative;
  flex: 1;
  width: 100%;
  padding-bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  --thumb-width: 18px;
  --thumb-offset: calc(var(--thumb-width) / 2);
}

.time-slider {
  position: relative;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #e5e5e5;
  -webkit-appearance: none;
  appearance: none;
  margin: 0 0 24px 0;
  padding: 0;
  z-index: 1;
}

.time-slider.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.time-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-glacier-default);
  border: 2px solid white;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.time-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-glacier-default);
  border: 2px solid white;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.year-labels {
  position: absolute;
  bottom: 0;
  left: var(--thumb-offset);
  right: var(--thumb-offset);
  font-size: 12px;
  color: #666;
  height: 16px;
  box-sizing: border-box;
  z-index: 2;
  /* outline: blue solid 1px; */
}

.year-labels.disabled {
  opacity: 0.5;
}

.year-labels span {
  position: absolute;
  bottom: -2px;
  white-space: nowrap;
  /* outline: orange solid 1px; */
}
</style>
