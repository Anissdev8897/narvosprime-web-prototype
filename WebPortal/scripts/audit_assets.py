import os
import cv2
import numpy as np
import json

def audit_sprite(file_path):
    """
    Check if a sprite frame has 'double sprites' or artifacts.
    Returns: list of issues found.
    """
    img = cv2.imread(file_path, cv2.IMREAD_UNCHANGED)
    if img is None:
        return ["Invalide (pas pu lire)"]
    
    issues = []
    
    # Check for transparency
    if img.shape[2] == 4:
        alpha = img[:, :, 3]
        # Count non-transparent blobs
        contours, _ = cv2.findContours(alpha, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Filter small noise
        blobs = [c for c in contours if cv2.contourArea(c) > 500]
        
        if len(blobs) > 1:
            issues.append(f"Multi-blobs détectés ({len(blobs)}) - Effet double sprite potentiel")
    
    # Check for text (very basic: look for high contrast edges in specific regions)
    # This is hard to do reliably without OCR, but simple contrast checks in corners help.
    
    return issues

def main():
    root_dir = r"C:\mes_projets\narvosprime-web-prototype\public\textures"
    report = {"bad_files": []}
    
    # 1. Audit Personnages
    personnage_dir = os.path.join(root_dir, "processed", "personnage")
    if os.path.exists(personnage_dir):
        for root, dirs, files in os.walk(personnage_dir):
            for file in files:
                if file.endswith(".png"):
                    full_path = os.path.join(root, file)
                    issues = audit_sprite(full_path)
                    if issues:
                        report["bad_files"].append({
                            "path": full_path,
                            "issues": issues
                        })

    # 2. Audit Maps (Simple text check for some specific ones)
    # We'll just manually list some and then suggest deletion of patterns
    
    with open("audit_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    print(f"Audit terminé. {len(report['bad_files'])} fichiers suspects trouvés.")

if __name__ == "__main__":
    main()
