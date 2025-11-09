<template>
  <div v-if="visible" class="tooltip" :style="{ left: x + 'px', top: y + 'px' }">
    <div class="tooltip-content">
      <div v-for="(value, key) in properties" :key="key" class="tooltip-row">
        <span class="tooltip-key">{{ key }}:</span>
        <span class="tooltip-value">{{ value }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  x: {
    type: Number,
    default: 0,
  },
  y: {
    type: Number,
    default: 0,
  },
  properties: {
    type: Object,
    default: () => ({}),
  },
});
</script>

<style scoped>
.tooltip {
  position: absolute;
  pointer-events: none;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 8px 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  font-size: 12px;
  max-width: 300px;
  max-height: 400px;
  overflow-y: auto;
}

.tooltip-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 2px 0;
  border-bottom: 1px solid #eee;
}

.tooltip-row:last-child {
  border-bottom: none;
}

.tooltip-key {
  font-weight: 600;
  color: #333;
  min-width: 100px;
}

.tooltip-value {
  color: #666;
  text-align: right;
  word-break: break-word;
}
</style>

