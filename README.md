# BEYOND ICE

## About 

BEYOND ICE is an interactive cartographic web application that visualizes projected future extents of all Swiss glaciers until the end of the 21st century (2020–2100) under different climate scenarios. Results are based on GLAMOS data and glaciological modelling of glacier retreat. The main purpose of this platform is to make scientifically derived glacier projections accessible to a broad audience through an intuitive, map-based interface.

> [!NOTE]
> **BEYOND ICE is live on the GLAMOS website:** [https://doi.glamos.ch/scenarios/](https://doi.glamos.ch/scenarios/)

## Data Processing

### Setup

Create a conda environment for the project and install dependencies:

```bash
cd data-processing
conda create -n BEYONDICE python=3.11
conda activate BEYONDICE
pip install -r requirements.txt
```

### Data Sources

The future glacier extents and the SGI 2016 extents must be stored inside `data/raw` to run the scripts in `data-processing`. SGI 2016 extents (`data/raw/sgi2016`) are available at [GLAMOS](https://doi.glamos.ch/data/inventory/inventory_sgi2016_r2020.html). Future glacier extents (`data/raw/future_extents`) are available at [polybox](https://polybox.ethz.ch/index.php/s/4D6DiFPF3XzCnHZ).

### Scripts

To execute the scripts, change directory to `data-processing`.

To create a glacier index file (.csv), run

```bash
python create_glacier_index.py
```

To calculate scenario totals (area and volume), run

```bash
python calculate_scenario_totals.py
```

To create GEOJSON files and tilesets (.mbtiles), run

```bash
python generate_tilesets.py
```

## Web Application

This application is built with [Vue 3](https://vuejs.org/) and [Vite](https://vitejs.dev/) using the [Composition API](https://vuejs.org/guide/extras/composition-api-faq.html). [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/) provides the interactive map visualization, while [Vue composables](https://vuejs.org/guide/reusability/composables.html) handle state management and user interactions.

### Setup

Install dependencies:

```bash
npm install
```

Create a `.env` file in the project root and add your Mapbox access token:

```
VITE_MAPBOX_TOKEN=your_mapbox_token_here
```

Start the development server:

```bash
npm run dev
```

### Code Structure

The codebase is split into components and composables. Components define the user interface, while composables contain reusable logic and manage application state.

**Entry Points:**
- `main.js` - Application initialization
- `App.vue` - Root component

**Components (`components/`):**
- `Map.vue` - Main map container and orchestration
- `ControlPanel.vue` - Control panel with mode/scenario controls, time slider, and graph
- `ModeScenarioControls.vue` - Visualization mode and scenario selection UI
- `TimeSlider.vue` - Year selection slider with animation
- `EvolutionGraph.vue` - Chart visualization for glacier evolution over time
- `VisualizationPanel.vue` - Visualization style selection and legend display
- `SearchBar.vue` - Glacier search input and results
- `MapControls.vue` - Basemap toggle and map navigation controls
- `GlacierTooltip.vue` - Hover tooltip for glacier features
- `MapLoadOverlay.vue` - Loading overlay on initial map load
- `Imprint.vue` - Application imprint/credits

**Composables (`composables/`):**
- `useMapboxMap.js` - Mapbox map initialization and logo positioning
- `useLayers.js` - Layer creation and management for all map modes
- `useLayerVisualization.js` - Color expressions and layer styling
- `useLayerToggles.js` - Year and scenario visibility toggles
- `useMapControls.js` - 3D terrain and camera controls
- `useMapStyles.js` - Basemap style switching (light/satellite)
- `useGlacierSearch.js` - Glacier search index loading and querying
- `useSearchSelection.js` - Glacier selection from search results
- `useClickSelection.js` - Glacier selection from map clicks
- `useGlacierZoom.js` - Terrain-aware (2D/3D) zoom to glacier extents
- `useGlacierTooltip.js` - Tooltip positioning and display logic
- `useEvolutionGraphData.js` - Chart data loading from CSV and tilesets
- `useAnimation.js` - Play/pause animation for time slider

**Utils (`utils/`):**
- `csvParser.js` - CSV line parsing utility
- `chartFormatters.js` - Number formatting for charts
- `bivariateColor.js` - Bivariate choropleth color calculations

**Config (`config/`):**
- `mapbox.js` - Mapbox token configuration
- `mapStyles.js` - Map style definitions
- `tilesets.js` - Mapbox tileset IDs mapping
- `years.js` - Year range configuration
- `scenarios.js` - Climate scenario definitions
- `csvPaths.js` - CSV file path utilities

## Attributions

**Data:** Glacier projections computed with the Global Glacier Evolution Model ([Huss and Hock, 2015](https://doi.org/10.3389/feart.2015.00054); [Huss et al., 2025](https://doi.org/10.5281/zenodo.14866776)) using IPCC low- to high-emission climate scenarios (SSP126 to SSP585) and [GLAMOS](https://www.glamos.ch) / [VAW ETH ZURICH](https://vaw.ethz.ch/forschung/glaziologie.html) data on glacier extent, thickness and mass balance.

**Basemaps:** © [Mapbox](https://www.mapbox.com/about/maps) © [OpenStreetMap](https://www.openstreetmap.org/copyright) © [Swisstopo](https://www.swisstopo.admin.ch/)

## Credits

This application was created by [David Clara](https://github.com/dav1dclara) for the course [Application Development in Cartography](https://karto.ethz.ch/en/education/courses/master/application-development-cartography.html) at ETH Zurich during the winter semester 2025/2026. Glacier projections were provided by [Matthias Huss](https://vaw.ethz.ch/personen/person-detail.m-huss.html), [VAW ETH ZURICH](https://vaw.ethz.ch/forschung/glaziologie.html), and [GLAMOS](https://www.glamos.ch).
