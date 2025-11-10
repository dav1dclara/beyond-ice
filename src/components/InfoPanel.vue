<template>
  <div class="info-panel" :class="{ 'expanded': expanded }">
    <div v-if="!expanded" class="info-panel-button">
      <button
        @click="handleExpandClick"
        @mouseleave="handleExpandMouseLeave"
        class="expand-button"
        title="Show glacier details"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <span class="tooltip" :class="{ 'hidden': hideExpandTooltip }">Show glacier details</span>
      </button>
    </div>
    <div v-if="expanded" class="info-panel-content">
      <button
        @click="handleCloseClick"
        @mouseleave="handleCloseMouseLeave"
        class="close-button"
        title="Collapse panel"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        <span class="tooltip" :class="{ 'hidden': hideCloseTooltip }">Collapse panel</span>
      </button>
      <div v-if="glacierData" class="glacier-info">
        <div class="info-item">
          <span class="info-label">Name:</span>
          <span class="info-value">{{ glacierData.name || "N/A" }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">SGI-ID:</span>
          <span class="info-value">{{ glacierData["sgi-id"] || "N/A" }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

defineProps({
  expanded: {
    type: Boolean,
    default: false,
  },
  glacierData: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['close', 'toggle']);

const hideExpandTooltip = ref(false);
const hideCloseTooltip = ref(false);

const handleExpandClick = () => {
  hideExpandTooltip.value = true;
  // Emit a toggle event - parent will handle showing the panel
  emit('toggle');
};

const handleCloseClick = () => {
  hideCloseTooltip.value = true;
  emit('close');
};

const handleExpandMouseLeave = () => {
  hideExpandTooltip.value = false;
};

const handleCloseMouseLeave = () => {
  hideCloseTooltip.value = false;
};
</script>

<style scoped>
.info-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 48px;
  background: #ffffff;
  border-left: 1px solid #e5e5e5;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: width;
}

.info-panel:not(.expanded) {
  overflow: visible;
}

.info-panel.expanded {
  width: 320px;
}

.info-panel-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding-top: 6px;
  overflow: visible;
}

.expand-button {
  position: relative;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
  color: #666;
}

.expand-button:hover {
  background: #f5f5f5;
}

.expand-button:active {
  background: #e5e5e5;
}

.expand-button svg {
  width: 18px;
  height: 18px;
}

.expand-button .tooltip {
  position: absolute;
  right: 50px;
  top: 50%;
  transform: translateY(-50%);
  background: #333;
  color: white;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s;
  pointer-events: none;
  z-index: 10000;
}

.expand-button:hover .tooltip:not(.hidden) {
  opacity: 1;
  visibility: visible;
}

.expand-button .tooltip.hidden {
  opacity: 0;
  visibility: hidden;
}

.close-button {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: #666;
  transition: background-color 0.2s;
  padding: 0;
  z-index: 10;
}

.close-button:hover {
  background: #f5f5f5;
  color: #333;
}

.close-button svg {
  width: 18px;
  height: 18px;
}

.close-button .tooltip {
  position: absolute;
  right: 50px;
  top: 50%;
  transform: translateY(-50%);
  background: #333;
  color: white;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s;
  pointer-events: none;
  z-index: 10000;
}

.close-button:hover .tooltip:not(.hidden) {
  opacity: 1;
  visibility: visible;
}

.close-button .tooltip.hidden {
  opacity: 0;
  visibility: hidden;
}

.info-panel-content {
  position: relative;
  flex: 1;
  overflow-y: auto;
  padding: 50px 16px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.glacier-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: 16px;
  color: #333;
  font-weight: 500;
}
</style>
