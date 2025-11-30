import mapboxgl from 'mapbox-gl';

/**
 * Calculate bounds from a GeoJSON feature
 * @param {Object} feature - GeoJSON feature
 * @returns {mapboxgl.LngLatBounds|null} The calculated bounds or null if invalid
 */
export const calculateFeatureBounds = (feature) => {
  console.log('[useGlacierBounds] calculateFeatureBounds called', { feature });
  
  if (!feature) {
    console.log('[useGlacierBounds] Feature is null or undefined');
    return null;
  }
  
  if (!feature.geometry) {
    console.log('[useGlacierBounds] Feature has no geometry property');
    return null;
  }
  
  console.log('[useGlacierBounds] Feature geometry type:', feature.geometry.type);
  
  const bounds = new mapboxgl.LngLatBounds();
  const coordinates = feature.geometry.coordinates;
  
  if (feature.geometry.type === "Polygon") {
    coordinates[0].forEach((coord, index) => {
      bounds.extend(coord);
    });
  } else if (feature.geometry.type === "MultiPolygon") {
    coordinates.forEach((polygon, polygonIndex) => {
      polygon[0].forEach((coord, coordIndex) => {
        bounds.extend(coord);
      });
    });
  } else {
    console.log('[useGlacierBounds] Unsupported geometry type:', feature.geometry.type);
    return null;
  }
  
  const isEmpty = bounds.isEmpty();
  
  if (!isEmpty) {
    console.log('[useGlacierBounds] Calculated bounds:', {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    });
  }
  
  return isEmpty ? null : bounds;
};

/**
 * Calculate bounds from an entire GeoJSON FeatureCollection
 * This function calculates the bounding box that encompasses all features in the GeoJSON
 * @param {Object} geojson - GeoJSON FeatureCollection or Feature object
 * @returns {mapboxgl.LngLatBounds|null} The calculated bounds or null if invalid
 */
export const calculateGeoJSONFileBounds = (geojson) => {
  console.log('[mapUtils] calculateGeoJSONFileBounds called', { geojson });
  
  if (!geojson) {
    console.log('[mapUtils] GeoJSON is null or undefined');
    return null;
  }
  
  const bounds = new mapboxgl.LngLatBounds();
  
  // Handle FeatureCollection - iterate through all features
  if (geojson.type === "FeatureCollection") {
    console.log('[mapUtils] Processing FeatureCollection with', geojson.features?.length || 0, 'features');
    
    if (!geojson.features || geojson.features.length === 0) {
      console.log('[mapUtils] FeatureCollection has no features');
      return null;
    }
    
    // Iterate through all features and extend bounds with all their coordinates
    geojson.features.forEach((feature) => {
      if (feature && feature.geometry) {
        const coordinates = feature.geometry.coordinates;
        
        if (feature.geometry.type === "Polygon") {
          // For Polygon, iterate through coordinates in the first ring
          coordinates[0].forEach((coord) => {
            bounds.extend(coord);
          });
        } else if (feature.geometry.type === "MultiPolygon") {
          // For MultiPolygon, iterate through all polygons and their first rings
          coordinates.forEach((polygon) => {
            polygon[0].forEach((coord) => {
              bounds.extend(coord);
            });
          });
        }
      }
    });
  } 
  // Handle single Feature - reuse the existing function
  else if (geojson.type === "Feature") {
    console.log('[mapUtils] Processing single Feature');
    return calculateFeatureBounds(geojson);
  } 
  // Handle raw geometry - wrap it in a Feature and calculate
  else if (geojson.type === "Polygon" || geojson.type === "MultiPolygon") {
    console.log('[mapUtils] Processing raw geometry');
    return calculateFeatureBounds({ type: "Feature", geometry: geojson });
  } 
  else {
    console.log('[mapUtils] Unsupported GeoJSON type:', geojson.type);
    return null;
  }
  
  const isEmpty = bounds.isEmpty();
  console.log('[mapUtils] GeoJSON bounds calculation complete. Is empty:', isEmpty);
  
  if (!isEmpty) {
    console.log('[mapUtils] Calculated GeoJSON bounds:', {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    });
  }
  
  return isEmpty ? null : bounds;
};
