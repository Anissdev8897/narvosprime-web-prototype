# tools/blender_inspect_tex.py — convertit le FBX Tex en GLB + dumpe os/anims.
#   blender --background --factory-startup --python blender_inspect_tex.py -- <input.fbx> <output.glb>
import bpy, sys, os
argv = sys.argv[sys.argv.index("--") + 1:]
inp, outp = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=inp, automatic_bone_orientation=True)

n_actions = len(bpy.data.actions)
arms = [o for o in bpy.data.objects if o.type == "ARMATURE"]
print(f"[TEX] actions={n_actions} armatures={len(arms)} meshes={len([o for o in bpy.data.objects if o.type=='MESH'])}")
for a in arms:
    names = [b.name for b in a.data.bones]
    print(f"[TEX] armature '{a.name}' bones={len(names)}")
    print("[TEX] firstbones=" + ", ".join(names[:24]))

bpy.ops.export_scene.gltf(filepath=outp, export_format="GLB", export_animations=True, export_apply=False, export_yup=True)
print(f"[TEX] export -> {os.path.basename(outp)}")
