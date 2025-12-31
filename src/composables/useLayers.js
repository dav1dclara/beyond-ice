import { ref } from 'vue';
import { SCENARIO_CONFIG } from '../config/scenarios.js';
import { TILESET_IDS } from '../config/tilesets.js';

/**
 * Composable for creating and managing map layers (tileset sources and layer creation)
 * Handles layer creation for dynamic, overlay, and comparison modes
 *
 * @param {Ref<mapboxgl.Map>} map - The Mapbox map instance
 * @param {Ref<string>} mapMode - Current map mode ('dynamic', 'overlay', 'comparison')
 * @param {Ref<Set<number>>} visibleYears - Set of visible years for overlay mode
 * @param {Ref<string>} referenceScenario - Reference scenario for comparison mode
 * @param {Ref<string>} comparisonScenario - Comparison scenario for comparison mode
 * @param {Ref<Set<string>>} visibleScenarios - Set of visible scenarios for comparison mode
 * @param {Ref<number|string|null>} selectedFeatureId - Selected feature ID for outline layer filter
 * @param {Function} setupClickHandler - Callback to setup click handlers after layer creation
 * @param {Function} cleanupHandlers - Optional callback to cleanup handlers before layer removal
 * @returns {Object} Layer creation functions and state
 */
export function useLayers(
  map,
  mapMode,
  visibleYears,
  referenceScenario,
  comparisonScenario,
  visibleScenarios,
  selectedFeatureId,
  setupClickHandler,
  cleanupHandlers = null
) {
  const loadedSources = ref(new Set());

  let getFillColor = null;
  let getFillOpacity = null;
  let getOutlineColor = null;

  const setColorFunctions = (fillColorFn, fillOpacityFn, outlineColorFn) => {
    getFillColor = fillColorFn;
    getFillOpacity = fillOpacityFn;
    getOutlineColor = outlineColorFn;
  };

  const getSourceId = (proj) => `glacier-tileset-${proj}`;
  const getLayerId = (proj) => `glacier-layer-${proj}`;
  const getOutlineId = (proj) => `glacier-outline-${proj}`;
  const getStaticLayerId = (proj, year) => `glacier-layer-${proj}-${year}`;
  const getComparisonLayerId = (proj) => `glacier-layer-comparison-${proj}`;
  const getComparisonOutlineId = (proj) => `glacier-outline-comparison-${proj}`;
  const getOverlayOutlineId = (proj) => `glacier-outline-overlay-${proj}-2020`;

  // Interpolate color from blue (2020) to orange (2100) for overlay mode
  const getYearColor = (year) => {
    const minYear = SCENARIO_CONFIG.MIN_YEAR;
    const maxYear = SCENARIO_CONFIG.MAX_YEAR;
    const normalized = (year - minYear) / (maxYear - minYear);

    const blue = { r: 59, g: 130, b: 246 };
    const orange = { r: 249, g: 115, b: 22 };

    const r = Math.round(blue.r + (orange.r - blue.r) * normalized);
    const g = Math.round(blue.g + (orange.g - blue.g) * normalized);
    const b = Math.round(blue.b + (orange.b - blue.b) * normalized);

    return `rgb(${r}, ${g}, ${b})`;
  };

  // Load tileset source and wait for it to be ready
  const loadTilesetSource = (proj) => {
    if (!map.value) return Promise.resolve();

    const tilesetId = TILESET_IDS[proj];
    if (!tilesetId) {
      console.warn('[useLayers] No tileset ID found for projection:', proj);
      return Promise.resolve();
    }

    const sourceId = getSourceId(proj);

    if (map.value.getSource(sourceId)) {
      return Promise.resolve();
    }

    console.log(
      '[useLayers] Loading tileset for projection:',
      proj,
      'tileset:',
      tilesetId
    );

    return new Promise((resolve) => {
      map.value.addSource(sourceId, {
        type: 'vector',
        url: `mapbox://${tilesetId}`,
      });

      const onSourceData = (e) => {
        if (e.sourceId === sourceId && e.isSourceLoaded) {
          map.value.off('sourcedata', onSourceData);
          loadedSources.value.add(proj);
          console.log('[useLayers] ✓ Tileset loaded for projection:', proj);
          resolve();
        }
      };
      map.value.on('sourcedata', onSourceData);
    });
  };

  // Remove all overlay mode layers for a specific projection
  const cleanupStaticLayers = (proj) => {
    if (!map.value) return;

    for (
      let year = SCENARIO_CONFIG.MIN_YEAR;
      year <= SCENARIO_CONFIG.MAX_YEAR;
      year += 10
    ) {
      const layerId = getStaticLayerId(proj, year);
      if (map.value.getLayer(layerId)) {
        map.value.removeLayer(layerId);
      }
    }

    const overlayOutlineId = getOverlayOutlineId(proj);
    if (map.value.getLayer(overlayOutlineId)) {
      map.value.removeLayer(overlayOutlineId);
    }
  };

  const cleanupAllStaticLayers = () => {
    if (!map.value) return;

    const projections = Object.keys(TILESET_IDS).filter(
      (proj) => TILESET_IDS[proj] !== null
    );

    projections.forEach((proj) => {
      cleanupStaticLayers(proj);
    });

    console.log('[useLayers] Cleaned up all overlay mode layers');
  };

  // Main function: creates layers based on current mode (comparison, overlay, or dynamic)
  const createLayersForProjectionYear = (proj, year) => {
    if (!map.value) return;

    const sourceId = getSourceId(proj);
    const layerId = getLayerId(proj);
    const outlineId = getOutlineId(proj);
    const sourceLayerName = year.toString();

    if (!map.value.getSource(sourceId)) {
      console.warn(
        '[useLayers] Source not found for projection:',
        proj,
        '- it may still be loading'
      );
      return;
    }

    if (mapMode.value === 'comparison') {
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

      if (map.value.getLayer(layerId)) map.value.removeLayer(layerId);
      if (map.value.getLayer(outlineId)) map.value.removeLayer(outlineId);

      cleanupStaticLayers(referenceScenario.value);
      cleanupStaticLayers(comparisonScenario.value);

      const refSourceId = getSourceId(referenceScenario.value);
      const compSourceId = getSourceId(comparisonScenario.value);

      if (
        !map.value.getSource(refSourceId) ||
        !map.value.getSource(compSourceId)
      ) {
        console.warn('[useLayers] Sources not ready for comparison mode');
        return;
      }

      const refLayerId = getComparisonLayerId(referenceScenario.value);
      const compLayerId = getComparisonLayerId(comparisonScenario.value);

      const refFillOpacity = selectedFeatureId.value
        ? ['case', ['==', ['id'], selectedFeatureId.value], 1.0, 0.6]
        : 0.6;

      map.value.addLayer({
        id: refLayerId,
        type: 'fill',
        source: refSourceId,
        'source-layer': sourceLayerName,
        layout: {
          visibility: visibleScenarios.value.has('reference')
            ? 'visible'
            : 'none',
        },
        paint: {
          'fill-color': '#3B82F6',
          'fill-opacity': refFillOpacity,
        },
      });

      const compFillOpacity = selectedFeatureId.value
        ? ['case', ['==', ['id'], selectedFeatureId.value], 1.0, 0.6]
        : 0.6;

      map.value.addLayer({
        id: compLayerId,
        type: 'fill',
        source: compSourceId,
        'source-layer': sourceLayerName,
        layout: {
          visibility: visibleScenarios.value.has('comparison')
            ? 'visible'
            : 'none',
        },
        paint: {
          'fill-color': '#F97316',
          'fill-opacity': compFillOpacity,
        },
      });

      console.log(
        '[useLayers] Comparison mode layers created for reference:',
        referenceScenario.value,
        'comparison:',
        comparisonScenario.value,
        'year:',
        year
      );

      // Use a small delay to ensure layers are fully added to the map
      if (setupClickHandler) {
        setTimeout(async () => {
          await setupClickHandler();
        }, 150);
      }

      return;
    }

    if (mapMode.value === 'overlay') {
      cleanupStaticLayers(proj);

      if (map.value.getLayer(layerId)) {
        map.value.removeLayer(layerId);
      }
      if (map.value.getLayer(outlineId)) {
        map.value.removeLayer(outlineId);
      }

      const decadeYears = [];
      for (
        let y = SCENARIO_CONFIG.MIN_YEAR;
        y <= SCENARIO_CONFIG.MAX_YEAR;
        y += 10
      ) {
        decadeYears.push(y);
      }

      // Add from 2100 to 2020 to ensure 2020 is drawn first (bottom) and 2100 is drawn last (top)
      let lastAddedLayerId = undefined;
      for (let i = decadeYears.length - 1; i >= 0; i--) {
        const decadeYear = decadeYears[i];

        if (!visibleYears.value.has(decadeYear)) {
          continue;
        }

        const staticLayerId = getStaticLayerId(proj, decadeYear);
        const yearColor = getYearColor(decadeYear);

        map.value.addLayer(
          {
            id: staticLayerId,
            type: 'fill',
            source: sourceId,
            'source-layer': decadeYear.toString(),
            paint: {
              'fill-color': yearColor,
              'fill-opacity': 0.7,
            },
          },
          lastAddedLayerId
        );

        lastAddedLayerId = staticLayerId;
      }

      const overlayOutlineId = getOverlayOutlineId(proj);
      const minYear = SCENARIO_CONFIG.MIN_YEAR;

      if (visibleYears.value.has(minYear)) {
        map.value.addLayer(
          {
            id: overlayOutlineId,
            type: 'line',
            source: sourceId,
            'source-layer': minYear.toString(),
            filter: selectedFeatureId.value
              ? ['==', ['id'], selectedFeatureId.value]
              : ['literal', false],
            paint: {
              'line-color': getYearColor(minYear),
              'line-width': 2,
              'line-opacity': 1,
            },
          },
          lastAddedLayerId
        );
      }

      console.log(
        `[useLayers] ${mapMode.value} mode layers created for projection:`,
        proj,
        'years:',
        decadeYears
      );

      // Use a small delay to ensure layers are fully added to the map
      if (setupClickHandler) {
        setTimeout(async () => {
          await setupClickHandler();
        }, 150);
      }

      return;
    }

    cleanupStaticLayers(proj);

    if (mapMode.value !== 'comparison') {
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

    if (cleanupHandlers) {
      cleanupHandlers(layerId);
    }

    if (map.value.getLayer(layerId)) {
      map.value.removeLayer(layerId);
    }
    if (map.value.getLayer(outlineId)) {
      map.value.removeLayer(outlineId);
    }

    if (!getFillColor || !getFillOpacity) {
      console.warn(
        '[useLayers] Color functions not set, skipping layer creation'
      );
      return;
    }
    const baseOpacity = getFillOpacity();
    const fillOpacity = selectedFeatureId.value
      ? ['case', ['==', ['id'], selectedFeatureId.value], 1.0, baseOpacity]
      : baseOpacity;

    map.value.addLayer({
      id: layerId,
      type: 'fill',
      source: sourceId,
      'source-layer': sourceLayerName,
      paint: {
        'fill-color': getFillColor(),
        'fill-opacity': fillOpacity,
      },
    });

    map.value.addLayer({
      id: outlineId,
      type: 'line',
      source: sourceId,
      'source-layer': sourceLayerName,
      filter: selectedFeatureId.value
        ? ['==', ['id'], selectedFeatureId.value]
        : ['literal', false],
      paint: {
        'line-color': getOutlineColor ? getOutlineColor() : getFillColor(),
        'line-width': 2,
        'line-opacity': 1,
      },
    });

    console.log(
      '[useLayers] Layers created for projection:',
      proj,
      'year:',
      year
    );
  };

  return {
    setColorFunctions,
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
  };
}
