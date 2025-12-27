<template>
  <div>
    <!-- Imprint button -->
    <button
      v-if="mapLoaded"
      @click="showModal = true"
      class="imprint-button"
      title="Imprint"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M12 16v-4"></path>
        <path d="M12 8h.01"></path>
      </svg>
    </button>
    
    <!-- Imprint Modal -->
    <div v-if="showModal" class="imprint-modal-overlay" @click="showModal = false">
      <div class="imprint-modal" @click.stop>
        <div class="imprint-modal-header">
          <h1 class="imprint-modal-title">BEYOND ICE</h1>
          <button @click="showModal = false" class="imprint-modal-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="imprint-modal-content">
          <p class="project-description">
            This application was created by David Clara for the course Application Development in Cartography at ETH Zurich
          </p>
          <div class="data-attributions">
            <h2>Data Attributions</h2>
            <p class="attribution-line">
              Future glacier extent data: <a href="https://doi.org/10.1002/hyp.7055" target="_blank" rel="noopener noreferrer">Huss et al. (2008)</a>
            </p>
          </div>
          <div class="map-attributions">
            <h2>Map Attributions</h2>
            <p class="attribution-line">
              © <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener noreferrer">Mapbox</a>,
              © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>,
              © <a href="https://www.maxar.com/" target="_blank" rel="noopener noreferrer">Maxar</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  mapLoaded: {
    type: Boolean,
    required: true
  }
})

const showModal = ref(false)
</script>

<style scoped>
.imprint-button {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1000;
  margin-left: 8px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: box-shadow 0.2s, border-color 0.2s, background 0.2s;
  color: #333;
  padding: 0;
  font-family: inherit;
  box-sizing: border-box;
}

.imprint-button:hover {
  background: #f5f5f5;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.imprint-button svg {
  width: 16px;
  height: 16px;
}

/* Imprint Modal */
.imprint-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.imprint-modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.imprint-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e5e5;
}

.imprint-modal-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #333;
  letter-spacing: 2px;
}

.imprint-modal-close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  border-radius: 4px;
  transition: background-color 0.2s, color 0.2s;
}

.imprint-modal-close:hover {
  background: #f5f5f5;
  color: #333;
}

.imprint-modal-close svg {
  width: 20px;
  height: 20px;
}

.imprint-modal-content {
  padding: 24px;
}

.project-description {
  margin: 0 0 24px 0;
  font-size: 14px;
  color: #666;
  line-height: 1.6;
}

.map-attributions,
.data-attributions {
  font-size: 12px;
  color: #999;
  margin-bottom: 16px;
}

.data-attributions:last-child {
  margin-bottom: 0;
}

.map-attributions h2,
.data-attributions h2 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #666;
}

.attribution-line {
  margin: 0;
  font-size: 12px;
  color: #999;
  line-height: 1.4;
}

.map-attributions a,
.data-attributions a {
  color: #1E90FF;
  text-decoration: none;
  transition: color 0.2s;
  font-size: 12px;
}

.map-attributions a:hover,
.data-attributions a:hover {
  color: #0066CC;
  text-decoration: underline;
}
</style>

