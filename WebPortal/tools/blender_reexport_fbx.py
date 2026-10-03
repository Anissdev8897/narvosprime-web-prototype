# tools/blender_reexport_fbx.py — re-exporte les FBX d'un dossier en FBX PROPRE.
#
# Certains FBX (Mixamo/tiers) contiennent des propriétés que three-stdlib FBXLoader
# ne sait pas parser ("Unknown property type") → crash au chargement. Blender les
# importe sans souci ; on les ré-exporte → FBX binaire 7.4 standard, parsable par three.
#
# Usage : blender --background --factory-startup --python blender_reexport_fbx.py -- <folder>
import bpy, sys, os, glob

folder = sys.argv[sys.argv.index("--") + 1:][0]
files = glob.glob(os.path.join(folder, "*.fbx")) + glob.glob(os.path.join(folder, "*.FBX"))

for f in sorted(set(files)):
    try:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.fbx(filepath=f, automatic_bone_orientation=True)
        n_act = len(bpy.data.actions)
        bpy.ops.export_scene.fbx(
            filepath=f, use_selection=False, add_leaf_bones=False,
            bake_anim=True, bake_anim_use_all_actions=False,
            path_mode="COPY", embed_textures=False,
        )
        print(f"[REEXPORT] {os.path.basename(f)} | actions={n_act}")
    except Exception as e:
        print(f"[REEXPORT] {os.path.basename(f)} | ERROR {e}")
