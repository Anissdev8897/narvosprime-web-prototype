# tools/blender_convert.py — Conversion FBX/OBJ → GLB (headless Blender).
#
# Usage :
#   blender --background --factory-startup --python blender_convert.py -- <input> <output.glb>
#
# Importe le FBX (avec animations) ou l'OBJ (avec MTL/matériaux), puis exporte en
# GLB binaire. Les anims FBX sont conservées ; les OBJ sont statiques (pas de skin).
import bpy
import sys
import os

argv = sys.argv[sys.argv.index("--") + 1:]
inp, outp = argv[0], argv[1]

# Scène vide (repart de zéro à chaque conversion).
bpy.ops.wm.read_factory_settings(use_empty=True)

ext = os.path.splitext(inp)[1].lower()
if ext == ".fbx":
    bpy.ops.import_scene.fbx(filepath=inp, automatic_bone_orientation=True)
elif ext == ".obj":
    # Blender 4.x : importeur OBJ natif (charge le .mtl voisin automatiquement).
    bpy.ops.wm.obj_import(filepath=inp)
else:
    raise SystemExit(f"Extension non supportée: {ext}")

# Compte anims + meshes pour le diagnostic.
n_actions = len(bpy.data.actions)
n_meshes = len([o for o in bpy.data.objects if o.type == "MESH"])
n_arm = len([o for o in bpy.data.objects if o.type == "ARMATURE"])

bpy.ops.export_scene.gltf(
    filepath=outp,
    export_format="GLB",
    export_animations=True,
    export_apply=False,
    export_yup=True,
)
print(f"[CONVERT] {os.path.basename(inp)} -> {os.path.basename(outp)} | actions={n_actions} meshes={n_meshes} armatures={n_arm}")
