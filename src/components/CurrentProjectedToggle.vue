<template>
  <div class="current-projected-toggle-container">
    <button
      @click="selectCurrent"
      class="toggle-option"
      :class="{ active: !isProjected }"
    >
      Current
    </button>
    <button
      @click="selectProjected"
      class="toggle-option"
      :class="{ active: isProjected }"
    >
      Projected
    </button>
  </div>
</template>

<script setup>
const props = defineProps({
  isProjected: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['toggle']);

const selectCurrent = () => {
  if (!props.isProjected) return; // Already selected
  emit('toggle');
};

const selectProjected = () => {
  if (props.isProjected) return; // Already selected
  emit('toggle');
};
</script>

<style scoped>
.current-projected-toggle-container {
  position: absolute;
  bottom: 20px;
  left: 20px;
  z-index: 1000;
  display: flex;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  box-sizing: border-box;
  height: 36px;
}

.toggle-option {
  flex: 1;
  min-width: 80px;
  height: 36px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-right: 1px solid #ccc;
  cursor: pointer;
  transition: all 0.2s;
  color: #333;
  font-size: 14px;
  font-weight: 600;
}

.toggle-option:last-child {
  border-right: none;
}

.toggle-option:hover {
  background: #f5f5f5;
}

.toggle-option.active {
  background: #87CEEB;
  color: white;
}

.toggle-option.active:hover {
  background: #B0E0E6;
}
</style>

