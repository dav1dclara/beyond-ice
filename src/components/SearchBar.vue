<template>
  <div class="search-container">
    <input
      type="text"
      placeholder="Search by name..."
      class="search-input"
      disabled
    />
  </div>
</template>

<script setup>
// Search bar component (currently disabled/placeholder)
</script>

<style scoped>
.search-container {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 1000;
  width: 300px;
}

.search-input {
  width: 100%;
  padding: 10px 15px;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  outline: none;
  background: white;
}

.search-input:focus {
  border-color: #87CEEB;
  box-shadow: 0 2px 12px rgba(135, 206, 235, 0.3);
}

.search-input:disabled {
  cursor: not-allowed;
}
</style>

