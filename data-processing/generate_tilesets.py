"""
Prepare glacier shapefiles for web visualization.

This script processes glacier shapefiles from different climate scenarios and:
- Converts them to GeoJSON format
- Adds mapbox-id and name mappings from glacier_index.csv
- Calculates area and volume changes compared to 2020 baseline
- Optimizes data types for efficient tile generation
- Creates Mapbox tilesets using tippecanoe
"""

from pathlib import Path
import subprocess
import geopandas as gpd
import pandas as pd
from tqdm import tqdm


def create_tileset_for_scenario(geojson_dir, scenario_name, data_dir):
    """
    Create a Mapbox tileset from GeoJSON files using tippecanoe.

    Processes all GeoJSON files in the specified directory and creates a single
    .mbtiles file with separate layers for each year. Each GeoJSON file becomes
    a layer named after its year (e.g., "2020.geojson" -> layer "2020").

    The tileset is optimized for web mapping with:
    - Zoom levels 0-14
    - Feature IDs based on mapbox-id attribute
    - Automatic simplification and detail levels

    Args:
        geojson_dir: Directory containing GeoJSON files (one per year)
        scenario_name: Name of the scenario (e.g., "SSP126")
        data_dir: Base data directory for output path

    Returns:
        True if tileset was created successfully, False otherwise
    """
    # Check if tippecanoe is installed
    try:
        subprocess.run(["tippecanoe", "--version"], capture_output=True, check=True)
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
    cmd = [
        "tippecanoe",
        f"--output={output_file}",
        f"--name={scenario_name} Tileset (All Years)",
        f"--description={scenario_name} glacier data with separate layer for each year",
        "--minimum-zoom=0",
        "--maximum-zoom=14",
        "--low-detail=10",
        "--full-detail=12",
        "--simplification=1",
        "--no-feature-limit",
        "--extend-zooms-if-still-dropping",
        "--use-attribute-for-id=mapbox-id",  # Use 'mapbox-id' property as the feature ID
        "-aI",  # Convert string IDs to numbers if possible
        "--force",
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
    mapping_path = data_dir / "processed" / "glacier_index.csv"
    if mapping_path.exists():
        mapping_df = pd.read_csv(mapping_path)
        # Convert sgi_id to string for consistent lookup (handles any type mismatches)
        mapping_df["sgi_id"] = mapping_df["sgi_id"].astype(str)
        # Create a dictionary for quick lookup: sgi_id -> (mapbox-id, name)
        mapping_dict = dict(
            zip(mapping_df["sgi_id"], zip(mapping_df["mapbox-id"], mapping_df["name"]))
        )
    else:
        print(f"Error: Mapping file not found at {mapping_path}")
        mapping_dict = {}

    # Path to the glacier shapefiles directory
    future_extents_dir = data_dir / "raw" / "future_extents"

    if not future_extents_dir.exists():
        print(f"Error: Directory not found: {future_extents_dir}")
        return

    # Get all subdirectories in the vector directory
    folders = [d for d in future_extents_dir.iterdir() if d.is_dir()]

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

        # First pass: collect 2020 baseline data
        print(f"Collecting 2020 baseline data for {scenario}...")
        for shp_file in shp_files:
            year = int(shp_file.stem.split("_")[0])
            if year == 2020:
                gdf_2020 = gpd.read_file(shp_file)

                # Rename volume column
                gdf_2020 = gdf_2020.rename(columns={"Volume (km": "Volume (km3)"})

                # Set negative volume values to None
                gdf_2020.loc[gdf_2020["Volume (km3)"] < 0, "Volume (km3)"] = None

                # Store baseline values
                for _, row in gdf_2020.iterrows():
                    sgi_id = str(row["Glacier_ID"])
                    baseline_2020[sgi_id] = {
                        "area": row["Area (km2)"],
                        "volume": row["Volume (km3)"],
                    }

        print(f"✓ Collected {len(baseline_2020)} baseline values from 2020 files")

        # For each shapefile, process and save
        pbar = tqdm(shp_files, desc=f"Processing {scenario}", unit="file")
        for shp_file in pbar:
            # Extract year and skip if before 2020
            year = int(shp_file.stem.split("_")[0])
            if year is None or year < 2020:
                continue

            gdf = gpd.read_file(shp_file)
            num_features = len(gdf)
            pbar.set_description(
                f"Processing {scenario} - {shp_file.name} ({num_features} features)"
            )

            # Rename volume column
            gdf = gdf.rename(columns={"Volume (km": "Volume (km3)"})

            # Set negative volume values to None
            gdf.loc[gdf["Volume (km3)"] < 0, "Volume (km3)"] = None
            folder_total_volumes += len(gdf)
            folder_valid_volumes += gdf["Volume (km3)"].notna().sum()

            # Calculate area from geometry for comparison
            if gdf.crs is None:
                gdf_for_area = gdf.copy()
            elif str(gdf.crs) != "EPSG:2056":
                gdf_for_area = gdf.to_crs("EPSG:2056")
            else:
                gdf_for_area = gdf.copy()

            computed_areas = gdf_for_area.geometry.area / 1_000_000
            given_areas = gdf["Area (km2)"]
            relative_diff = abs((computed_areas - given_areas) / given_areas) * 100
            matched = (relative_diff <= 1.0).sum()
            folder_total_areas += len(gdf)
            folder_matched_areas += matched

            # Assign mapbox-id and name from mapping file
            def get_mapping_info(glacier_id):
                glacier_id_str = str(glacier_id)
                return mapping_dict.get(glacier_id_str, (None, None))

            mapping_results = gdf["Glacier_ID"].apply(get_mapping_info)
            gdf["mapbox-id"] = [result[0] for result in mapping_results]
            gdf["name"] = [result[1] for result in mapping_results]

            # Rename Glacier_ID to SGI-ID
            gdf = gdf.rename(columns={"Glacier_ID": "SGI-ID"})

            # Calculate change in area and volume compared to 2020
            area_change = []
            volume_change = []

            for _, row in gdf.iterrows():
                sgi_id = str(row["SGI-ID"])

                if year == 2020:
                    area_change.append(0)
                    volume_change.append(0)
                elif sgi_id in baseline_2020:
                    baseline = baseline_2020[sgi_id]
                    current_area = row["Area (km2)"]
                    baseline_area = baseline["area"]
                    if (
                        pd.notna(current_area)
                        and pd.notna(baseline_area)
                        and baseline_area != 0
                    ):
                        area_change.append(
                            round(
                                ((current_area - baseline_area) / baseline_area) * 100
                            )
                        )
                    else:
                        area_change.append(None)

                    current_volume = row["Volume (km3)"]
                    baseline_volume = baseline["volume"]
                    if (
                        pd.notna(current_volume)
                        and pd.notna(baseline_volume)
                        and baseline_volume != 0
                    ):
                        volume_change.append(
                            round(
                                ((current_volume - baseline_volume) / baseline_volume)
                                * 100
                            )
                        )
                    else:
                        volume_change.append(None)
                else:
                    area_change.append(None)
                    volume_change.append(None)

            gdf["Area change (%)"] = area_change
            gdf["Volume change (%)"] = volume_change

            # Transform CRS to WGS84
            if gdf.crs is None:
                gdf.set_crs("EPSG:4326", inplace=True)
            elif str(gdf.crs) != "EPSG:4326":
                gdf = gdf.to_crs("EPSG:4326")

            # Optimize dtypes
            gdf["Area (km2)"] = gdf["Area (km2)"].astype("float32")
            gdf["Volume (km3)"] = gdf["Volume (km3)"].astype("float32")
            gdf["Area change (%)"] = gdf["Area change (%)"].astype("float32")
            gdf["Volume change (%)"] = gdf["Volume change (%)"].astype("float32")
            gdf["mapbox-id"] = gdf["mapbox-id"].astype("int32")

            # Save to GeoJSON
            output_path = output_dir / f"{year}.geojson"
            gdf.to_file(output_path, driver="GeoJSON")

            all_columns.append(list(gdf.columns))

        # Print folder summary
        print(f"Summary for scenario '{scenario}':")
        if folder_total_volumes > 0:
            print(
                f"  Valid volumes: {folder_valid_volumes}/{folder_total_volumes} ({folder_valid_volumes/folder_total_volumes*100:.1f}%)"
            )
        if folder_total_areas > 0:
            print(
                f"  Matched areas: {folder_matched_areas}/{folder_total_areas} ({folder_matched_areas/folder_total_areas*100:.1f}%)"
            )

        # Create tileset from the GeoJSON files
        create_tileset_for_scenario(output_dir, scenario, data_dir)

        print()

    # Assert that all files have the same column names
    if all_columns:
        first_columns = all_columns[0]
        for i, columns in enumerate(all_columns[1:], start=1):
            assert (
                columns == first_columns
            ), f"Column mismatch: File {i} has columns {columns}, but expected {first_columns}"


if __name__ == "__main__":
    main()
