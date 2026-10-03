# tools/convert_maps_to_glb.py — convertit TOUS les FBX/OBJ d'un dossier en GLB
# (textures embarquées), en place, même nom/dossier que la source.
#
# Lancer (headless) :
#   "C:/Program Files/Blender Foundation/Blender 4.5/blender.exe" -b -P tools/convert_maps_to_glb.py -- <ROOT>
#
# - OBJ : import via le .mtl voisin (textures liées automatiquement).
# - FBX : textures embarquées si présentes ; sinon liaison PBR HEURISTIQUE depuis le
#   dossier "Textures/" ancêtre le plus proche (T_<Mat>_BaseColor/Normal/ORM/Emissive).
# - Export : GLB unique, images packées (export_image_format='AUTO').
# - Idempotent : saute si le .glb cible existe et est plus récent que la source.
import bpy, os, sys, glob, time

ROOT = sys.argv[-1] if "--" in sys.argv else "."
SUFFIX = (".obj", ".fbx")

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def find_textures_dir(start):
    # Remonte jusqu'à 4 niveaux pour trouver un dossier "Textures".
    d = os.path.dirname(start)
    for _ in range(4):
        cand = os.path.join(d, "Textures")
        if os.path.isdir(cand):
            return cand
        parent = os.path.dirname(d)
        if parent == d:
            break
        d = parent
    return None

def bind_pbr_from_textures(tex_dir):
    # Pour chaque matériau sans texture, cherche T_<nom>_BaseColor/Normal/ORM/Emissive.
    if not tex_dir:
        return
    files = os.listdir(tex_dir)
    def find(matname, *keys):
        m = matname.lower().replace(" ", "").replace("_", "")
        for f in files:
            fl = f.lower()
            if not fl.endswith((".png", ".jpg", ".jpeg", ".tga")):
                continue
            stem = os.path.splitext(fl)[0].replace("t_", "").replace("_", "").replace(" ", "")
            if m in stem and any(k in fl for k in keys):
                return os.path.join(tex_dir, f)
        return None
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            mat.use_nodes = True
        nt = mat.node_tree
        bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if not bsdf:
            continue
        # déjà texturé ? (une image branchée sur Base Color)
        if bsdf.inputs["Base Color"].is_linked:
            continue
        base = find(mat.name, "basecolor", "albedo", "diffuse", "color")
        if base:
            img = nt.nodes.new("ShaderNodeTexImage")
            try: img.image = bpy.data.images.load(base, check_existing=True)
            except Exception: pass
            nt.links.new(img.outputs["Color"], bsdf.inputs["Base Color"])
        nrm = find(mat.name, "normal")
        if nrm:
            tex = nt.nodes.new("ShaderNodeTexImage")
            try:
                tex.image = bpy.data.images.load(nrm, check_existing=True)
                tex.image.colorspace_settings.name = "Non-Color"
            except Exception: pass
            nmap = nt.nodes.new("ShaderNodeNormalMap")
            nt.links.new(tex.outputs["Color"], nmap.inputs["Color"])
            nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
        emi = find(mat.name, "emissive", "emission")
        if emi:
            tex = nt.nodes.new("ShaderNodeTexImage")
            try: tex.image = bpy.data.images.load(emi, check_existing=True)
            except Exception: pass
            if "Emission Color" in bsdf.inputs:
                nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
                bsdf.inputs["Emission Strength"].default_value = 1.0

def convert(src):
    out = os.path.splitext(src)[0] + ".glb"
    if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(src):
        return "skip"
    clear_scene()
    ext = os.path.splitext(src)[1].lower()
    try:
        if ext == ".obj":
            bpy.ops.wm.obj_import(filepath=src)   # charge le .mtl voisin
        else:
            bpy.ops.import_scene.fbx(filepath=src)
            bind_pbr_from_textures(find_textures_dir(src))
    except Exception as e:
        print(f"  IMPORT FAIL {src}: {e}")
        return "fail"
    if not any(o.type == "MESH" for o in bpy.data.objects):
        return "empty"
    try:
        bpy.ops.export_scene.gltf(
            filepath=out, export_format="GLB",
            export_apply=True, export_yup=True,
        )
        return "ok"
    except Exception as e:
        print(f"  EXPORT FAIL {out}: {e}")
        return "fail"

def collect(paths):
    # Accepte des FICHIERS (.obj/.fbx) ET des DOSSIERS (glob récursif). Passer des fichiers
    # précis évite de re-balayer tout l'arbre (les anim FBX sans mesh ne sont pas reprocessées).
    srcs = []
    for p in paths:
        if os.path.isfile(p) and p.lower().endswith(SUFFIX):
            srcs.append(p)
        elif os.path.isdir(p):
            for ext in SUFFIX:
                srcs += glob.glob(os.path.join(p, "**", f"*{ext}"), recursive=True)
    return sorted(set(srcs))

def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [ROOT]
    srcs = collect(args)
    print(f"[convert] {len(srcs)} fichiers source")
    counts = {"ok": 0, "skip": 0, "fail": 0, "empty": 0}
    t0 = time.time()
    for i, s in enumerate(srcs, 1):
        r = convert(s)
        counts[r] += 1
        if i % 10 == 0 or r in ("fail", "empty"):
            print(f"[{i}/{len(srcs)}] {r}  {os.path.relpath(s, ROOT)}")
    print(f"[convert] terminé en {time.time()-t0:.0f}s — {counts}")

main()
