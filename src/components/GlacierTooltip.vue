<template>
  <div 
    v-if="tooltip.visible && tooltip.feature" 
    class="glacier-tooltip"
    :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
  >
    <div class="tooltip-content">
      <div v-if="tooltip.feature.properties?.name" class="tooltip-title">
        {{ tooltip.feature.properties.name }}
      </div>
      <div class="tooltip-properties">
        <div v-if="tooltip.feature.properties?.['sgi-id']" class="tooltip-row">
          <span class="tooltip-label">SGI ID:</span>
          <span class="tooltip-value">{{ tooltip.feature.properties['sgi-id'] }}</span>
        </div>
        <div v-if="getAreaValue !== null && getAreaValue !== undefined" class="tooltip-row">
          <span class="tooltip-label">Area:</span>
          <span class="tooltip-value">
            {{ getAreaValue.toFixed(2) }} km²
            <span v-if="tooltip.feature.properties?.['Area change (%)'] !== undefined" class="tooltip-change">
              ({{ tooltip.feature.properties['Area change (%)']?.toFixed(1) }}% since 2020)
            </span>
          </span>
        </div>
        <div v-if="getVolumeValue !== null && getVolumeValue !== undefined" class="tooltip-row">
          <span class="tooltip-label">Volume:</span>
          <span class="tooltip-value">
            {{ getVolumeValue.toFixed(2) }} km³
            <span v-if="tooltip.feature.properties?.['Volume change (%)'] !== undefined" class="tooltip-change">
              ({{ tooltip.feature.properties['Volume change (%)']?.toFixed(1) }}% since 2020)
            </span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  tooltip: {
    type: Object,
    required: true,
    validator: (value) => {
      return (
        typeof value === 'object' &&
        'visible' in value &&
        'feature' in value &&
        'x' in value &&
        'y' in value
      )
    }
  }
})

// Helper to extract area value from feature properties
const getAreaValue = computed(() => {
  if (!props.tooltip.feature?.properties) return null
  const featureProps = props.tooltip.feature.properties
  return featureProps['Area (km2)'] ?? featureProps['area_km2'] ?? featureProps['Area'] ?? featureProps['area'] ?? null
})

// Helper to extract volume value from feature properties
const getVolumeValue = computed(() => {
  if (!props.tooltip.feature?.properties) return null
  const featureProps = props.tooltip.feature.properties
  return featureProps['Volume (km3)'] ?? featureProps['volume_km3'] ?? featureProps['Volume'] ?? featureProps['volume'] ?? null
})
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

