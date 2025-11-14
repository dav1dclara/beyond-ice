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
    data_dir = Path("../data")    
    input_dir = data_dir / "raw" / "future_extents" / "glacier_extents-ssp245"
    print(f"Input directory: {input_dir}")

    # Extract scenario from path (e.g., "glacier_extents-ssp245" -> "ssp245")
    scenario = input_dir.name.split('-', 1)[1] if '-' in input_dir.name else None
    print(f"Scenario: {scenario}")

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
    
    # Track conversion statistics
    total_files_processed = 0
    total_files_successful = 0
    total_files_failed = 0
    unique_errors = {}  # Track unique error messages and their counts
    
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
            total_files_processed += 1
            gdf = polygonize_raster_extent(tif_file)
            if len(gdf) > 0:
                gdf_list.append(gdf)
                total_files_successful += 1
            else:
                # File processed but produced no features
                error_msg = "No valid data found"
                failed_files.append((tif_file.name, error_msg))
                total_files_failed += 1
                unique_errors[error_msg] = unique_errors.get(error_msg, 0) + 1
        
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
    
        # Save to GeoJSON with the same name as the prefix
        combined_gdf.to_file(output_path, driver='GeoJSON')
        print(f"  -> Successfully saved to {output_path}")
    
    # Print summary at the end
    print("\n" + "=" * 100)
    print("CONVERSION SUMMARY")
    print("=" * 100)
    print(f"Total files processed: {total_files_processed}")
    print(f"Successfully converted: {total_files_successful}")
    print(f"Failed: {total_files_failed}")
    
    # Print unique errors if any
    if unique_errors:
        print(f"\nUnique errors encountered ({len(unique_errors)}):")
        for error_msg, count in sorted(unique_errors.items(), key=lambda x: x[1], reverse=True):
            print(f"  [{count}x] {error_msg}")
    
    print("=" * 100)


if __name__ == '__main__':
    main()
