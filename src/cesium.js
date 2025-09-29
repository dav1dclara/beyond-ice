import {
  WebMapTileServiceImageryProvider,
  WebMercatorTilingScheme,
  Rectangle,
} from "cesium";

// from https://wmts.geo.admin.ch/EPSG/3857/1.0.0/WMTSCapabilities.xml
const kulturtypWMTS = new WebMapTileServiceImageryProvider({
  url: "https://wmts.geo.admin.ch/1.0.0/ch.blw.bodeneignung-kulturtyp/default/current/3857/{TileMatrix}/{TileCol}/{TileRow}.png",
  layer: "Bodeneignung: Kulturtyp",
  style: "ch.blw.bodeneignung-kulturtyp",
  format: "image/png",
  tileMatrixSetID: "3857_18",
  rectangle: Rectangle.fromDegrees(5.140242, 45.398181, 11.47757, 48.230651),
  tilingScheme: new WebMercatorTilingScheme(),
});

const kulturtypImageryProvider =
  viewer.scene.imageryLayers.addImageryProvider(kulturtypWMTS);

viewer.zoomTo(kulturtypImageryProvider);