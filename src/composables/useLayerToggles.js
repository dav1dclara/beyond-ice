/**
 * Composable for layer toggle functionality
 * Handles toggling years in overlay mode and scenarios in comparison mode
 *
 * @param {Ref<mapboxgl.Map>} map - The Mapbox map instance
 * @param {Ref<string>} mapMode - Current map mode ('dynamic', 'overlay', 'comparison')
 * @param {Ref<Set<number>>} visibleYears - Set of visible years for overlay mode
 * @param {Array<number>} decadeYears - Array of available decade years
 * @param {Ref<string>} projection - Current projection/scenario
 * @param {Ref<number>} currentYear - Current year
 * @param {Function} createLayersForProjectionYear - Function to create layers for a projection and year
 * @param {Function} updateOverlayOutline - Function to update overlay outline
 * @param {Function} setupClickHandler - Function to setup click handlers
 * @param {Ref<Set<string>>} visibleScenarios - Set of visible scenarios for comparison mode
 * @param {Function} updateComparisonLayerVisibility - Function to update comparison layer visibility
 * @returns {Object} Toggle functions for years and scenarios
 */
export function useLayerToggles(
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
) {
  // Toggle visibility of a specific year in overlay mode
  const toggleYear = (year) => {
    if (visibleYears.value.has(year)) {
      visibleYears.value.delete(year);
    } else {
      visibleYears.value.add(year);
    }

    if (map.value && mapMode.value === 'overlay') {
      createLayersForProjectionYear(projection.value, currentYear.value);
      setTimeout(() => {
        updateOverlayOutline();
      }, 200);
      setTimeout(async () => {
        await setupClickHandler();
      }, 150);
    }
  };

  // Toggle visibility of all years in overlay mode
  const toggleAllYears = () => {
    if (visibleYears.value.size === decadeYears.length) {
      visibleYears.value.clear();
    } else {
      visibleYears.value = new Set(decadeYears);
    }

    if (map.value && mapMode.value === 'overlay') {
      createLayersForProjectionYear(projection.value, currentYear.value);
      setTimeout(() => {
        updateOverlayOutline();
      }, 200);
    }
  };

  // Toggle visibility of a scenario in comparison mode
  const toggleScenario = (scenario) => {
    if (visibleScenarios.value.has(scenario)) {
      visibleScenarios.value.delete(scenario);
    } else {
      visibleScenarios.value.add(scenario);
    }

    if (map.value && mapMode.value === 'comparison') {
      updateComparisonLayerVisibility();
    }
  };

  return {
    toggleYear,
    toggleAllYears,
    toggleScenario,
  };
}
