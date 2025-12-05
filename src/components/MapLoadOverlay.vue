<template>
  <div class="map-load-overlay">
    <div class="title-container">
      <h1 class="main-title">
        <span class="title-word" v-for="(word, index) in titleWords" :key="index" :style="{ animationDelay: `${index * 0.2}s` }">
          {{ word }}
        </span>
      </h1>
      <div class="subtitle">Glacier Evolution Visualization</div>
    </div>
    <button @click="$emit('load')" class="load-map-button">
      <span>Load Map</span>
      <svg class="button-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

defineEmits(['load'])

const titleWords = computed(() => ['BEYOND', 'ICE'])
</script>

<style scoped>
.map-load-overlay {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  z-index: 2000;
  gap: 48px;
  overflow: hidden;
}

.map-load-overlay::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
  animation: rotate 20s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.title-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  z-index: 1;
}

.main-title {
  font-size: 72px;
  font-weight: 900;
  letter-spacing: 8px;
  margin: 0;
  display: flex;
  gap: 24px;
  line-height: 1.1;
}

.title-word {
  background: linear-gradient(135deg, #ffffff 0%, #e0f7fa 50%, #b2ebf2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: fadeInUp 1s ease-out both, glow 3s ease-in-out infinite;
  position: relative;
  filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.5));
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes glow {
  0%, 100% {
    filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.6)) drop-shadow(0 0 30px rgba(135, 206, 235, 0.4));
  }
  50% {
    filter: drop-shadow(0 0 25px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 50px rgba(135, 206, 235, 0.7));
  }
}

.subtitle {
  font-size: 18px;
  font-weight: 300;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 4px;
  text-transform: uppercase;
  animation: fadeIn 1.5s ease-out 0.5s both;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.load-map-button {
  padding: 16px 32px;
  font-size: 18px;
  font-weight: 600;
  color: white;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50px;
  cursor: pointer;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 1;
  animation: fadeIn 1.5s ease-out 0.8s both;
}

.load-map-button:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
}

.load-map-button:active {
  transform: translateY(0) scale(1);
}

.button-icon {
  transition: transform 0.3s ease;
}

.load-map-button:hover .button-icon {
  transform: translateX(4px);
}

/* Responsive design */
@media (max-width: 768px) {
  .main-title {
    font-size: 48px;
    letter-spacing: 4px;
    gap: 16px;
  }
  
  .subtitle {
    font-size: 14px;
    letter-spacing: 2px;
  }
  
  .load-map-button {
    padding: 14px 28px;
    font-size: 16px;
  }
}
</style>
