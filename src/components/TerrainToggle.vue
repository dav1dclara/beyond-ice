<template>
  <button
    @click="$emit('toggle')"
    class="terrain-toggle-button"
    :class="{ 'is-3d': is3D }"
    :title="is3D ? 'Switch to 2D view' : 'Switch to 3D view'"
  >
    {{ is3D ? '2D' : '3D' }}
  </button>
</template>

<script setup>
defineProps({
  is3D: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['toggle'])
</script>

<style scoped>
.terrain-toggle-button {
  position: absolute;
  bottom: 20px;
  left: 20px;
  z-index: 1000;
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
