from pathlib import Path
import numpy as np
import rasterio as rio
from rasterio.features import shapes
from rasterio.warp import transform_geom
from rasterio.crs import CRS
import geopandas as gpd
import pandas as pd
from shapely.geometry import shape, box
from shapely.ops import unary_union
from tqdm import tqdm
import warnings


def polygonize_raster_extent(raster_path, target_crs='EPSG:4326'):
    """
    Create a multipolygon delineating the raster extent of valid (non-zero, non-NaN) data.
    
    Args:
        raster_path: Path to raster file
        target_crs: Target CRS (default: EPSG:4326 for WGS84)
    
    Returns:
        GeoDataFrame with a single multipolygon feature representing valid data extent
    """
    with rio.open(raster_path) as src:
        crs = src.crs
        transform = src.transform
        nodata = src.nodata
        raster_data = src.read(1)

        # Set CRS to EPSG:2056 if None
        if crs is None:
            crs = CRS.from_epsg(2056)

        # Create mask for valid data using the raster's nodata value
        if nodata is not None:
            # Use the nodata value from the raster metadata
            if np.isnan(nodata):
                valid_mask = ~np.isnan(raster_data)
            else:
                valid_mask = (raster_data != nodata) & ~np.isnan(raster_data)
        else:
            # If no nodata is specified, treat NaN and potentially 0 as nodata
            valid_mask = ~np.isnan(raster_data) & (raster_data != 0)
        
        if not np.any(valid_mask):
            # No valid data found
            return gpd.GeoDataFrame(columns=['sgi-id'], geometry=[], crs=target_crs)
        
        # Create a binary raster where 1 = valid data, 0 = no data
        # This will be used to polygonize the actual boundary of valid data
        binary_raster = valid_mask.astype(np.uint8)
        
        # Polygonize the valid data to get the actual boundary shape
        # This creates polygons that follow the exact outline of valid data
        shapes_generator = shapes(binary_raster, transform=transform, mask=None)
        
        polygons = []
        for geom, value in shapes_generator:
            # Only keep polygons with value = 1 (valid data)
            if value == 1:
                # Transform geometry to target CRS if needed
                if crs and str(crs) != target_crs:
                    geom = transform_geom(crs, target_crs, geom)
                polygons.append(shape(geom))
        
        if not polygons:
            return gpd.GeoDataFrame(columns=['sgi-id'], geometry=[], crs=target_crs)
        
        # Combine all polygons into a single multipolygon (in case there are multiple separate areas)
        boundary_polygon = unary_union(polygons)
    
    # Extract sgi-id from filename (e.g., "gl2010_A55b-27.tif" -> "A55b-27")
    filename_stem = Path(raster_path).stem  # Gets "gl2010_A55b-27"
    sgi_id = filename_stem.split('_', 1)[1] if '_' in filename_stem else None
    
    # Create GeoDataFrame with single polygon feature representing the actual boundary
    gdf = gpd.GeoDataFrame(
        [{'sgi-id': sgi_id}],
        geometry=[boundary_polygon],
        crs=target_crs
    )
    
    return gdf


def main():
    # TODO: simplify/smooth the polygons
    # Use script's directory as base for relative paths
    script_dir = Path(__file__).parent
    data_dir = script_dir / ".." / "data"
    data_dir = data_dir.resolve()  # Resolve to absolute path
    
    # Load the mapping file to get mapbox-id and name for each sgi_id
    mapping_path = data_dir / "processed" / "mapping.csv"
    if mapping_path.exists():
        print(f"Loading mapping file: {mapping_path}")
        mapping_df = pd.read_csv(mapping_path)
        # Convert sgi_id to string for consistent lookup (handles any type mismatches)
        mapping_df['sgi_id'] = mapping_df['sgi_id'].astype(str)
        # Create a dictionary for quick lookup: sgi_id -> (mapbox-id, name)
        mapping_dict = dict(zip(mapping_df['sgi_id'], zip(mapping_df['mapbox-id'], mapping_df['name'])))
        print(f"  Loaded {len(mapping_dict)} mappings")
    else:
        print(f"Warning: Mapping file not found at {mapping_path}. Proceeding without mapbox-id and name assignment.")
        mapping_dict = {}
    
    # Process all scenarios
    future_extents_dir = data_dir / "raw" / "future_extents"
    
    if not future_extents_dir.exists():
        print(f"Error: Input directory not found: {future_extents_dir}")
        return
    
    # Get all scenario directories
    scenario_dirs = [d for d in future_extents_dir.iterdir() if d.is_dir()]
    
    if not scenario_dirs:
        print(f"Warning: No scenario directories found in {future_extents_dir}")
        return
    
    print(f"Found {len(scenario_dirs)} scenario(s) to process: {[d.name for d in scenario_dirs]}")
    print("=" * 100)
    
    # Process each scenario
    for scenario_dir in sorted(scenario_dirs):
        scenario = scenario_dir.name
        print(f"\n{'=' * 100}")
        print(f"Processing scenario: {scenario}")
        print(f"{'=' * 100}")
        
        input_dir = scenario_dir
        print(f"Input directory: {input_dir}")

        output_dir = data_dir / "processed" / "future_extents" / scenario
        output_dir.mkdir(parents=True, exist_ok=True)
        print(f"Output directory: {output_dir}")

        # Group files by prefix
        files_by_prefix = {}
        
        # Get all .tif files in the directory
        for tif_file in input_dir.glob("*.tif"):
            # Extract prefix (part before first underscore)
            prefix = tif_file.stem.split('_')[0]
            
            # Add to dictionary
            if prefix not in files_by_prefix:
                files_by_prefix[prefix] = []
            files_by_prefix[prefix].append(tif_file)
        
        # Print the total number of unique prefixes
        print(f"\nTotal number of unique prefixes: {len(files_by_prefix)}")
        
        # Track conversion statistics for this scenario
        scenario_files_processed = 0
        scenario_files_successful = 0
        scenario_files_failed = 0
        scenario_unique_errors = {}  # Track unique error messages and their counts
        
        # Iterate through all prefixes and print them
        for prefix in sorted(files_by_prefix.keys()):
            if prefix == "bedrock":
                continue
        
            # Remove "gl" from prefix to get year (e.g., "gl2010" -> "2010")
            year = prefix.replace("gl", "")

            # # Use this to skip years other than 2016
            # if year != "2016":
            #     continue

            # # Determine output path
            output_path = output_dir / f"{year}.geojson"
            if output_path.exists():
                print(f"✓ {output_path} already exists, skipping")
                continue

            # Polygonize all files in the prefix and combine into one GeoDataFrame
            gdf_list = []
            failed_files = []
            
            # Sort files by name
            sorted_files = sorted(files_by_prefix[prefix], key=lambda x: x.name)
            
            # Process all files with progress bar
            for tif_file in tqdm(sorted_files, desc=f"Polygonizing files for year {year}"):
                scenario_files_processed += 1
                gdf = polygonize_raster_extent(tif_file)
                if len(gdf) > 0:
                    gdf_list.append(gdf)
                    scenario_files_successful += 1
                else:
                    # File processed but produced no features
                    error_msg = "No valid data found"
                    failed_files.append((tif_file.name, error_msg))
                    scenario_files_failed += 1
                    scenario_unique_errors[error_msg] = scenario_unique_errors.get(error_msg, 0) + 1
            
            # Check if we have any successful conversions
            if not gdf_list:
                warnings.warn(f"No files were successfully converted for prefix {prefix}. Skipping.", UserWarning)
                continue

            # Combine all GeoDataFrames into one
            combined_gdf = gpd.GeoDataFrame(pd.concat(gdf_list, ignore_index=True), crs=gdf_list[0].crs)

            # Check that the number of features matches the number of files in the prefix
            if len(combined_gdf) != len(files_by_prefix[prefix]):
                print(
                    f"  -> [WARNING] Expected {len(files_by_prefix[prefix])} features (from {len(files_by_prefix[prefix])} files) "
                    f"but got {len(combined_gdf)}. {len(failed_files)} file(s) failed."
                )
            
            # Assign mapbox-id and name from mapping file based on sgi-id
            if mapping_dict:
                def get_mapping_info(sgi_id):
                    # Convert to string for lookup (handles any type mismatches)
                    sgi_id_str = str(sgi_id) if sgi_id is not None else None
                    if sgi_id_str and sgi_id_str in mapping_dict:
                        mapbox_id, name = mapping_dict[sgi_id_str]
                        return mapbox_id, name
                    return None, None
                
                # Apply mapping to get mapbox-id and name
                mapping_results = combined_gdf['sgi-id'].apply(get_mapping_info)
                combined_gdf['mapbox-id'] = [result[0] for result in mapping_results]
                combined_gdf['name'] = [result[1] for result in mapping_results]
                
                # Count how many features got mapped and how many didn't
                mapped_count = combined_gdf['mapbox-id'].notna().sum()
                unmapped_count = combined_gdf['mapbox-id'].isna().sum()
                print(f"  -> Assigned mapbox-id and name to {mapped_count} out of {len(combined_gdf)} features")
                if unmapped_count > 0:
                    print(f"  -> [WARNING] {unmapped_count} shape(s) were not mapped correctly (sgi-id not found in mapping file)")
            else:
                # If no mapping file, set to None
                combined_gdf['mapbox-id'] = None
                combined_gdf['name'] = None
            
            # Calculate area for each feature in square kilometers
            # Reproject to EPSG:2056 (Swiss CH1903+ / LV95) for accurate area calculation
            if combined_gdf.crs and str(combined_gdf.crs) != 'EPSG:2056':
                gdf_for_area = combined_gdf.to_crs('EPSG:2056')
                # Calculate area in square meters, then convert to square kilometers
                area_m2 = gdf_for_area.geometry.area
                combined_gdf['area_km2'] = area_m2 / 1_000_000
            else:
                # Calculate area in square meters, then convert to square kilometers
                area_m2 = combined_gdf.geometry.area
                combined_gdf['area_km2'] = area_m2 / 1_000_000
        
            # Save to GeoJSON with the same name as the prefix
            combined_gdf.to_file(output_path, driver='GeoJSON')
            print(f"  -> Successfully saved to {output_path}")
        
        # Print scenario summary
        print(f"\n  Scenario '{scenario}' summary:")
        print(f"    Files processed: {scenario_files_processed}")
        print(f"    Successfully converted: {scenario_files_successful}")
        print(f"    Failed: {scenario_files_failed}")
        
        # Print unique errors for this scenario if any
        if scenario_unique_errors:
            print(f"    Unique errors encountered ({len(scenario_unique_errors)}):")
            for error_msg, count in sorted(scenario_unique_errors.items(), key=lambda x: x[1], reverse=True):
                print(f"      [{count}x] {error_msg}")
    
    # Print final summary
    print("\n" + "=" * 100)
    print("ALL SCENARIOS PROCESSED")
    print("=" * 100)


if __name__ == '__main__':
    main()
