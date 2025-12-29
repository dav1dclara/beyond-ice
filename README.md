# BEYOND ICE

## Data Processing

### Setup
Create a conda environment for the project and install dependencies:

```bash
cd data-processing
conda create -n BEYONDICE python=3.11
conda activate BEYONDICE
pip install -r requirements.txt
```

### Data
The future glacier extents and the SGI 2016 extents must be stored inside `data/raw`. SGI 2016 extents (`data/raw/sgi2016`) are available at [GLAMOS](https://doi.glamos.ch/data/inventory/inventory_sgi2016_r2020.html). Future glacier extents (`data/raw/future_extents`) were provided by the [VAW](https://vaw.ethz.ch/en/research/glaciology.html).

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

---





# Vue 3 + Vite

This template should help get you started developing with Vue 3 in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about IDE Support for Vue in the [Vue Docs Scaling up Guide](https://vuejs.org/guide/scaling-up/tooling.html#ide-support).
