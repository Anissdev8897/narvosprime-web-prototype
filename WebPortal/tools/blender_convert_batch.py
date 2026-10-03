# tools/blender_convert_batch.py — Convertit en lot les FBX/OBJ d'un dossier racine en GLB.
#
# Usage :
#   blender --background --factory-startup --python blender_convert_batch.py -- <root_dir>
#
# Pour chaque SOUS-DOSSIER de <root_dir> :
#   • s'il a déjà un .glb à sa racine → SKIP (déjà converti / natif)
#   • sinon, trouve le 1er .fbx (puis .obj) en récursif → importe → exporte
#     <sous-dossier>/<nom_sous-dossier>.glb
# Imprime une ligne MANIFEST par conversion (réutilisable pour le catalogue).
import bpy
import sys
import os
import glob

argv = sys.argv[sys.argv.index("--") + 1:]
root = argv[0]

def find_model(folder):
    # GLB déjà présent à la racine du sous-dossier → on ne reconvertit pas.
    if glob.glob(os.path.join(folder, "*.glb")):
        return None, "skip-has-glb"
    fbx = glob.glob(os.path.join(folder, "**", "*.fbx"), recursive=True)
    if fbx:
        return fbx[0], "fbx"
    obj = glob.glob(os.path.join(folder, "**", "*.obj"), recursive=True)
    if obj:
        return obj[0], "obj"
    return None, "no-model"

for name in sorted(os.listdir(root)):
    folder = os.path.join(root, name)
    if not os.path.isdir(folder):
        continue
    inp, kind = find_model(folder)
    if inp is None:
        print(f"[MANIFEST] {name} | {kind}")
        continue
    try:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        ext = os.path.splitext(inp)[1].lower()
        if ext == ".fbx":
            bpy.ops.import_scene.fbx(filepath=inp, automatic_bone_orientation=True)
        else:
            bpy.ops.wm.obj_import(filepath=inp)
        out = os.path.join(folder, name + ".glb")
        n_actions = len(bpy.data.actions)
        n_arm = len([o for o in bpy.data.objects if o.type == "ARMATURE"])
        bpy.ops.export_scene.gltf(filepath=out, export_format="GLB",
                                  export_animations=True, export_apply=False, export_yup=True)
        print(f"[MANIFEST] {name} | {kind} | actions={n_actions} armatures={n_arm} | {name}.glb")
    except Exception as e:
        print(f"[MANIFEST] {name} | ERROR {e}")
