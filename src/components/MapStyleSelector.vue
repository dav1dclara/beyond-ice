<template>
  <div class="style-selector-container">
    <button
      @click="toggleExpanded"
      class="style-selector-button"
      :class="{ 'expanded': isExpanded }"
      :title="`Current: ${currentStyle}. Click to change style`"
    >
      {{ styleLabel }}
      <svg 
        class="chevron-icon" 
        :class="{ 'rotated': isExpanded }"
        width="16" 
        height="16" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        stroke-width="2" 
        stroke-linecap="round" 
        stroke-linejoin="round"
      >
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>
    <div v-if="isExpanded" class="style-options">
      <button
        v-for="style in styles"
        :key="style.name"
        @click="selectStyle(style.name)"
        class="style-option"
        :class="{ 'active': style.name === currentStyle }"
      >
        <span class="style-name">{{ style.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  currentStyle: {
    type: String,
    default: 'dark',
  },
})

const emit = defineEmits(['select'])

const isExpanded = ref(false)

const styles = [
  { name: 'dark', label: 'Dark', emoji: '🌙' },
  { name: 'light', label: 'Light', emoji: '☀️' },
  { name: 'satellite', label: 'Satellite', emoji: '🛰️' },
]

const styleLabel = computed(() => {
  const style = styles.find(s => s.name === props.currentStyle)
  return style ? style.label : props.currentStyle
})

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
}

const selectStyle = (styleName) => {
  emit('select', styleName)
  isExpanded.value = false
}

const handleClickOutside = (event) => {
  const container = event.target.closest('.style-selector-container')
  if (!container && isExpanded.value) {
    isExpanded.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.style-selector-container {
  position: absolute;
  bottom: 66px; /* Position above TerrainToggle (20px + 36px + 10px gap) */
  left: 20px;
  z-index: 1000;
}

.style-selector-button {
  position: relative;
  min-width: 100px;
  height: 36px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
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

.style-selector-button:hover {
  background: #f5f5f5;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.style-selector-button.expanded {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.chevron-icon {
  flex-shrink: 0;
  transition: transform 0.2s;
}

.chevron-icon.rotated {
  transform: rotate(180deg);
}

.style-options {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ccc;
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  animation: slideUp 0.2s ease-out;
  margin-bottom: 1px;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.style-option {
  width: 100%;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  background: white;
  border: none;
  border-bottom: 1px solid #e5e5e5;
  cursor: pointer;
  transition: background-color 0.2s;
  color: #333;
  font-size: 14px;
  font-weight: 500;
  text-align: left;
}

.style-option:last-child {
  border-bottom: none;
}

.style-option:hover {
  background: #f5f5f5;
}

.style-option.active {
  background: #87CEEB;
  color: white;
}

.style-option.active:hover {
  background: #B0E0E6;
}

.style-name {
  flex: 1;
}
</style>
