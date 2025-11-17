<template>
  <div class="map-viewer">
    <div ref="mapboxCanvas" class="mapbox-canvas"></div>
    <div v-if="!mapLoaded" class="map-load-overlay">
      <button @click="initializeMap" class="load-map-button">
        Load Map
      </button>
    </div>
    <SearchBar
      v-if="mapLoaded"
      @search="handleSearch"
      @clear="handleSearchClear"
    />
    <MapStyleSelector
      v-if="mapLoaded && map"
      :current-style="currentStyle"
      @select="handleStyleChange"
    />
    <TerrainToggle
      v-if="mapLoaded && map"
      :is-3d="is3D"
      @toggle="toggleTerrain"
    />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useMapboxMap } from '../composables/useMapboxMap.js'
import { useTerrain } from '../composables/useTerrain.js'
import { useMapStyle } from '../composables/useMapStyle.js'
import { useGeoJSONLayer } from '../composables/useGeoJSONLayer.js'
import SearchBar from './SearchBar.vue'
import TerrainToggle from './TerrainToggle.vue'
import MapStyleSelector from './MapStyleSelector.vue'

// Template ref for the DOM element where Mapbox will render
const mapboxCanvas = ref(null)

// Use the map composable
const { map, mapLoaded, initializeMap } = useMapboxMap(mapboxCanvas)

// Use the terrain composable
const { is3D, toggleTerrain } = useTerrain(map)

// Use the map style composable
const { currentStyle, setMapStyle } = useMapStyle(map)

// Use the GeoJSON layer composable
const { loadGeoJSONLayer } = useGeoJSONLayer(map)

// Function to load the GeoJSON layer
const loadGlacierData = () => {
  const geojsonUrl = `${import.meta.env.BASE_URL}data/sgi2016.geojson`
  loadGeoJSONLayer(geojsonUrl, 'geojson-data')
}

// Load GeoJSON layer when map is ready
watch(mapLoaded, (loaded) => {
  if (loaded && map.value) {
    // Check if map is already loaded, otherwise wait for load event
    if (map.value.loaded()) {
      loadGlacierData()
    } else {
      map.value.once('load', () => {
        loadGlacierData()
      })
    }
  }
})

// Wrapper for setMapStyle that re-adds GeoJSON layer after style change
const handleStyleChange = (styleName) => {
  setMapStyle(styleName, loadGlacierData)
}

// Search handlers
const handleSearch = (query) => {
  // Search functionality to be implemented
  console.log('Searching for:', query)
}

const handleSearchClear = () => {
  // Clear search functionality
  console.log('Search cleared')
}
</script>

<style scoped>
.map-viewer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.mapbox-canvas {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

/* Hide Mapbox logo but keep attribution control */
.mapbox-canvas :deep(.mapboxgl-ctrl-logo) {
  display: none !important;
}

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
  background: #000000;
  z-index: 2000;
  gap: 16px;
}

.load-map-button {
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 600;
  color: white;
  background: #87CEEB;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: background-color 0.2s, transform 0.1s;
}

.load-map-button:hover {
  background: #B0E0E6;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.load-map-button:active {
  transform: translateY(0);
}
</style>