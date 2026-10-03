# tools/blender_convert_animated.py — FBX rigué+animé → GLB, orientation Mixamo PRÉSERVÉE.
#   blender --background --factory-startup --python blender_convert_animated.py -- <f1.fbx> ...
# automatic_bone_orientation=False → même orientation que le FBXLoader de three.js
# (les anims propres restent cohérentes + la calibration d'orientation reste valable).
import bpy, sys, os

inputs = sys.argv[sys.argv.index("--") + 1:]
ok = 0
for inp in inputs:
    if not os.path.exists(inp):
        print(f"[A] MANQUANT {inp}"); continue
    out = os.path.splitext(inp)[0] + ".glb"
    try:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.fbx(filepath=inp, automatic_bone_orientation=False)
        n = len(bpy.data.actions)
        bpy.ops.export_scene.gltf(filepath=out, export_format="GLB",
                                  export_animations=True, export_apply=False, export_yup=True)
        ok += 1
        print(f"[A] {os.path.basename(inp)} -> {os.path.basename(out)}  actions={n}")
    except Exception as e:
        print(f"[A] ERREUR {os.path.basename(inp)}: {e}")
print(f"[A] DONE ({ok}/{len(inputs)})")
