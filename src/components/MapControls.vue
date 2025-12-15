<template>
  <div class="map-controls-bar">
    <button
      @click="$emit('toggle')"
      class="control-button"
      :class="{ 'is-3d': is3D }"
      :title="is3D ? 'Switch to 2D view' : 'Switch to 3D view'"
    >
      {{ is3D ? '2D' : '3D' }}
    </button>
    <button
      @click="$emit('zoom-to-extent')"
      class="control-button"
      title="Zoom to full extent of data"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="9" y1="3" x2="9" y2="21"></line>
        <line x1="3" y1="9" x2="21" y2="9"></line>
      </svg>
    </button>
  </div>
</template>

<script setup>
defineProps({
  is3D: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['toggle', 'zoom-to-extent'])
</script>

<style scoped>
.map-controls-bar {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 1000;
  display: flex;
  flex-direction: row;
  gap: 8px;
  align-items: center;
}

.control-button {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.2s;
  color: #333;
  padding: 0;
  font-size: 14px;
  font-weight: 600;
}

.control-button:hover {
  background: #f5f5f5;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.control-button svg {
  width: 20px;
  height: 20px;
}

.control-button.is-3d {
  background: var(--color-glacier-default);
  color: white;
  border-color: var(--color-glacier-default);
}

.control-button.is-3d:hover {
  background: #B0E0E6;
}
</style>
