<template>
  <div
    v-if="tooltip.visible && tooltip.feature"
    class="glacier-tooltip"
    :style="tooltipStyle"
  >
    <div class="tooltip-content">
      <div v-if="featureProps?.name" class="tooltip-title">
        {{ featureProps.name }}
      </div>
      <div class="tooltip-properties">
        <div v-if="featureProps?.['sgi-id']" class="tooltip-row">
          <span class="tooltip-label">SGI ID:</span>
          <span class="tooltip-value">{{ featureProps['sgi-id'] }}</span>
        </div>
        <div v-if="getAreaValue != null" class="tooltip-row">
          <span class="tooltip-label">Area:</span>
          <span class="tooltip-value">
            {{ getAreaValue.toFixed(2) }} km²
            <span v-if="areaChange != null" class="tooltip-change">
              ({{ areaChange.toFixed(1) }}% since 2020)
            </span>
          </span>
        </div>
        <div v-if="getVolumeValue != null" class="tooltip-row">
          <span class="tooltip-label">Volume:</span>
          <span class="tooltip-value">
            {{ getVolumeValue.toFixed(2) }} km³
            <span v-if="volumeChange != null" class="tooltip-change">
              ({{ volumeChange.toFixed(1) }}% since 2020)
            </span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  tooltip: {
    type: Object,
    required: true,
    // Validate that tooltip object has required properties
    validator: (value) => {
      return (
        typeof value === 'object' &&
        'visible' in value &&
        'feature' in value &&
        'x' in value &&
        'y' in value
      );
    },
  },
});

const featureProps = computed(() => props.tooltip.feature?.properties);

const getAreaValue = computed(() => featureProps.value?.['Area (km2)'] ?? null);

const getVolumeValue = computed(
  () => featureProps.value?.['Volume (km3)'] ?? null
);

const areaChange = computed(() => featureProps.value?.['Area change (%)']);

const volumeChange = computed(() => featureProps.value?.['Volume change (%)']);

// Compute tooltip position style
const tooltipStyle = computed(() => ({
  left: `${props.tooltip.x}px`,
  top: `${props.tooltip.y}px`,
}));
</script>

<style scoped>
.glacier-tooltip {
  position: absolute;
  pointer-events: none;
  z-index: 2000;
  background: #f5f5f5;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 0;
  max-width: 280px;
  font-size: 11px;
  line-height: 1.4;
}

.tooltip-content {
  padding: 8px 10px;
}

.tooltip-title {
  font-weight: 600;
  font-size: 12px;
  color: #333333;
  margin-bottom: 6px;
}

.tooltip-properties {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tooltip-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.tooltip-label {
  color: #333333;
  font-weight: 400;
  flex-shrink: 0;
  font-size: 11px;
  width: 50px;
}

.tooltip-value {
  color: #333333;
  text-align: left;
  font-weight: 500;
  font-size: 11px;
  flex: 1;
}

.tooltip-change {
  color: #333333;
  font-weight: 400;
}
</style>
