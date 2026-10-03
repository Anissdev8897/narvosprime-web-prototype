# tools/blender_anim_only.py — FBX animé → GLB ANIM-ONLY (squelette + anim, SANS mesh/textures).
#   blender --background --factory-startup --python blender_anim_only.py -- <f1.fbx> ...
# Pour les clips d'animation dont on n'a PAS besoin du mesh (il vient d'un autre fichier).
# Résultat = quelques Ko (vs des dizaines de Mo avec le mesh hi-poly + textures).
import bpy, sys, os

inputs = sys.argv[sys.argv.index("--") + 1:]
ok = 0
for inp in inputs:
    if not os.path.exists(inp):
        print(f"[AO] MANQUANT {inp}"); continue
    out = os.path.splitext(inp)[0] + ".glb"
    try:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.fbx(filepath=inp, automatic_bone_orientation=False)
        # Supprime les MESH (on ne garde que l'armature + son action).
        for o in [o for o in bpy.data.objects if o.type == "MESH"]:
            bpy.data.objects.remove(o, do_unlink=True)
        n = len(bpy.data.actions)
        bpy.ops.export_scene.gltf(filepath=out, export_format="GLB",
                                  export_animations=True, export_apply=False, export_yup=True)
        ok += 1
        print(f"[AO] {os.path.basename(inp)} -> {os.path.basename(out)}  actions={n}")
    except Exception as e:
        print(f"[AO] ERREUR {os.path.basename(inp)}: {e}")
print(f"[AO] DONE ({ok}/{len(inputs)})")
