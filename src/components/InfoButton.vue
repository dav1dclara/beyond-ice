<template>
  <button
    @click="$emit('click')"
    class="info-button"
    title="Information"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
  </button>
</template>

<script setup>
defineEmits(['click']);
</script>

<style scoped>
.info-button {
  position: absolute;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid #ccc;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.2s;
  color: #333;
  padding: 0;
}

.info-button:hover {
  background: #f5f5f5;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transform: scale(1.05);
}

.info-button:active {
  transform: scale(0.95);
}
</style>

