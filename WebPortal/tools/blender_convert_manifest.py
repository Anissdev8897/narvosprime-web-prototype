# tools/blender_convert_manifest.py — convertit en GLB une LISTE de FBX (manifeste).
#
# Lit un fichier (un chemin FBX par ligne) et exporte chaque clip en GLB (même nom).
# L'export GLB préserve les animations de façon fiable (contrairement au re-export FBX).
# Usage : blender --background --factory-startup --python blender_convert_manifest.py -- <manifest.txt>
import bpy, sys, os

manifest = sys.argv[sys.argv.index("--") + 1:][0]
with open(manifest, encoding="utf-8") as fh:
    paths = [l.strip() for l in fh if l.strip()]

for inp in paths:
    try:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.fbx(filepath=inp, automatic_bone_orientation=True)
        out = os.path.splitext(inp)[0] + ".glb"
        n = len(bpy.data.actions)
        bpy.ops.export_scene.gltf(filepath=out, export_format="GLB",
                                  export_animations=True, export_apply=False, export_yup=True)
        print(f"[MF] OK {os.path.basename(out)} actions={n}")
    except Exception as e:
        print(f"[MF] ERR {os.path.basename(inp)} | {e}")
