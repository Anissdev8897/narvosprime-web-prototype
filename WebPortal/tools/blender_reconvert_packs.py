# tools/blender_reconvert_packs.py — Reconvertit les FBX de pack en GLB en PRÉSERVANT
# l'orientation d'os Mixamo brute (automatic_bone_orientation=False).
#
# Pourquoi : la 1re conversion utilisait automatic_bone_orientation=True → Blender
# réoriente les os → la pose de repos du clip diffère de celle du rig chargé par le
# FBXLoader de three.js (qui garde l'orientation brute) → le perso se RETOURNE/déforme.
# Avec False, l'orientation brute est conservée → les clips se posent correctement.
#
#   blender --background --factory-startup --python blender_reconvert_packs.py -- <folder1> <folder2> ...
import bpy, sys, os

folders = sys.argv[sys.argv.index("--") + 1:]

for folder in folders:
    if not os.path.isdir(folder):
        print(f"[RECONV] ABSENT: {folder}"); continue
    glbs = [f for f in os.listdir(folder) if f.lower().endswith(".glb")]
    for glb in glbs:
        base = os.path.splitext(glb)[0]
        # FBX de même basename (insensible à la casse).
        fbx = None
        for f in os.listdir(folder):
            if f.lower() == (base + ".fbx").lower():
                fbx = os.path.join(folder, f); break
        if not fbx:
            print(f"[RECONV] pas de FBX pour {glb}"); continue
        try:
            bpy.ops.wm.read_factory_settings(use_empty=True)
            bpy.ops.import_scene.fbx(filepath=fbx, automatic_bone_orientation=False)
            n = len(bpy.data.actions)
            out = os.path.join(folder, glb)
            bpy.ops.export_scene.gltf(filepath=out, export_format="GLB",
                                      export_animations=True, export_apply=False, export_yup=True)
            print(f"[RECONV] {base}  actions={n}")
        except Exception as e:
            print(f"[RECONV] ERREUR {base}: {e}")
print("[RECONV] DONE")
