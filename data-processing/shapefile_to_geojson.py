#!/usr/bin/env python3
"""
Convert shapefile to GeoJSON with CRS transformation.
Transforms to WGS84 (EPSG:4326) for web mapping.
"""

import sys
from pathlib import Path
import geopandas as gpd
import pandas as pd


def convert_shapefile_to_geojson(input_path, output_path, target_crs='EPSG:4326'):
    """
    Convert shapefile to GeoJSON with CRS transformation.
    
    Args:
        input_path: Path to input shapefile (.shp)
        output_path: Path to output GeoJSON file
        target_crs: Target CRS (default: EPSG:4326 for WGS84)
    """
    input_path = Path(input_path)
    output_path = Path(output_path)
    
    # Check if input file exists
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}")
        sys.exit(1)
    
    print(f"Reading shapefile: {input_path}")
    
    # Read shapefile
    try:
        gdf = gpd.read_file(input_path)
    except Exception as e:
        print(f"Error reading shapefile: {e}")
        sys.exit(1)
    
    print(f"Original CRS: {gdf.crs}")
    print(f"Features: {len(gdf)}")
    
    # Transform CRS if needed
    if gdf.crs is None:
        print("Warning: No CRS defined. Assuming WGS84.")
        gdf.set_crs(target_crs, inplace=True)
    elif gdf.crs != target_crs:
        print(f"Transforming to {target_crs}...")
        gdf = gdf.to_crs(target_crs)
    
    # Find the sgi_id column (could be 'sgi-id', 'sgi_id', or similar)
    sgi_id_col = None
    for col in gdf.columns:
        if col.lower().replace('-', '_') in ['sgi_id', 'sgiid', 'sgi-id']:
            sgi_id_col = col
            break
    
    if sgi_id_col is None:
        print("Warning: No sgi_id column found. Using index as sgi_id.")
        sgi_id_col = 'sgi_id'
        gdf[sgi_id_col] = gdf.index.astype(str)
    
    # Find the name column (could be 'name', 'Name', 'NAME', etc.)
    name_col = None
    for col in gdf.columns:
        if col.lower() == 'name':
            name_col = col
            break
    
    if name_col is None:
        print("Warning: No name column found. Using empty string for name.")
        name_col = 'name'
        gdf[name_col] = ''
    
    # Sort by sgi_id to ensure consistent ID assignment
    gdf = gdf.sort_values(by=sgi_id_col).reset_index(drop=True)
    
    # Create mapbox-id for each feature (sequential integers for Mapbox performance)
    # Integers are more efficient for Mapbox's setFeatureState and feature queries
    gdf['mapbox-id'] = range(len(gdf))
    
    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Create mapping DataFrame with mapbox-id, sgi_id, and name
    mapping_df = pd.DataFrame({
        'mapbox-id': gdf['mapbox-id'],
        'sgi_id': gdf[sgi_id_col],
        'name': gdf[name_col]
    })
    
    # Save mapping to CSV in the same output directory
    mapping_path = output_path.parent / f"mapping.csv"
    mapping_df.to_csv(mapping_path, index=False)
    print(f"✓ Saved mapping to: {mapping_path}")
    
    # Write GeoJSON
    print(f"Writing GeoJSON: {output_path}")
    try:
        gdf.to_file(output_path, driver='GeoJSON')
        print(f"✓ Successfully converted to GeoJSON")
        print(f"  Output: {output_path}")
        print(f"  Features: {len(gdf)}")
        print(f"  CRS: {gdf.crs}")
    except Exception as e:
        print(f"Error writing GeoJSON: {e}")
        sys.exit(1)


def main():
    # Use script's directory as base for relative paths
    script_dir = Path(__file__).parent
    data_dir = script_dir / ".." / "data"
    data_dir = data_dir.resolve()  # Resolve to absolute path

    input_path = data_dir / "raw" / "sgi2016" / "SGI_2016_glaciers.shp"
    output_path = data_dir / "processed" / "sgi2016.geojson"

    convert_shapefile_to_geojson(
        input_path=input_path,
        output_path=output_path,
    )


if __name__ == '__main__':
    main()

