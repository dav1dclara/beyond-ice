<template>
  <div class="searchbar-container">
    <div class="searchbar-wrapper">
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
        v-model="searchQuery"
        type="text"
        placeholder="Search glaciers..."
        class="search-input"
        disabled
        @input="handleInput"
        @keyup.enter="handleSearch"
        @keyup.esc="handleClear"
        ref="searchInput"
      />
      <button
        v-if="searchQuery"
        @click="handleClear"
        class="clear-button"
        title="Clear search"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const emit = defineEmits(['search', 'clear']);

const searchQuery = ref('');
const searchInput = ref(null);

const handleInput = () => {
  emit('search', searchQuery.value);
};

const handleSearch = () => {
  if (searchQuery.value.trim()) {
    emit('search', searchQuery.value);
  }
};

const handleClear = () => {
  searchQuery.value = '';
  emit('clear');
  if (searchInput.value) {
    searchInput.value.focus();
  }
};
</script>

<style scoped>
.searchbar-container {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 1000;
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
  min-width: 300px;
  max-width: 500px;
  transition: box-shadow 0.2s, border-color 0.2s;
}

.searchbar-wrapper:focus-within {
  border-color: #87CEEB;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.searchbar-wrapper:has(.search-input:disabled) {
  opacity: 0.6;
  cursor: not-allowed;
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
  cursor: not-allowed;
}

.search-input:disabled {
  color: #999;
  cursor: not-allowed;
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
</style>
