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
        <div v-if="tooltip.feature.properties?.['Area change (%)'] !== undefined" class="tooltip-row">
          <span class="tooltip-label">Area Change:</span>
          <span class="tooltip-value">{{ tooltip.feature.properties['Area change (%)']?.toFixed(1) }}%</span>
        </div>
        <div v-if="tooltip.feature.properties?.['Volume change (%)'] !== undefined" class="tooltip-row">
          <span class="tooltip-label">Volume Change:</span>
          <span class="tooltip-value">{{ tooltip.feature.properties['Volume change (%)']?.toFixed(1) }}%</span>
        </div>
        <div v-if="tooltip.feature.properties?.Area !== undefined" class="tooltip-row">
          <span class="tooltip-label">Area:</span>
          <span class="tooltip-value">{{ tooltip.feature.properties.Area?.toFixed(2) }} km²</span>
        </div>
        <div v-if="tooltip.feature.properties?.Volume !== undefined" class="tooltip-row">
          <span class="tooltip-label">Volume:</span>
          <span class="tooltip-value">{{ tooltip.feature.properties.Volume?.toFixed(2) }} km³</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
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
</script>

<style scoped>
.glacier-tooltip {
  position: absolute;
  pointer-events: none;
  z-index: 2000;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 0;
  max-width: 280px;
  font-size: 12px;
  line-height: 1.5;
}

.tooltip-content {
  padding: 12px;
}

.tooltip-title {
  font-weight: 600;
  font-size: 13px;
  color: #333;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e5e5;
}

.tooltip-properties {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}

.tooltip-label {
  color: #666;
  font-weight: 500;
  flex-shrink: 0;
}

.tooltip-value {
  color: #333;
  text-align: right;
  font-weight: 600;
}
</style>

