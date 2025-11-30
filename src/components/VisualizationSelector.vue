<template>
  <div v-if="mapLoaded" class="visualization-selector">
    <button
      @click="toggleExpanded"
      class="visualization-button"
      :class="{ expanded: isExpanded }"
      title="Select visualization type"
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
        <line x1="18" y1="20" x2="18" y2="10"></line>
        <line x1="12" y1="20" x2="12" y2="4"></line>
        <line x1="6" y1="20" x2="6" y2="14"></line>
      </svg>
      <span>{{ selectedVisualization || 'Visualization' }}</span>
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
      <div class="visualization-grid">
        <button
          v-for="option in visualizationOptions"
          :key="option"
          @click="selectVisualization(option)"
          class="visualization-option"
          :class="{ 
            active: selectedVisualization === option,
            disabled: option !== 'Area' && option !== 'Outlines Only'
          }"
          :disabled="option !== 'Area' && option !== 'Outlines Only'"
        >
          {{ option }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  mapLoaded: {
    type: Boolean,
    default: false
  },
  selectedVisualization: {
    type: String,
    default: null
  },
  visualizationOptions: {
    type: Array,
    default: () => ["Outlines Only", "Area", "Elevation", "Volume", "Ice Thickness"]
  }
});

const emit = defineEmits(['visualization-change']);

const isExpanded = ref(false);

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value;
};

const selectVisualization = (visualization) => {
  // Only allow selecting "Area" or "Outlines Only" for now
  if (visualization !== 'Area' && visualization !== 'Outlines Only') {
    return;
  }
  emit('visualization-change', visualization);
  isExpanded.value = false;
};

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  const container = event.target.closest('.visualization-selector');
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
</script>

<style scoped>
.visualization-selector {
  position: absolute;
  top: 20px; /* Aligned with sidebar top */
  left: 352px; /* 20px (sidebar left) + 320px (sidebar width) + 12px (gap) */
  z-index: 1000;
}

.visualization-button {
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

.visualization-button .icon {
  flex-shrink: 0;
  color: #666;
}

.visualization-button:hover {
  background: #f5f5f5;
  border-color: #d0d0d0;
}

.visualization-button.expanded {
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
  min-width: 400px;
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

.visualization-grid {
  display: flex;
  flex-direction: row;
  gap: 12px;
}

.visualization-option {
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

.visualization-option:hover {
  background: #f5f5f5;
  border-color: #d0d0d0;
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.visualization-option.active {
  background: #e5e5e5;
  border-color: #87CEEB;
  color: #333;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.visualization-option.active:hover {
  background: #d0d0d0;
  border-color: #5F9EA0;
}

.visualization-option.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.visualization-option.disabled:hover {
  background: #f9f9f9;
  border-color: #e5e5e5;
  transform: none;
  box-shadow: none;
}
</style>
