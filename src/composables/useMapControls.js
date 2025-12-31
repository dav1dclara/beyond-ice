import { ref, watch } from 'vue';

/**
 * Composable for managing map controls (terrain, style, camera)
 * Consolidates terrain, style, and camera control functionality
 *
 * @param {Ref<mapboxgl.Map>} map - The Mapbox map instance
 * @returns {Object} Map control state and functions
 */
export function useMapControls(map) {
  const is3D = ref(false);

  const syncTerrainFromMap = () => {
    if (!map.value) return;

    const terrain = map.value.getTerrain();
    const pitch = map.value.getPitch();
    // Consider 3D if terrain is enabled OR pitch is > 0
    is3D.value = terrain !== null || pitch > 0;
  };

  watch(
    map,
    (newMap) => {
      if (newMap) {
        newMap.once('load', () => {
          syncTerrainFromMap();
        });
        if (newMap.loaded()) {
          syncTerrainFromMap();
        }
      }
    },
    { immediate: true }
  );

  /**
   * Animate terrain exaggeration smoothly
   */
  const animateTerrainExaggeration = (
    startValue,
    endValue,
    duration,
    onComplete
  ) => {
    if (!map.value) return;

    const startTime = performance.now();
    const source = 'mapbox-dem';

    if (!map.value.getSource(source)) {
      map.value.addSource(source, {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 256,
        maxzoom: 11,
      });
    }

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const easeInOutCubic = (t) => {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      };

      const easedProgress = easeInOutCubic(progress);
      const currentExaggeration =
        startValue + (endValue - startValue) * easedProgress;

      map.value.setTerrain({
        source: source,
        exaggeration: currentExaggeration,
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        if (onComplete) onComplete();
      }
    };

    requestAnimationFrame(animate);
  };

  /**
   * Toggle 3D terrain on/off
   */
  const toggleTerrain = () => {
    if (!map.value) return;

    is3D.value = !is3D.value;
    const duration = 1000;

    if (is3D.value) {
      if (!map.value.getSource('mapbox-dem')) {
        map.value.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 256,
          maxzoom: 11, // Reduced from 14 for better performance
        });
      }

      animateTerrainExaggeration(0, 1.0, duration);
      map.value.setRenderWorldCopies(false);

      map.value.easeTo({
        pitch: 50, // Reduced from 60 for better performance
        duration: duration,
      });
    } else {
      const currentTerrain = map.value.getTerrain();
      const currentExaggeration = currentTerrain?.exaggeration || 1.0;

      animateTerrainExaggeration(currentExaggeration, 0, duration, () => {
        map.value.setTerrain(null);
      });

      map.value.easeTo({
        pitch: 0,
        duration: duration,
      });
    }
  };

  /**
   * Reset map bearing to north (0 degrees)
   */
  const resetBearing = () => {
    if (!map.value) return;
    map.value.easeTo({
      bearing: 0,
      duration: 1000,
    });
  };

  return {
    is3D,
    toggleTerrain,
    resetBearing,
  };
}
