"""
Create glacier_index.csv file from a shapefile.

This script processes a glacier shapefile and generates a glacier index CSV file that contains:
- mapbox-id: Sequential integer IDs (1-based) for efficient Mapbox feature queries
- sgi_id: Swiss Glacier Inventory identifier
- name: Glacier name
- bounds: Geographic bounding box (min_lng, min_lat, max_lng, max_lat)
- slope_deg: Glacier slope in degrees
- aspect_deg: Glacier aspect (direction) in degrees

The output is used by the Mapbox visualization to efficiently query and display glacier features.
"""

from pathlib import Path
import geopandas as gpd
import pandas as pd


def _extract_bounds(gdf):
    """
    Extract bounding boxes for all features in the GeoDataFrame.

    Args:
        gdf: GeoDataFrame with geometry column

    Returns:
        List of dictionaries with min_lng, min_lat, max_lng, max_lat keys
    """
    bounds_list = []
    for _, row in gdf.iterrows():
        # geometry.bounds returns (minx, miny, maxx, maxy)
        minx, miny, maxx, maxy = row.geometry.bounds
        bounds_list.append(
            {
                "min_lng": minx,  # minimum longitude (west)
                "min_lat": miny,  # minimum latitude (south)
                "max_lng": maxx,  # maximum longitude (east)
                "max_lat": maxy,  # maximum latitude (north)
            }
        )
    return bounds_list


def create_glacier_index(input_path, output_path):
    """
    Create glacier_index.csv file from a shapefile.

    Processes a glacier shapefile and generates a CSV glacier index file with:
    - Sequential mapbox-ids for efficient feature queries
    - Original sgi_id identifiers
    - Glacier names and geographic bounds
    - Slope and aspect data (if available)

    Args:
        input_path: Path to input shapefile (.shp)
        output_path: Path to output glacier_index.csv file
    """
    input_path = Path(input_path)
    output_path = Path(output_path)

    # Validate input file exists
    if not input_path.exists():
        print(f"Error: Input file not found: '{input_path}'")
        return

    print(f"Reading shapefile: '{input_path}'")

    # Read and load shapefile
    gdf = gpd.read_file(input_path)

    print(f"Features: {len(gdf)}")
    print(f"Original CRS: {gdf.crs}")

    print("-" * 50)

    # Normalize coordinate system to WGS84 (required by Mapbox)
    if gdf.crs is None:
        print("Warning: No CRS defined, assuming WGS84")
        gdf.set_crs("EPSG:4326", inplace=True)
    elif gdf.crs.to_string() != "EPSG:4326":
        print(f"Converting from {gdf.crs} to EPSG:4326 (WGS84)...")
        gdf = gdf.to_crs("EPSG:4326")
        print("✓ CRS conversion complete")

    print("-" * 50)

    # Sort by sgi_id to ensure consistent mapbox-id assignment across runs
    gdf = gdf.sort_values(by="sgi-id").reset_index(drop=True)

    # Assign sequential integer IDs starting from 1
    # Integers are more efficient for Mapbox's feature queries than string-based IDs
    print("Assigning sequential integer IDs...")
    gdf["mapbox-id"] = range(1, len(gdf) + 1)
    print("✓ Sequential integer IDs assignment complete")

    print("-" * 50)

    # Extract bounds for each glacier
    print("Extracting bounds for each glacier...")
    bounds_list = _extract_bounds(gdf)
    print("✓ Bounds extraction complete")

    print("-" * 50)

    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Create glacier index DataFrame with all required columns
    glacier_index_df = pd.DataFrame(
        {
            "mapbox-id": gdf["mapbox-id"],
            "sgi_id": gdf["sgi-id"],
            "name": gdf["name"],
            "min_lng": [b["min_lng"] for b in bounds_list],
            "min_lat": [b["min_lat"] for b in bounds_list],
            "max_lng": [b["max_lng"] for b in bounds_list],
            "max_lat": [b["max_lat"] for b in bounds_list],
            "slope_deg": gdf["slope_deg"],
            "aspect_deg": gdf["aspect_deg"],
        }
    )

    # Save to CSV
    glacier_index_df.to_csv(output_path, index=False)
    print(f"✓ Saved glacier index to: {output_path}")
    print(f"Columns:")
    for col in glacier_index_df.columns:
        print(f"  {col}: {glacier_index_df[col].dtype}")


def main():
    """
    Main entry point for the script.

    Sets up input/output paths relative to the script location and runs
    the glacier index CSV generation.
    """
    # Use script's directory as base for relative paths
    script_dir = Path(__file__).parent
    data_dir = script_dir / ".." / "data"
    data_dir = data_dir.resolve()

    input_path = data_dir / "raw" / "sgi2016" / "SGI_2016_glaciers.shp"
    output_path = data_dir / "processed" / "glacier_index.csv"

    create_glacier_index(
        input_path=input_path,
        output_path=output_path,
    )


if __name__ == "__main__":
    main()
