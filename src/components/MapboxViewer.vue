<template>
  <div class="mapbox-container">
    <div ref="mapContainer" class="map-container"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAPBOX_TOKEN } from "../config/mapbox.js";

const mapContainer = ref(null);
let map = null;

onMounted(() => {
  if (!mapContainer.value) return;

  if (!MAPBOX_TOKEN) {
    console.error("Mapbox access token is missing. Please set VITE_MAPBOX_TOKEN in your .env file");
    return;
  }

  // Initialize Mapbox map
  map = new mapboxgl.Map({
    container: mapContainer.value,
    style: "mapbox://styles/mapbox/streets-v12", // Default style
    center: [8.2275, 46.8182], // Center of Switzerland (similar to old Cesium view)
    zoom: 7,
    accessToken: MAPBOX_TOKEN,
  });

  // Add navigation controls
  map.addControl(new mapboxgl.NavigationControl());
});

onBeforeUnmount(() => {
  if (map) {
    map.remove();
    map = null;
  }
});
</script>

<style scoped>
.mapbox-container,
.map-container {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>

