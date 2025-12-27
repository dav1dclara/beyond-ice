#!/usr/bin/env python3
"""
Inspect tile sizes in an mbtiles file.
Usage: python inspect_tiles.py [scenario]
"""

from pathlib import Path
import sqlite3
import sys
from collections import defaultdict

def inspect_tileset(scenario='ssp126'):
    """Inspect tile sizes for a given scenario."""
    # Get script directory and data directory
    script_dir = Path(__file__).parent
    data_dir = script_dir / ".." / "data"
    tilesets_dir = data_dir / "processed" / "tilesets"
    
    # Find the mbtiles file
    mbtiles_file = tilesets_dir / f"{scenario.lower()}.mbtiles"
    
    if not mbtiles_file.exists():
        print(f"Error: Tileset not found: {mbtiles_file}")
        return
    
    print(f"Inspecting tileset: {mbtiles_file}")
    print(f"File size: {mbtiles_file.stat().st_size / (1024*1024):.2f} MB\n")
    
    # Connect to database
    conn = sqlite3.connect(str(mbtiles_file))
    cursor = conn.cursor()
    
    # Get metadata
    cursor.execute("SELECT name, value FROM metadata")
    metadata = dict(cursor.fetchall())
    
    print("Metadata:")
    for key, value in sorted(metadata.items()):
        print(f"  {key}: {value}")
    print()
    
    # Get tile statistics
    cursor.execute("""
        SELECT 
            zoom_level,
            COUNT(*) as tile_count,
            AVG(LENGTH(tile_data)) as avg_size,
            MIN(LENGTH(tile_data)) as min_size,
            MAX(LENGTH(tile_data)) as max_size,
            SUM(LENGTH(tile_data)) as total_size
        FROM tiles
        WHERE tile_data IS NOT NULL
        GROUP BY zoom_level
        ORDER BY zoom_level
    """)
    
    results = cursor.fetchall()
    
    if not results:
        print("No tiles found in database!")
        conn.close()
        return
    
    print("Tile Statistics by Zoom Level:")
    print("-" * 80)
    print(f"{'Zoom':<6} {'Count':<10} {'Avg Size':<12} {'Min Size':<12} {'Max Size':<12} {'Total Size':<15}")
    print("-" * 80)
    
    total_tiles = 0
    total_size = 0
    
    for zoom, count, avg_size, min_size, max_size, size_sum in results:
        total_tiles += count
        total_size += size_sum
        avg_kb = avg_size / 1024 if avg_size else 0
        min_kb = min_size / 1024 if min_size else 0
        max_kb = max_size / 1024 if max_size else 0
        total_mb = size_sum / (1024 * 1024) if size_sum else 0
        
        print(f"{zoom:<6} {count:<10} {avg_kb:>10.2f} KB {min_kb:>10.2f} KB {max_kb:>10.2f} KB {total_mb:>13.2f} MB")
    
    print("-" * 80)
    print(f"{'TOTAL':<6} {total_tiles:<10} {'':<12} {'':<12} {'':<12} {total_size/(1024*1024):>13.2f} MB")
    print()
    
    # Get distribution of tile sizes
    print("Tile Size Distribution:")
    print("-" * 50)
    
    cursor.execute("""
        SELECT 
            CASE 
                WHEN LENGTH(tile_data) < 1024 THEN '< 1 KB'
                WHEN LENGTH(tile_data) < 10*1024 THEN '1-10 KB'
                WHEN LENGTH(tile_data) < 50*1024 THEN '10-50 KB'
                WHEN LENGTH(tile_data) < 100*1024 THEN '50-100 KB'
                WHEN LENGTH(tile_data) < 500*1024 THEN '100-500 KB'
                ELSE '> 500 KB'
            END as size_range,
            COUNT(*) as count
        FROM tiles
        WHERE tile_data IS NOT NULL
        GROUP BY size_range
        ORDER BY 
            CASE 
                WHEN size_range = '< 1 KB' THEN 1
                WHEN size_range = '1-10 KB' THEN 2
                WHEN size_range = '10-50 KB' THEN 3
                WHEN size_range = '50-100 KB' THEN 4
                WHEN size_range = '100-500 KB' THEN 5
                ELSE 6
            END
    """)
    
    dist_results = cursor.fetchall()
    for size_range, count in dist_results:
        percentage = (count / total_tiles * 100) if total_tiles > 0 else 0
        print(f"  {size_range:<15} {count:>8} tiles ({percentage:>5.1f}%)")
    print()
    
    # Find largest tiles
    print("Top 10 Largest Tiles:")
    print("-" * 50)
    cursor.execute("""
        SELECT zoom_level, tile_column, tile_row, LENGTH(tile_data) as size
        FROM tiles
        WHERE tile_data IS NOT NULL
        ORDER BY size DESC
        LIMIT 10
    """)
    
    large_tiles = cursor.fetchall()
    for zoom, x, y, size in large_tiles:
        size_kb = size / 1024
        print(f"  Zoom {zoom}, Tile {x}/{y}: {size_kb:.2f} KB")
    print()
    
    # Check for empty tiles
    cursor.execute("SELECT COUNT(*) FROM tiles WHERE tile_data IS NULL OR LENGTH(tile_data) = 0")
    empty_count = cursor.fetchone()[0]
    if empty_count > 0:
        print(f"Warning: {empty_count} empty tiles found!")
        print()
    
    conn.close()
    
    # Summary
    print("Summary:")
    print(f"  Total tiles: {total_tiles:,}")
    print(f"  Total size: {total_size / (1024*1024):.2f} MB")
    print(f"  Average tile size: {total_size / total_tiles / 1024:.2f} KB" if total_tiles > 0 else "  Average tile size: N/A")


def main():
    """Main function."""
    scenario = sys.argv[1] if len(sys.argv) > 1 else 'ssp126'
    inspect_tileset(scenario)


if __name__ == '__main__':
    main()

