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
  if (!mapContainer.value) {
    console.error("MapboxViewer: Container element not found");
    return;
  }

  console.log("MapboxViewer - MAPBOX_TOKEN check:");
  console.log("  Value:", MAPBOX_TOKEN);
  console.log("  Type:", typeof MAPBOX_TOKEN);
  console.log("  Is truthy?", !!MAPBOX_TOKEN);
  console.log("  Length:", MAPBOX_TOKEN ? MAPBOX_TOKEN.length : 0);
  
  if (!MAPBOX_TOKEN) {
    console.error("Mapbox access token is missing. Please set VITE_MAPBOX_TOKEN in your .env file or GitLab CI/CD variables");
    console.error("Current token value:", MAPBOX_TOKEN);
    return;
  }

  console.log("MapboxViewer: Initializing map with token:", MAPBOX_TOKEN.substring(0, 10) + "...");

  try {
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

    // Debug: Log when map loads
    map.on("load", () => {
      console.log("MapboxViewer: Map loaded successfully");
    });

    // Debug: Log any errors
    map.on("error", (e) => {
      console.error("MapboxViewer: Map error:", e);
    });
  } catch (error) {
    console.error("MapboxViewer: Failed to initialize map:", error);
  }
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

