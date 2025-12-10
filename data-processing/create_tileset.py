#!/usr/bin/env python3
"""
Simple script to convert SSP126 GeoJSON data to Mapbox tileset using tippecanoe.
For testing purposes - keeps it simple.
"""

import json
import subprocess
import sys
from pathlib import Path

def main():
    data_dir = Path("public/data/SSP126")
    output_dir = Path("tileset_output")
    output_file = output_dir / "ssp126.mbtiles"
    
    # Check if tippecanoe is installed
    try:
        subprocess.run(["tippecanoe", "--version"], 
                      capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Error: tippecanoe is not installed")
        print("Install it with: brew install tippecanoe (on macOS)")
        sys.exit(1)
    
    # Check if data directory exists
    if not data_dir.exists():
        print(f"Error: Data directory not found: {data_dir}")
        sys.exit(1)
    
    # Find all GeoJSON files
    geojson_files = sorted(data_dir.glob("*.geojson"))
    
    if not geojson_files:
        print(f"Error: No GeoJSON files found in {data_dir}")
        sys.exit(1)
    
    print(f"Found {len(geojson_files)} GeoJSON files")
    
    # Extract year from filename and create layer mapping
    # Each year will be a separate layer in the tileset
    layer_mappings = []
    
    for geojson_file in geojson_files:
        # Extract year from filename (e.g., "2020.geojson" -> "2020")
        year = geojson_file.stem  # Gets filename without extension
        if year.isdigit():
            layer_name = year
        else:
            # Fallback: use filename as layer name
            layer_name = year
        
        layer_mappings.append((layer_name, geojson_file))
        print(f"  Layer '{layer_name}': {geojson_file.name}")
    
    # Create output directory
    output_dir.mkdir(exist_ok=True)
    
    # Run tippecanoe with separate layers for each year
    print(f"\nCreating tileset with {len(layer_mappings)} layers: {output_file}")
    
    # Build tippecanoe command
    # Use -L option to specify layer name for each file: -L layer_name:file.geojson
    cmd = [
        "tippecanoe",
        f"--output={output_file}",
        "--name=SSP126 Tileset (All Years)",
        "--description=SSP126 glacier data with separate layer for each year",
        "--minimum-zoom=0",
        "--maximum-zoom=14",
        "--force"
    ]
    
    # Add -L layer_name:file.geojson for each file
    for layer_name, geojson_file in layer_mappings:
        cmd.extend(["-L", f"{layer_name}:{geojson_file}"])
    
    try:
        subprocess.run(cmd, check=True)
        print(f"\n✓ Tileset created: {output_file}")
        print(f"  Contains {len(layer_mappings)} layers (one per year)")
        print(f"  Layer names: {', '.join([name for name, _ in layer_mappings])}")
        print(f"\nTo upload to Mapbox:")
        print(f"  mapbox upload YOUR_USERNAME.ssp126-test {output_file}")
        print(f"\nAfter upload, use the tileset ID in your code.")
        print(f"Each year will be available as a separate source-layer in Mapbox Studio.")
    except subprocess.CalledProcessError as e:
        print(f"Error running tippecanoe: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
