# BEYOND ICE

BEYOND ICE is an interactive cartographic web application that visualizes projected future extents of all Swiss glaciers until the end of the 21st century under different climate scenarios. The main purpose of this project is to make scientifically derived glacier projections accessible to a broad audience through an intuitive, map-based interface.

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

The future glacier extents and the SGI 2016 extents must be stored inside `data/raw` to run the scripts in `data-processing`. SGI 2016 extents (`data/raw/sgi2016`) are available at [GLAMOS](https://doi.glamos.ch/data/inventory/inventory_sgi2016_r2020.html). Future glacier extents (`data/raw/future_extents`) were are available at [polybox](https://polybox.ethz.ch/index.php/s/4D6DiFPF3XzCnHZ).

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

## Data Attribution

Glacier projection data was computed with GERM ([Huss et al., 2008](https://doi.org/10.1002/hyp.7055)) and provided by [VAW](https://vaw.ethz.ch/). The basemap data is provided by [Mapbox](https://www.mapbox.com/about/maps), [OpenStreetMap](https://www.openstreetmap.org/copyright), and [Swisstopo](https://www.swisstopo.admin.ch/).

## AI Assistance

[Cursor](https://cursor.com/) was used as a development aid throughout this project. It was primarily employed to explore implementation ideas, prototype alternative approaches, and support the overall development process. AI-assisted code suggestions were carefully reviewed, adapted, and integrated manually. In later stages, Cursor was used for refactoring, improving code readability and writing documentation. Architectural decisions, core logic, data processing pipeline, and scientific interpretations were designed, validated and finalized by the author. 

## Credits

This application was created by David Clara for the course [Application Development in Cartography](https://karto.ethz.ch/en/education/courses/master/application-development-cartography.html) at ETH Zurich during the winter semester 2025/2026.
