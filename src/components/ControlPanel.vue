<template>
  <div class="control-panel" :class="{ 'expanded': expanded }">
    <div v-if="!expanded" class="control-panel-button">
      <button
        @click="handleExpandClick"
        class="expand-button"
        title="Expand panel"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>
    </div>
    <button
      @click="$emit('search')"
      class="search-button"
      :class="{ 'expanded': expanded }"
      title="Search glaciers"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <path d="m21 21-4.35-4.35"></path>
      </svg>
      <span class="search-text" :class="{ 'visible': expanded }">Search glaciers</span>
    </button>
    <button
      @click="$emit('layers')"
      class="layer-button"
      :class="{ 'expanded': expanded }"
      title="Layers"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7"></rect>
        <rect x="14" y="3" width="7" height="7"></rect>
        <rect x="14" y="14" width="7" height="7"></rect>
        <rect x="3" y="14" width="7" height="7"></rect>
      </svg>
      <span class="layer-text" :class="{ 'visible': expanded }">Layers</span>
    </button>
    <div v-if="expanded" class="control-panel-content">
      <button
        @click="handleCloseClick"
        class="close-button"
        title="Collapse panel"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  expanded: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['toggle', 'search', 'layers']);

const handleExpandClick = () => {
  emit('toggle');
};

const handleCloseClick = () => {
  emit('toggle');
};
</script>

<style scoped>
.control-panel {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 48px;
  background: #ffffff;
  border-right: 1px solid #e5e5e5;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: width;
}

.control-panel:not(.expanded) {
  overflow: visible;
}

.control-panel.expanded {
  width: 280px;
}

.control-panel-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding-top: 6px;
  overflow: visible;
}

.expand-button {
  position: relative;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
  color: #666;
}

.expand-button:hover {
  background: #f5f5f5;
}

.expand-button:active {
  background: #e5e5e5;
}

.expand-button svg {
  width: 18px;
  height: 18px;
}



.close-button {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: #666;
  transition: background-color 0.2s;
  padding: 0;
  z-index: 10;
}

.close-button:hover {
  background: #f5f5f5;
  color: #333;
}

.close-button svg {
  width: 18px;
  height: 18px;
}


.control-panel-content {
  position: relative;
  flex: 1;
  overflow-y: auto;
  padding: 50px 16px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-button {
  position: absolute;
  left: 6px;
  top: 50px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  color: #666;
  padding: 0 0 0 9px;
  z-index: 10;
  overflow: hidden;
}

.search-button:hover {
  background: #f5f5f5;
}

.search-button:active {
  background: #e5e5e5;
}

.search-button svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin-left: 0;
  transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.search-button.expanded {
  width: calc(100% - 12px);
  padding-left: 9px;
  padding-right: 12px;
  gap: 8px;
}

.search-button.expanded svg {
  margin-left: 0;
}

.search-text {
  font-size: 14px;
  color: #666;
  white-space: nowrap;
  opacity: 0;
  width: 0;
  overflow: hidden;
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.1s, width 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.1s;
}

.search-text.visible {
  opacity: 1;
  width: auto;
}

.layer-button {
  position: absolute;
  left: 6px;
  top: 94px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  color: #666;
  padding: 0 0 0 9px;
  z-index: 10;
  overflow: hidden;
}

.layer-button:hover {
  background: #f5f5f5;
}

.layer-button:active {
  background: #e5e5e5;
}

.layer-button svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin-left: 0;
  transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.layer-button.expanded {
  width: calc(100% - 12px);
  padding-left: 9px;
  padding-right: 12px;
  gap: 8px;
}

.layer-button.expanded svg {
  margin-left: 0;
}

.layer-text {
  font-size: 14px;
  color: #666;
  white-space: nowrap;
  opacity: 0;
  width: 0;
  overflow: hidden;
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.1s, width 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.1s;
}

.layer-text.visible {
  opacity: 1;
  width: auto;
}
</style>

