<template>
  <div v-if="mapLoaded" class="time-slider-wrapper">
    <div 
      class="toggle-background"
      :class="{ 'expanded': selectedProjection !== 'Current' && selectedProjection !== null }"
    >
      <div 
        v-if="selectedProjection !== 'Current' && selectedProjection !== null"
        class="timeslider-container"
      >
        <input
          type="range"
          :min="minYear"
          :max="maxYear"
          :step="step"
          :value="currentYear"
          @input="handleYearChange"
          class="time-slider"
        />
        <div class="year-labels">
          <span>{{ minYear }}</span>
          <span>{{ currentYear }}</span>
          <span>{{ maxYear }}</span>
        </div>
      </div>
      <div 
        class="toggle-container"
        @click="toggle"
      >
        <div 
          class="toggle-indicator"
          :class="{ 'on-projected': selectedProjection !== 'Current' && selectedProjection !== null }"
        ></div>
        <span 
          class="toggle-option"
          :class="{ 'selected': selectedProjection === 'Current' }"
        >
          Current
        </span>
        <span 
          class="toggle-option"
          :class="{ 'selected': selectedProjection !== 'Current' && selectedProjection !== null }"
        >
          Projected
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  mapLoaded: {
    type: Boolean,
    default: false
  },
  selectedProjection: {
    type: String,
    default: null
  },
  currentYear: {
    type: Number,
    default: 2020
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
  }
})

const emit = defineEmits(['projection-change', 'year-change'])

const toggle = () => {
  // Toggle behavior: always switch to the opposite state
  if (props.selectedProjection === 'Current') {
    // Currently on Current, switch to Projected
    emit('projection-change', 'SSP1-2.6')
  } else {
    // Currently on Projected (or null), switch to Current
    emit('projection-change', 'Current')
  }
}

const handleYearChange = (event) => {
  const year = parseInt(event.target.value)
  emit('year-change', year)
}
</script>

<style scoped>
.time-slider-wrapper {
  position: absolute;
  bottom: 10px;
  left: 10px;
  right: 10px;
  z-index: 1001;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  /* outline: 2px solid red; */
}

.toggle-background {
  position: absolute;
  left: 0;
  bottom: 0;
  background: #e5e5e5;
  border-radius: 10px;
  width: 200px;
  height: 40px;
  padding: 0px;
  box-sizing: border-box;
  transition: width 0.3s ease, right 0.3s ease, height 0.3s ease;
  pointer-events: none;
  /* outline: 2px solid blue; */
}

.toggle-background.expanded {
  right: 0;
  width: auto;
  height: 200px;
}

.timeslider-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 40px;
  background: white;
  border-radius: 10px;
  /* border: 2px solid #87CEEB; */
  box-sizing: border-box;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: auto;
}

.time-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #e5e5e5;
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
  background: #87CEEB;
  border: 2px solid white;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.time-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #87CEEB;
  border: 2px solid white;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.year-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #666;
  padding: 0 4px;
}

.year-labels span:nth-child(2) {
  font-weight: 600;
  color: #333;
}

.toggle-indicator {
  position: absolute;
  left: 0px;
  top: 0px;
  width: 50%;
  height: 100%;
  background: white;
  border-radius: 10px;
  /* border: 2px solid #87CEEB; */
  box-sizing: border-box;
  transition: transform 0.3s ease, border-radius 0.3s ease;
  pointer-events: none;
  z-index: 1;
  /* outline: 2px solid green; */
}

.toggle-indicator::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: inherit;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  pointer-events: none;
  clip-path: inset(0 -10px -10px -10px);
}

.toggle-indicator.on-projected {
  transform: translateX(100%);
  border-radius: 0 0 10px 10px;
  /* border-top: none;
  border-left: 2px solid #87CEEB;
  border-right: 2px solid #87CEEB;
  border-bottom: 2px solid #87CEEB; */
}

.toggle-container {
  position: absolute;
  left: 0px;
  bottom: 0px;
  display: inline-flex;
  align-items: center;
  width: 200px;
  height: 40px;
  pointer-events: auto;
  cursor: pointer;
  /* outline: 2px solid orange; */
}

.toggle-option {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 500;
  color: #666;
  transition: color 0.2s;
  user-select: none;
  position: relative;
  z-index: 3;
  /* outline: 2px solid purple; */
}

.toggle-option.selected {
  color: #333;
}
</style>

