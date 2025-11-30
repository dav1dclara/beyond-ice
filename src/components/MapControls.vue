<template>
  <div class="map-controls">
    <button
      @click="$emit('reset-bearing')"
      class="compass-button"
      title="Reset map to north"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
      </svg>
    </button>
    <button
      @click="$emit('toggle')"
      class="terrain-toggle-button"
      :class="{ 'is-3d': is3D }"
      :title="is3D ? 'Switch to 2D view' : 'Switch to 3D view'"
    >
      {{ is3D ? '2D' : '3D' }}
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

defineEmits(['reset-bearing', 'toggle'])
</script>

<style scoped>
.map-controls {
  position: absolute;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-end;
}

.compass-button {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.2s;
  color: #333;
  padding: 0;
}

.compass-button:hover {
  background: #f5f5f5;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.compass-button svg {
  width: 20px;
  height: 20px;
}

.terrain-toggle-button {
  min-width: 50px;
  height: 36px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.2s;
  color: #333;
  font-size: 14px;
  font-weight: 600;
}

.terrain-toggle-button:hover {
  background: #f5f5f5;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.terrain-toggle-button.is-3d {
  background: #87CEEB;
  color: white;
  border-color: #87CEEB;
}

.terrain-toggle-button.is-3d:hover {
  background: #B0E0E6;
}
</style>
