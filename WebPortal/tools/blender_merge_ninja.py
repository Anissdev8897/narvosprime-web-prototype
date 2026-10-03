# tools/blender_merge_ninja.py — Fusionne les GLB Ninja (1 anim/fichier) en UN GLB.
#
# Chaque GLB source contient le MÊME mesh + squelette + UNE action. On garde le mesh
# du Tpose, on récupère l'action de chaque autre GLB (renommée idle/walk/run/…), on
# supprime les doublons, puis on exporte un seul GLB avec TOUTES les actions.
#
#   blender --background --factory-startup --python blender_merge_ninja.py -- <ninjaDir> <out.glb>
import bpy, sys, os

argv = sys.argv[sys.argv.index("--") + 1:]
ninja_dir, outp = argv[0], argv[1]
# 3e arg optionnel : GLB d'où emprunter un IDLE (os Meshy compatibles "Hips/Spine").
idle_src = argv[2] if len(argv) > 2 else None

# (sous-dossier, action canonique). Tpose = base mesh (l'asset n'a PAS d'idle propre
# → on l'emprunte ensuite à soldat_humain, rig Meshy compatible).
SOURCES = [
    ("Tpose", "tpose"),
    ("Walk",  "walk"),
    ("Run",   "run"),
    ("Jump",  "jump"),
    ("Kick",  "attack"),
    ("Die",   "death"),
]

def first_glb(folder):
    d = os.path.join(ninja_dir, folder)
    for f in os.listdir(d):
        if f.lower().endswith(".glb"):
            return os.path.join(d, f)
    raise SystemExit(f"Pas de GLB dans {d}")

bpy.ops.wm.read_factory_settings(use_empty=True)

kept_objs = None  # (armature, meshes) du Tpose à conserver
for folder, action_name in SOURCES:
    before_objs = set(bpy.data.objects)
    before_acts = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=first_glb(folder))
    new_objs = [o for o in bpy.data.objects if o not in before_objs]
    new_acts = [a for a in bpy.data.actions if a not in before_acts]

    # Renomme l'action importée + fake user (survit à la suppression des objets).
    for a in new_acts:
        a.name = action_name
        a.use_fake_user = True

    if folder == "Tpose":
        kept_objs = new_objs  # on garde le mesh + armature du Tpose
    else:
        # Supprime les objets dupliqués (on ne garde QUE leur action).
        for o in new_objs:
            bpy.data.objects.remove(o, do_unlink=True)

# L'asset Ninja n'a PAS d'idle. On en fabrique un STATIQUE sur SON PROPRE rig (garanti
# sans cassure) = 1re frame de "walk" figée (pose debout naturelle, ≠ T-pose bras en croix).
walk = bpy.data.actions.get("walk")
if walk:
    idle = walk.copy()
    idle.name = "idle"
    idle.use_fake_user = True
    for fc in idle.fcurves:
        kfs = fc.keyframe_points
        if len(kfs) == 0:
            continue
        v0, x0 = kfs[0].co[1], kfs[0].co[0]
        while len(kfs) > 2:
            kfs.remove(kfs[len(kfs) - 1])
        # 2 keyframes IDENTIQUES (pose tenue 30 frames) → durée non-nulle (sinon l'export
        # glTF saute l'anim) mais visuellement STATIQUE.
        if len(kfs) == 1:
            fc.keyframe_points.insert(x0 + 30, v0)
        else:
            kfs[1].co = (x0 + 30, v0)
        fc.update()

# Supprime l'action "tpose" inutile (statique, bras en croix).
tp = bpy.data.actions.get("tpose")
if tp:
    bpy.data.actions.remove(tp)

# Pousse CHAQUE action sur sa propre piste NLA de l'armature conservée. Méthode
# FIABLE en Blender 4.x : l'export glTF NLA_TRACKS émet une animation par piste
# (contrairement au mode ACTIONS qui saute les actions copiées/non-liées à un slot).
arm = next((o for o in (kept_objs or []) if o.type == "ARMATURE"), None)
ORDER = ["idle", "walk", "run", "jump", "attack", "death"]
if arm:
    if not arm.animation_data:
        arm.animation_data_create()
    arm.animation_data.action = None
    for name in ORDER:
        act = bpy.data.actions.get(name)
        if not act:
            continue
        track = arm.animation_data.nla_tracks.new()
        track.name = name
        start = int(act.frame_range[0])
        track.strips.new(name, start, act)

print(f"[NINJA] actions={[a.name for a in bpy.data.actions]} nla={[t.name for t in (arm.animation_data.nla_tracks if arm else [])]}")

bpy.ops.export_scene.gltf(
    filepath=outp,
    export_format="GLB",
    export_animations=True,
    export_animation_mode="NLA_TRACKS",  # 1 animation glTF par piste NLA
    export_apply=False,
    export_yup=True,
)
print(f"[NINJA] export -> {os.path.basename(outp)}")
