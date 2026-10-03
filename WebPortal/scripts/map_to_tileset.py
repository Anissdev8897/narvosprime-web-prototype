
import os
import glob
import json
import hashlib
from PIL import Image

# Config
TILE_SIZE = 64
MAPS_DIR = os.path.join("public", "textures", "dofus_maps")
OUTPUT_BASE = os.path.join("public", "tilesets")

def get_tile_hash(tile_data):
    return hashlib.md5(tile_data).hexdigest()

def process_map(image_path, faction_name):
    img = Image.open(image_path).convert("RGB")
    width, height = img.size
    
    cols = width // TILE_SIZE
    rows = height // TILE_SIZE
    
    # Nettoyage du nom (enlever seulement l'extension .png finale)
    map_name = os.path.basename(image_path)
    if map_name.lower().endswith('.png'):
        map_name = map_name[:-4]
    
    out_dir = os.path.join(OUTPUT_BASE, faction_name, map_name)
    os.makedirs(os.path.join(out_dir, "tiles"), exist_ok=True)
    
    tile_matrix = []
    unique_tiles = {} # hash -> id
    tile_counter = 0
    
    print(f"📦 Processing Map: {map_name} ({cols}x{rows} tiles)")
    
    for r in range(rows):
        row_data = []
        for c in range(cols):
            left = c * TILE_SIZE
            top = r * TILE_SIZE
            right = left + TILE_SIZE
            bottom = top + TILE_SIZE
            
            tile = img.crop((left, top, right, bottom))
            tile_bytes = tile.tobytes()
            h = get_tile_hash(tile_bytes)
            
            if h not in unique_tiles:
                unique_tiles[h] = tile_counter
                tile_filename = f"tile_{tile_counter}.png"
                tile.save(os.path.join(out_dir, "tiles", tile_filename))
                tile_counter += 1
            
            row_data.append(unique_tiles[h])
        tile_matrix.append(row_data)
        
    # Metadata
    metadata = {
        "name": map_name,
        "faction": faction_name,
        "tileSize": TILE_SIZE,
        "cols": cols,
        "rows": rows,
        "totalUniqueTiles": len(unique_tiles),
        "data": tile_matrix
    }
    
    with open(os.path.join(out_dir, "map_data.json"), "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    
    print(f"✅ Success: {map_name} converted with {len(unique_tiles)} unique tiles.")
    return map_name

def main():
    if not os.path.exists(MAPS_DIR):
        print(f"❌ Error: Maps directory not found at {MAPS_DIR}")
        return
        
    factions = [d for d in os.listdir(MAPS_DIR) if os.path.isdir(os.path.join(MAPS_DIR, d))]
    manifest = {}

    for faction in factions:
        print(f"📂 Processing Faction: {faction}")
        manifest[faction] = []
        pattern = os.path.join(MAPS_DIR, faction, "**", "*.png")
        map_files = glob.glob(pattern, recursive=True)
        
        map_files = [f for f in map_files if "_mask" not in f]
        
        for map_file in map_files:
            try:
                name = process_map(map_file, faction)
                manifest[faction].append(name)
            except Exception as e:
                print(f"❌ Error processing {map_file}: {e}")
    
    # Write Manifest
    manifest_path = os.path.join(OUTPUT_BASE, "manifest.json")
    os.makedirs(OUTPUT_BASE, exist_ok=True)
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"\n📂 Manifest generated at {manifest_path}")

if __name__ == "__main__":
    main()
