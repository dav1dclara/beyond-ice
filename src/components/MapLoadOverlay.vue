<template>
  <div class="map-load-overlay">
    <button @click="$emit('load')" class="load-map-button">
      Load Map
    </button>
  </div>
</template>

<script setup>
defineEmits(['load'])
</script>

<style scoped>
.map-load-overlay {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: white;
  z-index: 2000;
  gap: 16px;
}

.load-map-button {
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 600;
  color: white;
  background: #87CEEB;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: background-color 0.2s, transform 0.1s;
}

.load-map-button:hover {
  background: #B0E0E6;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.load-map-button:active {
  transform: translateY(0);
}
</style>
