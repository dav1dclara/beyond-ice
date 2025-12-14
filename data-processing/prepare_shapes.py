from pathlib import Path
import geopandas as gpd
import pandas as pd
from tqdm import tqdm
import subprocess
import sys


def create_tileset_for_scenario(geojson_dir, scenario_name, data_dir):
    """Create a Mapbox tileset from GeoJSON files using tippecanoe."""
    # Check if tippecanoe is installed
    try:
        subprocess.run(["tippecanoe", "--version"], 
                      capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print(f"  Warning: tippecanoe is not installed, skipping tileset creation")
        print(f"  Install it with: brew install tippecanoe (on macOS)")
        return False
    
    # Find all GeoJSON files in the output directory
    geojson_files = sorted(geojson_dir.glob("*.geojson"))
    
    if not geojson_files:
        print(f"  Warning: No GeoJSON files found in {geojson_dir}")
        return False
    
    # Create tileset output directory
    tileset_output_dir = data_dir / "processed" / "tilesets"
    tileset_output_dir.mkdir(parents=True, exist_ok=True)
    
    # Create output file for this scenario
    output_file = tileset_output_dir / f"{scenario_name.lower()}.mbtiles"
    
    print(f"\n  Creating tileset: {output_file}")
    print(f"    Using {len(geojson_files)} GeoJSON files")
    
    # Build tippecanoe command
    # Use -L option to specify layer name for each file: -L layer_name:file.geojson
    # The layer name is the year (filename without extension)
    cmd = [
        "tippecanoe",
        f"--output={output_file}",
        f"--name={scenario_name} Tileset (All Years)",
        f"--description={scenario_name} glacier data with separate layer for each year",
        "--minimum-zoom=0",
        "--maximum-zoom=14",
        # "--base-zoom=8",  # Optimize detail for zoom 8 (higher = more detail preserved)
        # "--simplification=4",  # Balance between detail and tile size (lower = more detail, but larger tiles)
        # "--drop-densest-as-needed",  # Drop features when needed to stay within tile size limits
        "--use-attribute-for-id=mapbox-id",  # Use 'mapbox-id' property as the feature ID
        "-aI",  # Convert string IDs to numbers if possible
        "--force"
    ]
    
    # Add -L layer_name:file.geojson for each file
    for geojson_file in geojson_files:
        # Extract year from filename (e.g., "2020.geojson" -> "2020")
        layer_name = geojson_file.stem
        cmd.extend(["-L", f"{layer_name}:{geojson_file}"])
    
    try:
        subprocess.run(cmd, check=True)
        print(f"  ✓ Tileset created: {output_file}")
        print(f"    Contains {len(geojson_files)} layers (one per year)")
        return True
    except subprocess.CalledProcessError as e:
        print(f"  ✗ Error running tippecanoe: {e}")
        return False


def main():
    # Use script's directory as base for relative paths
    script_dir = Path(__file__).parent
    data_dir = script_dir / ".." / "data"
    data_dir = data_dir.resolve()  # Resolve to absolute path
    
    # Load the mapping file to get mapbox-id and name for each sgi_id
    mapping_path = data_dir / "processed" / "mapping.csv"
    if mapping_path.exists():
        mapping_df = pd.read_csv(mapping_path)
        # Convert sgi_id to string for consistent lookup (handles any type mismatches)
        mapping_df['sgi_id'] = mapping_df['sgi_id'].astype(str)
        # Create a dictionary for quick lookup: sgi_id -> (mapbox-id, name)
        mapping_dict = dict(zip(mapping_df['sgi_id'], zip(mapping_df['mapbox-id'], mapping_df['name'])))
    else:
        print(f"Error: Mapping file not found at {mapping_path}")
        mapping_dict = {}
    
    # Path to the vector directory
    vector_dir = data_dir / "raw" / "future_extents" / "vector"
    
    if not vector_dir.exists():
        print(f"Error: Directory not found: {vector_dir}")
        return
    
    # Get all subdirectories in the vector directory
    folders = [d for d in vector_dir.iterdir() if d.is_dir()]
    
    if not folders:
        print(f"Warning: No folders found in {vector_dir}")
        return
    
    # Collect all column names from all shapefiles
    all_columns = []
    first_file_processed = False
    
    # Iterate through each folder
    for folder in sorted(folders):
        # Extract scenario from folder name
        scenario = folder.name
        
        # Get all .shp files in this folder
        shp_files = sorted(folder.glob("*.shp"))
        
        # Create output directory for this scenario
        output_dir = data_dir / "processed" / "future_extents" / scenario
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Track summary statistics for this folder
        folder_total_volumes = 0
        folder_valid_volumes = 0
        folder_total_areas = 0
        folder_matched_areas = 0
        
        # Dictionary to store 2020 baseline data: {sgi_id: {'area': value, 'volume': value}}
        baseline_2020 = {}
        
        # Helper function to extract year from filename
        def extract_year(filename):
            stem = Path(filename).stem
            # Try different patterns: "2010", "gl2010", or find 4-digit year
            if stem.isdigit():
                return int(stem) if len(stem) == 4 else None
            elif stem.startswith("gl") and len(stem) >= 6:
                year_str = stem[2:6]
                return int(year_str) if year_str.isdigit() else None
            else:
                import re
                year_match = re.search(r'\d{4}', stem)
                return int(year_match.group()) if year_match else None
        
        # First pass: collect 2020 baseline data
        for shp_file in shp_files:
            year = extract_year(shp_file.name)
            if year == 2020:
                try:
                    gdf_2020 = gpd.read_file(shp_file)
                    
                    # Rename volume columns to match processing (same as in main loop)
                    rename_dict = {}
                    for col in gdf_2020.columns:
                        if col.startswith("Volume (km"):
                            rename_dict[col] = "Volume (km3)"
                    if rename_dict:
                        gdf_2020 = gdf_2020.rename(columns=rename_dict)
                    
                    # Set negative volume values to None (same as in main processing)
                    if "Volume (km3)" in gdf_2020.columns:
                        gdf_2020.loc[gdf_2020["Volume (km3)"] < 0, "Volume (km3)"] = None
                    
                    # Find SGI-ID column
                    sgi_id_col = None
                    if "SGI-ID" in gdf_2020.columns:
                        sgi_id_col = "SGI-ID"
                    elif "Glacier_ID" in gdf_2020.columns:
                        sgi_id_col = "Glacier_ID"
                    
                    if sgi_id_col:
                        # Find area and volume columns
                        area_col = None
                        for col in gdf_2020.columns:
                            if "Area" in col or "area" in col.lower():
                                area_col = col
                                break
                        
                        volume_col = None
                        if "Volume (km3)" in gdf_2020.columns:
                            volume_col = "Volume (km3)"
                        
                        # Calculate Mean Thickness for 2020 baseline (same as in main processing)
                        if volume_col and area_col:
                            gdf_2020["Mean Thickness (m)"] = (gdf_2020[volume_col] / gdf_2020[area_col]) * 1000
                        
                        # Store baseline values
                        for idx, row in gdf_2020.iterrows():
                            sgi_id = str(row[sgi_id_col]) if pd.notna(row[sgi_id_col]) else None
                            if sgi_id:
                                # Calculate thickness if available
                                thickness = None
                                if "Mean Thickness (m)" in gdf_2020.columns and pd.notna(row["Mean Thickness (m)"]):
                                    thickness = row["Mean Thickness (m)"]
                                
                                baseline_2020[sgi_id] = {
                                    'area': row[area_col] if area_col and pd.notna(row[area_col]) else None,
                                    'volume': row[volume_col] if volume_col and pd.notna(row[volume_col]) else None,
                                    'thickness': thickness
                                }
                except Exception as e:
                    print(f"    Warning: Could not read 2020 baseline file {shp_file.name}: {e}")
        
        # Debug: print baseline collection summary
        if baseline_2020:
            print(f"    Collected {len(baseline_2020)} baseline values from 2020 files")
        else:
            print(f"    Warning: No 2020 baseline data collected for scenario {scenario}")
        
        # For each shapefile, process and save
        pbar = tqdm(shp_files, desc=f"Processing {scenario}", unit="file")
        for shp_file in pbar:
            try:
                # Extract year and skip if before 2020
                year = extract_year(shp_file.name)
                if year is None or year < 2020:
                    continue
                
                gdf = gpd.read_file(shp_file)
                num_features = len(gdf)
                # Update progress bar description with current file info
                pbar.set_description(f"Processing {scenario} - {shp_file.name} ({num_features} features)")

                # Rename columns that start with "Volume (km" to "Volume (km3)"
                rename_dict = {}
                for col in gdf.columns:
                    if col.startswith("Volume (km"):
                        rename_dict[col] = "Volume (km3)"
                
                if rename_dict:
                    gdf = gdf.rename(columns=rename_dict)
                
                # Check Volume: count and percentage of shapes with valid and non-negative volume
                # Set negative volume values to None (invalid data - better than 0 for web map filtering)
                if "Volume (km3)" in gdf.columns:
                    # Replace negative values with None
                    gdf.loc[gdf["Volume (km3)"] < 0, "Volume (km3)"] = None
                    
                    total = len(gdf)
                    valid_non_negative = gdf["Volume (km3)"].notna().sum()
                    percentage = (valid_non_negative / total * 100) if total > 0 else 0
                    all_valid = (valid_non_negative == total)
                    checkmark = "✓" if all_valid else "✗"
                    # print(f"    Volume: {checkmark} {valid_non_negative}/{total} ({percentage:.1f}%) valid and non-negative")
                    # Accumulate for folder summary
                    folder_total_volumes += total
                    folder_valid_volumes += valid_non_negative
                
                # Find the Area column (could be "Area", "Area (km2)", etc.)
                area_col = None
                for col in gdf.columns:
                    if "Area" in col or "area" in col.lower():
                        area_col = col
                        break
                
                if area_col:
                    # Check Area: count and percentage of shapes with valid and non-negative area
                    total = len(gdf)
                    valid_non_negative = ((gdf[area_col].notna()) & (gdf[area_col] >= 0)).sum()
                    percentage = (valid_non_negative / total * 100) if total > 0 else 0
                    all_valid = (valid_non_negative == total)
                    checkmark = "✓" if all_valid else "✗"
                    # print(f"    Area: {checkmark} {valid_non_negative}/{total} ({percentage:.1f}%) valid and non-negative")
                
                # Calculate area from geometry for comparison (temporary, not saved)
                # Reproject to EPSG:2056 (Swiss CH1903+ / LV95) for accurate area calculation
                if area_col:
                    if gdf.crs is None:
                        # If no CRS, assume it's already in a suitable CRS or set one
                        gdf_for_area = gdf.copy()
                    elif str(gdf.crs) != 'EPSG:2056':
                        gdf_for_area = gdf.to_crs('EPSG:2056')
                    else:
                        gdf_for_area = gdf.copy()
                    
                    # Calculate area in square meters, then convert to square kilometers
                    area_m2 = gdf_for_area.geometry.area
                    computed_areas = area_m2 / 1_000_000
                    
                    # Count mismatched areas (using 1% relative tolerance)
                    given_areas = gdf[area_col]
                    # Calculate relative difference (percentage)
                    relative_diff = abs((computed_areas - given_areas) / given_areas) * 100
                    # Consider mismatched if relative difference > 1%
                    mismatched = (relative_diff > 1.0).sum()
                    total = len(gdf)
                    matched = total - mismatched
                    # print(f"    Area comparison: {matched}/{total} matched, {mismatched} mismatched (>1% difference)")
                    # Accumulate for folder summary
                    folder_total_areas += total
                    folder_matched_areas += matched
                
                # Calculate Mean Thickness (m) = (Volume / Area) * 1000
                if "Volume (km3)" in gdf.columns and area_col:
                    # Calculate Mean Thickness: (Volume / Area) * 1000
                    # Volume is in km3, Area is in km2, so Volume/Area gives km
                    # Multiply by 1000 to convert km to m
                    gdf["Mean Thickness (m)"] = (gdf["Volume (km3)"] / gdf[area_col]) * 1000
                
                # Find the Glacier_ID column for mapping
                glacier_id_col = None
                if "Glacier_ID" in gdf.columns:
                    glacier_id_col = "Glacier_ID"
                else:
                    # Case-insensitive search
                    for col in gdf.columns:
                        if col.lower() == "glacier_id":
                            glacier_id_col = col
                            break
                
                # Assign mapbox-id and name from mapping file based on Glacier_ID
                if mapping_dict and glacier_id_col:
                    def get_mapping_info(glacier_id):
                        # Convert to string for lookup (handles any type mismatches)
                        glacier_id_str = str(glacier_id) if glacier_id is not None else None
                        if glacier_id_str and glacier_id_str in mapping_dict:
                            mapbox_id, name = mapping_dict[glacier_id_str]
                            return mapbox_id, name
                        return None, None
                    
                    # Apply mapping to get mapbox-id and name
                    mapping_results = gdf[glacier_id_col].apply(get_mapping_info)
                    gdf['mapbox-id'] = [result[0] for result in mapping_results]
                    gdf['name'] = [result[1] for result in mapping_results]
                else:
                    # If no mapping file or Glacier_ID column, set to None
                    gdf['mapbox-id'] = None
                    gdf['name'] = None
                
                # Rename Glacier_ID to SGI-ID
                if glacier_id_col and glacier_id_col != "SGI-ID":
                    gdf = gdf.rename(columns={glacier_id_col: "SGI-ID"})
                
                # Calculate change in area, volume, and thickness compared to 2020
                if "SGI-ID" in gdf.columns:
                    area_change = []
                    volume_change = []
                    thickness_change = []
                    
                    for idx, row in gdf.iterrows():
                        sgi_id = str(row["SGI-ID"]) if pd.notna(row["SGI-ID"]) else None
                        
                        # For 2020, change is 0% (baseline year)
                        if year == 2020:
                            area_change.append(0)
                            volume_change.append(0)
                            thickness_change.append(0)
                        elif sgi_id and sgi_id in baseline_2020:
                            baseline = baseline_2020[sgi_id]
                            
                            # Calculate area change as percentage (rounded to int)
                            if area_col and area_col in gdf.columns:
                                current_area = row[area_col] if pd.notna(row[area_col]) else None
                            else:
                                current_area = None
                            baseline_area = baseline['area']
                            if current_area is not None and baseline_area is not None and baseline_area != 0:
                                # Percentage change: ((current - baseline) / baseline) * 100, rounded to int
                                area_change.append(round(((current_area - baseline_area) / baseline_area) * 100))
                            else:
                                area_change.append(None)
                            
                            # Calculate volume change as percentage (rounded to int)
                            current_volume = row["Volume (km3)"] if "Volume (km3)" in gdf.columns and pd.notna(row["Volume (km3)"]) else None
                            baseline_volume = baseline['volume']
                            if current_volume is not None and baseline_volume is not None and baseline_volume != 0:
                                # Percentage change: ((current - baseline) / baseline) * 100, rounded to int
                                volume_change.append(round(((current_volume - baseline_volume) / baseline_volume) * 100))
                            else:
                                volume_change.append(None)
                            
                            # Calculate thickness change as percentage (rounded to int)
                            current_thickness = row["Mean Thickness (m)"] if "Mean Thickness (m)" in gdf.columns and pd.notna(row["Mean Thickness (m)"]) else None
                            baseline_thickness = baseline['thickness']
                            if current_thickness is not None and baseline_thickness is not None and baseline_thickness != 0:
                                # Percentage change: ((current - baseline) / baseline) * 100, rounded to int
                                thickness_change.append(round(((current_thickness - baseline_thickness) / baseline_thickness) * 100))
                            else:
                                thickness_change.append(None)
                        else:
                            area_change.append(None)
                            volume_change.append(None)
                            thickness_change.append(None)
                    
                    gdf['Area change (%)'] = area_change
                    gdf['Volume change (%)'] = volume_change
                    gdf['Thickness change (%)'] = thickness_change
                else:
                    gdf['Area change (km2)'] = None
                    gdf['Volume change (km3)'] = None
                
                # Transform CRS to WGS84 (EPSG:4326) for web mapping
                target_crs = 'EPSG:4326'
                if gdf.crs is None:
                    gdf.set_crs(target_crs, inplace=True)
                elif str(gdf.crs) != target_crs:
                    gdf = gdf.to_crs(target_crs)
                
                # Save to GeoJSON
                output_filename = str(year) + ".geojson"
                output_path = output_dir / output_filename
                gdf.to_file(output_path, driver='GeoJSON')
                
                # Collect columns after processing for assertion
                all_columns.append(list(gdf.columns))
                
            except Exception as e:
                print(f"  {shp_file.name}: Error - {e}")
                import traceback
                traceback.print_exc()
        
        # Print folder summary
        print(f"\n  Summary for scenario '{scenario}':")
        if folder_total_volumes > 0:
            print(f"    Valid volumes: {folder_valid_volumes}/{folder_total_volumes} ({folder_valid_volumes/folder_total_volumes*100:.1f}%)")
        if folder_total_areas > 0:
            print(f"    Matched areas: {folder_matched_areas}/{folder_total_areas} ({folder_matched_areas/folder_total_areas*100:.1f}%)")
        
        # Create tileset from the GeoJSON files
        create_tileset_for_scenario(output_dir, scenario, data_dir)
        
        print()
    
    # Assert that all files have the same column names
    if all_columns:
        first_columns = all_columns[0]
        for i, columns in enumerate(all_columns[1:], start=1):
            assert columns == first_columns, f"Column mismatch: File {i} has columns {columns}, but expected {first_columns}"


if __name__ == '__main__':
    main()
