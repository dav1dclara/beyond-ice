// Central place to define reusable Mapbox GL style objects

// Style based on your custom-style.html (Swiss WMS relief)
export const swissReliefWmsStyle = {
  version: 8,
  name: 'Swiss relief WMS + terrain source',
  sources: {
    'mapbox-terrain': {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-terrain-v2',
    },
    'swiss-wms': {
      type: 'raster',
      tiles: [
        'https://wms.geo.admin.ch/?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ch.swisstopo.digitales-hoehenmodell_25_reliefschattierung&STYLES=default&CRS=EPSG:3857&FORMAT=image/png&TRANSPARENT=true&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}',
      ],
      tileSize: 256,
    },
  },
  layers: [
    // Uncomment if you want a solid background color
    // {
    //   id: 'background',
    //   type: 'background',
    //   paint: {
    //     'background-color': '#000000',
    //   },
    // },
    {
      id: 'swiss-wms',
      type: 'raster',
      source: 'swiss-wms',
      paint: {
        'raster-opacity': 1,
      },
    },
    // Example: add contours on top using mapbox-terrain
    // {
    //   id: 'contour',
    //   source: 'mapbox-terrain',
    //   'source-layer': 'contour',
    //   type: 'line',
    //   paint: {
    //     'line-color': '#ffffff',
    //   },
    // },
  ],
}

// Minimal base style with contour lines from Mapbox terrain
export const minimalContourStyle = {
  version: 8,
  name: 'Minimal contour lines',
  sources: {
    'mapbox-terrain': {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-terrain-v2',
    },
  },
  layers: [
    // Simple background
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#f5f5f5', // Light gray background
      },
    },
    // Hillshade from mapbox-terrain
    {
      id: 'hillshade',
      type: 'fill',
      source: 'mapbox-terrain',
      'source-layer': 'hillshade',
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['get', 'elevation'],
          200, '#e8e8e8',
          500, '#d0d0d0',
          1000, '#b8b8b8',
          2000, '#a0a0a0',
          3000, '#888888',
        ],
        'fill-opacity': 0.6,
      },
    },
    // Contour lines from mapbox-terrain
    {
      id: 'contour',
      type: 'line',
      source: 'mapbox-terrain',
      'source-layer': 'contour',
      paint: {
        'line-color': '#666666', // Gray contour lines
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 0.5,
          10, 1,
          15, 1.5,
        ],
        'line-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 0.3,
          10, 0.5,
          15, 0.7,
        ],
      },
    },
  ],
}
