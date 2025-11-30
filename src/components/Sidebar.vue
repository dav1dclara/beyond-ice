<template>
  <div>
    <SearchBar
      :model-value="modelValue"
      :map-loaded="mapLoaded"
      :show-search-results="showSearchResults"
      :search-results="searchResults"
      @search="$emit('search', $event)"
      @clear="$emit('clear')"
      @update:model-value="$emit('update:modelValue', $event)"
      @select="$emit('select', $event)"
    />
    
    <!-- Sidebar - Only visible when glacier is selected -->
    <div v-if="selectedGlacier" class="sidebar">
      <div class="sidebar-content">
        <GlacierInfo :selected-glacier="selectedGlacier" />
        
        <EvolutionGraph
          :selected-glacier="selectedGlacier"
          :selected-projection="selectedProjection"
          :current-year="currentYear"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import SearchBar from './SearchBar.vue'
import GlacierInfo from './GlacierInfo.vue'
import EvolutionGraph from './EvolutionGraph.vue'

defineProps({
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
  },
  selectedGlacier: {
    type: Object,
    default: null
  },
  showOnlySelected: {
    type: Boolean,
    default: false
  },
  selectedProjection: {
    type: String,
    default: 'Current'
  },
  currentYear: {
    type: Number,
    default: null
  }
})

defineEmits(['search', 'clear', 'update:modelValue', 'select', 'zoom', 'toggle-filter'])
</script>

<style scoped>
.sidebar {
  position: absolute;
  top: 72px; /* 20px (top) + 40px (search bar height) + 12px (gap) */
  left: 20px;
  bottom: 20px;
  min-width: 250px;
  max-width: 400px;
  width: 320px;
  z-index: 999;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  pointer-events: auto;
}

.sidebar-content {
  position: relative;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  flex: 1;
  pointer-events: auto;
}
</style>
