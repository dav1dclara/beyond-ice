#!/usr/bin/env python3
"""
Convert shapefile to GeoJSON with CRS transformation.
Transforms to WGS84 (EPSG:4326) for web mapping.
"""

import sys
import argparse
from pathlib import Path

try:
    import geopandas as gpd
except ImportError:
    print("Error: geopandas is required. Install with: pip install geopandas")
    sys.exit(1)


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
    
    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
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
    parser = argparse.ArgumentParser(
        description='Convert shapefile to GeoJSON with CRS transformation'
    )
    parser.add_argument(
        'input',
        help='Input shapefile path (.shp)'
    )
    parser.add_argument(
        '-o', '--output',
        help='Output GeoJSON path (default: input filename with .geojson extension)'
    )
    parser.add_argument(
        '--crs',
        default='EPSG:4326',
        help='Target CRS (default: EPSG:4326 for WGS84)'
    )
    
    args = parser.parse_args()
    
    # Determine output path
    if args.output:
        output_path = Path(args.output)
    else:
        input_path = Path(args.input)
        output_path = input_path.parent / f"{input_path.stem}.geojson"
    
    convert_shapefile_to_geojson(args.input, output_path, args.crs)


if __name__ == '__main__':
    main()

