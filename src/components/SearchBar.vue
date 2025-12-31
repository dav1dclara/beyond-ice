<template>
  <div v-if="mapLoaded" class="searchbar-container">
    <Transition name="zoom-button-fade">
      <div v-if="selectedGlacier" class="zoom-to-glacier-dropdown">
        <button
          @click="$emit('zoom-to-glacier')"
          class="zoom-to-glacier-button"
          title="Zoom to glacier extent"
        >
          Zoom to glacier
        </button>
      </div>
    </Transition>

    <div class="searchbar-wrapper">
      <svg
        class="search-icon"
        width="16"
        height="16"
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
        :class="{ 'has-selection': selectedGlacier }"
      />
      <button
        v-if="modelValue"
        @click="handleClear"
        class="clear-button"
        title="Clear search"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div v-else class="clear-button-placeholder"></div>

      <div v-if="showSearchResults" class="search-results-dropdown">
        <template v-if="searchResults.length > 0">
          <div
            v-for="(result, index) in searchResults"
            :key="result.id || index"
            @click="$emit('select', result)"
            class="search-result-item"
          >
            <span class="result-name">{{
              result.name || 'Unnamed Glacier'
            }}</span>
          </div>
        </template>
        <div v-else class="search-result-item no-results">
          No glaciers found
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  mapLoaded: {
    type: Boolean,
    default: false,
  },
  showSearchResults: {
    type: Boolean,
    default: false,
  },
  searchResults: {
    type: Array,
    default: () => [],
  },
  selectedGlacier: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits([
  'search',
  'clear',
  'update:modelValue',
  'select',
  'zoom-to-glacier',
]);

const searchTimeout = ref(null);

const handleInput = (e) => {
  const value = e.target.value;
  emit('update:modelValue', value);

  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value);
  }

  searchTimeout.value = setTimeout(() => {
    emit('search', value);
  }, 300);
};

onBeforeUnmount(() => {
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value);
  }
});

const handleSearch = () => {
  emit('search', props.modelValue);
};

const handleClear = () => {
  emit('update:modelValue', '');
  emit('clear');
};
</script>

<style scoped>
.searchbar-container {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: inline-block;
  min-width: 250px;
  max-width: 400px;
  width: 320px;
}

.searchbar-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  padding: 8px 12px;
  min-height: 36px;
  box-sizing: border-box;
  transition:
    box-shadow 0.2s,
    border-color 0.2s;
  pointer-events: auto;
  z-index: 2;
}

.search-icon {
  flex-shrink: 0;
  color: #444;
  margin-right: 10px;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: #333;
  padding: 0;
  min-width: 0;
}

.search-input.has-selection {
  font-weight: 500;
}

.search-input::placeholder {
  color: #666;
}

.clear-button {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: #444;
  transition:
    background-color 0.2s,
    color 0.2s;
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
  width: 16px;
  height: 16px;
  margin-left: 8px;
}

.search-results-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-height: 200px;
  overflow-y: auto;
  z-index: 3;
}

.search-results-dropdown::-webkit-scrollbar {
  width: 6px;
}

.search-results-dropdown::-webkit-scrollbar-track {
  background: transparent;
}

.search-results-dropdown::-webkit-scrollbar-thumb {
  background: #f0f0f0;
  border-radius: 3px;
}

.search-results-dropdown::-webkit-scrollbar-thumb:hover {
  background: #e0e0e0;
}

.search-results-dropdown {
  scrollbar-width: thin;
  scrollbar-color: #f0f0f0 transparent;
}

.search-result-item {
  padding: 6px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f5f5f5;
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
  font-size: 12px;
  color: #333;
}

.zoom-to-glacier-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: -6px;
  z-index: 1;
  width: 100%;
  box-sizing: border-box;
  pointer-events: auto;
}

.zoom-to-glacier-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding-top: 12px;
  padding-bottom: 6px;
  background: #f5f5f5;
  border: 1px solid #e5e5e5;
  border-top: none;
  border-radius: 0 0 8px 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  font-size: 12px;
  color: #666;
  transition: all 0.2s;
  box-sizing: border-box;
}

.zoom-to-glacier-button:hover {
  background: #f0f0f0;
  font-weight: 500;
}

.zoom-to-glacier-button svg {
  flex-shrink: 0;
  color: currentColor;
}

.zoom-button-fade-enter-active {
  transition:
    opacity 0.4s ease,
    transform 0.4s ease;
}

.zoom-button-fade-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.zoom-button-fade-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.zoom-button-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.zoom-button-fade-enter-to,
.zoom-button-fade-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
