# tools/blender_convert_weapons.py — convertit une LISTE de FBX d'armes → GLB (statiques).
#   blender --background --factory-startup --python blender_convert_weapons.py -- <f1.fbx> <f2.fbx> ...
# Chaque sortie = même chemin, extension .glb. Pas d'animation (armes statiques) ; textures embarquées.
import bpy, sys, os

inputs = sys.argv[sys.argv.index("--") + 1:]
ok = 0
for inp in inputs:
    if not os.path.exists(inp):
        print(f"[W] MANQUANT {inp}"); continue
    out = os.path.splitext(inp)[0] + ".glb"
    try:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.fbx(filepath=inp)
        bpy.ops.export_scene.gltf(filepath=out, export_format="GLB",
                                  export_animations=False, export_apply=False, export_yup=True)
        ok += 1
        print(f"[W] {os.path.basename(inp)} -> {os.path.basename(out)}")
    except Exception as e:
        print(f"[W] ERREUR {os.path.basename(inp)}: {e}")
print(f"[W] DONE ({ok}/{len(inputs)})")
