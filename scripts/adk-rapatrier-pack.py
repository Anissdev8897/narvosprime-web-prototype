# -*- coding: utf-8 -*-
"""
adk-rapatrier-pack.py — la méthode MetaCustom, pour N'IMPORTE QUEL pack promu :
ses dépendances vers un dossier STAGÉ (jamais cuit) passent à leur jumeau promu.

  node scripts/narvos-audit-dependances.mjs --paires CITY_PACK   # écrit adk/_rapatrier-CITY_PACK.json
  python scripts/ue-remote.py --statement "exec(open(r'E:/narvosprime-web-prototype/scripts/adk-rapatrier-pack.py', encoding='utf-8').read()); rapatrier_pack('CITY_PACK', appliquer=False)"

── POURQUOI ──────────────────────────────────────────────────────────────────
L'audit des dépendances du 2026-09-11 (AUDIT_DEPENDANCES_2026-09-11.md) : CITY_PACK
nomme 697 cibles hors pack qui ont un jumeau promu, OpenWorlds 564, Megastructure
64. Cuites, ces références sont MORTES : matériaux gris, textures absentes, sans
erreur. C'est la cause mesurée des « textures manquantes » de la ville.

── LA MÉTHODE (celle d'adk-rapatrier-metacustom.py, prouvée : 371/371) ─────────
  1. la liste vient du REGISTRE (dump + audit), pas d'un chargement ;
  2. consolidate_assets(jumeau, [stagé]) : les référents CHARGÉS passent au
     jumeau, le stagé devient un redirecteur ;
  3. ⚠ les référents NON chargés gardent le chemin stagé sur disque : il FAUT
     ensuite adk-recharger-et-resauver.py finaliser('/Game/Narvos/<pack>', …) ;
  4. la preuve se lit SUR DISQUE, dans un autre processus.

Sauvegarder AVANT d'appliquer : les dossiers stagés nommés dans `racines_stage` du
JSON, et le pack promu. Classes exclues : classes-types (Blueprint, Widget, ABP,
struct, enum) et animations — comme pour MetaCustom.
"""
import json
import sys
import unreal

EAL = unreal.EditorAssetLibrary
ADK = "E:/narvosprime-web-prototype/WebPortal/Server/adk"
CLASSES_OK = {
    "Skeleton", "SkeletalMesh", "StaticMesh", "PhysicsAsset", "Material",
    "MaterialInstanceConstant", "MaterialFunction", "MaterialParameterCollection",
    "Texture2D", "TextureCube", "TextureRenderTarget2D", "SubsurfaceProfile",
    "PhysicalMaterial", "SoundWave", "SoundCue", "NiagaraSystem", "ParticleSystem",
}
PRIORITE = {"Skeleton": 0, "PhysicsAsset": 1, "SkeletalMesh": 2, "Material": 3, "MaterialFunction": 3}


def dire(pack, texte):
    sys.stdout.write(str(texte) + "\n")
    with open("%s/_rapatrier-%s.log" % (ADK, pack), "a", encoding="utf-8") as f:
        f.write(str(texte) + "\n")


def _classe(chemin):
    try:
        return str(EAL.find_asset_data(chemin).asset_class_path.asset_name)
    except Exception:
        return "?"


def rapatrier_pack(pack, appliquer=False, lot=80):
    with open("%s/_rapatrier-%s.json" % (ADK, pack), encoding="utf-8") as f:
        donnees = json.load(f)
    paires, refus = [], {}
    for p in donnees.get("paires", []):
        stage, jumeau = p["stage"], p["jumeau"]
        cs = _classe(stage)
        if cs in ("?", "None", "ObjectRedirector") or not EAL.does_asset_exist(stage):
            refus["deja rapatrie ou absent"] = refus.get("deja rapatrie ou absent", 0) + 1
            continue
        if cs not in CLASSES_OK:
            refus[cs] = refus.get(cs, 0) + 1
            continue
        if not jumeau or _classe(jumeau) != cs:
            refus["jumeau de classe differente"] = refus.get("jumeau de classe differente", 0) + 1
            continue
        paires.append((stage, jumeau, cs))
    paires.sort(key=lambda t: (PRIORITE.get(t[2], 9), t[0]))
    par_classe = {}
    for _, _, c in paires:
        par_classe[c] = par_classe.get(c, 0) + 1
    dire(pack, "[P] %s : %d a rapatrier %s ; ecartees %s ; mortes au registre : %d"
         % (pack, len(paires), par_classe, refus, len(donnees.get("mortes", []))))
    if not appliquer or not paires:
        return
    faits, echecs = 0, []
    for stage, jumeau, _ in paires[:lot]:
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
    dire(pack, "[P] lot : %d consolide(s), %d echec(s) %s ; sauvegarde %s ; reste %d"
         % (faits, len(echecs), echecs[:6], ok, max(0, len(paires) - lot)))