<template>
  <div class="mapbox-container" :class="{ 'sidebar-open': sidebarVisible }">
    <div ref="mapContainer" class="map-container"></div>
    <div v-if="!mapLoaded" class="map-load-overlay">
      <button @click="initializeMap" class="load-map-button">
        Load Map
      </button>
      <p class="load-map-hint">Click to load the interactive map</p>
    </div>
    <SearchBar v-if="mapLoaded" />
    <InfoButton
      v-if="mapLoaded"
      @click="handleInfoClick"
    />
    <CurrentProjectedToggle
      v-if="mapLoaded"
      :is-projected="isProjected"
      @toggle="toggleCurrentProjected"
    />
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
    <Sidebar
      v-if="mapLoaded"
      :visible="sidebarVisible"
      :glacier-data="selectedGlacier"
      @close="closeSidebar"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAPBOX_TOKEN } from "../config/mapbox.js";
import SearchBar from "./SearchBar.vue";
import TerrainToggle from "./TerrainToggle.vue";
import CurrentProjectedToggle from "./CurrentProjectedToggle.vue";
import ScenarioSelector from "./ScenarioSelector.vue";
import TimeSlider from "./TimeSlider.vue";
import InfoButton from "./InfoButton.vue";
import Sidebar from "./Sidebar.vue";

const mapContainer = ref(null);
let map = null;
const mapLoaded = ref(false);
const terrain3DEnabled = ref(false);
const isProjected = ref(false);
const sidebarVisible = ref(false);
const selectedGlacier = ref(null);
let currentSelectedId = null; // Track currently selected feature ID
let currentHoveredId = null; // Track currently hovered feature ID
let dataBounds = null; // Store bounds for zoom to extent

// Helper function to calculate bounds from GeoJSON source
const calculateGeoJSONBounds = () => {
  if (!map) return null;
  
  const source = map.getSource("geojson-data");
  if (!source) return null;
  
  const bounds = new mapboxgl.LngLatBounds();
  
  // Try to get features from the source
  try {
    // Use querySourceFeatures to get all features
    const features = map.querySourceFeatures("geojson-data");
    
    if (features && features.length > 0) {
      features.forEach((feature) => {
        if (feature.geometry) {
          if (feature.geometry.type === "Polygon") {
            feature.geometry.coordinates[0].forEach((coord) => {
              bounds.extend(coord);
            });
          } else if (feature.geometry.type === "MultiPolygon") {
            feature.geometry.coordinates.forEach((polygon) => {
              polygon[0].forEach((coord) => {
                bounds.extend(coord);
              });
            });
          }
        }
      });
    } else if (source._data && source._data.features) {
      // Fallback to internal data if querySourceFeatures doesn't work
      source._data.features.forEach((feature) => {
        if (feature.geometry) {
          if (feature.geometry.type === "Polygon") {
            feature.geometry.coordinates[0].forEach((coord) => {
              bounds.extend(coord);
            });
          } else if (feature.geometry.type === "MultiPolygon") {
            feature.geometry.coordinates.forEach((polygon) => {
              polygon[0].forEach((coord) => {
                bounds.extend(coord);
              });
            });
          }
        }
      });
    }
    
    return bounds.isEmpty() ? null : bounds;
  } catch (error) {
    console.error("Error calculating bounds:", error);
    return null;
  }
};

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
    map = new mapboxgl.Map({
      container: mapContainer.value,
      style: "mapbox://styles/mapbox/light-v11", // Light style for 2D
      center: [8.2275, 46.8182], // Center of Switzerland (fallback until GeoJSON loads)
      zoom: 7,
      accessToken: MAPBOX_TOKEN,
      attributionControl: false, // Disable Mapbox attributions
    });

    // Add navigation controls with integrated zoom to extent button
    const navControl = new mapboxgl.NavigationControl();
    map.addControl(navControl);
    
    // Wait for navigation control to be added, then append zoom to extent button to it
    map.once('load', () => {
      // Use setTimeout to ensure the control is fully rendered
      setTimeout(() => {
        // Find the navigation control container (first one in top-right)
        const navControlContainer = mapContainer.value.querySelector('.mapboxgl-ctrl-group');
        if (navControlContainer) {
          // Create separator
          const separator = document.createElement('div');
          separator.className = 'mapboxgl-ctrl-group-separator';
          separator.style.borderTop = '1px solid rgba(0,0,0,0.1)';
          separator.style.margin = '2px 0';
          
          // Create zoom to extent button
          const button = document.createElement('button');
          button.className = 'mapboxgl-ctrl-icon mapboxgl-ctrl-zoom-extent';
          button.type = 'button';
          button.setAttribute('aria-label', 'Zoom to extent');
          button.title = 'Zoom to extent';
          button.style.width = '29px';
          button.style.height = '29px';
          button.style.display = 'flex';
          button.style.alignItems = 'center';
          button.style.justifyContent = 'center';
          button.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 2L8 2L8 8L2 8L2 2Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
              <path d="M12 2L18 2L18 8L12 8L12 2Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
              <path d="M2 12L8 12L8 18L2 18L2 12Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
              <path d="M12 12L18 12L18 18L12 18L12 12Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
            </svg>
          `;
          
          button.addEventListener('click', () => {
            zoomToExtent();
          });
          
          navControlContainer.appendChild(separator);
          navControlContainer.appendChild(button);
        }
      }, 100);
    });

    // Add GeoJSON layer when map loads
    map.on("load", () => {
      // Add terrain source for 3D terrain
      map.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 256,
        maxzoom: 14,
      });

      // Add GeoJSON source
      // Use promoteId to use 'gid' property as feature ID for setFeatureState
      map.addSource("geojson-data", {
        type: "geojson",
        data: `${import.meta.env.BASE_URL}data/sgi2016.geojson`,
        promoteId: "gid", // Use 'gid' property as feature ID
      });

      // Add layer to display the features
      map.addLayer({
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
      map.addLayer({
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
        const bounds = calculateGeoJSONBounds();
        if (bounds) {
          dataBounds = bounds; // Store bounds for zoom to extent
          // Zoom to extent with a short delay to ensure map is ready
          setTimeout(() => {
            map.fitBounds(bounds, { padding: 50, duration: 500 });
          }, 100);
        }
      };

      // Try to zoom when data loads
      map.once("data", (e) => {
        if (e.sourceId === "geojson-data" && e.isSourceLoaded) {
          zoomToGeoJSONExtent();
        }
      });

      // Also try when source is loaded (backup in case data event doesn't fire)
      map.once("sourcedata", (e) => {
        if (e.sourceId === "geojson-data" && e.isSourceLoaded) {
          zoomToGeoJSONExtent();
        }
      });

      // Mouseover functionality - highlight only (no tooltip)
      map.on("mousemove", "geojson-layer", (e) => {
        // Change cursor to pointer
        map.getCanvas().style.cursor = "pointer";

        const feature = e.features[0];
        const featureId = feature.id !== undefined ? feature.id : feature.properties?.gid;
        
        // Clear previous hover if different feature
        if (currentHoveredId !== null && currentHoveredId !== featureId) {
          map.setFeatureState(
            { source: "geojson-data", id: currentHoveredId },
            { hover: false }
          );
        }
        
        // Highlight the feature if it has an ID
        if (featureId !== undefined && currentHoveredId !== featureId) {
          map.setFeatureState(
            { source: "geojson-data", id: featureId },
            { hover: true }
          );
          currentHoveredId = featureId;
        }
      });

      // Mouse leave - remove highlight
      map.on("mouseleave", "geojson-layer", () => {
        map.getCanvas().style.cursor = "";

        // Remove highlight from currently hovered feature
        if (currentHoveredId !== null) {
          map.setFeatureState(
            { source: "geojson-data", id: currentHoveredId },
            { hover: false }
          );
          currentHoveredId = null;
        }
      });

      // Click functionality - highlight, zoom, and open sidebar
      map.on("click", "geojson-layer", (e) => {
        const feature = e.features[0];
        if (feature && feature.properties) {
          // Get feature ID (promoted from gid property)
          const featureId = feature.id !== undefined ? feature.id : feature.properties?.gid;
          
          // Clear previous selection if different feature
          if (currentSelectedId !== null && currentSelectedId !== featureId) {
            map.setFeatureState(
              { source: "geojson-data", id: currentSelectedId },
              { selected: false }
            );
          }

          // Highlight the clicked feature
          if (featureId !== undefined) {
            map.setFeatureState(
              { source: "geojson-data", id: featureId },
              { selected: true }
            );
            currentSelectedId = featureId;
          }

          // Zoom to feature bounds
          const coordinates = feature.geometry.coordinates;
          const bounds = new mapboxgl.LngLatBounds();

          if (feature.geometry.type === "Polygon") {
            coordinates[0].forEach((coord) => {
              bounds.extend(coord);
            });
          } else if (feature.geometry.type === "MultiPolygon") {
            coordinates.forEach((polygon) => {
              polygon[0].forEach((coord) => {
                bounds.extend(coord);
              });
            });
          }

          if (!bounds.isEmpty()) {
            map.fitBounds(bounds, { padding: 100, duration: 1000 });
          }

          // Update sidebar data
          selectedGlacier.value = {
            name: feature.properties.name || null,
            "sgi-id": feature.properties["sgi-id"] || null,
          };
          sidebarVisible.value = true;

          // Resize map after sidebar opens
          setTimeout(() => {
            map.resize();
          }, 300); // Wait for CSS transition
        }
      });
    });

    // Mark map as loaded
    mapLoaded.value = true;

    // Log any errors
    map.on("error", (e) => {
      console.error("MapboxViewer: Map error:", e);
    });
  } catch (error) {
    console.error("MapboxViewer: Failed to initialize map:", error);
  }
};

// Helper function to re-add GeoJSON layers after style change
const reAddGeoJSONLayers = () => {
  if (!map) return;
  
  // Re-add GeoJSON source if it doesn't exist
  if (!map.getSource("geojson-data")) {
    map.addSource("geojson-data", {
      type: "geojson",
      data: `${import.meta.env.BASE_URL}data/sgi2016.geojson`,
      promoteId: "gid",
    });
  }
  
  // Re-add or update fill layer
  if (!map.getLayer("geojson-layer")) {
    map.addLayer({
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
    map.setPaintProperty("geojson-layer", "fill-color", [
      "case",
      ["boolean", ["feature-state", "selected"], false],
      "#5F9EA0", // Selected color (cadet blue)
      ["boolean", ["feature-state", "hover"], false],
      "#B0E0E6", // Highlight color on hover (powder blue)
      "#87CEEB", // Default color (sky blue)
    ]);
  }
  
  // Re-add or update outline layer
  if (!map.getLayer("geojson-outline")) {
    map.addLayer({
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
    map.setPaintProperty("geojson-outline", "line-color", "#87CEEB");
  }
  
  // Re-add terrain source if it doesn't exist
  if (!map.getSource("mapbox-dem")) {
    map.addSource("mapbox-dem", {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 256,
      maxzoom: 14,
    });
  }
};

const toggle3DTerrain = () => {
  if (!map) return;

  terrain3DEnabled.value = !terrain3DEnabled.value;

  if (terrain3DEnabled.value) {
    // Switch to satellite style for 3D terrain
    map.setStyle("mapbox://styles/mapbox/satellite-v9");
    
    // Wait for style to load before enabling terrain
    map.once("style.load", () => {
      reAddGeoJSONLayers();
      
      // Enable 3D terrain
      map.setTerrain({
        source: "mapbox-dem",
        exaggeration: 1.5, // Exaggerate terrain height for better visibility
      });
      
      // Adjust pitch for better 3D view
      map.easeTo({
        pitch: 60,
        duration: 1000,
      });
    });
  } else {
    // Switch back to light style for 2D
    map.setStyle("mapbox://styles/mapbox/light-v11");
    
    // Wait for style to load before disabling terrain
    map.once("style.load", () => {
      reAddGeoJSONLayers();
      
      // Disable 3D terrain
      map.setTerrain(null);
      
      // Reset pitch to flat view
      map.easeTo({
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

const zoomToExtent = () => {
  if (!map) return;
  
  // Recalculate bounds to ensure we have the latest data
  const bounds = calculateGeoJSONBounds();
  
  if (bounds) {
    dataBounds = bounds; // Update stored bounds
    map.fitBounds(bounds, { padding: 50, duration: 1000 });
  } else if (dataBounds) {
    // Fallback to stored bounds if recalculation fails
    map.fitBounds(dataBounds, { padding: 50, duration: 1000 });
  }
};

const closeSidebar = () => {
  sidebarVisible.value = false;
  selectedGlacier.value = null;

  // Clear selection highlight when sidebar closes
  if (map && currentSelectedId !== null) {
    map.setFeatureState(
      { source: "geojson-data", id: currentSelectedId },
      { selected: false }
    );
    currentSelectedId = null;
  }

  // Resize map after sidebar closes
  if (map) {
    setTimeout(() => {
      map.resize();
    }, 300); // Wait for CSS transition
  }
};

onMounted(() => {
  // Map will only load when user clicks the button
  // This saves Mapbox credits by not auto-loading
});

onBeforeUnmount(() => {
  if (map) {
    map.remove();
    map = null;
  }
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
  transition: right 0.3s ease;
}

.mapbox-container.sidebar-open {
  right: 350px;
}

.map-container {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

/* Hide Mapbox logo/watermark */
.map-container :deep(.mapboxgl-ctrl-logo) {
  display: none !important;
}

.map-container :deep(.mapboxgl-ctrl-bottom-left) {
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
</style>

