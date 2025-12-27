<template>
  <div class="map-load-overlay">
    <div class="content">
      <div class="title-group">
        <h1 class="title">BEYOND ICE</h1>
        <p class="subtitle">Exploring the Future of Swiss Glaciers in 3D</p>
      </div>
      <button @click="$emit('load')" class="load-button">
        Load Map
      </button>
    </div>
  </div>
</template>

<script setup>
defineEmits(['load'])
</script>

<style scoped>
.map-load-overlay {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #FFFFFF;
  z-index: 2000;
}

.content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  text-align: center;
}

.title-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.title {
  font-size: 72px;
  font-weight: 700;
  letter-spacing: 6px;
  margin: 0;
  background: linear-gradient(135deg, #3B82F6 0%, #60A5FA 50%, #3B82F6 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: shimmer 3s ease-in-out infinite;
  filter: drop-shadow(0 2px 8px rgba(59, 130, 246, 0.3));
  position: relative;
}

@keyframes shimmer {
  0%, 100% {
    background-position: 0% center;
  }
  50% {
    background-position: 100% center;
  }
}

.subtitle {
  font-size: 24px;
  font-weight: 400;
  color: #666666;
  margin: 0;
  letter-spacing: 0.5px;
}

.load-button {
  padding: 12px 32px;
  font-size: 16px;
  font-weight: 600;
  color: #FFFFFF;
  background: #3B82F6;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
  margin-top: 8px;
}

.load-button:hover {
  background: #2563EB;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.load-button:active {
  transform: translateY(0);
}
</style>
