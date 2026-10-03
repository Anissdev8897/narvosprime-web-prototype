# ══════════════════════════════════════════════════════════════════════════════
# adk-sonder-materiaux-foret.py — LECTURE SEULE : pourquoi la foret est-elle sans texture ?
#
# Execute DANS l'editeur ouvert sur Map_Narvos (scripts/ue-remote.py --fichier).
# Vu le 2026-09-13 15:08 (capture de Hanibes) : dans l'EDITEUR, les arbres de
# ForestKitONE (Terrain/Vegetation/InstancedFoliageActor) sont deja gris-bleu : le
# defaut est dans la source, pas seulement dans le cuit.
#
# Rend, pour le foliage et le terrain charges : mesh -> materiaux EFFECTIFS ->
# chaine de parents -> parametres de texture (valeur ou None) et textures utilisees.
# Ne modifie rien, ne sauve rien.
# ══════════════════════════════════════════════════════════════════════════════
import unreal

MEL = unreal.MaterialEditingLibrary
TAG = "[FORET] "
MAX_MATERIAUX = 60


def dire(texte):
    print(TAG + texte)


def chemin(obj):
    return obj.get_path_name() if obj else "None"


def parents(mi):
    chaine = []
    courant = mi
    for _ in range(8):
        if not isinstance(courant, unreal.MaterialInstance):
            break
        courant = courant.get_editor_property("parent")
        chaine.append(chemin(courant))
        if courant is None:
            break
    return chaine


def textures_de(materiau):
    lignes = []
    if isinstance(materiau, unreal.MaterialInstance):
        try:
            for nom in MEL.get_texture_parameter_names(materiau):
                valeur = MEL.get_material_instance_texture_parameter_value(materiau, nom)
                lignes.append("%s=%s" % (nom, chemin(valeur)))
        except Exception as e:
            lignes.append("parametres illisibles : %s" % e)
    base = materiau.get_base_material() if hasattr(materiau, "get_base_material") else None
    if base is not None:
        try:
            utilisees = MEL.get_used_textures(base)
            lignes.append("base %s : %d texture(s) utilisee(s)%s" % (
                chemin(base), len(utilisees),
                "" if not utilisees else " ex. " + ", ".join(chemin(t) for t in list(utilisees)[:3])))
        except Exception as e:
            lignes.append("textures de base illisibles : %s" % e)
    return lignes


def main():
    monde = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    dire("monde : %s" % chemin(monde))

    vus = {}
    feuillages = unreal.GameplayStatics.get_all_actors_of_class(monde, unreal.InstancedFoliageActor)
    dire("InstancedFoliageActor charges : %d" % len(feuillages))
    for ifa in feuillages:
        composants = ifa.get_components_by_class(unreal.InstancedStaticMeshComponent)
        total = sum(c.get_instance_count() for c in composants)
        dire("IFA %s : %d composant(s), %d instance(s), niveau %s" % (
            ifa.get_name(), len(composants), total, chemin(ifa.get_outer())))
        for c in composants:
            mesh = c.get_editor_property("static_mesh")
            materiaux = c.get_materials()
            dire("  %s x%d  mats=%s" % (chemin(mesh), c.get_instance_count(),
                                       [chemin(m) for m in materiaux]))
            for m in materiaux:
                if m is not None and chemin(m) not in vus:
                    vus[chemin(m)] = m

    paysages = unreal.GameplayStatics.get_all_actors_of_class(monde, unreal.LandscapeProxy)
    dire("LandscapeProxy charges : %d" % len(paysages))
    for p in paysages[:20]:
        try:
            mat = p.get_editor_property("landscape_material")
        except Exception:
            mat = None
        dire("  %s @ %s  landscape_material=%s" % (p.get_name(), p.get_actor_location(), chemin(mat)))
        if mat is not None and chemin(mat) not in vus:
            vus[chemin(mat)] = mat

    dire("materiaux distincts : %d (detail des %d premiers)" % (len(vus), MAX_MATERIAUX))
    for nom, m in list(vus.items())[:MAX_MATERIAUX]:
        dire("MAT %s [%s]" % (nom, m.get_class().get_name()))
        chaine = parents(m)
        if chaine:
            dire("    parents : %s" % " -> ".join(chaine))
        for ligne in textures_de(m):
            dire("    " + ligne)


main()