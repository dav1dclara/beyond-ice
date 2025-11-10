import mapboxgl from 'mapbox-gl';

/**
 * Calculate bounds from a GeoJSON source in a Mapbox map
 * @param {mapboxgl.Map} map - The Mapbox map instance
 * @param {string} sourceId - The ID of the GeoJSON source
 * @returns {mapboxgl.LngLatBounds|null} The calculated bounds or null if not available
 */
export const calculateGeoJSONBounds = (map, sourceId = 'geojson-data') => {
  if (!map) return null;
  
  const source = map.getSource(sourceId);
  if (!source) return null;
  
  const bounds = new mapboxgl.LngLatBounds();
  
  // Try to get features from the source
  try {
    // Use querySourceFeatures to get all features
    const features = map.querySourceFeatures(sourceId);
    
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

/**
 * Calculate bounds from a GeoJSON feature
 * @param {Object} feature - GeoJSON feature
 * @returns {mapboxgl.LngLatBounds|null} The calculated bounds or null if invalid
 */
export const calculateFeatureBounds = (feature) => {
  if (!feature || !feature.geometry) return null;
  
  const bounds = new mapboxgl.LngLatBounds();
  const coordinates = feature.geometry.coordinates;
  
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
  
  return bounds.isEmpty() ? null : bounds;
};

