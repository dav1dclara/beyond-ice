<template>
  <div class="time-slider-container">
    <div class="slider-wrapper">
      <input
        type="range"
        :min="minYear"
        :max="maxYear"
        :value="currentYear"
        @input="handleSliderChange"
        class="time-slider"
      />
      <div class="slider-labels">
        <span class="label">{{ minYear }}</span>
        <span class="label">{{ maxYear }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";

const props = defineProps({
  minYear: {
    type: Number,
    default: 2016,
  },
  maxYear: {
    type: Number,
    default: 2100,
  },
});

const currentYear = ref(props.minYear);

const handleSliderChange = (event) => {
  currentYear.value = parseInt(event.target.value);
  // Emit change event for future functionality
  // emit('change', currentYear.value);
};
</script>

<style scoped>
.time-slider-container {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  padding: 12px 16px;
  min-width: 300px;
  max-width: 500px;
}

.slider-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.time-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #e0e0e0;
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
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: background 0.2s;
}

.time-slider::-webkit-slider-thumb:hover {
  background: #B0E0E6;
}

.time-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #87CEEB;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: background 0.2s;
}

.time-slider::-moz-range-thumb:hover {
  background: #B0E0E6;
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #666;
  padding: 0 2px;
}

.label {
  font-weight: 500;
}
</style>

