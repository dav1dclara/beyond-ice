<template>
  <div v-if="mapLoaded" class="searchbar-wrapper">
    <svg 
      class="search-icon" 
      width="18" 
      height="18" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      stroke-width="2" 
      stroke-linecap="round" 
      stroke-linejoin="round"
    >
      <circle cx="11" cy="11" r="8"></circle>
      <path d="m21 21-4.35-4.35"></path>
    </svg>
    <input
      :value="modelValue"
      @input="handleInput"
      @keyup.enter="handleSearch"
      @keyup.esc="handleClear"
      type="text"
      placeholder="Search glaciers..."
      class="search-input"
    />
    <button
      v-if="modelValue"
      @click="handleClear"
      class="clear-button"
      title="Clear search"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
    <div v-else class="clear-button-placeholder"></div>
    
    <!-- Search results dropdown -->
    <div v-if="showSearchResults && searchResults.length > 0" class="search-results-dropdown">
      <div
        v-for="(result, index) in searchResults"
        :key="result.id || index"
        @click="$emit('select', result)"
        class="search-result-item"
      >
        <span class="result-name">{{ result.name || 'Unnamed Glacier' }}</span>
        <span v-if="result['sgi-id']" class="result-id">SGI-ID: {{ result['sgi-id'] }}</span>
      </div>
    </div>
    <div v-else-if="showSearchResults && searchResults.length === 0" class="search-results-dropdown">
      <div class="search-result-item no-results">
        No glaciers found
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  mapLoaded: {
    type: Boolean,
    default: false
  },
  showSearchResults: {
    type: Boolean,
    default: false
  },
  searchResults: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['search', 'clear', 'update:modelValue', 'select'])

let searchTimeout = null

const handleInput = (e) => {
  const value = e.target.value
  emit('update:modelValue', value)
  
  // Clear previous timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  
  // Debounce search - trigger after 300ms of no typing
  searchTimeout = setTimeout(() => {
    emit('search', value)
  }, 300)
}

const handleSearch = () => {
  emit('search', props.modelValue)
}

const handleClear = () => {
  emit('update:modelValue', '')
  emit('clear')
}
</script>

<style scoped>
.searchbar-wrapper {
  position: absolute;
  top: 20px;
  left: 20px;
  display: flex;
  align-items: center;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  padding: 8px 12px;
  min-height: 40px;
  min-width: 300px;
  max-width: 500px;
  width: 320px;
  box-sizing: border-box;
  transition: box-shadow 0.2s, border-color 0.2s;
  pointer-events: auto;
  z-index: 1000;
}

.searchbar-wrapper:focus-within {
  border-color: var(--color-glacier-default);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.search-icon {
  flex-shrink: 0;
  color: #666;
  margin-right: 10px;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: #333;
  padding: 0;
  min-width: 0;
}

.search-input::placeholder {
  color: #999;
}

.clear-button {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: #666;
  transition: background-color 0.2s, color 0.2s;
  padding: 0;
  margin-left: 8px;
}

.clear-button:hover {
  background: #f5f5f5;
  color: #333;
}

.clear-button svg {
  width: 16px;
  height: 16px;
}

.clear-button-placeholder {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  margin-left: 8px;
}

/* Search Results Dropdown */
.search-results-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: #ffffff;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-height: 300px;
  overflow-y: auto;
  z-index: 1001;
}

.search-result-item {
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid #f5f5f5;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: background-color 0.2s;
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background: #f5f5f5;
}

.search-result-item.no-results {
  cursor: default;
  color: #999;
  font-style: italic;
}

.search-result-item.no-results:hover {
  background: transparent;
}

.result-name {
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.result-id {
  font-size: 12px;
  color: #666;
}
</style>
