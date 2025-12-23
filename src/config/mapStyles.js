// Aerial imagery style using Swisstopo SWISSIMAGE
export const swissImage = {
  version: 8,
  name: 'SWISSIMAGE',
  sources: {
    'swiss-image': {
      type: 'raster',
      tiles: [
        'https://wms.geo.admin.ch/?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ch.swisstopo.images-swissimage&STYLES=default&CRS=EPSG:3857&FORMAT=image/jpeg&TRANSPARENT=false&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}',
      ],
      tileSize: 256,
    },
  },
  layers: [
    {
      id: 'swiss-image',
      type: 'raster',
      source: 'swiss-image',
      paint: {
        'raster-opacity': 1,
      },
    },
  ],
}