<template>
  <div v-if="mapLoaded" class="map-controls">
    <button
      @click="$emit('zoom-to-extent')"
      class="control-button"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polygon
          points="12 3 3 10 5 10 5 20 19 20 19 10 21 10"
          fill="none"
        ></polygon>
      </svg>
    </button>
    <button
      @click="$emit('reset-bearing')"
      class="control-button"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <polygon points="12 2 6 10 18 10" fill="#333"></polygon>
        <polygon points="12 22 6 14 18 14" fill="#999"></polygon>
      </svg>
    </button>
    <button
      @click="$emit('toggle-terrain')"
      class="control-button"
      :class="{ 'is-3d': is3D }"
    >
      {{ is3D ? '2D' : '3D' }}
    </button>
    <div class="basemap-toggle">
      <button
        @click="$emit('toggle-basemap', false)"
        :class="{ active: !isSatellite }"
        class="basemap-toggle-button"
      >
        Light
      </button>
      <button
        @click="$emit('toggle-basemap', true)"
        :class="{ active: isSatellite }"
        class="basemap-toggle-button"
      >
        Aerial
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  mapLoaded: {
    type: Boolean,
    required: true,
  },
  is3D: {
    type: Boolean,
    required: true,
  },
  isSatellite: {
    type: Boolean,
    required: true,
  },
});

defineEmits([
  'zoom-to-extent',
  'reset-bearing',
  'toggle-terrain',
  'toggle-basemap',
]);
</script>

<style scoped>
.map-controls {
  position: absolute;
  top: 10px;
  right: 56px;
  z-index: 1000;
  display: flex;
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
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition:
    box-shadow 0.2s,
    border-color 0.2s,
    background 0.2s;
  color: #444;
  padding: 0;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  box-sizing: border-box;
}

.control-button:hover {
  background: #f5f5f5;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.control-button svg {
  width: 18px;
  height: 18px;
}

.basemap-toggle {
  display: flex;
  gap: 4px;
  background: #e5e5e5;
  border-radius: 8px;
  padding: 2px;
  height: 36px;
  box-sizing: border-box;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.basemap-toggle-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 500;
  color: #666;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  height: 100%;
  font-family: inherit;
}

.basemap-toggle-button:hover {
  color: #333;
}

.basemap-toggle-button.active {
  background: white;
  color: #333;
  font-weight: 500;
}
</style>
