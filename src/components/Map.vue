<template>
  <div class="map-viewer">
    <div ref="mapboxCanvas" class="mapbox-canvas"></div>

    <Transition name="fade">
      <MapLoadOverlay v-if="!mapLoaded" @load="initializeMap" />
    </Transition>

    <VisualizationPanel
      v-if="mapLoaded"
      :current-mode="mapMode === 'dynamic' ? 'default' : mapMode"
      :current-visualization="visualization"
      :visible-years="visibleYears"
      :min-year="YEAR_CONFIG.MIN_YEAR"
      :max-year="YEAR_CONFIG.MAX_YEAR"
      :reference-scenario="referenceScenario"
      :comparison-scenario="comparisonScenario"
      :visible-scenarios="visibleScenarios"
      @year-toggle="toggleYear"
      @toggle-all-years="toggleAllYears"
      @scenario-toggle="toggleScenario"
      @visualization-change="handleVisualizationChange"
    />

    <SearchBar
      :model-value="searchQuery"
      :map-loaded="mapLoaded"
      :show-search-results="showSearchResults"
      :search-results="searchResults"
      :selected-glacier="selectedGlacier"
      @search="handleSearch"
      @clear="handleSearchClear"
      @update:model-value="searchQuery = $event"
      @select="handleGlacierSelect"
      @zoom-to-glacier="zoomToGlacierExtent"
    />

    <MapControls
      :map-loaded="mapLoaded"
      :is3D="is3D"
      :is-satellite="isSatellite"
      @zoom-to-extent="handleZoomToExtent"
      @reset-bearing="handleResetBearing"
      @toggle-terrain="toggleTerrain"
      @toggle-basemap="toggleBasemap"
    />

    <Imprint :map-loaded="mapLoaded" />

    <ControlPanel
      :current-year="currentYear"
      :min-year="YEAR_CONFIG.MIN_YEAR"
      :max-year="YEAR_CONFIG.MAX_YEAR"
      :step="YEAR_CONFIG.YEAR_STEP"
      :selected-projection="projection"
      :selected-glacier="selectedGlacier"
      :map="map"
      :get-source-id="getSourceId"
      :map-loaded="mapLoaded"
      :reference-scenario="referenceScenario"
      :comparison-scenario="comparisonScenario"
      @year-change="handleYearChange"
      @projection-change="handleProjectionChange"
      @mode-change="handleModeChange"
      @reference-scenario-change="handleReferenceScenarioChange"
      @comparison-scenario-change="handleComparisonScenarioChange"
    />

    <GlacierTooltip ref="tooltipElement" :tooltip="tooltip" :current-year="currentYear" />
  </div>
</template>

<script setup>
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, onBeforeUnmount, nextTick, watch, computed } from 'vue';
import { useMapboxMap } from '../composables/useMapboxMap.js';
import { useMapControls } from '../composables/useMapControls.js';
import { useGlacierZoom } from '../composables/useGlacierZoom.js';
import { useLayers } from '../composables/useLayers.js';
import { useGlacierSearch } from '../composables/useGlacierSearch.js';
import { useClickSelection } from '../composables/useClickSelection.js';
import { useLayerVisualization } from '../composables/useLayerVisualization.js';
import { useGlacierTooltip } from '../composables/useGlacierTooltip.js';
import { useLayerToggles } from '../composables/useLayerToggles.js';
import { useMapStyles } from '../composables/useMapStyles.js';
import { useSearchSelection } from '../composables/useSearchSelection.js';
import { YEAR_CONFIG } from '../config/years.js';
import { SCENARIO_DEFAULTS } from '../config/scenarios.js';
import { TILESET_IDS } from '../config/tilesets.js';
import SearchBar from './SearchBar.vue';
import MapLoadOverlay from './MapLoadOverlay.vue';
import ControlPanel from './ControlPanel.vue';
import VisualizationPanel from './VisualizationPanel.vue';
import MapControls from './MapControls.vue';
import GlacierTooltip from './GlacierTooltip.vue';
import Imprint from './Imprint.vue';

// ============================================================================
// TEMPLATE REFS
// ============================================================================
const mapboxCanvas = ref(null);
const tooltipElement = ref(null);

// ============================================================================
// REACTIVE STATE
// ============================================================================
// Map and visualization state
const isSatellite = ref(false);
const visualization = ref('uniform');
const mapMode = ref('dynamic');

// Time, projection, and scenario state
const decadeYears = [];
for (let y = YEAR_CONFIG.MIN_YEAR; y <= YEAR_CONFIG.MAX_YEAR; y += 10) {
  decadeYears.push(y);
}
const visibleYears = ref(new Set(decadeYears));
const projection = ref(SCENARIO_DEFAULTS.DEFAULT_SCENARIO);
const currentYear = ref(YEAR_CONFIG.DEFAULT_YEAR);
const referenceScenario = ref(SCENARIO_DEFAULTS.DEFAULT_REFERENCE_SCENARIO);
const comparisonScenario = ref(SCENARIO_DEFAULTS.DEFAULT_COMPARISON_SCENARIO);
const visibleScenarios = ref(new Set(['reference', 'comparison']));

// Selection state
const selectedGlacier = ref(null);
const selectedFeatureId = ref(null);

// Event handler state
const handlerLayerId = ref(null);
const mapClickHandlerSetup = ref(false);
const lastModeSwitchTime = ref(0);
const selectionTime = ref(0);
let currentMousemoveHandler = null;
let currentMouseleaveHandler = null;

// Timer state
let tooltipTimer = null;
let yearChangeTimer = null;

// ============================================================================
// COMPOSABLES AND UTILITY FUNCTIONS
// ============================================================================
// Map initialization composables
const { map, mapLoaded, initializeMap } = useMapboxMap(mapboxCanvas);
const { is3D, toggleTerrain, resetBearing } = useMapControls(map);

// Tooltip composable
const {
  tooltip,
  calculateTooltipPosition,
  cleanup: cleanupTooltip,
  TOOLTIP_DELAY,
} = useGlacierTooltip(mapboxCanvas, tooltipElement, map);

// Search composable
const {
  searchQuery,
  searchResults,
  showSearchResults,
  glacierSearchIndex,
  loadGlacierSearchIndex,
  handleSearch,
  handleSearchClear: clearSearch,
} = useGlacierSearch();

// Click handler cleanup function
// Cleans up click and hover handlers for the active layer
// handleGlacierClick is resolved at runtime
const cleanupHandlersForLayer = (layerId) => {
  if (handlerLayerId.value === layerId) {
    try {
      if (currentMousemoveHandler) {
        map.value.off('mousemove', layerId, currentMousemoveHandler);
      } else {
        map.value.off('mousemove', layerId);
      }
      if (currentMouseleaveHandler) {
        map.value.off('mouseleave', layerId, currentMouseleaveHandler);
      } else {
        map.value.off('mouseleave', layerId);
      }
      map.value.off('click', layerId, handleGlacierClick);
      handlerLayerId.value = null;
      currentMousemoveHandler = null;
      currentMouseleaveHandler = null;
    } catch (error) {
      console.log('[Map] Error cleaning up handlers:', error);
    }
  }
};

// Click handler setup function
// Sets up event handlers (click, mousemove, mouseleave) for map layers.
// Handles three modes differently:
// - Overlay: Multiple year layers, query all visible layers
// - Comparison: Two scenario layers, prefer comparison layer feature
// - Dynamic: Single layer, standard feature query
// Dependencies are resolved at runtime.
const setupClickHandler = async () => {
  if (!map.value) return;

  if (mapMode.value === 'overlay') {
    const overlayLayerIds = [];
    decadeYears.forEach((year) => {
      if (visibleYears.value.has(year)) {
        const layerId = getStaticLayerId(projection.value, year);
        if (map.value.getLayer(layerId)) {
          overlayLayerIds.push(layerId);
        }
      }
    });

    if (overlayLayerIds.length === 0) return;

    const overlayLayerKey = `overlay-${overlayLayerIds.join('-')}`;
    if (handlerLayerId.value === overlayLayerKey) return;

    if (handlerLayerId.value && handlerLayerId.value.startsWith('overlay-')) {
      const oldKey = handlerLayerId.value.replace('overlay-', '');
      const oldLayerIds = oldKey.split('-').filter((id) => id);
      oldLayerIds.forEach((oldLayerId) => {
        try {
          if (currentMousemoveHandler) {
            map.value.off('mousemove', oldLayerId, currentMousemoveHandler);
          }
          if (currentMouseleaveHandler) {
            map.value.off('mouseleave', oldLayerId, currentMouseleaveHandler);
          }
          map.value.off('click', oldLayerId, handleGlacierClick);
        } catch {
          // Ignore errors
        }
      });
    }
    currentMousemoveHandler = (e) => {
      if (map.value) {
        map.value.getCanvas().style.cursor = 'pointer';

        if (tooltipTimer) {
          clearTimeout(tooltipTimer);
          tooltipTimer = null;
        }

        const overlayLayerIds = [];
        decadeYears.forEach((year) => {
          if (visibleYears.value.has(year)) {
            const layerId = getStaticLayerId(projection.value, year);
            if (map.value.getLayer(layerId)) {
              overlayLayerIds.push(layerId);
            }
          }
        });
        const features = map.value.queryRenderedFeatures(e.point, {
          layers: overlayLayerIds,
        });

        if (features.length > 0) {
          // Prefer topmost layer (most recent year)
          const feature = features[features.length - 1];

          const pointX = e.point.x;
          const pointY = e.point.y;

          tooltipTimer = setTimeout(() => {
            const position = calculateTooltipPosition(pointX, pointY);
            tooltip.value = {
              visible: true,
              feature: feature,
              x: position.x,
              y: position.y,
            };
            tooltipTimer = null;
            nextTick(() => {
              if (tooltip.value.visible) {
                const actualPosition = calculateTooltipPosition(pointX, pointY);
                tooltip.value.x = actualPosition.x;
                tooltip.value.y = actualPosition.y;
              }
            });
          }, TOOLTIP_DELAY);
        } else {
          tooltip.value.visible = false;
          tooltip.value.feature = null;
        }
      }
    };

    currentMouseleaveHandler = () => {
      if (map.value) {
        map.value.getCanvas().style.cursor = '';
      }
      if (tooltipTimer) {
        clearTimeout(tooltipTimer);
        tooltipTimer = null;
      }
      tooltip.value.visible = false;
      tooltip.value.feature = null;
    };

    // Add handlers to all visible overlay layers
    try {
      overlayLayerIds.forEach((layerId) => {
        map.value.on('mousemove', layerId, currentMousemoveHandler);
        map.value.on('mouseleave', layerId, currentMouseleaveHandler);
        map.value.on('click', layerId, handleGlacierClick);
      });

      handlerLayerId.value = overlayLayerKey;

      if (!mapClickHandlerSetup.value) {
        map.value.on('click', handleMapClick);
        mapClickHandlerSetup.value = true;
      }
    } catch (error) {
      console.error('[Map] Error attaching handlers to overlay layers:', error);
    }

    return;
  }

  if (mapMode.value === 'comparison') {
    const refLayerId = getComparisonLayerId(referenceScenario.value);
    const compLayerId = getComparisonLayerId(comparisonScenario.value);
    const comparisonLayerKey = `${refLayerId}-${compLayerId}`;

    if (handlerLayerId.value === comparisonLayerKey) return;

    // Wait for layers to be created
    let retries = 0;
    const maxRetries = 5;
    while (
      (!map.value.getLayer(refLayerId) || !map.value.getLayer(compLayerId)) &&
      retries < maxRetries
    ) {
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      retries++;
    }

    if (!map.value.getLayer(refLayerId) || !map.value.getLayer(compLayerId)) {
      console.warn('[Map] Comparison layers not found after retries');
      return;
    }

    if (handlerLayerId.value) {
      const oldKey = handlerLayerId.value;
      try {
        if (oldKey.includes('-') && oldKey.includes('comparison')) {
          const oldRefLayerId = getComparisonLayerId(referenceScenario.value);
          const oldCompLayerId = getComparisonLayerId(comparisonScenario.value);
          if (currentMousemoveHandler) {
            map.value.off('mousemove', oldRefLayerId, currentMousemoveHandler);
            map.value.off('mousemove', oldCompLayerId, currentMousemoveHandler);
          }
          if (currentMouseleaveHandler) {
            map.value.off(
              'mouseleave',
              oldRefLayerId,
              currentMouseleaveHandler
            );
            map.value.off(
              'mouseleave',
              oldCompLayerId,
              currentMouseleaveHandler
            );
          }
          map.value.off('click', oldRefLayerId, handleGlacierClick);
          map.value.off('click', oldCompLayerId, handleGlacierClick);
        } else {
          if (currentMousemoveHandler) {
            map.value.off('mousemove', oldKey, currentMousemoveHandler);
          }
          if (currentMouseleaveHandler) {
            map.value.off('mouseleave', oldKey, currentMouseleaveHandler);
          }
          map.value.off('click', oldKey, handleGlacierClick);
        }
      } catch (error) {
        console.log('[Map] Error removing old handlers:', error);
      }
      currentMousemoveHandler = null;
      currentMouseleaveHandler = null;
    }
    currentMousemoveHandler = (e) => {
      if (map.value) {
        map.value.getCanvas().style.cursor = 'pointer';

        if (tooltipTimer) {
          clearTimeout(tooltipTimer);
          tooltipTimer = null;
        }

        const features = map.value.queryRenderedFeatures(e.point, {
          layers: [refLayerId, compLayerId],
        });

        if (features.length > 0) {
          // Tooltips disabled in comparison mode
          tooltip.value.visible = false;
          tooltip.value.feature = null;
        } else {
          tooltip.value.visible = false;
          tooltip.value.feature = null;
        }
      }
    };

    currentMouseleaveHandler = () => {
      if (map.value) {
        map.value.getCanvas().style.cursor = '';
      }
      if (tooltipTimer) {
        clearTimeout(tooltipTimer);
        tooltipTimer = null;
      }
      tooltip.value.visible = false;
      tooltip.value.feature = null;
    };

    try {
      map.value.on('mousemove', refLayerId, currentMousemoveHandler);
      map.value.on('mouseleave', refLayerId, currentMouseleaveHandler);
      map.value.on('click', refLayerId, handleGlacierClick);

      map.value.on('mousemove', compLayerId, currentMousemoveHandler);
      map.value.on('mouseleave', compLayerId, currentMouseleaveHandler);
      map.value.on('click', compLayerId, handleGlacierClick);

      handlerLayerId.value = comparisonLayerKey;

      if (!mapClickHandlerSetup.value) {
        map.value.on('click', handleMapClick);
        mapClickHandlerSetup.value = true;
      }
    } catch (error) {
      console.error('[Map] Error attaching comparison handlers:', error);
    }

    return;
  }

  // Dynamic mode: single layer
  const layerId = currentLayerId.value;

  if (
    handlerLayerId.value === layerId &&
    !handlerLayerId.value.startsWith('overlay-') &&
    !handlerLayerId.value.includes('comparison')
  ) {
    return;
  }

  if (!map.value.getLayer(layerId)) {
    console.warn('[Map] Layer not found:', layerId);
    return;
  }

  if (handlerLayerId.value) {
    const oldLayerId = handlerLayerId.value;
    try {
      if (oldLayerId.startsWith('overlay-')) {
        const oldKey = oldLayerId.replace('overlay-', '');
        const oldLayerIds = oldKey.split('-').filter((id) => id);
        oldLayerIds.forEach((oldLayerId) => {
          try {
            if (currentMousemoveHandler) {
              map.value.off('mousemove', oldLayerId, currentMousemoveHandler);
            }
            if (currentMouseleaveHandler) {
              map.value.off('mouseleave', oldLayerId, currentMouseleaveHandler);
            }
            map.value.off('click', oldLayerId, handleGlacierClick);
          } catch {
            // Ignore errors
          }
        });
      } else if (
        oldLayerId.includes('-') &&
        oldLayerId.includes('comparison')
      ) {
        const refLayerId = getComparisonLayerId(referenceScenario.value);
        const compLayerId = getComparisonLayerId(comparisonScenario.value);
        if (currentMousemoveHandler) {
          map.value.off('mousemove', refLayerId, currentMousemoveHandler);
          map.value.off('mousemove', compLayerId, currentMousemoveHandler);
        }
        if (currentMouseleaveHandler) {
          map.value.off('mouseleave', refLayerId, currentMouseleaveHandler);
          map.value.off('mouseleave', compLayerId, currentMouseleaveHandler);
        }
        map.value.off('click', refLayerId, handleGlacierClick);
        map.value.off('click', compLayerId, handleGlacierClick);
      } else {
        if (currentMousemoveHandler) {
          map.value.off('mousemove', oldLayerId, currentMousemoveHandler);
        } else {
          map.value.off('mousemove', oldLayerId);
        }
        if (currentMouseleaveHandler) {
          map.value.off('mouseleave', oldLayerId, currentMouseleaveHandler);
        } else {
          map.value.off('mouseleave', oldLayerId);
        }
        map.value.off('click', oldLayerId, handleGlacierClick);
      }
    } catch (error) {
      console.log('[Map] Error removing old handlers:', error);
    }
    currentMousemoveHandler = null;
    currentMouseleaveHandler = null;
  }

  currentMousemoveHandler = (e) => {
    if (map.value) {
      map.value.getCanvas().style.cursor = 'pointer';

      if (tooltipTimer) {
        clearTimeout(tooltipTimer);
        tooltipTimer = null;
      }

      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        const pointX = e.point.x;
        const pointY = e.point.y;

        tooltipTimer = setTimeout(() => {
          const position = calculateTooltipPosition(pointX, pointY);
          tooltip.value = {
            visible: true,
            feature: feature,
            x: position.x,
            y: position.y,
          };
          tooltipTimer = null;
          nextTick(() => {
            if (tooltip.value.visible) {
              const actualPosition = calculateTooltipPosition(pointX, pointY);
              tooltip.value.x = actualPosition.x;
              tooltip.value.y = actualPosition.y;
            }
          });
        }, TOOLTIP_DELAY);
      } else {
        tooltip.value.visible = false;
        tooltip.value.feature = null;
      }
    }
  };

  currentMouseleaveHandler = () => {
    if (map.value) {
      map.value.getCanvas().style.cursor = '';
    }
    if (tooltipTimer) {
      clearTimeout(tooltipTimer);
      tooltipTimer = null;
    }
    tooltip.value.visible = false;
    tooltip.value.feature = null;
  };

  map.value.on('mousemove', layerId, currentMousemoveHandler);
  map.value.on('mouseleave', layerId, currentMouseleaveHandler);

  try {
    map.value.on('click', layerId, handleGlacierClick);
  } catch (error) {
    console.warn('[Map] Error setting up click handler:', error);
    setTimeout(() => {
      if (map.value && map.value.getLayer(layerId)) {
        try {
          map.value.on('click', layerId, handleGlacierClick);
        } catch (retryError) {
          console.warn('[Map] Error retrying click handler:', retryError);
        }
      }
    }, 100);
  }

  if (!mapClickHandlerSetup.value) {
    map.value.on('click', handleMapClick);
    mapClickHandlerSetup.value = true;
  }

  handlerLayerId.value = layerId;
};

// Layer creation composable (defined after setupClickHandler due to circular dependency)
const {
  loadedSources,
  getSourceId,
  getLayerId,
  getOutlineId,
  getStaticLayerId,
  getComparisonLayerId,
  getComparisonOutlineId,
  getOverlayOutlineId,
  getYearColor,
  loadTilesetSource,
  createLayersForProjectionYear,
  cleanupStaticLayers,
  cleanupAllStaticLayers,
  setColorFunctions,
} = useLayers(
  map,
  mapMode,
  visibleYears,
  referenceScenario,
  comparisonScenario,
  visibleScenarios,
  selectedFeatureId,
  setupClickHandler,
  cleanupHandlersForLayer
);

// Additional cleanup utility for overlay mode
// Defined after useLayers since it uses getStaticLayerId)
const cleanupOverlayHandlers = () => {
  if (!map.value) return;

  decadeYears.forEach((year) => {
    const layerId = getStaticLayerId(projection.value, year);
    try {
      if (currentMousemoveHandler) {
        map.value.off('mousemove', layerId, currentMousemoveHandler);
      }
      if (currentMouseleaveHandler) {
        map.value.off('mouseleave', layerId, currentMouseleaveHandler);
      }
      map.value.off('click', layerId, handleGlacierClick);
    } catch {
      // Layer may not exist
    }
  });

  if (handlerLayerId.value && handlerLayerId.value.startsWith('overlay-')) {
    const oldKey = handlerLayerId.value.replace('overlay-', '');
    const oldLayerIds = oldKey.split('-').filter((id) => id);
    oldLayerIds.forEach((oldLayerId) => {
      try {
        if (currentMousemoveHandler) {
          map.value.off('mousemove', oldLayerId, currentMousemoveHandler);
        }
        if (currentMouseleaveHandler) {
          map.value.off('mouseleave', oldLayerId, currentMouseleaveHandler);
        }
        map.value.off('click', oldLayerId, handleGlacierClick);
      } catch {
        // Ignore errors
      }
    });
  }

  currentMousemoveHandler = null;
  currentMouseleaveHandler = null;
  handlerLayerId.value = null;
};

// Computed layer bindings (defined after useLayers)
const currentSourceId = computed(() => getSourceId(projection.value));
const currentLayerId = computed(() => getLayerId(projection.value));
const currentOutlineId = computed(() => getOutlineId(projection.value));

// Query source features utility (used by click selection)
const querySourceFeatures = () => {
  if (!map.value) return [];
  const sourceId = currentSourceId.value;
  const source = map.value.getSource(sourceId);
  if (!source) return [];

  if (source.type === 'vector') {
    const sourceLayerName = currentYear.value.toString();
    try {
      return map.value.querySourceFeatures(sourceId, {
        sourceLayer: sourceLayerName,
      });
    } catch {
      return [];
    }
  }
  return [];
};

// Glacier zoom composable
const { calculateTerrainCameraAngle, zoomToGlacierExtent, zoomToBounds } =
  useGlacierZoom(map, selectedGlacier, glacierSearchIndex, is3D);

// Layer visualization composable (defined before useClickSelection which needs updateAllLayerColors)
const {
  getFillColor,
  getFillOpacity,
  getOutlineColor,
  updateComparisonLayerVisibility,
  updateComparisonLayerOpacity,
  updateOverlayOutline,
  updateAllLayerColors,
} = useLayerVisualization(
  map,
  visualization,
  isSatellite,
  selectedFeatureId,
  currentLayerId,
  currentOutlineId,
  mapMode,
  referenceScenario,
  comparisonScenario,
  visibleScenarios,
  getComparisonLayerId,
  getOverlayOutlineId,
  projection,
  getYearColor
);

setColorFunctions(getFillColor, getFillOpacity, getOutlineColor);

// Click selection composable
const {
  handleGlacierClick,
  handleMapClick,
  restoreSelectionByFeatureId,
  clearSelection,
} = useClickSelection(
  map,
  mapMode,
  referenceScenario,
  comparisonScenario,
  visibleYears,
  decadeYears,
  projection,
  glacierSearchIndex,
  is3D,
  getComparisonLayerId,
  getStaticLayerId,
  currentLayerId,
  searchQuery,
  selectedGlacier,
  selectedFeatureId,
  calculateTerrainCameraAngle,
  updateAllLayerColors,
  querySourceFeatures,
  lastModeSwitchTime,
  selectionTime
);

// Layer toggles composable
const { toggleYear, toggleAllYears, toggleScenario } = useLayerToggles(
  map,
  mapMode,
  visibleYears,
  decadeYears,
  projection,
  currentYear,
  createLayersForProjectionYear,
  updateOverlayOutline,
  setupClickHandler,
  visibleScenarios,
  updateComparisonLayerVisibility
);

// Map styles composable
const { toggleBasemap } = useMapStyles(
  map,
  isSatellite,
  is3D,
  loadedSources,
  mapClickHandlerSetup,
  loadTilesetSource,
  createLayersForProjectionYear,
  updateAllLayerColors,
  setupClickHandler,
  projection,
  currentYear
);

// Search selection composable
const { handleGlacierSelect } = useSearchSelection(
  map,
  is3D,
  glacierSearchIndex,
  zoomToBounds,
  getSourceId,
  projection,
  currentYear,
  selectedGlacier,
  selectedFeatureId,
  searchQuery,
  updateAllLayerColors,
  showSearchResults
);

// ============================================================================
// EVENT HANDLERS
// ============================================================================
const handleSearchClear = () => {
  clearSearch();
  clearSelection();
};

const handleResetBearing = () => {
  resetBearing();
};

const handleZoomToExtent = () => {
  if (!map.value) return;
  try {
    map.value.flyTo({
      center: [8.5143, 46.3803],
      zoom: 8,
      duration: 1000,
    });
  } catch (error) {
    console.error('[Map] Error zooming to extent:', error);
  }
};

const handleVisualizationChange = (mode) => {
  visualization.value = mode;
  updateAllLayerColors();
};

// Year change timer utility (used by handleYearChange)
const clearYearChangeTimer = () => {
  if (yearChangeTimer) {
    clearTimeout(yearChangeTimer);
    yearChangeTimer = null;
  }
};

const updateLayersForCurrentYear = () => {
  clearYearChangeTimer();

  yearChangeTimer = setTimeout(() => {
    const proj = projection.value;
    const year = currentYear.value;
    const preservedFeatureId = selectedFeatureId.value;

    if (mapMode.value === 'comparison') {
      createLayersForProjectionYear(proj, year);
      return;
    }

    nextTick(() => {
      createLayersForProjectionYear(proj, year);

      if (map.value) {
        map.value.once('idle', () => {
          setTimeout(() => {
            const layerId = getLayerId(proj);

            if (map.value.getLayer(layerId)) {
              const fillColor = getFillColor();
              const fillOpacity = getFillOpacity();
              // Flash effect: briefly show default color, then apply actual color
              map.value.setPaintProperty(layerId, 'fill-color', '#3B82F6');
              setTimeout(() => {
                map.value.setPaintProperty(layerId, 'fill-color', fillColor);
                map.value.setPaintProperty(
                  layerId,
                  'fill-opacity',
                  fillOpacity
                );
              }, 10);
            }
            updateAllLayerColors();

            if (preservedFeatureId != null) {
              setTimeout(() => {
                restoreSelectionByFeatureId(preservedFeatureId);
              }, 200);
            }
          }, 100);
        });
      }

      setupClickHandler();
    });
  }, 100);
};

const handleModeChange = (mode) => {
  const mappedMode = mode === 'default' ? 'dynamic' : mode;
  mapMode.value = mappedMode;

  if (mappedMode === 'comparison') {
    if (tooltipTimer) {
      clearTimeout(tooltipTimer);
      tooltipTimer = null;
    }
    tooltip.value.visible = false;
    tooltip.value.feature = null;
    createLayersForProjectionYear(projection.value, currentYear.value);
  }
};

const handleReferenceScenarioChange = (scenario) => {
  referenceScenario.value = scenario;
  if (mapMode.value === 'comparison') {
    createLayersForProjectionYear(projection.value, currentYear.value);
  }
};

const handleComparisonScenarioChange = (scenario) => {
  comparisonScenario.value = scenario;
  if (mapMode.value === 'comparison') {
    createLayersForProjectionYear(projection.value, currentYear.value);
  }
};

const handleProjectionChange = (newProjection) => {
  const preservedFeatureId = selectedFeatureId.value;
  const oldProjection = projection.value;

  const oldLayerId = getLayerId(oldProjection);
  const oldOutlineId = getOutlineId(oldProjection);
  if (map.value.getLayer(oldLayerId)) {
    map.value.removeLayer(oldLayerId);
  }
  if (map.value.getLayer(oldOutlineId)) {
    map.value.removeLayer(oldOutlineId);
  }

  if (mapMode.value === 'overlay') {
    cleanupStaticLayers(oldProjection);
  }

  projection.value = newProjection;
  createLayersForProjectionYear(newProjection, currentYear.value);
  updateAllLayerColors();
  setupClickHandler();

  if (preservedFeatureId != null) {
    map.value.once('idle', () => {
      setTimeout(() => {
        restoreSelectionByFeatureId(preservedFeatureId);
      }, 200);
    });
  } else {
    selectedGlacier.value = null;
    searchQuery.value = '';
  }
};

const handleYearChange = (newYear) => {
  currentYear.value = newYear;
  updateLayersForCurrentYear();
};

// ============================================================================
// LIFECYCLE HOOKS
// ============================================================================
onBeforeUnmount(() => {
  cleanupTooltip();
  clearYearChangeTimer();

  if (map.value) {
    if (handlerLayerId.value) {
      try {
        const layerId = handlerLayerId.value;
        if (currentMousemoveHandler) {
          map.value.off('mousemove', layerId, currentMousemoveHandler);
        } else {
          map.value.off('mousemove', layerId);
        }
        if (currentMouseleaveHandler) {
          map.value.off('mouseleave', layerId, currentMouseleaveHandler);
        } else {
          map.value.off('mouseleave', layerId);
        }
        map.value.off('click', layerId, handleGlacierClick);
      } catch {
        // Ignore errors
      }
    }

    if (mapClickHandlerSetup.value) {
      try {
        map.value.off('click', handleMapClick);
      } catch {
        // Ignore errors
      }
    }
  }
});

// ============================================================================
// WATCHERS
// ============================================================================
watch(selectedFeatureId, () => {
  if (mapMode.value === 'comparison') {
    updateComparisonLayerOpacity();
  } else if (mapMode.value === 'overlay') {
    updateOverlayOutline();
  }
});

// Handle mode switching: cleanup old layers/handlers, setup new ones
watch(mapMode, (newMode, oldMode) => {
  if (!mapLoaded.value || !map.value) return;

  // Clear selection when switching modes to prevent stale selections
  if (oldMode === 'overlay' && newMode !== 'overlay') {
    selectedGlacier.value = null;
    selectedFeatureId.value = null;
    searchQuery.value = '';
    selectionTime.value = 0;
    lastModeSwitchTime.value = Date.now();
  }

  if (oldMode && oldMode !== newMode && oldMode !== 'overlay') {
    selectedGlacier.value = null;
    selectedFeatureId.value = null;
    searchQuery.value = '';
    selectionTime.value = 0;
    lastModeSwitchTime.value = Date.now();
  }

  if (newMode === 'comparison') {
    if (tooltipTimer) {
      clearTimeout(tooltipTimer);
      tooltipTimer = null;
    }
    tooltip.value.visible = false;
    tooltip.value.feature = null;
  }

  if (newMode === 'overlay') {
    visibleYears.value = new Set(decadeYears);
  } else if (oldMode === 'overlay') {
    cleanupOverlayHandlers();
    cleanupAllStaticLayers();
  }

  if (oldMode === 'comparison') {
    if (handlerLayerId.value && handlerLayerId.value.includes('comparison')) {
      const refLayerId = getComparisonLayerId(referenceScenario.value);
      const compLayerId = getComparisonLayerId(comparisonScenario.value);
      try {
        if (currentMousemoveHandler) {
          map.value.off('mousemove', refLayerId, currentMousemoveHandler);
          map.value.off('mousemove', compLayerId, currentMousemoveHandler);
        }
        if (currentMouseleaveHandler) {
          map.value.off('mouseleave', refLayerId, currentMouseleaveHandler);
          map.value.off('mouseleave', compLayerId, currentMouseleaveHandler);
        }
        map.value.off('click', refLayerId, handleGlacierClick);
        map.value.off('click', compLayerId, handleGlacierClick);
        currentMousemoveHandler = null;
        currentMouseleaveHandler = null;
        handlerLayerId.value = null;
      } catch (error) {
        console.log('[Map] Error removing comparison handlers:', error);
      }
    }

    const allProjections = Object.keys(TILESET_IDS).filter(
      (p) => TILESET_IDS[p] !== null
    );
    allProjections.forEach((p) => {
      const compLayerId = getComparisonLayerId(p);
      const compOutlineId = getComparisonOutlineId(p);
      if (map.value.getLayer(compLayerId)) map.value.removeLayer(compLayerId);
      if (map.value.getLayer(compOutlineId))
        map.value.removeLayer(compOutlineId);
    });
  }

  createLayersForProjectionYear(projection.value, currentYear.value);
  updateAllLayerColors();
  handlerLayerId.value = null;

  if (newMode === 'dynamic' || newMode === 'overlay') {
    setTimeout(async () => {
      await setupClickHandler();
    }, 150);
  }
});

watch([projection, mapMode], ([newProjection, mode], [oldProjection]) => {
  if (!mapLoaded.value || !map.value || mode !== 'overlay') return;

  if (oldProjection && oldProjection !== newProjection) {
    cleanupStaticLayers(oldProjection);
  }

  createLayersForProjectionYear(newProjection, currentYear.value);
});

// Preload all tilesets on map load for better performance
watch(mapLoaded, async (loaded) => {
  if (!loaded || !map.value) return;

  await loadGlacierSearchIndex();

  const projections = Object.keys(TILESET_IDS).filter(
    (proj) => TILESET_IDS[proj] !== null
  );

  const loadPromises = projections.map((proj) => loadTilesetSource(proj));

  try {
    await Promise.all(loadPromises);
    createLayersForProjectionYear(projection.value, currentYear.value);
    updateAllLayerColors();
    setupClickHandler();
  } catch (error) {
    console.error('[Map] Error loading tilesets:', error);
  }
});
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

/* Fade transition for map load overlay */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.6s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
