import os
import glob
from PIL import Image
import numpy as np

# Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_BASE = os.path.join(BASE_DIR, "..", "public", "textures", "personnage_extracted")
OUTPUT_DIR = os.path.join(BASE_DIR, "..", "public", "textures", "sprites")

def process_pil(name, folder):
    print(f"PIL Processing {name} from {folder}...")
    files = sorted(glob.glob(os.path.join(folder, "*.png")))[:32]
    if not files:
        print(f"  Warning: No sprites found in {folder}")
        return
    
    sz = 256
    cols, rows = 4, 8
    albedo_sheet = Image.new("RGBA", (sz * cols, sz * rows), (0,0,0,0))
    mask_sheet = Image.new("RGBA", (sz * cols, sz * rows), (0,0,0,0))
    
    for i, f in enumerate(files):
        img = Image.open(f).convert("RGBA")
        bbox = img.getbbox() # Simple alpha bbox
        if not bbox: continue
        
        char = img.crop(bbox)
        cw, ch = char.size
        
        # Center the char
        frame = Image.new("RGBA", (sz, sz), (0,0,0,0))
        tx = (sz - cw) // 2
        ty = sz - ch - 40 # Ground with 40px margin
        frame.paste(char, (tx, ty))
        
        # Sheet paste
        r, c = i // cols, i % cols
        albedo_sheet.paste(frame, (c * sz, r * sz))
        
        # Mask Generation (Red for mid-tones, Green for highlights)
        arr = np.array(frame)
        gray = np.array(frame.convert("L"))
        
        # Custom mask logic for color tinting
        m_r = np.where((gray > 30) & (gray < 130), 255, 0).astype(np.uint8)
        m_g = np.where(gray >= 130, 255, 0).astype(np.uint8)
        
        mask_arr = np.zeros_like(arr)
        mask_arr[:, :, 0] = m_r # RED channel
        mask_arr[:, :, 1] = m_g # GREEN channel
        # BLUE channel can be used for secondary armor color if needed
        mask_arr[:, :, 3] = arr[:, :, 3] # ALPHA
        
        mask_sheet.paste(Image.fromarray(mask_arr), (c * sz, r * sz))

    albedo_sheet.save(os.path.join(OUTPUT_DIR, f"{name.lower()}_albedo.png"))
    mask_sheet.save(os.path.join(OUTPUT_DIR, f"{name.lower()}_mask.png"))
    print(f"  Saved {name.lower()}_albedo.png and _mask.png")

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    if not os.path.exists(INPUT_BASE):
        print(f"Error: Input directory {INPUT_BASE} not found.")
        return

    # Process all subdirectories in the extracted folder
    subdirs = [d for d in os.listdir(INPUT_BASE) if os.path.isdir(os.path.join(INPUT_BASE, d))]
    
    if not subdirs:
        print("No class directories found to process.")
        return

    for subdir in subdirs:
        folder_path = os.path.join(INPUT_BASE, subdir)
        process_pil(subdir, folder_path)

    print("Dynamic PIL processing done.")

if __name__ == "__main__":
    main()
