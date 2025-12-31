/**
 * Composable for selecting glaciers from map clicks
 * Handles clicking on glaciers, map clicks, and restoring selections
 *
 * @param {Ref<mapboxgl.Map>} map - The Mapbox map instance
 * @param {Ref<string>} mapMode - Current map mode ('dynamic', 'overlay', 'comparison')
 * @param {Ref<string>} referenceScenario - Reference scenario for comparison mode
 * @param {Ref<string>} comparisonScenario - Comparison scenario for comparison mode
 * @param {Ref<Set<number>>} visibleYears - Set of visible years for overlay mode
 * @param {Array<number>} decadeYears - Array of decade years
 * @param {Ref<string>} projection - Current projection
 * @param {Ref<Array>} glacierSearchIndex - Glacier search index from useGlacierSearch
 * @param {Ref<boolean>} is3D - Whether 3D mode is enabled
 * @param {Function} getComparisonLayerId - Function to get comparison layer ID
 * @param {Function} getStaticLayerId - Function to get static layer ID
 * @param {ComputedRef<string>} currentLayerId - Current layer ID
 * @param {Ref<string>} searchQuery - Search query ref (for updating)
 * @param {Ref} selectedGlacier - Ref for selected glacier
 * @param {Ref} selectedFeatureId - Ref for selected feature ID
 * @param {Function} calculateTerrainCameraAngle - Function to calculate camera angle from terrain
 * @param {Function} updateLayerColors - Function to update layer colors
 * @param {Function} querySourceFeatures - Function to query features from source
 * @param {Ref<number>} lastModeSwitchTime - Timestamp of last mode switch
 * @param {Ref<number>} selectionTime - Ref to track when selection was made
 * @returns {Object} Selection functions
 */
export function useClickSelection(
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
  updateLayerColors,
  querySourceFeatures,
  lastModeSwitchTime,
  selectionTime
) {
  const handleGlacierClick = (e) => {
    // Query features from all relevant layers to handle overlapping layers
    let features = [];
    if (mapMode.value === 'comparison') {
      const refLayerId = getComparisonLayerId(referenceScenario.value);
      const compLayerId = getComparisonLayerId(comparisonScenario.value);

      const allFeatures = map.value.queryRenderedFeatures(e.point, {
        layers: [refLayerId, compLayerId],
      });

      console.log(
        '[useClickSelection] Query found',
        allFeatures.length,
        'features at click point in comparison mode',
        {
          refLayerId,
          compLayerId,
          point: e.point,
          features: allFeatures.map((f) => ({
            id: f.id,
            layerId: f.layer?.id,
            hasProperties: !!f.properties,
          })),
        }
      );

      if (allFeatures.length === 0) {
        console.warn(
          '[useClickSelection] No features found at click point in comparison mode'
        );
        return;
      }

      features = allFeatures;
    } else if (mapMode.value === 'overlay') {
      const overlayLayerIds = [];
      decadeYears.forEach((year) => {
        if (visibleYears.value.has(year)) {
          const layerId = getStaticLayerId(projection.value, year);
          if (map.value.getLayer(layerId)) {
            overlayLayerIds.push(layerId);
          }
        }
      });

      if (overlayLayerIds.length === 0) {
        console.warn('[useClickSelection] No visible overlay layers to query');
        return;
      }

      const allFeatures = map.value.queryRenderedFeatures(e.point, {
        layers: overlayLayerIds,
      });

      console.log(
        '[useClickSelection] Query found',
        allFeatures.length,
        'features at click point in overlay mode',
        {
          overlayLayerIds,
          point: e.point,
          features: allFeatures.map((f) => ({
            id: f.id,
            layerId: f.layer?.id,
            hasProperties: !!f.properties,
          })),
        }
      );

      if (allFeatures.length === 0) {
        console.warn(
          '[useClickSelection] No features found at click point in overlay mode'
        );
        return;
      }

      features = allFeatures;
    } else {
      if (!e.features || e.features.length === 0) return;
      features = e.features;
    }

    let selectedFeature = features[0];

    // Prefer topmost layer feature when multiple features are present
    if (mapMode.value === 'comparison' && features.length > 1) {
      const compLayerId = getComparisonLayerId(comparisonScenario.value);
      const compFeature = features.find((f) => f.layer?.id === compLayerId);
      if (compFeature) {
        selectedFeature = compFeature;
      }
    } else if (mapMode.value === 'overlay' && features.length > 1) {
      // Prefer most recent year (last feature is topmost layer)
      selectedFeature = features[features.length - 1];
    }

    // Extract feature ID, trying multiple sources
    let featureId = selectedFeature.id;
    if (
      featureId === undefined ||
      featureId === null ||
      featureId === 'null' ||
      featureId === ''
    ) {
      featureId =
        selectedFeature.properties?.['mapbox-id'] ||
        selectedFeature.properties?.id ||
        selectedFeature.properties?.['sgi-id'] ||
        selectedFeature.properties?.['mapbox_id'];

      console.log(
        '[useClickSelection] Feature ID not in id field, trying properties:',
        {
          originalId: selectedFeature.id,
          'mapbox-id': selectedFeature.properties?.['mapbox-id'],
          mapbox_id: selectedFeature.properties?.['mapbox_id'],
          id: selectedFeature.properties?.id,
          'sgi-id': selectedFeature.properties?.['sgi-id'],
          foundId: featureId,
          allProperties: Object.keys(selectedFeature.properties || {}),
        }
      );
    }

    if (
      featureId === undefined ||
      featureId === null ||
      featureId === 'null' ||
      featureId === ''
    ) {
      console.warn(
        '[useClickSelection] Selected feature has no valid ID in any form',
        {
          feature: selectedFeature,
          layerId: selectedFeature.layer?.id,
          source: selectedFeature.source,
          sourceLayer: selectedFeature.sourceLayer,
          properties: selectedFeature.properties,
          idField: selectedFeature.id,
        }
      );
      return;
    }

    if (typeof featureId === 'string' && featureId.toLowerCase() === 'null') {
      console.warn(
        '[useClickSelection] Feature ID is string "null", cannot use'
      );
      return;
    }

    console.log(
      '[useClickSelection] Feature selected - ID:',
      featureId,
      'from layer:',
      selectedFeature.layer?.id,
      'total features:',
      features.length
    );

    // Calculate bearing for 3D mode
    if (is3D.value) {
      try {
        const glacierEntry = glacierSearchIndex.value.find(
          (entry) => entry.mapbox_id === featureId
        );

        if (
          glacierEntry &&
          glacierEntry.aspect_deg !== undefined &&
          glacierEntry.aspect_deg !== null
        ) {
          const bearing = (glacierEntry.aspect_deg + 180) % 360;
          const slopeDeg =
            glacierEntry.slope_deg !== undefined &&
            glacierEntry.slope_deg !== null
              ? glacierEntry.slope_deg
              : null;
          let pitch = 50;
          if (slopeDeg !== null) {
            pitch = 45 + slopeDeg * 0.5;
            pitch = Math.min(65, Math.max(45, pitch));
          }

          console.log(
            '[useClickSelection] 🧭 Using aspect_deg from mapping CSV:',
            {
              aspect_deg: glacierEntry.aspect_deg.toFixed(1) + '°',
              bearing: bearing.toFixed(1) + '°',
              slope_deg: slopeDeg !== null ? slopeDeg.toFixed(1) + '°' : 'N/A',
              pitch: pitch.toFixed(1) + '°',
            }
          );
        } else if (selectedFeature.geometry) {
          // Calculate from terrain when CSV data unavailable
          let minLng = Infinity,
            minLat = Infinity,
            maxLng = -Infinity,
            maxLat = -Infinity;

          const processCoords = (coords) => {
            if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
              coords.forEach((coord) => {
                if (Array.isArray(coord) && coord.length >= 2) {
                  const [lng, lat] = coord;
                  minLng = Math.min(minLng, lng);
                  minLat = Math.min(minLat, lat);
                  maxLng = Math.max(maxLng, lng);
                  maxLat = Math.max(maxLat, lat);
                }
              });
            } else {
              const [lng, lat] = coords;
              minLng = Math.min(minLng, lng);
              minLat = Math.min(minLat, lat);
              maxLng = Math.max(maxLng, lng);
              maxLat = Math.max(maxLat, lat);
            }
          };

          if (selectedFeature.geometry.type === 'Polygon') {
            selectedFeature.geometry.coordinates[0].forEach(processCoords);
          } else if (selectedFeature.geometry.type === 'MultiPolygon') {
            selectedFeature.geometry.coordinates.forEach((polygon) => {
              polygon[0].forEach(processCoords);
            });
          }

          if (minLng !== Infinity && minLat !== Infinity) {
            const bounds = {
              min_lng: minLng,
              min_lat: minLat,
              max_lng: maxLng,
              max_lat: maxLat,
            };
            const cameraAngle = calculateTerrainCameraAngle(bounds);
            console.log(
              '[useClickSelection] 🧭 Calculated bearing from terrain (mapping CSV not available):',
              {
                bearing: cameraAngle.bearing.toFixed(1) + '°',
                pitch: cameraAngle.pitch.toFixed(1) + '°',
                aspect: ((cameraAngle.bearing + 180) % 360).toFixed(1) + '°',
              }
            );
          }
        }
      } catch (error) {
        console.warn('[useClickSelection] Error calculating bearing:', error);
      }
    }

    // Normalize feature ID type
    const normalizedFeatureId =
      typeof featureId === 'string' &&
      !isNaN(featureId) &&
      !isNaN(parseFloat(featureId))
        ? parseFloat(featureId)
        : featureId;

    const currentId = selectedGlacier.value?.id;
    const currentIdNormalized =
      currentId != null &&
      typeof currentId === 'string' &&
      !isNaN(currentId) &&
      !isNaN(parseFloat(currentId))
        ? parseFloat(currentId)
        : currentId;

    const isSameFeature =
      currentIdNormalized != null &&
      currentIdNormalized === normalizedFeatureId;

    console.log('[useClickSelection] Comparing feature IDs:', {
      currentId,
      currentIdNormalized,
      newFeatureId: normalizedFeatureId,
      currentType: typeof currentId,
      newType: typeof normalizedFeatureId,
      isSameFeature,
      strictEqual: currentIdNormalized === normalizedFeatureId,
    });

    // Never deselect by clicking the same feature (prevents confusion with overlapping layers)
    const shouldDeselect = false;

    if (shouldDeselect) {
      console.log(
        '[useClickSelection] Deselecting feature (clicked same feature again)'
      );
      selectedGlacier.value = null;
      selectedFeatureId.value = null;
      if (selectionTime) {
        selectionTime.value = 0;
      }
      searchQuery.value = '';
    } else {
      console.log(
        '[useClickSelection] Selecting feature, setting ID:',
        normalizedFeatureId,
        isSameFeature
          ? '(same feature, but keeping selected in comparison mode)'
          : '(new feature)'
      );
      selectedGlacier.value = {
        id: normalizedFeatureId,
        name: selectedFeature.properties?.name || null,
        'sgi-id': selectedFeature.properties?.['sgi-id'] || null,
      };
      selectedFeatureId.value = normalizedFeatureId;
      if (selectionTime) {
        selectionTime.value = Date.now();
      }
      searchQuery.value = selectedFeature.properties?.name || '';
    }

    // Update layer colors
    updateLayerColors();

    console.log(
      '[useClickSelection] ✓ Feature selection updated, ID locked:',
      selectedFeatureId.value,
      {
        selectedGlacier: selectedGlacier.value,
        selectedFeatureId: selectedFeatureId.value,
      }
    );
  };

  const handleMapClick = (e) => {
    if (mapMode.value === 'comparison') {
      const refLayerId = getComparisonLayerId(referenceScenario.value);
      const compLayerId = getComparisonLayerId(comparisonScenario.value);
      const features = map.value.queryRenderedFeatures(e.point, {
        layers: [refLayerId, compLayerId],
      });

      if (features.length === 0 && selectedGlacier.value !== null) {
        selectedGlacier.value = null;
        selectedFeatureId.value = null;
        searchQuery.value = '';
        updateLayerColors();
        console.log(
          '[useClickSelection] ✓ Deselected (clicked outside glacier)'
        );
      }
    } else if (mapMode.value === 'overlay') {
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

      if (features.length === 0 && selectedGlacier.value !== null) {
        selectedGlacier.value = null;
        selectedFeatureId.value = null;
        searchQuery.value = '';
        updateLayerColors();
        console.log(
          '[useClickSelection] ✓ Deselected (clicked outside glacier)'
        );
      }
    } else {
      const layerId = currentLayerId.value;
      const features = map.value.queryRenderedFeatures(e.point, {
        layers: [layerId],
      });

      if (features.length === 0 && selectedGlacier.value !== null) {
        selectedGlacier.value = null;
        selectedFeatureId.value = null;
        searchQuery.value = '';
        updateLayerColors();
        console.log(
          '[useClickSelection] ✓ Deselected (clicked outside glacier)'
        );
      }
    }
  };

  const restoreSelectionByFeatureId = (featureId, retryCount = 0) => {
    if (!map.value) return;

    const maxRetries = 5;
    const retryDelay = 200;

    try {
      const features = querySourceFeatures();
      console.log(
        '[useClickSelection] Attempting to restore selection for feature ID:',
        featureId,
        'Found',
        features?.length || 0,
        'features'
      );

      if (!features || features.length === 0) {
        if (retryCount < maxRetries) {
          console.log(
            '[useClickSelection] No features found yet, retrying...',
            retryCount + 1,
            '/',
            maxRetries
          );
          setTimeout(() => {
            restoreSelectionByFeatureId(featureId, retryCount + 1);
          }, retryDelay);
        } else {
          console.warn(
            '[useClickSelection] Could not restore selection: no features found after',
            maxRetries,
            'retries'
          );
          selectedGlacier.value = null;
          searchQuery.value = '';
          updateLayerColors();
        }
        return;
      }

      const feature = features.find((f) => f.id === featureId);

      if (feature) {
        selectedGlacier.value = {
          id: featureId,
          name: feature.properties?.name || null,
          'sgi-id': feature.properties?.['sgi-id'] || null,
        };
        searchQuery.value = feature.properties?.name || '';
        updateLayerColors();
        console.log(
          '[useClickSelection] ✓ Selection restored for feature ID:',
          featureId
        );
      } else {
        selectedGlacier.value = null;
        searchQuery.value = '';
        updateLayerColors();
        console.log(
          '[useClickSelection] Feature ID',
          featureId,
          'not found in current layer (checked',
          features.length,
          'features)'
        );
      }
    } catch (error) {
      console.error('[useClickSelection] Error restoring selection:', error);
      if (retryCount < maxRetries) {
        setTimeout(() => {
          restoreSelectionByFeatureId(featureId, retryCount + 1);
        }, retryDelay);
      }
    }
  };

  const clearSelection = () => {
    selectedGlacier.value = null;
    selectedFeatureId.value = null;
    searchQuery.value = '';
    updateLayerColors();
  };

  return {
    handleGlacierClick,
    handleMapClick,
    restoreSelectionByFeatureId,
    clearSelection,
  };
}
