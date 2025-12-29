"""
Generate totals CSV files for each scenario.

This script processes glacier shapefiles from different climate scenarios and
generates pre-aggregated CSV files containing total area and volume for each year.
This pre-aggregation allows the chart to load instantly without processing
individual features.

The script reads from shapefiles in data/raw/future_extents/{SCENARIO}/ and outputs
CSV files to data/processed/totals/ with the format: {SCENARIO}_totals.csv
"""

from pathlib import Path
import pandas as pd
import geopandas as gpd


def process_scenario(scenario_folder, output_csv):
    """
    Process a scenario folder and generate totals CSV.

    Reads all shapefiles in the scenario folder, extracts year from filenames,
    aggregates area and volume across all features, and saves to CSV.

    Args:
        scenario_folder: Path to scenario folder containing shapefiles
        output_csv: Path to output CSV file
    """
    scenario_name = scenario_folder.name
    print(f"Processing {scenario_name}...")

    # Get all shapefiles
    shp_files = sorted(scenario_folder.glob("*.shp"))

    if not shp_files:
        print(f"  No shapefiles found in {scenario_folder}")
        return

    results = []

    for file_idx, shp_file in enumerate(shp_files):
        gdf = gpd.read_file(shp_file)

        # Extract year from filename (part before first underscore)
        year = int(shp_file.stem.split("_")[0])

        # Sum area and volume
        total_area = gdf["Area (km2)"].sum()
        total_volume = gdf["Volume (km"].sum()

        results.append({"year": year, "area": total_area, "volume": total_volume})

        print(
            f"  {year}: area={total_area:.2f} km², volume={total_volume:.2f} km³ ({len(gdf)} features)"
        )

    if not results:
        print(f"  No valid data found for {scenario_name}")
        return

    # Create DataFrame and sort by year
    df = pd.DataFrame(results)
    df = df.sort_values("year")

    # Round area and volume
    df["area"] = df["area"].round(4)
    df["volume"] = df["volume"].round(4)

    # Save to CSV
    df.to_csv(output_csv, index=False)
    print(f"  ✓ Saved to {output_csv}")


def main():
    """
    Main entry point for the script.

    Processes all scenario folders and generates totals CSV files
    for each scenario (SSP126, SSP245, SSP370, SSP585).
    """
    # Use script's directory as base for relative paths
    script_dir = Path(__file__).parent
    data_dir = script_dir / ".." / "data"
    data_dir = data_dir.resolve()

    future_extents_dir = data_dir / "raw" / "future_extents"

    if not future_extents_dir.exists():
        print(f"Error: Future extents directory not found: {future_extents_dir}")
        return

    # Output directory
    output_dir = data_dir / "processed" / "totals"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Valid scenario names
    scenarios = {"SSP126", "SSP245", "SSP370", "SSP585"}

    # Get all scenario folders in future extents directory
    scenario_folders = [d for d in future_extents_dir.iterdir() if d.is_dir()]

    if not scenario_folders:
        print(f"Error: No scenario folders found in {future_extents_dir}")
        return

    # Process each scenario
    for idx, scenario_folder in enumerate(sorted(scenario_folders)):
        folder_name = scenario_folder.name
        output_csv = output_dir / f"{folder_name}_totals.csv"

        process_scenario(scenario_folder, output_csv)

        print("-" * 50)

    print("✓ All CSVs generated!")


if __name__ == "__main__":
    main()
