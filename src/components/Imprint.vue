<template>
  <div>
    <button v-if="mapLoaded" @click="showModal = true" class="imprint-button">
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
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M12 16v-4"></path>
        <path d="M12 8h.01"></path>
      </svg>
    </button>

    <div
      v-if="showModal"
      class="imprint-modal-overlay"
      @click="showModal = false"
    >
      <div class="imprint-modal" @click.stop>
        <button @click="showModal = false" class="imprint-modal-close">
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
        <div class="imprint-modal-header">
          <h1 class="imprint-modal-title">BEYOND ICE</h1>
          <p class="imprint-modal-subtitle">
            Exploring the Future of Swiss Glaciers in 3D
          </p>
        </div>
        <div class="imprint-modal-content">
          <div class="section">
            <h2>About</h2>
            <p class="section-text">
              BEYOND ICE is an interactive cartographic web application that
              visualizes projected future extents of all Swiss glaciers until
              the end of the 21st century (2020–2100) under different climate
              scenarios. The main purpose of this project is to make
              scientifically derived glacier projections accessible to a broad
              audience through an intuitive, map-based interface.
            </p>
          </div>

          <div class="section">
            <h2>Attributions</h2>
            <p class="section-text">
              Data: Glacier projections computed with GERM (<a
                href="https://doi.org/10.1002/hyp.7055"
                target="_blank"
                rel="noopener noreferrer"
                >Huss et al., 2008</a
              >), provided by
              <a
                href="https://vaw.ethz.ch/"
                target="_blank"
                rel="noopener noreferrer"
                >VAW</a
              >
            </p>
            <p class="section-text">
              Basemap: ©
              <a
                href="https://www.mapbox.com/about/maps"
                target="_blank"
                rel="noopener noreferrer"
                >Mapbox</a
              >
              ©
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
                >OpenStreetMap</a
              >
              ©
              <a
                href="https://www.swisstopo.admin.ch/"
                target="_blank"
                rel="noopener noreferrer"
                >Swisstopo</a
              >
            </p>
          </div>

          <div class="section">
            <h2>Credits</h2>
            <p class="section-text">
              This application was created by David Clara for the course
              <a
                href="https://karto.ethz.ch/en/education/courses/master/application-development-cartography.html"
                target="_blank"
                rel="noopener noreferrer"
                >Application Development in Cartography</a
              >
              at ETH Zurich during the winter semester 2025/2026.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

defineProps({
  mapLoaded: {
    type: Boolean,
    required: true,
  },
});

const showModal = ref(false);
</script>

<style scoped>
.imprint-button {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1000;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 50%;
  cursor: pointer;
  color: #333;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.2s;
}

.imprint-button:hover {
  background: #f5f5f5;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.imprint-button svg {
  width: 16px;
  height: 16px;
}

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
  position: relative;
  margin: 0;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  max-width: 620px;
  width: 90%;
  max-height: 85vh;
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
  padding: 18px;
}

.imprint-modal-title {
  margin: 0 0 4px 0;
  font-size: 24px;
  font-weight: 700;
  color: #333;
  letter-spacing: 2px;
}

.imprint-modal-subtitle {
  margin: 0;
  font-size: 18px;
  font-weight: 400;
  color: #666;
  letter-spacing: 0.5px;
}

.imprint-modal-close {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 1;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: #666;
  transition: all 0.2s;
}

.imprint-modal-close:hover {
  background: #f5f5f5;
  color: #333;
}

.imprint-modal-close svg {
  width: 18px;
  height: 18px;
}

.imprint-modal-content {
  padding: 6px 18px 18px 18px;
}

.section {
  margin-bottom: 24px;
}

.section:last-child {
  margin-bottom: 0;
}

.section h2 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
  border-bottom: 1px solid #e5e5e5;
  padding-bottom: 8px;
}

.section-text {
  margin: 0;
  font-size: 14px;
  color: #666;
  line-height: 1.6;
}

.section a {
  color: #3b82f6;
  text-decoration: none;
  transition: all 0.2s;
}

.section a:hover {
  color: #2563eb;
  text-decoration: underline;
}
</style>
