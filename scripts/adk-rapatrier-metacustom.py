# -*- coding: utf-8 -*-
"""
adk-rapatrier-metacustom.py — faire pointer MetaCustom (promu, CUIT) vers ses
propres copies, et non plus vers le pack d'origine (stagé, NeverCook).

  python scripts/ue-remote.py --statement "exec(open(r'E:/narvosprime-web-prototype/scripts/adk-rapatrier-metacustom.py', encoding='utf-8').read()); rapatrier(appliquer=False)"

── CE QUI EST CASSÉ (mesuré sur disque le 2026-09-11) ────────────────────────
Les assets de /Game/Narvos/MetaCustom nomment 407 chemins distincts sous
/Game/Metahuman_Customization_System ; 380 ont un JUMEAU promu au chemin miroir.
25 maillages nomment le Skel_Dummy stagé, 17 le metahuman_base_skel stagé.
Le dossier stagé n'est jamais cuit : dans le pack, ces maillages auraient un
squelette MORT — ni rendu, ni animation. Même mal que Defender, autre cause :
ici la cible existe, elle est seulement hors du cook.

── LA MÉTHODE ─────────────────────────────────────────────────────────────────
  1. dépendances lues dans le REGISTRE (pas en chargeant : une sonde qui charge
     trop tôt empoisonne, cf. adk-recharger-et-resauver.py) ;
  2. pour chaque cible stagée qui a un jumeau promu de même classe :
     consolidate_assets(jumeau, [stagé]) — tous les référents passent au jumeau,
     le stagé devient un redirecteur (le dossier stagé reste NeverCook) ;
  3. sauvegarde des paquets modifiés, PAR LOTS (un appel distant qui dure trop
     longtemps ne rend plus la main) ; relancer jusqu'à « reste 0 » ;
  4. la preuve se lit ensuite SUR DISQUE, dans un autre processus.

Classes exclues : les classes-types (Blueprint, AnimBlueprint, Widget, struct,
enum) — consolider une classe touche les CDO — et les animations, hors cook ici
(`DefaultGame.ini`) et dont une a déjà tué un cook.

Sauvegarde préalable : adk/_sauvegardes/2026-09-11_metacustom/
Journal : WebPortal/Server/adk/_rapatrier-metacustom.log
"""
import sys
import unreal

EAL = unreal.EditorAssetLibrary
AR = unreal.AssetRegistryHelpers.get_asset_registry()
STAGE = "/Game/Metahuman_Customization_System"
PROMU = "/Game/Narvos/MetaCustom"
JOURNAL = "E:/narvosprime-web-prototype/WebPortal/Server/adk/_rapatrier-metacustom.log"
CLASSES_OK = {
    "Skeleton", "SkeletalMesh", "StaticMesh", "PhysicsAsset", "Material",
    "MaterialInstanceConstant", "MaterialFunction", "MaterialParameterCollection",
    "Texture2D", "TextureCube", "SubsurfaceProfile", "IKRigDefinition", "IKRetargeter",
    "GroomAsset", "GroomBindingAsset", "SkeletalMeshLODSettings", "PhysicalMaterial",
}
# Les squelettes d'abord : ce sont eux qui rendent un maillage animable.
PRIORITE = {"Skeleton": 0, "PhysicsAsset": 1, "SkeletalMesh": 2}


def dire(texte):
    sys.stdout.write(str(texte) + "\n")
    with open(JOURNAL, "a", encoding="utf-8") as f:
        f.write(str(texte) + "\n")


def _classe(chemin):
    try:
        return str(EAL.find_asset_data(chemin).asset_class_path.asset_name)
    except Exception:
        return "?"


def _paires():
    """(stagé, jumeau, classe) pour chaque cible stagée d'un paquet promu."""
    opts = unreal.AssetRegistryDependencyOptions(
        include_soft_package_references=True, include_hard_package_references=True,
        include_searchable_names=False, include_soft_management_references=False,
        include_hard_management_references=False)
    promus = sorted({str(a).split(".")[0] for a in EAL.list_assets(PROMU, recursive=True, include_folder=False)})
    cibles = set()
    for p in promus:
        for dep in (AR.get_dependencies(p, opts) or []):
            d = str(dep)
            if d.startswith(STAGE + "/"):
                cibles.add(d)
    paires, refus = [], {}
    for stage in sorted(cibles):
        jumeau = PROMU + stage[len(STAGE):]
        cs = _classe(stage)
        if _classe(stage + "." + stage.rsplit("/", 1)[1]) == "ObjectRedirector" or cs == "ObjectRedirector":
            continue
        if not EAL.does_asset_exist(jumeau):
            refus["sans jumeau"] = refus.get("sans jumeau", 0) + 1
            continue
        if cs not in CLASSES_OK:
            refus[cs] = refus.get(cs, 0) + 1
            continue
        if _classe(jumeau) != cs:
            refus["classe differente"] = refus.get("classe differente", 0) + 1
            continue
        paires.append((stage, jumeau, cs))
    paires.sort(key=lambda t: (PRIORITE.get(t[2], 9), t[0]))
    return len(promus), paires, refus


def rapatrier(appliquer=False, lot=60):
    nb_promus, paires, refus = _paires()
    par_classe = {}
    for _, _, c in paires:
        par_classe[c] = par_classe.get(c, 0) + 1
    dire("[M] %d paquet(s) promu(s) ; %d cible(s) stagee(s) a rapatrier %s ; ecartees %s"
         % (nb_promus, len(paires), par_classe, refus))
    if not appliquer or not paires:
        return
    faits, echecs = 0, []
    for stage, jumeau, classe in paires[:lot]:
        j = unreal.load_asset(jumeau)
        s = unreal.load_asset(stage)
        if j is None or s is None:
            echecs.append((stage, "chargement"))
            continue
        try:
            if EAL.consolidate_assets(j, [s]):
                faits += 1
            else:
                echecs.append((stage, "refus"))
        except Exception as e:
            echecs.append((stage, str(e)[:80]))
    ok = unreal.EditorLoadingAndSavingUtils.save_dirty_packages(False, True)
    dire("[M] lot : %d consolide(s), %d echec(s) %s ; sauvegarde %s ; reste %d"
         % (faits, len(echecs), echecs[:6], ok, max(0, len(paires) - lot)))