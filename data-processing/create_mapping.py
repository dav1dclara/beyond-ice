#!/usr/bin/env python3
"""
Create mapping.csv file from a shapefile.
The mapping file contains mapbox-id, sgi_id, name, bounds, slope_deg, and aspect_deg for each glacier feature.
"""

from pathlib import Path
import geopandas as gpd
import pandas as pd


def create_mapping_csv(input_path, output_path):
    """
    Create mapping.csv file from a shapefile.
    
    Args:
        input_path: Path to input shapefile (.shp)
        output_path: Path to output mapping.csv file
    """
    input_path = Path(input_path)
    output_path = Path(output_path)
    
    # Check if input file exists
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}")
        return
    
    print(f"Reading shapefile: {input_path}")
    
    # Read shapefile
    try:
        gdf = gpd.read_file(input_path)
    except Exception as e:
        print(f"Error reading shapefile: {e}")
        return
    
    print(f"Features: {len(gdf)}")
    print(f"Original CRS: {gdf.crs}")
    
    # Convert to WGS84 (EPSG:4326) if not already - Mapbox uses WGS84 for coordinates
    if gdf.crs is None:
        print("Warning: No CRS defined, assuming WGS84")
        gdf.set_crs('EPSG:4326', inplace=True)
    elif gdf.crs.to_string() != 'EPSG:4326':
        print(f"Converting from {gdf.crs} to EPSG:4326 (WGS84)...")
        gdf = gdf.to_crs('EPSG:4326')
        print("✓ CRS conversion complete")
    
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
    
    # Find slope_deg column (could be 'slope_deg', 'slope-deg', 'Slope_deg', etc.)
    slope_col = None
    for col in gdf.columns:
        if col.lower().replace('-', '_') in ['slope_deg', 'slopedeg', 'slope']:
            slope_col = col
            break
    
    if slope_col is None:
        print("Warning: No slope_deg column found. Using None for slope_deg.")
        slope_col = 'slope_deg'
        gdf[slope_col] = None
    else:
        print(f"Found slope column: {slope_col}")
    
    # Find aspect_deg column (could be 'aspect_deg', 'aspect-deg', 'Aspect_deg', etc.)
    aspect_col = None
    for col in gdf.columns:
        if col.lower().replace('-', '_') in ['aspect_deg', 'aspectdeg', 'aspect']:
            aspect_col = col
            break
    
    if aspect_col is None:
        print("Warning: No aspect_deg column found. Using None for aspect_deg.")
        aspect_col = 'aspect_deg'
        gdf[aspect_col] = None
    else:
        print(f"Found aspect column: {aspect_col}")
    
    # Sort by sgi_id to ensure consistent ID assignment
    gdf = gdf.sort_values(by=sgi_id_col).reset_index(drop=True)
    
    # Create mapbox-id for each feature (sequential integers starting from 1 for Mapbox performance)
    # Integers are more efficient for Mapbox's setFeatureState and feature queries
    gdf['mapbox-id'] = range(1, len(gdf) + 1)
    
    # Extract bounds (extents) for each glacier
    print("Extracting bounds for each glacier...")
    bounds_list = []
    for idx, row in gdf.iterrows():
        bounds = row.geometry.bounds  # Returns (minx, miny, maxx, maxy)
        bounds_list.append({
            'min_lng': bounds[0],  # minx (longitude)
            'min_lat': bounds[1],  # miny (latitude)
            'max_lng': bounds[2],  # maxx (longitude)
            'max_lat': bounds[3]   # maxy (latitude)
        })
    
    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Create mapping DataFrame with mapbox-id, sgi_id, name, bounds, slope_deg, and aspect_deg
    mapping_df = pd.DataFrame({
        'mapbox-id': gdf['mapbox-id'],
        'sgi_id': gdf[sgi_id_col],
        'name': gdf[name_col],
        'min_lng': [b['min_lng'] for b in bounds_list],
        'min_lat': [b['min_lat'] for b in bounds_list],
        'max_lng': [b['max_lng'] for b in bounds_list],
        'max_lat': [b['max_lat'] for b in bounds_list],
        'slope_deg': gdf[slope_col],
        'aspect_deg': gdf[aspect_col]
    })
    
    # Save mapping to CSV
    mapping_df.to_csv(output_path, index=False)
    print(f"✓ Saved mapping to: {output_path}")
    print(f"  Mapped {len(mapping_df)} features")


def main():
    # Use script's directory as base for relative paths
    script_dir = Path(__file__).parent
    data_dir = script_dir / ".." / "data"
    data_dir = data_dir.resolve()  # Resolve to absolute path

    input_path = data_dir / "raw" / "sgi2016" / "SGI_2016_glaciers.shp"
    output_path = data_dir / "processed" / "mapping.csv"

    create_mapping_csv(
        input_path=input_path,
        output_path=output_path,
    )


if __name__ == '__main__':
    main()
