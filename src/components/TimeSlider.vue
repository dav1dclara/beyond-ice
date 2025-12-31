<template>
  <div class="time-slider-section">
    <button
      @click="togglePlay"
      class="play-button"
      :class="{ disabled: disabled }"
      :disabled="disabled"
      :title="isPlaying ? 'Pause animation' : 'Play animation'"
    >
      <svg
        v-if="!isPlaying"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M8 5v14l11-7z" />
      </svg>
      <svg
        v-else
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
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
        :class="{ disabled: disabled }"
        :disabled="disabled"
      />
      <div
        class="thumb-year-label"
        :style="getThumbYearStyle()"
        :class="{ disabled: disabled }"
      >
        {{ currentYear }}
      </div>
      <div class="year-labels" :class="{ disabled: disabled }">
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
import { ref, computed, watch, onBeforeUnmount } from 'vue';

const props = defineProps({
  currentYear: {
    type: Number,
    required: true,
  },
  minYear: {
    type: Number,
    required: true,
  },
  maxYear: {
    type: Number,
    required: true,
  },
  step: {
    type: Number,
    default: 2,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['year-change']);

const isPlaying = ref(false);
let playInterval = null;
const playSpeed = 500; // milliseconds per year step

const handleYearChange = (event) => {
  const year = parseInt(event.target.value);
  // If user manually changes year while playing, stop animation
  if (isPlaying.value) {
    stopAnimation();
  }
  emit('year-change', year);
};

const togglePlay = () => {
  if (props.disabled) return;
  if (isPlaying.value) {
    stopAnimation();
  } else {
    startAnimation();
  }
};

const startAnimation = () => {
  if (isPlaying.value) return;

  isPlaying.value = true;
  let currentYearValue = props.currentYear;

  playInterval = setInterval(() => {
    const nextYear = currentYearValue + props.step;

    if (nextYear > props.maxYear) {
      currentYearValue = props.maxYear;
      stopAnimation();
      return;
    }

    currentYearValue = nextYear;

    emit('year-change', currentYearValue);
  }, playSpeed);
};

const stopAnimation = () => {
  isPlaying.value = false;
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }
};

watch(
  () => props.currentYear,
  (newYear) => {
    if (newYear >= props.maxYear && isPlaying.value) {
      stopAnimation();
    }
  }
);

onBeforeUnmount(() => {
  stopAnimation();
});

const yearLabels = computed(() => {
  const labels = [];
  const startYear = Math.ceil(props.minYear / 10) * 10;
  const endYear = Math.floor(props.maxYear / 10) * 10;

  for (let year = startYear; year <= endYear; year += 10) {
    labels.push(year);
  }

  if (labels[0] !== props.minYear) {
    labels.unshift(props.minYear);
  }
  if (labels[labels.length - 1] !== props.maxYear) {
    labels.push(props.maxYear);
  }

  return labels;
});

const getYearLabelStyle = (year) => {
  const min = props.minYear;
  const max = props.maxYear;
  const percentage = ((year - min) / (max - min)) * 100;

  return {
    position: 'absolute',
    left: `${percentage}%`,
    transform: 'translateX(-50%)',
  };
};

const getThumbYearStyle = () => {
  const min = props.minYear;
  const max = props.maxYear;
  const percentage = ((props.currentYear - min) / (max - min)) * 100;

  return {
    left: `calc(12px + ${percentage}% - ${(percentage * 24) / 100}px)`,
  };
};
</script>

<style scoped>
.time-slider-section {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
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
  transition:
    border-color 0.2s,
    background 0.2s;
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
}

.time-slider {
  position: relative;
  width: calc(100% - 8px);
  height: 6px;
  border-radius: 3px;
  background: #e5e5e5;
  -webkit-appearance: none;
  appearance: none;
  margin: 0 0 24px 0;
  margin-left: 4px;
  margin-right: 4px;
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
  width: 16px;
  height: 16px;
  background: #d0d0d0;
  border: 2px solid white;
  cursor: pointer;
}

.time-slider::-moz-range-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: #d0d0d0;
  border: 2px solid white;
  cursor: pointer;
}

.thumb-year-label {
  position: absolute;
  top: 3px;
  transform: translate(-50%, -50%);
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 12px;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  pointer-events: none;
  z-index: 10;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.thumb-year-label.disabled {
  opacity: 0.5;
}

.year-labels {
  position: absolute;
  bottom: 0;
  left: 14px;
  right: 14px;
  width: calc(100% - 28px);
  font-size: 12px;
  color: #666;
  height: 16px;
  box-sizing: border-box;
  z-index: 2;
}

.year-labels.disabled {
  opacity: 0.5;
}

.year-labels span {
  position: absolute;
  bottom: -2px;
  white-space: nowrap;
}
</style>
