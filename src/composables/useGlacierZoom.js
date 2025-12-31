import mapboxgl from 'mapbox-gl';

/**
 * Composable for glacier zoom operations with terrain-aware camera positioning
 * Handles zooming to glaciers with optimal camera angles based on terrain aspect/slope
 *
 * @param {Ref<mapboxgl.Map>} map - The Mapbox map instance
 * @param {Ref<Object>} selectedGlacier - The currently selected glacier
 * @param {Ref<Array>} glacierSearchIndex - The glacier search index with bounds data
 * @param {Ref<Boolean>} is3D - Whether 3D mode is enabled
 * @returns {Object} Zoom functions
 */
export function useGlacierZoom(
  map,
  selectedGlacier,
  glacierSearchIndex,
  is3D
) {
  /**
   * Calculate optimal camera angle (bearing and pitch) from terrain
   * Samples elevation at grid points and calculates aspect/slope
   *
   * @param {Object} bounds - Bounds object with min_lng, min_lat, max_lng, max_lat
   * @returns {Object} Object with bearing and pitch values
   */
  const calculateTerrainCameraAngle = (bounds) => {
    if (!map.value) return { bearing: 0, pitch: 50 };

    const terrain = map.value.getTerrain();
    if (!terrain) {
      return { bearing: 0, pitch: 50 };
    }

    const { min_lng, min_lat, max_lng, max_lat } = bounds;

    const gridSize = 5;
    const lngStep = (max_lng - min_lng) / (gridSize - 1);
    const latStep = (max_lat - min_lat) / (gridSize - 1);

    const elevations = [];
    const elevationGrid = [];

    for (let i = 0; i < gridSize; i++) {
      const row = [];
      for (let j = 0; j < gridSize; j++) {
        const lng = min_lng + j * lngStep;
        const lat = min_lat + i * latStep;

        try {
          const elevation = terrain.getElevation(new mapboxgl.LngLat(lng, lat));
          elevations.push(elevation);
          row.push(elevation);
        } catch {
          row.push(0);
        }
      }
      elevationGrid.push(row);
    }

    if (elevations.length === 0) {
      return { bearing: 0, pitch: 50 };
    }

    // Calculate aspect (direction of steepest slope) using gradient
    // Aspect: 0° = North, 90° = East, 180° = South, 270° = West
    let aspectX = 0;
    let aspectY = 0;
    let totalSlope = 0;
    let sampleCount = 0;

    for (let i = 0; i < gridSize - 1; i++) {
      for (let j = 0; j < gridSize - 1; j++) {
        const e1 = elevationGrid[i][j];
        const e2 = elevationGrid[i][j + 1];
        const e3 = elevationGrid[i + 1][j];

        // Calculate geographic distances (meters)
        // 1 degree longitude ≈ 111km * cos(latitude), 1 degree latitude ≈ 111km
        const centerLat = (min_lat + max_lat) / 2;
        const lngDist =
          lngStep * 111000 * Math.cos((centerLat * Math.PI) / 180);
        const latDist = latStep * 111000;

        // Calculate elevation gradients (elevation change per meter)
        const dx = (e2 - e1) / lngDist;
        const dy = (e1 - e3) / latDist;

        const slopeMagnitude = Math.sqrt(dx * dx + dy * dy);
        if (slopeMagnitude > 0) {
          // Gradient vector points uphill, so negate for descent direction
          const weight = slopeMagnitude;
          aspectX += -dx * weight;
          aspectY += -dy * weight;
          totalSlope += slopeMagnitude;
          sampleCount++;
        }
      }
    }

    if (sampleCount === 0 || totalSlope === 0) {
      return { bearing: 0, pitch: 50 };
    }

    const avgAspectX = aspectX / totalSlope;
    const avgAspectY = aspectY / totalSlope;

    // Calculate aspect angle (direction of steepest descent)
    // atan2(x, y) where x=east, y=north gives angle from north
    let aspect = Math.atan2(avgAspectX, avgAspectY) * (180 / Math.PI);
    aspect = (aspect + 360) % 360;

    // Bearing opposite of aspect (180° rotation) to view from uphill side
    let bearing = (aspect + 180) % 360;

    console.log('[Terrain Camera] Aspect calculation:', {
      avgAspectX: avgAspectX.toFixed(4),
      avgAspectY: avgAspectY.toFixed(4),
      aspect: aspect.toFixed(1) + '°',
      bearing: bearing.toFixed(1) + '°',
      avgSlope: (totalSlope / sampleCount).toFixed(4),
    });

    const avgSlope = totalSlope / sampleCount;
    const minElev = Math.min(...elevations);
    const maxElev = Math.max(...elevations);
    const elevRange = maxElev - minElev;

    // Pitch range: 45-65 degrees (steeper terrain = higher pitch)
    let pitch = 45 + avgSlope * 2;
    if (elevRange > 500) {
      pitch += 10;
    } else if (elevRange > 200) {
      pitch += 5;
    }
    pitch = Math.min(65, Math.max(45, pitch));

    return { bearing, pitch };
  };

  /**
   * Zoom to bounds with terrain-aware camera positioning
   * @param {Object} bounds - Bounds object with min_lng, min_lat, max_lng, max_lat
   * @param {string} [mapboxId] - Optional mapbox ID to look up aspect/slope from search index
   * @returns {Promise<void>} Promise that resolves when zoom animation completes
   */
  const zoomToBounds = async (bounds, mapboxId = null) => {
    if (!map.value) {
      console.warn('[GlacierZoom] Cannot zoom: map not available');
      return;
    }

    const { min_lng, min_lat, max_lng, max_lat } = bounds;

    try {
      const centerLng = (min_lng + max_lng) / 2;
      const centerLat = (min_lat + max_lat) / 2;

      let bearing = 0;
      let pitch = 50;

      if (is3D.value) {
        const glacierEntry = mapboxId
          ? glacierSearchIndex.value.find((entry) => entry.mapbox_id === mapboxId)
          : null;

        if (glacierEntry) {
          if (
            glacierEntry.aspect_deg !== undefined &&
            glacierEntry.aspect_deg !== null
          ) {
            bearing = (glacierEntry.aspect_deg + 180) % 360;
          } else {
            const cameraAngle = calculateTerrainCameraAngle(bounds);
            bearing = cameraAngle.bearing;
            pitch = cameraAngle.pitch;
          }

          if (
            glacierEntry.slope_deg !== undefined &&
            glacierEntry.slope_deg !== null
          ) {
            // Pitch range: 45-65 degrees (steeper slopes = higher pitch)
            pitch = 45 + glacierEntry.slope_deg * 0.5;
            pitch = Math.min(65, Math.max(45, pitch));
          }
        } else {
          const cameraAngle = calculateTerrainCameraAngle(bounds);
          bearing = cameraAngle.bearing;
          pitch = cameraAngle.pitch;
        }

        if (!map.value.getSource('mapbox-dem')) {
          map.value.addSource('mapbox-dem', {
            type: 'raster-dem',
            url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
            tileSize: 256,
            maxzoom: 11,
          });
        }

        if (!map.value.getTerrain()) {
          map.value.setTerrain({
            source: 'mapbox-dem',
            exaggeration: 1.0,
          });
        }

        const boundsArray = [
          [min_lng, min_lat],
          [max_lng, max_lat],
        ];
        const padding = { top: 100, bottom: 100, left: 100, right: 100 };

        const cameraOptions = map.value.cameraForBounds(boundsArray, {
          padding: padding,
        });

        map.value.flyTo({
          center: cameraOptions.center || [centerLng, centerLat],
          zoom: cameraOptions.zoom,
          bearing: bearing,
          pitch: pitch,
          duration: 2000,
          essential: true,
        });
      } else {
        const boundsArray = [
          [min_lng, min_lat],
          [max_lng, max_lat],
        ];
        const padding = { top: 100, bottom: 100, left: 100, right: 100 };

        const cameraOptions = map.value.cameraForBounds(boundsArray, {
          padding: padding,
        });

        const zoomedOutZoom = cameraOptions.zoom
          ? cameraOptions.zoom - 0.5
          : undefined;

        map.value.flyTo({
          center: cameraOptions.center || [centerLng, centerLat],
          zoom: zoomedOutZoom,
          duration: 1000,
        });
      }

      await new Promise((resolve) => {
        map.value.once('idle', () => {
          setTimeout(() => resolve(), 300);
        });
      });
    } catch (error) {
      console.error('[GlacierZoom] Error zooming to bounds:', error);
    }
  };

  /**
   * Zoom to the extent of the currently selected glacier
   * Uses terrain-aware camera positioning in 3D mode
   */
  const zoomToGlacierExtent = () => {
    if (!map.value || !selectedGlacier.value) {
      console.warn(
        '[GlacierZoom] Cannot zoom: map or glacier not available'
      );
      return;
    }

    const mapboxId =
      selectedGlacier.value['mapbox-id'] || selectedGlacier.value.id;
    if (!mapboxId) {
      console.warn('[GlacierZoom] Cannot zoom: no mapbox-id found');
      return;
    }

    const glacierEntry = glacierSearchIndex.value.find(
      (entry) => entry.mapbox_id === mapboxId
    );

    if (!glacierEntry || !glacierEntry.bounds) {
      console.warn(
        '[GlacierZoom] Cannot zoom: glacier bounds not found in mapping data'
      );
      return;
    }

    const bounds = {
      min_lng: glacierEntry.bounds.min_lng,
      min_lat: glacierEntry.bounds.min_lat,
      max_lng: glacierEntry.bounds.max_lng,
      max_lat: glacierEntry.bounds.max_lat,
    };

    zoomToBounds(bounds, mapboxId);
  };

  return {
    calculateTerrainCameraAngle,
    zoomToGlacierExtent,
    zoomToBounds,
  };
}
