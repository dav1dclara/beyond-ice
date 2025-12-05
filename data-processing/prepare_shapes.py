from pathlib import Path
import geopandas as gpd
import pandas as pd


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
    
    # Iterate through each folder
    for folder in sorted(folders):
        # Extract scenario from folder name
        scenario = folder.name
        
        # Get all .shp files in this folder
        shp_files = sorted(folder.glob("*.shp"))
        
        # Create output directory for this scenario
        output_dir = data_dir / "processed" / "future_extents" / scenario
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # For each shapefile, process and save
        for shp_file in shp_files:
            try:
                gdf = gpd.read_file(shp_file)
                num_features = len(gdf)
                print(f"  {shp_file.name}: {num_features} feature(s)")
                
                # Rename columns that start with "Volume (km" to "Volume (km3)"
                rename_dict = {}
                for col in gdf.columns:
                    if col.startswith("Volume (km"):
                        rename_dict[col] = "Volume (km3)"
                
                if rename_dict:
                    gdf = gdf.rename(columns=rename_dict)
                
                # Assert that Volume and Area values are not below 0
                if "Volume (km3)" in gdf.columns:
                    assert (gdf["Volume (km3)"] >= 0).all(), f"Error in {shp_file.name}: Found negative Volume values"
                
                # Find the Area column (could be "Area", "Area (km2)", etc.)
                area_col = None
                for col in gdf.columns:
                    if "Area" in col or "area" in col.lower():
                        area_col = col
                        break
                
                if area_col:
                    assert (gdf[area_col] >= 0).all(), f"Error in {shp_file.name}: Found negative Area values"
                
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
                
                # Transform CRS to WGS84 (EPSG:4326) for web mapping
                target_crs = 'EPSG:4326'
                if gdf.crs is None:
                    gdf.set_crs(target_crs, inplace=True)
                elif str(gdf.crs) != target_crs:
                    gdf = gdf.to_crs(target_crs)
                
                # Save to GeoJSON
                output_filename = shp_file.stem + ".geojson"
                output_path = output_dir / output_filename
                gdf.to_file(output_path, driver='GeoJSON')
                
                # Collect columns after processing for assertion
                all_columns.append(list(gdf.columns))
                
            except Exception as e:
                print(f"  {shp_file.name}: Error - {e}")
                import traceback
                traceback.print_exc()
    
    # Assert that all files have the same column names
    if all_columns:
        first_columns = all_columns[0]
        for i, columns in enumerate(all_columns[1:], start=1):
            assert columns == first_columns, f"Column mismatch: File {i} has columns {columns}, but expected {first_columns}"


if __name__ == '__main__':
    main()
