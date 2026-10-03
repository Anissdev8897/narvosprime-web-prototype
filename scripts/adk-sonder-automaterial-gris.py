# ══════════════════════════════════════════════════════════════════════════════
# adk-sonder-automaterial-gris.py — pourquoi l'auto-material de terrain rend GRIS.
#
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript -script="…"
#
# ⚠ EDITEUR FERME. Sortie dans `Saved/Logs/NanosWorldADK.log` (LogPython),
#    PAS sur stdout.
#
# ── DEUX CAUSES POSSIBLES, TRES DIFFERENTES ───────────────────────────────────
# 1. Les TEXTURES sont vides ou grises (import raté, données absentes).
# 2. Les textures vont bien, mais le MATERIAU ne peut pas se compiler sur la
#    cible où on le pose. `MTL_MWAM_AutoMaterial_MASTER` est `MD_Surface` et
#    emploie des nœuds RESERVES AU TERRAIN — LandscapeLayerSample,
#    LandscapeVisibilityMask, LandscapeGrassOutput. Posé sur un StaticMesh, il
#    ne compile pas pour ce vertex factory, et Unreal retombe sur le matériau
#    par défaut, qui est GRIS.
#
# Ce script MESURE laquelle des deux, au lieu de choisir.
#
# ⚠ NE PAS parcourir `expression_collection` du master : ça a fait CRASHER le
#    commandlet le 2026-09-05. On lit les propriétés, jamais le graphe.
# ══════════════════════════════════════════════════════════════════════════════

import unreal

RACINE = "/Game/Narvos/MWLandscapeAutoMaterial"


def journal(m):
    unreal.log("[NARVOS] " + m)


registre = unreal.AssetRegistryHelpers.get_asset_registry()
registre.search_all_assets(True)

# ── 1. Les textures ont-elles des DONNEES ? ──────────────────────────────────
#
# Une texture grise à l'écran vient presque toujours d'un import qui a produit
# un asset valide mais VIDE. Les dimensions et le format le disent tout de suite.

journal("=== TEXTURES")
textures = []
for d in registre.get_assets_by_path(RACINE + "/Textures", recursive=True):
    if str(d.asset_class_path.asset_name) != "Texture2D":
        continue
    textures.append(str(d.package_name))

journal("%d Texture2D sous %s/Textures" % (len(textures), RACINE))
suspectes = 0
for paquet in sorted(textures):
    t = unreal.EditorAssetLibrary.load_asset(paquet)
    if t is None:
        journal("  ILLISIBLE  %s" % paquet)
        suspectes += 1
        continue
    try:
        w = t.blueprint_get_size_x()
        h = t.blueprint_get_size_y()
    except Exception:
        w = h = -1
    try:
        comp = str(t.get_editor_property("compression_settings"))
        srgb = t.get_editor_property("srgb")
        grp = str(t.get_editor_property("lod_group"))
    except Exception:
        comp, srgb, grp = "?", "?", "?"
    douteuse = (w <= 4 or h <= 4)
    if douteuse:
        suspectes += 1
    journal("  %-52s %5dx%-5d srgb=%-5s %-34s %s"
            % (paquet.rsplit("/", 1)[-1], w, h, srgb, comp.replace("TextureCompressionSettings.", ""),
               "<-- VIDE ?" if douteuse else ""))

journal("")
journal("%d texture(s) suspecte(s) (dimension <= 4 px ou illisible)" % suspectes)

# ── 2. Le materiau MASTER — domaine et usages ────────────────────────────────
#
# `material_domain` dit sur QUOI il peut se poser. `used_with_static_lighting`,
# `used_with_skeletal_mesh`… sont les drapeaux d'usage : un matériau qui n'a pas
# le drapeau de sa cible ne compile pas pour elle et rend le matériau par défaut.

journal("")
journal("=== MATERIAU MASTER")
master = unreal.EditorAssetLibrary.load_asset(RACINE + "/Materials/MASTER/MTL_MWAM_AutoMaterial_MASTER")
if master is None:
    journal("MASTER INTROUVABLE")
else:
    for prop in ("material_domain", "blend_mode", "shading_model", "two_sided",
                 "used_with_static_lighting", "used_with_skeletal_mesh",
                 "used_with_instanced_static_meshes", "used_with_nanite",
                 "used_with_landscape"):
        try:
            journal("  %-36s %s" % (prop, master.get_editor_property(prop)))
        except Exception as e:
            journal("  %-36s (non lisible : %s)" % (prop, e))

    # get_texture_parameter_names est un helper C++ : il ne fait PAS parcourir
    # le graphe depuis Python, contrairement a expression_collection.
    try:
        noms = unreal.MaterialEditingLibrary.get_texture_parameter_names(master)
        journal("  %d parametre(s) de texture declare(s)" % len(noms))
        for n in list(noms)[:40]:
            journal("      %s" % n)
    except Exception as e:
        journal("  parametres de texture non lisibles : %s" % e)

# ── 3. Les instances de biome — que surchargent-elles VRAIMENT ? ─────────────
#
# ⚠ `get_material_parameters` de UnrealMCP ne lit que le MASTER : un rapport vert
#    de ce côté ne dit rien de ce que l'instance applique. On lit ici la
#    propriété `texture_parameter_values` de l'instance, qui EST la surcharge.

journal("")
journal("=== INSTANCES DE BIOME")
for nom in ("DesertExample", "IslandExample", "MountainRangeExample"):
    chemin = "%s/Materials/Landscape/MTL_MWAM_Landscape_%s" % (RACINE, nom)
    inst = unreal.EditorAssetLibrary.load_asset(chemin)
    if inst is None:
        journal("  %-22s INTROUVABLE" % nom)
        continue
    parent = inst.get_editor_property("parent")
    journal("  %-22s parent=%s" % (nom, parent.get_name() if parent else "**AUCUN**"))
    try:
        vals = inst.get_editor_property("texture_parameter_values")
        vides = 0
        for v in vals:
            tex = v.get_editor_property("parameter_value")
            if tex is None:
                vides += 1
        journal("      %d surcharge(s) de texture, dont %d VIDE(S)" % (len(vals), vides))
        for v in list(vals)[:30]:
            info = v.get_editor_property("parameter_info")
            tex = v.get_editor_property("parameter_value")
            journal("        %-30s -> %s" % (info.get_editor_property("name"),
                                             tex.get_name() if tex else "**VIDE**"))
    except Exception as e:
        journal("      surcharges non lisibles : %s" % e)

# ── 4. Y a-t-il de quoi PEINDRE une couche ? ─────────────────────────────────
#
# Le master emploie `LandscapeLayerSample`. Peindre une couche de terrain exige
# un `LandscapeLayerInfoObject` par couche : sans lui, la couche apparait avec un
# « + » dans l'onglet Paint, le poids reste a 0, et le mélange rend du gris.

journal("")
journal("=== LANDSCAPE LAYER INFO")
infos = []
for d in registre.get_assets_by_path("/Game/Narvos", recursive=True):
    if str(d.asset_class_path.asset_name) == "LandscapeLayerInfoObject":
        infos.append(str(d.package_name))
journal("%d LandscapeLayerInfoObject sous /Game/Narvos" % len(infos))
for p in sorted(infos):
    journal("  %s" % p)

journal("")
journal("=== LECTURE")
journal("Textures vides    -> import a refaire.")
journal("Textures OK + material_domain=Surface + noeuds Landscape")
journal("                  -> le materiau ne compile QUE sur un Landscape ;")
journal("                     pose sur un StaticMesh il rend le materiau par defaut (GRIS).")
journal("0 LayerInfo       -> aucune couche peignable : le melange sort a poids nul.")