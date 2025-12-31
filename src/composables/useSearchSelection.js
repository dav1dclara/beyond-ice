/**
 * Composable for selecting glaciers from search results
 * Handles selection from search dropdown with zoom and feature lookup
 *
 * @param {Ref<mapboxgl.Map>} map - The Mapbox map instance
 * @param {Ref<boolean>} is3D - Whether 3D mode is enabled
 * @param {Ref<Array>} glacierSearchIndex - Glacier search index
 * @param {Function} zoomToBounds - Function to zoom to bounds from useGlacierZoom
 * @param {Function} getSourceId - Function to get source ID
 * @param {Ref<string>} projection - Current projection/scenario
 * @param {Ref<number>} currentYear - Current year
 * @param {Ref} selectedGlacier - Ref for selected glacier
 * @param {Ref} selectedFeatureId - Ref for selected feature ID
 * @param {Ref<string>} searchQuery - Search query ref
 * @param {Function} updateAllLayerColors - Function to update layer colors
 * @param {Ref<boolean>} showSearchResults - Ref to show/hide search results
 * @returns {Object} Selection function
 */
export function useSearchSelection(
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
) {
  const handleGlacierSelect = async (result) => {
    showSearchResults.value = false;

    if (!result || !result['mapbox-id']) {
      console.warn('[useSearchSelection] Invalid glacier selection result');
      return;
    }

    const mapboxId = result['mapbox-id'];

    if (result.bounds) {
      try {
        const bounds = {
          min_lng: result.bounds.min_lng,
          min_lat: result.bounds.min_lat,
          max_lng: result.bounds.max_lng,
          max_lat: result.bounds.max_lat,
        };
        await zoomToBounds(bounds, mapboxId);
      } catch (error) {
        console.warn('[useSearchSelection] Error flying to bounds:', error);
      }
    }

    const sourceId = getSourceId(projection.value);
    if (!sourceId || !map.value) {
      console.warn('[useSearchSelection] Cannot select glacier: source not available');
      return;
    }

    try {
      const source = map.value.getSource(sourceId);
      if (!source || source.type !== 'vector') {
        console.warn('[useSearchSelection] Source not available or not a vector source');
        return;
      }

      const sourceLayerName = currentYear.value.toString();

      const findFeature = () => {
        let features = map.value.querySourceFeatures(sourceId, {
          sourceLayer: sourceLayerName,
        });

        let feature = features.find((f) => f.id === mapboxId);

        if (!feature) {
          try {
            features = map.value.querySourceFeatures(sourceId, {
              sourceLayer: sourceLayerName,
              filter: ['==', ['get', 'mapbox-id'], mapboxId],
            });
            if (features.length > 0) {
              feature = features[0];
            }
          } catch {
            // Continue if filter fails
          }
        }

        if (!feature) {
          features = map.value.querySourceFeatures(sourceId, {
            sourceLayer: sourceLayerName,
          });
          feature = features.find((f) => {
            const fId = f.id;
            const fMapboxId = f.properties?.['mapbox-id'];
            return (
              fId === mapboxId ||
              fId === String(mapboxId) ||
              fMapboxId === mapboxId ||
              fMapboxId === String(mapboxId)
            );
          });
        }

        return feature;
      };

      let feature = findFeature();

      let retries = 0;
      const maxRetries = 5;
      while (!feature && retries < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        feature = findFeature();
        retries++;
      }

      if (!feature) {
        console.warn(
          `[useSearchSelection] Glacier with mapbox-id ${mapboxId} not found after ${maxRetries} retries`
        );
        selectedGlacier.value = {
          id: mapboxId,
          name: result.name || null,
          'sgi-id': result['sgi-id'] || null,
          'mapbox-id': mapboxId,
        };
        selectedFeatureId.value = mapboxId;
        searchQuery.value = result.name || '';
        updateAllLayerColors();
        return;
      }

      selectedGlacier.value = {
        id: feature.id || mapboxId,
        name: result.name || feature.properties?.name || null,
        'sgi-id': result['sgi-id'] || feature.properties?.['sgi-id'] || null,
        'mapbox-id': mapboxId,
      };
      selectedFeatureId.value = feature.id || mapboxId;
      searchQuery.value = result.name || '';

      updateAllLayerColors();

      // Calculate bounds from feature geometry if not in search result
      if (!result.bounds && feature.geometry) {
        try {
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

          if (feature.geometry.type === 'Polygon') {
            feature.geometry.coordinates[0].forEach(processCoords);
          } else if (feature.geometry.type === 'MultiPolygon') {
            feature.geometry.coordinates.forEach((polygon) => {
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
            await zoomToBounds(bounds, mapboxId);
          }
        } catch (error) {
          console.warn('[useSearchSelection] Could not zoom to glacier:', error);
        }
      }
    } catch (error) {
      console.error('[useSearchSelection] Error selecting glacier:', error);
    }
  };

  return {
    handleGlacierSelect,
  };
}

