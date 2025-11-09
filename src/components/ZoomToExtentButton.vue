<template>
  <button @click="$emit('zoom')" class="zoom-to-extent-button" title="Zoom to extent">
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 2L8 2L8 8L2 8L2 2Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
      <path d="M12 2L18 2L18 8L12 8L12 2Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
      <path d="M2 12L8 12L8 18L2 18L2 12Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
      <path d="M12 12L18 12L18 18L12 18L12 12Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
    </svg>
  </button>
</template>

<script setup>
defineEmits(['zoom']);
</script>

<style scoped>
.zoom-to-extent-button {
  position: absolute;
  top: 56px; /* Position below NavigationControl (10px top + 36px height + 10px gap) */
  right: 10px;
  z-index: 1000;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: all 0.2s;
  color: #333;
  padding: 0;
}

.zoom-to-extent-button:hover {
  background: #f5f5f5;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.zoom-to-extent-button:active {
  transform: scale(0.95);
}

.zoom-to-extent-button svg {
  width: 20px;
  height: 20px;
}
</style>

