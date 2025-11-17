export function useGeoJSONLayer(map) {
  const loadGeoJSONLayer = (url, layerId = 'geojson-layer') => {
    if (!map.value) return

    // Add GeoJSON source
    if (!map.value.getSource(layerId)) {
      map.value.addSource(layerId, {
        type: 'geojson',
        data: url,
      })
    } else {
      // Update existing source
      const source = map.value.getSource(layerId)
      if (source.type === 'geojson') {
        source.setData(url)
      }
    }

    // Add fill layer if it doesn't exist
    if (!map.value.getLayer(layerId)) {
      map.value.addLayer({
        id: layerId,
        type: 'fill',
        source: layerId,
        paint: {
          'fill-color': '#87CEEB',
          'fill-opacity': 0.6,
        },
      })
    }

    // Add outline layer
    const outlineId = `${layerId}-outline`
    if (!map.value.getLayer(outlineId)) {
      map.value.addLayer({
        id: outlineId,
        type: 'line',
        source: layerId,
        paint: {
          'line-color': '#87CEEB',
          'line-width': 2,
        },
      })
    }
  }

  return {
    loadGeoJSONLayer,
  }
}

