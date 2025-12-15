#!/usr/bin/env python3
"""
Generate overall totals CSV files for each scenario.
This pre-aggregates the data so the chart can load instantly.
Reads from shapefiles in data/raw/future_extents/vector
"""

import pandas as pd
from pathlib import Path
import sys
import re

try:
    import geopandas as gpd
except ImportError:
    print("Error: geopandas is required. Install it with: pip install geopandas")
    sys.exit(1)

def extract_area_volume(row):
    """Extract area and volume from shapefile row."""
    area = None
    volume = None
    
    # Try exact column names first (most common patterns)
    exact_area_names = ['Area (km2)', 'Area (km²)', 'area (km2)', 'area (km²)']
    exact_volume_names = ['Volume (km3)', 'Volume (km³)', 'volume (km3)', 'volume (km³)']
    
    # Try exact matches first
    for col in row.index:
        if col in exact_area_names:
            try:
                val = row[col]
                if pd.notna(val):
                    area = float(val)
                    break
            except (ValueError, TypeError):
                continue
    
    # Try pattern matching for area (case-insensitive)
    if area is None:
        for col in row.index:
            col_lower = col.lower()
            if 'area' in col_lower and ('km2' in col_lower or 'km²' in col_lower):
                try:
                    val = row[col]
                    if pd.notna(val):
                        area = float(val)
                        break
                except (ValueError, TypeError):
                    continue
    
    # Try simpler area pattern
    if area is None:
        for col in row.index:
            col_lower = col.lower()
            if col_lower == 'area':
                try:
                    val = row[col]
                    if pd.notna(val):
                        area = float(val)
                        break
                except (ValueError, TypeError):
                    continue
    
    # Try exact matches for volume first
    for col in row.index:
        if col in exact_volume_names:
            try:
                val = row[col]
                if pd.notna(val):
                    volume = float(val)
                    break
            except (ValueError, TypeError):
                continue
    
    # Try pattern matching for volume (case-insensitive)
    if volume is None:
        for col in row.index:
            col_lower = col.lower()
            # Check for "Volume (km" pattern (handles truncated names)
            if 'volume' in col_lower and ('km3' in col_lower or 'km³' in col_lower or col_lower.startswith('volume (km')):
                try:
                    val = row[col]
                    if pd.notna(val):
                        volume = float(val)
                        break
                except (ValueError, TypeError):
                    continue
    
    # Try simpler volume pattern
    if volume is None:
        for col in row.index:
            col_lower = col.lower()
            if col_lower == 'volume':
                try:
                    val = row[col]
                    if pd.notna(val):
                        volume = float(val)
                        break
                except (ValueError, TypeError):
                    continue
    
    return area or 0, volume or 0

def extract_year(filename):
    """Extract year from filename."""
    stem = Path(filename).stem
    
    # Try different patterns: "2020", "gl2020", or find 4-digit year
    if stem.isdigit():
        return int(stem) if len(stem) == 4 else None
    elif stem.startswith("gl") and len(stem) >= 6:
        year_str = stem[2:6]
        return int(year_str) if year_str.isdigit() else None
    else:
        year_match = re.search(r'\d{4}', stem)
        return int(year_match.group()) if year_match else None

def process_scenario(scenario_folder, output_csv, print_columns=False):
    """Process a scenario folder and generate CSV."""
    scenario_name = scenario_folder.name
    print(f"Processing {scenario_name}...")
    
    # Get all shapefiles
    shp_files = sorted(scenario_folder.glob("*.shp"))
    
    if not shp_files:
        print(f"  No shapefiles found in {scenario_folder}")
        return
    
    results = []
    area_col_used = None
    volume_col_used = None
    
    for file_idx, shp_file in enumerate(shp_files):
        # Print columns from first file if requested
        if print_columns and file_idx == 0:
            try:
                gdf_sample = gpd.read_file(shp_file)
                print(f"\n  Available columns in {shp_file.name}:")
                for col in gdf_sample.columns:
                    if col != 'geometry':  # Skip geometry column
                        sample_val = gdf_sample[col].iloc[0] if len(gdf_sample) > 0 else None
                        print(f"    - {col}: {type(sample_val).__name__} (sample: {sample_val})")
                print()
            except Exception as e:
                print(f"  Error reading columns from {shp_file.name}: {e}")
        
        # Extract year from filename
        year = extract_year(shp_file)
        if year is None:
            print(f"  Warning: Could not extract year from {shp_file.name}, skipping")
            continue
        
        try:
            # Read shapefile
            gdf = gpd.read_file(shp_file)
            
            # Identify columns on first file
            if file_idx == 0:
                for col in gdf.columns:
                    if col != 'geometry':
                        col_lower = col.lower()
                        if area_col_used is None and 'area' in col_lower and ('km2' in col_lower or 'km²' in col_lower):
                            area_col_used = col
                        if volume_col_used is None and 'volume' in col_lower and ('km3' in col_lower or 'km³' in col_lower or col_lower.startswith('volume (km')):
                            volume_col_used = col
                if area_col_used and volume_col_used:
                    print(f"  Using columns: '{area_col_used}' for area, '{volume_col_used}' for volume")
            
            # Sum up all features
            total_area = 0
            total_volume = 0
            
            for row_idx, row in gdf.iterrows():
                area, volume = extract_area_volume(row)
                total_area += area
                total_volume += volume
            
            results.append({
                'year': year,
                'area': total_area,
                'volume': total_volume
            })
            
            print(f"  {year}: area={total_area:.2f} km², volume={total_volume:.2f} km³ ({len(gdf)} features)")
            
        except Exception as e:
            print(f"  Error processing {shp_file.name}: {e}")
            continue
    
    if not results:
        print(f"  No valid data found for {scenario_name}")
        return
    
    # Create DataFrame and sort by year
    df = pd.DataFrame(results)
    df = df.sort_values('year')
    
    # Save to CSV
    df.to_csv(output_csv, index=False)
    print(f"  ✓ Saved to {output_csv}")
    print(f"  Total years: {len(df)}")

def main():
    # Get script directory
    script_dir = Path(__file__).parent
    
    # Shapefiles are in data/raw/future_extents/vector
    vector_dir = script_dir / "data" / "raw" / "future_extents" / "vector"
    
    if not vector_dir.exists():
        print(f"Error: Vector directory not found: {vector_dir}")
        sys.exit(1)
    
    # Output directory (public/data - create new folder)
    output_dir = script_dir / "public" / "data"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Scenario folder mapping (shapefile folder name -> output filename)
    scenarios = {
        'SSP126': 'SSP126',  # Shapefile folder -> CSV filename prefix
        'SSP245': 'SSP245',
        'SSP370': 'SSP370',
        'SSP585': 'SSP585'
    }
    
    # Get all scenario folders in vector directory
    scenario_folders = [d for d in vector_dir.iterdir() if d.is_dir()]
    
    if not scenario_folders:
        print(f"Error: No scenario folders found in {vector_dir}")
        sys.exit(1)
    
    # Process each scenario
    for idx, scenario_folder in enumerate(sorted(scenario_folders)):
        folder_name = scenario_folder.name
        
        # Check if this is a known scenario
        if folder_name not in scenarios:
            print(f"Warning: Unknown scenario folder: {folder_name}, skipping")
            continue
        
        # Output CSV filename (e.g., public/data/SSP126_overall_totals.csv)
        output_csv = output_dir / f"{scenarios[folder_name]}_overall_totals.csv"
        
        # Print columns from first file of first scenario
        print_columns = (idx == 0)
        process_scenario(scenario_folder, output_csv, print_columns=print_columns)
    
    print("\n✓ All CSVs generated!")

if __name__ == '__main__':
    main()
