import { getBivariateColorExpression } from '../utils/bivariateColor.js';
import { SCENARIO_CONFIG } from '../config/scenarios.js';

/**
 * Composable for layer visualization and property updates
 * Handles color expressions, opacity, and layer updates for all modes (dynamic, overlay, comparison)
 *
 * @param {Ref<mapboxgl.Map>} map - The Mapbox map instance
 * @param {Ref<string>} visualization - Current visualization mode
 * @param {Ref<boolean>} isSatellite - Whether satellite basemap is active
 * @param {Ref<number|string|null>} selectedFeatureId - Selected feature ID for outline filter
 * @param {ComputedRef<string>} currentLayerId - Current layer ID
 * @param {ComputedRef<string>} currentOutlineId - Current outline layer ID
 * @param {Ref<string>} mapMode - Current map mode ('dynamic', 'overlay', 'comparison')
 * @param {Ref<string>} referenceScenario - Reference scenario for comparison mode
 * @param {Ref<string>} comparisonScenario - Comparison scenario for comparison mode
 * @param {Ref<Set<string>>} visibleScenarios - Set of visible scenarios for comparison mode
 * @param {Function} getComparisonLayerId - Function to get comparison layer ID
 * @param {Function} getOverlayOutlineId - Function to get overlay outline layer ID
 * @param {Ref<string>} projection - Current projection/scenario
 * @param {Function} getYearColor - Function to get color for a year
 * @returns {Object} Visualization and update functions
 */
export function useLayerVisualization(
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
) {
  // Color functions for layer styling
  const getFillColor = () => {
    if (visualization.value === 'area-change') {
      return [
        'interpolate',
        ['linear'],
        ['get', 'Area change (%)'],
        -100,
        '#F97316',
        0,
        '#3B82F6',
      ];
    } else if (visualization.value === 'volume-change') {
      return [
        'interpolate',
        ['linear'],
        ['get', 'Volume change (%)'],
        -100,
        '#F97316',
        0,
        '#3B82F6',
      ];
    } else if (visualization.value === 'bivariate') {
      return getBivariateColorExpression();
    } else {
      return isSatellite.value ? '#FFFFFF' : '#3B82F6';
    }
  };

  const getFillOpacity = () => {
    return isSatellite.value ? 0.8 : 0.6;
  };

  const getOutlineColor = () => {
    if (
      visualization.value === 'uniform' &&
      isSatellite.value &&
      selectedFeatureId.value
    ) {
      return '#3B82F6';
    }
    return getFillColor();
  };

  // Update dynamic mode layer colors and outline filter
  const updateLayerColors = () => {
    const layerId = currentLayerId.value;
    const outlineId = currentOutlineId.value;

    if (!map.value) {
      return;
    }

    if (map.value.getLayer(layerId)) {
      const fillColor = getFillColor();
      const baseOpacity = getFillOpacity();
      const fillOpacity = selectedFeatureId.value
        ? ['case', ['==', ['id'], selectedFeatureId.value], 1.0, baseOpacity]
        : baseOpacity;

      map.value.setPaintProperty(layerId, 'fill-color', fillColor);
      map.value.setPaintProperty(layerId, 'fill-opacity', fillOpacity);
    }

    if (map.value.getLayer(outlineId)) {
      const filter = selectedFeatureId.value
        ? ['==', ['id'], selectedFeatureId.value]
        : ['literal', false];
      map.value.setFilter(outlineId, filter);
      const outlineColor = getOutlineColor();
      map.value.setPaintProperty(outlineId, 'line-color', outlineColor);
    }
  };

  // Update comparison mode layer visibility based on visibleScenarios
  const updateComparisonLayerVisibility = () => {
    if (!map.value || mapMode.value !== 'comparison') return;

    const refLayerId = getComparisonLayerId(referenceScenario.value);
    const compLayerId = getComparisonLayerId(comparisonScenario.value);

    if (map.value.getLayer(refLayerId)) {
      const visibility = visibleScenarios.value.has('reference')
        ? 'visible'
        : 'none';
      map.value.setLayoutProperty(refLayerId, 'visibility', visibility);
    }

    if (map.value.getLayer(compLayerId)) {
      const visibility = visibleScenarios.value.has('comparison')
        ? 'visible'
        : 'none';
      map.value.setLayoutProperty(compLayerId, 'visibility', visibility);
    }
  };

  // Update comparison mode layer opacity (selected glacier has full opacity)
  const updateComparisonLayerOpacity = () => {
    if (!map.value || mapMode.value !== 'comparison') return;

    const refLayerId = getComparisonLayerId(referenceScenario.value);
    const compLayerId = getComparisonLayerId(comparisonScenario.value);

    const fillOpacity = selectedFeatureId.value
      ? ['case', ['==', ['id'], selectedFeatureId.value], 1.0, 0.6]
      : 0.6;

    if (map.value.getLayer(refLayerId)) {
      map.value.setPaintProperty(refLayerId, 'fill-opacity', fillOpacity);
    }

    if (map.value.getLayer(compLayerId)) {
      map.value.setPaintProperty(compLayerId, 'fill-opacity', fillOpacity);
    }
  };

  // Update overlay mode outline filter and color for selected glacier
  const updateOverlayOutline = () => {
    if (!map.value || mapMode.value !== 'overlay') return;

    const overlayOutlineId = getOverlayOutlineId(projection.value);

    if (map.value.getLayer(overlayOutlineId)) {
      const filter = selectedFeatureId.value
        ? ['==', ['id'], selectedFeatureId.value]
        : ['literal', false];
      map.value.setFilter(overlayOutlineId, filter);

      const minYear = SCENARIO_CONFIG.MIN_YEAR;
      const yearColor = getYearColor(minYear);
      map.value.setPaintProperty(overlayOutlineId, 'line-color', yearColor);
    }
  };

  // Orchestrates all layer color/opacity updates across all modes
  const updateAllLayerColors = () => {
    updateLayerColors();
    updateComparisonLayerOpacity();
    updateOverlayOutline();
  };

  return {
    getFillColor,
    getOutlineColor,
    getFillOpacity,
    updateLayerColors,
    updateComparisonLayerVisibility,
    updateComparisonLayerOpacity,
    updateOverlayOutline,
    updateAllLayerColors,
  };
}
