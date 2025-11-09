<template>
  <div v-if="visible" class="sidebar">
    <div class="sidebar-header">
      <h2 class="sidebar-title">Glacier Details</h2>
      <button @click="$emit('close')" class="close-button" title="Close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <div class="sidebar-content">
      <div v-if="glacierData" class="glacier-info">
        <div class="info-item">
          <span class="info-label">Name:</span>
          <span class="info-value">{{ glacierData.name || "N/A" }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">SGI-ID:</span>
          <span class="info-value">{{ glacierData["sgi-id"] || "N/A" }}</span>
        </div>
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
  glacierData: {
    type: Object,
    default: null,
  },
});

defineEmits(['close']);
</script>

<style scoped>
.sidebar {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 350px;
  background: white;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.sidebar-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

.close-button {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: #666;
  transition: all 0.2s;
  padding: 0;
}

.close-button:hover {
  background: #f5f5f5;
  color: #333;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.glacier-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: 16px;
  color: #333;
  font-weight: 500;
}
</style>

