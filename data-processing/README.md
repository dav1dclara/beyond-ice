# Data Processing Scripts

## Setup

Install required Python packages:

```bash
conda create -n BEYONDICE python=3.11
conda activate BEYONDICE
pip install -r requirements.txt
```

## Shapefile to GeoJSON

Convert a shapefile to GeoJSON with automatic CRS transformation to WGS84:

```bash
python data-processing/shapefile_to_geojson.py data/input.shp -o data/output.geojson
```

If no output is specified, it will create a `.geojson` file with the same name as the input:

```bash
python data-processing/shapefile_to_geojson.py data/input.shp
# Creates: data/input.geojson
```

### Options

- `-o, --output`: Specify output file path
- `--crs`: Target CRS (default: EPSG:4326 for WGS84)

### Example

```bash
# Convert shapefile to GeoJSON
python data-processing/shapefile_to_geojson.py data/my_shapefile.shp -o data/my_shapefile.geojson

# Convert with custom CRS
python data-processing/shapefile_to_geojson.py data/my_shapefile.shp --crs EPSG:3857
```

