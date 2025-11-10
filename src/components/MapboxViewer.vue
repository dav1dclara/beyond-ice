<template>
  <div class="mapbox-container" :class="{ 'sidebar-open': sidebarVisible, 'left-sidebar-open': leftSidebarVisible }">
    <ControlPanel
      v-if="mapLoaded"
      :expanded="leftSidebarVisible"
      @toggle="toggleLeftSidebar"
      @search="showSearchBar"
      @layers="handleLayers"
    />
    <div ref="mapContainer" class="map-container"></div>
    <div v-if="!mapLoaded" class="map-load-overlay">
      <button @click="initializeMap" class="load-map-button">
        Load Map
      </button>
    </div>
    <div v-if="searchBarVisible" class="search-bar-overlay">
      <div class="search-bar-container">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search glaciers..."
          class="search-bar-input"
          @keyup.enter="hideSearchBar"
          @keyup.esc="hideSearchBar"
          ref="searchInput"
        />
        <button @click="hideSearchBar" class="search-bar-close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
    <NavigationControls
      v-if="mapLoaded && map"
      :map="map"
      @zoom="zoomToExtent"
    />
    <!-- <CurrentProjectedToggle
      v-if="mapLoaded"
      :is-projected="isProjected"
      @toggle="toggleCurrentProjected"
    /> -->
    <ScenarioSelector
      v-if="mapLoaded && isProjected"
      @change="handleScenarioChange"
    />
    <TimeSlider
      v-if="mapLoaded && isProjected"
    />
    <TerrainToggle
      v-if="mapLoaded"
      :is-active="terrain3DEnabled"
      @toggle="toggle3DTerrain"
    />
    <InfoPanel
      v-if="mapLoaded"
      :expanded="sidebarVisible"
      :glacier-data="selectedGlacier"
      @close="closeSidebar"
      @toggle="toggleSidebar"
    />
    <Tooltip
      v-if="mapLoaded"
      :visible="tooltipVisible"
      :x="tooltipX"
      :y="tooltipY"
      :properties="tooltipProperties"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAPBOX_TOKEN } from "../config/mapbox.js";
import TerrainToggle from "./TerrainToggle.vue";
import CurrentProjectedToggle from "./CurrentProjectedToggle.vue";
import ScenarioSelector from "./ScenarioSelector.vue";
import TimeSlider from "./TimeSlider.vue";
import InfoPanel from "./InfoPanel.vue";
import Tooltip from "./Tooltip.vue";
import ControlPanel from "./ControlPanel.vue";
import NavigationControls from "./NavigationControls.vue";
import { calculateGeoJSONBounds, calculateFeatureBounds } from "../utils/mapUtils.js";

const mapContainer = ref(null);
const map = ref(null);
const mapLoaded = ref(false);
const terrain3DEnabled = ref(false);
const isProjected = ref(false);
const sidebarVisible = ref(false);
const leftSidebarVisible = ref(false);
const selectedGlacier = ref(null);
const tooltipVisible = ref(false);
const tooltipX = ref(0);
const tooltipY = ref(0);
const tooltipProperties = ref({});
const searchBarVisible = ref(false);
const searchQuery = ref('');
const searchInput = ref(null);
let currentSelectedId = null; // Track currently selected feature ID
let currentHoveredId = null; // Track currently hovered feature ID
let dataBounds = null; // Store bounds for zoom to extent
let userLocation = null; // Store user location coordinates


const initializeMap = () => {
  if (!mapContainer.value) {
    console.error("MapboxViewer: Container element not found");
    return;
  }

  if (!MAPBOX_TOKEN) {
    console.error("Mapbox access token is missing. Please set VITE_MAPBOX_TOKEN in your .env file");
    return;
  }

  if (mapLoaded.value) {
    return; // Map already loaded
  }

  try {
    // Initialize Mapbox map
    // Set initial center/zoom to Switzerland as fallback, will zoom to GeoJSON extent once data loads
    map.value = new mapboxgl.Map({
      container: mapContainer.value,
      style: "mapbox://styles/mapbox/light-v11", // Light style for 2D
      center: [8.2275, 46.8182], // Center of Switzerland (fallback until GeoJSON loads)
      zoom: 7,
      accessToken: MAPBOX_TOKEN,
      attributionControl: true, // Enable Mapbox attributions
    });

    // Add GeoJSON layer when map loads
    map.value.on("load", () => {
      // Add terrain source for 3D terrain
      map.value.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 256,
        maxzoom: 14,
      });

      // Add GeoJSON source
      // Use promoteId to use 'gid' property as feature ID for setFeatureState
      map.value.addSource("geojson-data", {
        type: "geojson",
        data: `${import.meta.env.BASE_URL}data/sgi2016.geojson`,
        promoteId: "gid", // Use 'gid' property as feature ID
      });

      // Add layer to display the features
      map.value.addLayer({
        id: "geojson-layer",
        type: "fill",
        source: "geojson-data",
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            "#5F9EA0", // Selected color (cadet blue)
            ["boolean", ["feature-state", "hover"], false],
            "#B0E0E6", // Highlight color on hover (powder blue)
            "#87CEEB", // Default color (sky blue)
          ],
          "fill-opacity": 0.6,
        },
      });

      // Add outline
      map.value.addLayer({
        id: "geojson-outline",
        type: "line",
        source: "geojson-data",
        paint: {
          "line-color": "#87CEEB",
          "line-width": 2,
        },
      });

      // Fit map to data bounds and store bounds for zoom to extent
      // Wait for source to be fully loaded before calculating bounds
      const zoomToGeoJSONExtent = () => {
        const bounds = calculateGeoJSONBounds(map.value);
        if (bounds) {
          dataBounds = bounds; // Store bounds for zoom to extent
          // Zoom to extent with a short delay to ensure map is ready
          setTimeout(() => {
            map.value.fitBounds(bounds, { padding: 50, duration: 500 });
          }, 100);
        }
      };

      // Try to zoom when data loads
      map.value.once("data", (e) => {
        if (e.sourceId === "geojson-data" && e.isSourceLoaded) {
          zoomToGeoJSONExtent();
        }
      });

      // Also try when source is loaded (backup in case data event doesn't fire)
      map.value.once("sourcedata", (e) => {
        if (e.sourceId === "geojson-data" && e.isSourceLoaded) {
          zoomToGeoJSONExtent();
        }
      });

      // Mouseover functionality - highlight and show tooltip
      map.value.on("mousemove", "geojson-layer", (e) => {
        // Change cursor to pointer
        map.value.getCanvas().style.cursor = "pointer";

        const feature = e.features[0];
        const featureId = feature.id !== undefined ? feature.id : feature.properties?.gid;
        
        // Clear previous hover if different feature
        if (currentHoveredId !== null && currentHoveredId !== featureId) {
          map.value.setFeatureState(
            { source: "geojson-data", id: currentHoveredId },
            { hover: false }
          );
        }
        
        // Highlight the feature if it has an ID
        if (featureId !== undefined && currentHoveredId !== featureId) {
          map.value.setFeatureState(
            { source: "geojson-data", id: featureId },
            { hover: true }
          );
          currentHoveredId = featureId;
        }
        
        // Show tooltip with feature properties
        if (feature && feature.properties) {
          tooltipProperties.value = feature.properties;
          tooltipVisible.value = true;
          
          // Get mouse position relative to the map container
          // e.point is already relative to the map container
          tooltipX.value = e.point.x;
          tooltipY.value = e.point.y + 10; // Offset below cursor
        }
      });

      // Mouse leave - remove highlight and hide tooltip
      map.value.on("mouseleave", "geojson-layer", () => {
        map.value.getCanvas().style.cursor = "";

        // Remove highlight from currently hovered feature
        if (currentHoveredId !== null) {
          map.value.setFeatureState(
            { source: "geojson-data", id: currentHoveredId },
            { hover: false }
          );
          currentHoveredId = null;
        }
        
        // Hide tooltip
        tooltipVisible.value = false;
      });

      // Click functionality - highlight, zoom, and open sidebar
      map.value.on("click", "geojson-layer", (e) => {
        // Hide tooltip when clicking
        tooltipVisible.value = false;
        
        const feature = e.features[0];
        if (feature && feature.properties) {
          // Get feature ID (promoted from gid property)
          const featureId = feature.id !== undefined ? feature.id : feature.properties?.gid;
          
          // Clear previous selection if different feature
          if (currentSelectedId !== null && currentSelectedId !== featureId) {
            map.value.setFeatureState(
              { source: "geojson-data", id: currentSelectedId },
              { selected: false }
            );
          }

          // Highlight the clicked feature
          if (featureId !== undefined) {
            map.value.setFeatureState(
              { source: "geojson-data", id: featureId },
              { selected: true }
            );
            currentSelectedId = featureId;
          }

          // Zoom to feature bounds
          const bounds = calculateFeatureBounds(feature);

          if (bounds) {
            map.value.fitBounds(bounds, { padding: 100, duration: 1000 });
          }

          // Update sidebar data
          selectedGlacier.value = {
            name: feature.properties.name || null,
            "sgi-id": feature.properties["sgi-id"] || null,
          };
          sidebarVisible.value = true;

          // Resize map after sidebar opens
          setTimeout(() => {
            map.value.resize();
          }, 300); // Wait for CSS transition
        }
      });
    });

    // Mark map as loaded
    mapLoaded.value = true;

    // Log any errors
    map.value.on("error", (e) => {
      console.error("MapboxViewer: Map error:", e);
    });
  } catch (error) {
    console.error("MapboxViewer: Failed to initialize map:", error);
  }
};

// Helper function to re-add GeoJSON layers after style change
const reAddGeoJSONLayers = () => {
  if (!map.value) return;
  
  // Re-add GeoJSON source if it doesn't exist
  if (!map.value.getSource("geojson-data")) {
    map.value.addSource("geojson-data", {
      type: "geojson",
      data: `${import.meta.env.BASE_URL}data/sgi2016.geojson`,
      promoteId: "gid",
    });
  }
  
  // Re-add or update fill layer
  if (!map.value.getLayer("geojson-layer")) {
    map.value.addLayer({
      id: "geojson-layer",
      type: "fill",
      source: "geojson-data",
      paint: {
        "fill-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          "#5F9EA0", // Selected color (cadet blue)
          ["boolean", ["feature-state", "hover"], false],
          "#B0E0E6", // Highlight color on hover (powder blue)
          "#87CEEB", // Default color (sky blue)
        ],
        "fill-opacity": 0.6,
      },
    });
  } else {
    // Update existing layer colors
    map.value.setPaintProperty("geojson-layer", "fill-color", [
      "case",
      ["boolean", ["feature-state", "selected"], false],
      "#5F9EA0", // Selected color (cadet blue)
      ["boolean", ["feature-state", "hover"], false],
      "#B0E0E6", // Highlight color on hover (powder blue)
      "#87CEEB", // Default color (sky blue)
    ]);
  }
  
  // Re-add or update outline layer
  if (!map.value.getLayer("geojson-outline")) {
    map.value.addLayer({
      id: "geojson-outline",
      type: "line",
      source: "geojson-data",
      paint: {
        "line-color": "#87CEEB",
        "line-width": 2,
      },
    });
  } else {
    // Update existing layer color
    map.value.setPaintProperty("geojson-outline", "line-color", "#87CEEB");
  }
  
  // Re-add terrain source if it doesn't exist
  if (!map.value.getSource("mapbox-dem")) {
    map.value.addSource("mapbox-dem", {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 256,
      maxzoom: 14,
    });
  }
  
  // Re-add user location marker if it exists
  addUserLocationMarker();
};

const toggle3DTerrain = () => {
  if (!map.value) return;

  terrain3DEnabled.value = !terrain3DEnabled.value;

  if (terrain3DEnabled.value) {
    // Switch to satellite style for 3D terrain
    map.value.setStyle("mapbox://styles/mapbox/satellite-v9");
    
    // Wait for style to load before enabling terrain
    map.value.once("style.load", () => {
      reAddGeoJSONLayers();
      
      // Enable 3D terrain
      map.value.setTerrain({
        source: "mapbox-dem",
        exaggeration: 1.5, // Exaggerate terrain height for better visibility
      });
      
      // Adjust pitch for better 3D view
      map.value.easeTo({
        pitch: 60,
        duration: 1000,
      });
    });
  } else {
    // Switch back to light style for 2D
    map.value.setStyle("mapbox://styles/mapbox/light-v11");
    
    // Wait for style to load before disabling terrain
    map.value.once("style.load", () => {
      reAddGeoJSONLayers();
      
      // Disable 3D terrain
      map.value.setTerrain(null);
      
      // Reset pitch to flat view
      map.value.easeTo({
        pitch: 0,
        duration: 1000,
      });
    });
  }
};

const toggleCurrentProjected = () => {
  // UI-only toggle for now - no logic implemented yet
  isProjected.value = !isProjected.value;
};

const handleInfoClick = () => {
  // Info button click handler - no logic implemented yet
  console.log("Info button clicked");
};

const handleScenarioChange = (scenario) => {
  // Scenario change handler - no logic implemented yet
  console.log("Scenario changed to:", scenario);
};

const handleLocation = (location) => {
  if (!map.value) return;
  
  const { longitude, latitude } = location;
  userLocation = [longitude, latitude];
  
  // Center map on user location
  map.value.flyTo({
    center: [longitude, latitude],
    zoom: 12,
    duration: 1500,
  });
  
  // Add marker at user location
  addUserLocationMarker();
};

// Helper function to add user location marker
const addUserLocationMarker = () => {
  if (!map.value || !userLocation) return;
  
  // Remove existing marker if any
  if (map.value.getLayer('user-location-marker')) {
    map.value.removeLayer('user-location-marker');
  }
  if (map.value.getSource('user-location')) {
    map.value.removeSource('user-location');
  }
  
  // Add marker source and layer
  map.value.addSource('user-location', {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: userLocation,
      },
    },
  });
  
  map.value.addLayer({
    id: 'user-location-marker',
    type: 'circle',
    source: 'user-location',
    paint: {
      'circle-radius': 8,
      'circle-color': '#4285F4',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  });
};

const zoomToExtent = () => {
  if (!map.value) return;
  
  // Recalculate bounds to ensure we have the latest data
  const bounds = calculateGeoJSONBounds(map.value);
  
  if (bounds) {
    dataBounds = bounds; // Update stored bounds
    map.value.fitBounds(bounds, { padding: 50, duration: 1000 });
  } else if (dataBounds) {
    // Fallback to stored bounds if recalculation fails
    map.value.fitBounds(dataBounds, { padding: 50, duration: 1000 });
  }
};

const toggleSidebar = () => {
  sidebarVisible.value = !sidebarVisible.value;
  
  // Resize map after sidebar toggles
  if (map.value) {
    setTimeout(() => {
      map.value.resize();
    }, 300); // Wait for CSS transition
  }
};

const closeSidebar = () => {
  sidebarVisible.value = false;
  selectedGlacier.value = null;

  // Clear selection highlight when sidebar closes
  if (map.value && currentSelectedId !== null) {
    map.value.setFeatureState(
      { source: "geojson-data", id: currentSelectedId },
      { selected: false }
    );
    currentSelectedId = null;
  }

  // Resize map after sidebar closes
  if (map.value) {
    setTimeout(() => {
      map.value.resize();
    }, 300); // Wait for CSS transition
  }
};

const toggleLeftSidebar = () => {
  leftSidebarVisible.value = !leftSidebarVisible.value;
  
  // Resize map after sidebar toggles
  if (map.value) {
    setTimeout(() => {
      map.value.resize();
    }, 300);
  }
};

const handleFullscreenResize = () => {
  // Resize map when entering/exiting fullscreen
  if (map.value) {
    setTimeout(() => {
      map.value.resize();
    }, 100);
  }
};

const showSearchBar = () => {
  searchBarVisible.value = true;
  // Focus the input after it's rendered
  setTimeout(() => {
    if (searchInput.value) {
      searchInput.value.focus();
    }
  }, 100);
};

const hideSearchBar = () => {
  searchBarVisible.value = false;
  searchQuery.value = '';
};

const handleLayers = () => {
  // Layer selection functionality to be implemented
  console.log('Layers button clicked');
};

// const handleSearch = () => {
//   // Search functionality to be implemented
//   console.log('Searching for:', searchQuery.value);
//   // For now, just hide the search bar after searching
//   hideSearchBar();
// };

onMounted(() => {
  // Map will only load when user clicks the button
  // This saves Mapbox credits by not auto-loading
  
  // Listen for fullscreen changes to resize map
  document.addEventListener('fullscreenchange', handleFullscreenResize);
  document.addEventListener('webkitfullscreenchange', handleFullscreenResize);
  document.addEventListener('msfullscreenchange', handleFullscreenResize);
});

onBeforeUnmount(() => {
  if (map.value) {
    map.value.remove();
    map.value = null;
  }
  
  // Remove fullscreen listeners
  document.removeEventListener('fullscreenchange', handleFullscreenResize);
  document.removeEventListener('webkitfullscreenchange', handleFullscreenResize);
  document.removeEventListener('msfullscreenchange', handleFullscreenResize);
});
</script>

<style scoped>
.mapbox-container {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transition: right 0.3s ease, left 0.3s ease;
  overflow: visible;
}

.mapbox-container.sidebar-open {
  right: 320px; /* Account for expanded InfoPanel */
}

.map-container {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  overflow: visible;
}

.search-bar-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  pointer-events: none;
}

.search-bar-container {
  position: relative;
  width: 500px;
  max-width: 90%;
  pointer-events: all;
  animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.search-bar-input {
  width: 100%;
  padding: 16px 50px 16px 20px;
  font-size: 16px;
  border: 2px solid #e5e5e5;
  border-radius: 8px;
  outline: none;
  background: white;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  transition: border-color 0.2s;
}

.search-bar-input:focus {
  border-color: #10a37f;
}

.search-bar-input::placeholder {
  color: #999;
}

.search-bar-close {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: #666;
  transition: background-color 0.2s;
  padding: 0;
}

.search-bar-close:hover {
  background: #f5f5f5;
}

.search-bar-close svg {
  width: 18px;
  height: 18px;
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
  background: rgba(255, 255, 255, 0.95);
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

.load-map-hint {
  color: #666;
  font-size: 14px;
  margin: 0;
}

.sidebar-section {
  margin-bottom: 24px;
}

.section-title {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.section-text {
  margin: 0;
  color: #666;
  font-size: 14px;
  line-height: 1.6;
}
</style>

