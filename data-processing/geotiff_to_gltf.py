#!/usr/bin/env python3
"""
Convert a GeoTIFF elevation file to GLTF 3D model format.
The output GLTF can be used with threebox in Mapbox.
"""

import sys
import os
import numpy as np
import rasterio
from rasterio.transform import xy
from rasterio.crs import CRS
from rasterio.warp import transform as rasterio_transform
import trimesh
from pathlib import Path


def geotiff_to_gltf(input_path, output_path=None, simplify=True, max_vertices=50000):
    """
    Convert a GeoTIFF elevation file to GLTF format.
    
    Args:
        input_path: Path to input GeoTIFF file
        output_path: Path to output GLTF file (default: input_path with .gltf extension)
        simplify: Whether to simplify the mesh if it has too many vertices
        max_vertices: Maximum number of vertices before simplification
    
    Returns:
        dict with model info including origin coordinates for Mapbox
    """
    print(f"Reading GeoTIFF: {input_path}")
    
    # Read the GeoTIFF
    with rasterio.open(input_path) as src:
        # Get elevation data
        elevation = src.read(1)  # Read first band
        transform = src.transform
        crs = src.crs
        bounds = src.bounds
        
        print(f"  Dimensions: {elevation.shape}")
        print(f"  CRS: {crs}")
        print(f"  Bounds: {bounds}")
        print(f"  Elevation range: {np.nanmin(elevation):.2f} to {np.nanmax(elevation):.2f} meters")
        
        # Transform coordinates to WGS84 (EPSG:4326) for Mapbox
        # Get center coordinates in source CRS
        center_x = (bounds.left + bounds.right) / 2
        center_y = (bounds.bottom + bounds.top) / 2
        
        # Transform to WGS84 if not already
        if crs and str(crs) != 'EPSG:4326':
            print(f"  Transforming coordinates from {crs} to WGS84 (EPSG:4326)...")
            center_lng, center_lat = rasterio_transform(
                crs, CRS.from_epsg(4326),
                [center_x], [center_y]
            )
            center_lng = center_lng[0]
            center_lat = center_lat[0]
        else:
            center_lng = center_x
            center_lat = center_y
        
        # Handle no-data values: -9999 means no data
        no_data_value = -9999
        elevation_clean = elevation.copy()
        
        # Create mask for valid data (not no-data and not NaN)
        valid_mask = (elevation_clean != no_data_value) & ~np.isnan(elevation_clean)
        
        if not np.any(valid_mask):
            raise ValueError("No valid elevation data found in raster (all values are no-data)")
        
        # Get valid elevation range
        valid_elevations = elevation[valid_mask]  # Use original elevation, not cleaned
        elevation_min = np.min(valid_elevations)
        elevation_max = np.max(valid_elevations)
        
        print(f"  Valid elevation range: {elevation_min:.2f} to {elevation_max:.2f} meters")
        print(f"  Valid data points: {np.sum(valid_mask)} / {elevation.size} ({100 * np.sum(valid_mask) / elevation.size:.1f}%)")
        
        # Calculate elevation range for scaling
        elevation_range = elevation_max - elevation_min
        print(f"  Elevation range: {elevation_range:.2f} meters")
        
        # Skip no-data areas entirely - only create vertices for valid data
        print(f"  Skipping no-data areas (creating holes in mesh)...")
        
        # Create coordinate grids in source CRS
        rows, cols = elevation.shape
        x_coords = np.linspace(bounds.left, bounds.right, cols)
        y_coords = np.linspace(bounds.top, bounds.bottom, rows)  # Note: top to bottom
        X, Y = np.meshgrid(x_coords, y_coords)
        
        # Transform all coordinates to WGS84 if needed
        if crs and str(crs) != 'EPSG:4326':
            print(f"  Transforming mesh coordinates to WGS84...")
            # Flatten coordinate arrays for transformation
            x_flat = X.flatten()
            y_flat = Y.flatten()
            # Transform in batches to avoid memory issues
            lng_flat, lat_flat = rasterio_transform(
                crs, CRS.from_epsg(4326),
                x_flat, y_flat
            )
            Lng = np.array(lng_flat).reshape(X.shape)
            Lat = np.array(lat_flat).reshape(Y.shape)
        else:
            Lng = X
            Lat = Y
        
        # Scale coordinates to meters (for mesh local coordinate system)
        # 1 degree latitude ≈ 111,000 meters
        # 1 degree longitude ≈ 111,000 * cos(latitude) meters
        lat_scale = 111000  # meters per degree latitude
        lon_scale = 111000 * np.cos(np.radians(center_lat))  # meters per degree longitude
        
        # Get center elevation from valid data (for coordinate reference)
        center_row = rows // 2
        center_col = cols // 2
        if valid_mask[center_row, center_col]:
            center_elevation = elevation[center_row, center_col]
        else:
            # Find nearest valid elevation
            center_elevation = np.mean(valid_elevations)
        
        # Create vertex index map: maps (row, col) -> vertex_index (only for valid data)
        vertex_map = {}  # (i, j) -> vertex_index
        vertices = []
        vertex_index = 0
        
        # Only create vertices for valid data points
        for i in range(rows):
            for j in range(cols):
                if valid_mask[i, j]:
                    # Convert lat/lon to local meters (relative to center)
                    # In three.js/GLTF: x=east-west, y=up (elevation), z=north-south
                    x = (Lng[i, j] - center_lng) * lon_scale  # longitude -> x (east-west)
                    # Use elevation relative to minimum so terrain starts at y=0
                    # This ensures all y values are positive (or zero at minimum)
                    y = elevation[i, j] - elevation_min  # elevation -> y (up), relative to minimum
                    z = -(Lat[i, j] - center_lat) * lat_scale  # latitude -> -z (north-south, negated for right-handed)
                    vertices.append([x, y, z])
                    vertex_map[(i, j)] = vertex_index
                    vertex_index += 1
        
        vertices = np.array(vertices)
        print(f"  Created {len(vertices)} vertices from {np.sum(valid_mask)} valid data points")
        
        # Create faces (triangles) only for quads where all 4 corners have valid data
        faces = []
        for i in range(rows - 1):
            for j in range(cols - 1):
                # Check if all 4 corners have valid data
                v0_valid = valid_mask[i, j]
                v1_valid = valid_mask[i, j + 1]
                v2_valid = valid_mask[i + 1, j]
                v3_valid = valid_mask[i + 1, j + 1]
                
                # Only create triangles if all corners are valid
                if v0_valid and v1_valid and v2_valid and v3_valid:
                    # Get vertex indices from map
                    v0 = vertex_map[(i, j)]
                    v1 = vertex_map[(i, j + 1)]
                    v2 = vertex_map[(i + 1, j)]
                    v3 = vertex_map[(i + 1, j + 1)]
                    
                    # Create two triangles per quad
                    # Reverse winding order so faces point upward (visible from above)
                    faces.append([v0, v2, v1])  # Reversed: v0, v2, v1 instead of v0, v1, v2
                    faces.append([v1, v2, v3])  # Reversed: v1, v2, v3 instead of v1, v3, v2
        
        faces = np.array(faces) if faces else np.array([], dtype=int).reshape(0, 3)
        print(f"  Created {len(faces)} faces (triangles)")
        print(f"  Final mesh: {len(vertices)} vertices, {len(faces)} faces")
        
        # Create trimesh object
        mesh = trimesh.Trimesh(vertices=vertices, faces=faces)
        
        # Fix normals to point upward (ensure faces are visible from above)
        # Check if normals point in the right direction (should point up, positive y)
        face_normals = mesh.face_normals
        # If most normals point down (negative y), flip them
        upward_normals = face_normals[:, 1] > 0  # y-component > 0 means pointing up
        if np.sum(upward_normals) < len(face_normals) / 2:
            print(f"  Flipping face normals (most were pointing down)")
            mesh.faces = np.flip(mesh.faces, axis=1)  # Reverse vertex order to flip normals
            mesh._face_normals = None  # Force recalculation
        
        # Make mesh double-sided so it's visible from all angles
        # Create a material with double-sided rendering
        if hasattr(mesh.visual, 'material'):
            mesh.visual.material.doubleSided = True
        else:
            # If no material exists, create one
            from trimesh.visual.material import SimpleMaterial
            material = SimpleMaterial()
            material.doubleSided = True
            mesh.visual.material = material
        
        print(f"  Mesh configured for double-sided rendering")
        
        # Simplify if needed
        if simplify and len(vertices) > max_vertices:
            print(f"  Simplifying mesh (target: {max_vertices} vertices)...")
            try:
                mesh = mesh.simplify_quadric_decimation(max_vertices)
                print(f"  Simplified to {len(mesh.vertices)} vertices")
            except ImportError:
                print(f"  Warning: fast_simplification not available, skipping simplification")
                print(f"  Using full mesh with {len(vertices)} vertices")
            except Exception as e:
                print(f"  Warning: Simplification failed ({e}), using full mesh")
        
        # Determine output path
        if output_path is None:
            input_path_obj = Path(input_path)
            output_path = input_path_obj.parent / f"{input_path_obj.stem}.gltf"
        
        # Export to GLTF with double-sided material
        print(f"Exporting GLTF: {output_path}")
        
        # Use pygltflib to set double-sided material
        try:
            import pygltflib
            # Export as GLTF first
            mesh.export(str(output_path), file_type='gltf')
            
            # Load and modify to ensure double-sided
            gltf = pygltflib.GLTF2().load(str(output_path))
            if gltf.materials and len(gltf.materials) > 0:
                for material in gltf.materials:
                    if material.pbrMetallicRoughness:
                        # Set doubleSided property
                        material.doubleSided = True
                gltf.save(str(output_path))
                print(f"  Set doubleSided=true on all materials")
        except Exception as e:
            print(f"  Warning: Could not set double-sided property ({e}), using default export")
            mesh.export(str(output_path), file_type='gltf')
        
        # Return model info for Mapbox
        # Important: The model's y=0 corresponds to elevation_min (lowest point)
        # So the origin elevation should be elevation_min, not center_elevation
        origin_elevation = elevation_min
        
        model_info = {
            'origin': [center_lng, center_lat, origin_elevation],
            'bounds': bounds,
            'crs': str(crs),
            'vertices': len(mesh.vertices),
            'faces': len(mesh.faces),
            'elevation_min': elevation_min,
            'elevation_max': elevation_max,
            'elevation_range': elevation_range,
            'output_path': str(output_path)
        }
        
        print("\n=== Model Information ===")
        print(f"Origin coordinates for Mapbox: {model_info['origin']}")
        print(f"  Longitude: {center_lng:.6f}")
        print(f"  Latitude: {center_lat:.6f}")
        print(f"  Elevation: {origin_elevation:.2f} meters (minimum elevation - model's y=0)")
        print(f"  Elevation range: {elevation_min:.2f} to {elevation_max:.2f} meters")
        print(f"\nUse these coordinates in your Mapbox config:")
        print(f"  origin: [{center_lng:.6f}, {center_lat:.6f}, {origin_elevation:.2f}]")
        print(f"\nNote: The model's y=0 corresponds to the minimum elevation ({elevation_min:.2f}m)")
        print(f"      So the origin elevation should be {origin_elevation:.2f}m, not {center_elevation:.2f}m")
        
        return model_info


def main():
    if len(sys.argv) < 2:
        print("Usage: python geotiff_to_gltf.py <input_geotiff> [output_gltf]")
        print("\nExample:")
        print("  python geotiff_to_gltf.py data/raster.tif")
        print("  python geotiff_to_gltf.py data/raster.tif data/raster.gltf")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None
    
    if not os.path.exists(input_path):
        print(f"Error: File not found: {input_path}")
        sys.exit(1)
    
    try:
        model_info = geotiff_to_gltf(input_path, output_path)
        print(f"\n✓ Successfully created GLTF model: {model_info['output_path']}")
    except Exception as e:
        print(f"\n✗ Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()

