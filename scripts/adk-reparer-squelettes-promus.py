# -*- coding: utf-8 -*-
"""
adk-reparer-squelettes-promus.py — rebrancher un pack PROMU dont les references
pointent encore l'ancien chemin, puis poser ses squelettes d'humains sur le
squelette nanos (SKEL_Mannequin).

Execution DANS l'editeur ADK ouvert (execution Python distante) :

  python scripts/ue-remote.py --statement "exec(open(r'E:/narvosprime-web-prototype/scripts/adk-reparer-squelettes-promus.py', encoding='utf-8').read()); reparer('/Game/Narvos/Defender', ['/Game/Narvos/Defender/Demo/Meshes/UE4_Mannequin/SK_MannequinMainUE4M'], appliquer=False)"

Par defaut : MESURE, rien n'est modifie. `appliquer=True` ecrit.
Journal disque : WebPortal/Server/adk/_reparer-squelettes.log

── LE DEFAUT ────────────────────────────────────────────────────────────────
La promotion (`adk-promouvoir-packs.py`) a deplace les packs sous /Game/Narvos
sans ecrire les redirecteurs de la SOURCE. Les assets promus pointent donc
l'ancien chemin : squelette, asset physique, materiaux. Journal du cook du
2026-09-11 : « has a dependency on package ... which does not exist ». Les 60
SkeletalMesh de Defender etaient cuits avec `skeleton = None`.

── POURQUOI PAS PLUS SIMPLE ─────────────────────────────────────────────────
  · `SkeletalMesh.skeleton` est [Read-Only] en Python 5.7, aucun setter.
  · L'aller-retour de `rename_asset` echoue quand les referents sont deja
    charges avec une reference NULLE (adk-reparer-refs.py, 2026-09-09).
  · Deplacer les miroirs toucherait leurs referents valides, cartes comprises.

── LA METHODE ───────────────────────────────────────────────────────────────
  0. NETTOYER : supprimer les duplicatas NON SAUVES d'un passage interrompu.
  A. Pour chaque dependance morte D (absente SUR DISQUE) dont le miroir M
     existe sur disque : DUPLIQUER M en D. Aucun referent de M n'est touche.
  B. CHARGER les referents du pack (hors animations) : leurs references se
     resolvent enfin, sur le duplicata.
  C. `consolidate_assets(M, [D])` : les references chargees passent de D a M,
     le duplicata devient un redirecteur, les referents modifies sont SAUVES.
  D. Squelettes humains : `consolidate_assets(SKEL_Mannequin, [squelette])`.
  E. Remesurer.

── ⚠ LES ANIMATIONS SONT EXCLUES, ET C'EST MESURE ────────────────────────────
Premier passage du 2026-09-11 : `duplicate_asset` d'une AnimSequence au
squelette mort leve « Invalid USkeleton supplied » et ARRETE tout. On ne
traite donc que squelettes, physique, materiaux, textures et meshes. Les
animations de demonstration de Defender sont de toute facon hors cook
(`Demo/Animations`, DefaultGame.ini).

Le temoin qui compte est hors de ce script : relire la table de noms des
.uasset SUR DISQUE, pas l'etat en memoire.
"""
import os
import sys
import unreal

EAL = unreal.EditorAssetLibrary
REG = unreal.AssetRegistryHelpers.get_asset_registry()
OPTS = unreal.AssetRegistryDependencyOptions()
NANOS = "/Game/NanosWorld/Characters/Common/SKEL_Mannequin"
CONTENT = "E:/narvosprime-web-prototype/WebPortal/Server/adk/Content"
JOURNAL = "E:/narvosprime-web-prototype/WebPortal/Server/adk/_reparer-squelettes.log"

# Classes que l'on sait dupliquer et consolider sans squelette valide.
CIBLES_OK = {
    "Skeleton", "PhysicsAsset", "SkeletalMesh", "StaticMesh",
    "Material", "MaterialInstanceConstant", "MaterialFunction",
    "MaterialParameterCollection", "Texture2D", "TextureCube", "SubsurfaceProfile",
    "SoundWave", "SoundCue", "NiagaraSystem", "PhysicalMaterial",
}
ANIMS = {"AnimSequence", "AnimMontage", "BlendSpace", "BlendSpace1D",
         "AimOffsetBlendSpace", "AimOffsetBlendSpace1D", "AnimBlueprint", "PoseAsset",
         "AnimComposite"}


def dire(texte):
    sys.stdout.write(str(texte) + "\n")
    with open(JOURNAL, "a", encoding="utf-8") as f:
        f.write(str(texte) + "\n")


def _paquet(objet):
    return str(objet).split(".")[0]


def _sur_disque(chemin):
    if not chemin.startswith("/Game/"):
        return False
    base = CONTENT + "/" + chemin[len("/Game/"):]
    return os.path.exists(base + ".uasset") or os.path.exists(base + ".umap")


def _miroir(chemin):
    if chemin.startswith("/Game/") and not chemin.startswith("/Game/Narvos/"):
        return "/Game/Narvos/" + chemin[len("/Game/"):]
    return None


def _classe(chemin):
    try:
        return str(EAL.find_asset_data(chemin).asset_class_path.asset_name)
    except Exception:
        return "?"


def mesurer(racine):
    """Rend (paquets, morts {D: M}, sautes {D: classe}, sans_miroir [D], referents [paquet])."""
    paquets = sorted({_paquet(a) for a in EAL.list_assets(racine, recursive=True, include_folder=False)})
    morts, sautes, sans_miroir, referents = {}, {}, set(), set()
    for p in paquets:
        for d in REG.get_dependencies(p, OPTS) or []:
            d = str(d)
            if not d.startswith("/Game/") or _sur_disque(d):
                continue
            m = _miroir(d)
            if not (m and _sur_disque(m)):
                sans_miroir.add(d)
                continue
            classe = _classe(m)
            if classe not in CIBLES_OK:
                sautes[d] = classe
                continue
            morts[d] = m
            referents.add(p)
    return paquets, morts, sautes, sorted(sans_miroir), sorted(referents)


def _squelettes_des_sk(racine):
    compte = {}
    for p in sorted({_paquet(a) for a in EAL.list_assets(racine, recursive=True, include_folder=False)}):
        if _classe(p) != "SkeletalMesh":
            continue
        sk = unreal.load_asset(p)
        sq = sk.get_editor_property("skeleton") if sk else None
        cle = sq.get_path_name().split(".")[0] if sq else "None"
        compte[cle] = compte.get(cle, 0) + 1
    return compte


def reparer(racine, squelettes_vers_nanos=(), appliquer=False, charger_anims=False):
    """`charger_anims=True` : a l'etape D, charger AUSSI les animations qui
    referencent le squelette. A n'employer que si ce squelette EXISTE (ex. le
    squelette de Freeflow, reste dans le dossier stage non cuit) : une animation
    au squelette mort leve a la duplication comme au chargement."""
    paquets, morts, sautes, sans_miroir, referents = mesurer(racine)
    dire("[MESURE] %s : %d paquet(s), %d referent(s) a rebrancher, %d cible(s) morte(s) a miroir, "
         "%d sautee(s) (animations), %d SANS miroir"
         % (racine, len(paquets), len(referents), len(morts), len(sautes), len(sans_miroir)))
    if not appliquer:
        dire("[MESURE] squelettes des SK : %s" % _squelettes_des_sk(racine))
        dire("[MESURE] rien n'est modifie (appliquer=False).")
        return

    # 0. nettoyer les duplicatas non sauves d'un passage interrompu
    nettoyes = 0
    for d in list(morts) + list(sautes):
        if EAL.does_asset_exist(d) and not _sur_disque(d):
            try:
                if EAL.delete_asset(d):
                    nettoyes += 1
            except Exception as e:
                dire("   nettoyage impossible %s : %s" % (d, str(e)[:80]))
    dire("[0] %d duplicata(s) non sauve(s) supprime(s)" % nettoyes)

    # A. dupliquer chaque miroir a l'ancien chemin
    dupliques, echecs_a = 0, []
    for d, m in sorted(morts.items()):
        if EAL.does_asset_exist(d):
            continue
        try:
            if EAL.duplicate_asset(m, d) is not None:
                dupliques += 1
            else:
                echecs_a.append(d)
        except Exception as e:
            echecs_a.append(d + " (" + str(e)[:60] + ")")
    dire("[A] %d duplicata(s) poses, %d echec(s)" % (dupliques, len(echecs_a)))
    for d in echecs_a[:6]:
        dire("   echec A : " + d)

    # B. charger les referents hors animations
    charges = 0
    for p in referents:
        if _classe(p) in ANIMS:
            continue
        try:
            if unreal.load_asset(p) is not None:
                charges += 1
        except Exception:
            pass
    dire("[B] %d referent(s) charge(s)" % charges)

    # C. consolider chaque duplicata vers son miroir (sauve les referents modifies)
    consolides, echecs_c = 0, []
    for d, m in sorted(morts.items()):
        try:
            cible, source = unreal.load_asset(m), unreal.load_asset(d)
            if cible is not None and source is not None and EAL.consolidate_assets(cible, [source]):
                consolides += 1
            else:
                echecs_c.append(d)
        except Exception as e:
            echecs_c.append(d + " (" + str(e)[:60] + ")")
    dire("[C] %d consolidation(s) vers le miroir, %d echec(s)" % (consolides, len(echecs_c)))
    for d in echecs_c[:6]:
        dire("   echec C : " + d)

    # D. squelettes humains -> squelette nanos
    nanos = unreal.load_asset(NANOS)
    for chemin in squelettes_vers_nanos:
        try:
            sq = unreal.load_asset(chemin)
            if sq is None or nanos is None:
                dire("[D] squelette introuvable : %s" % chemin)
                continue
            refs = [str(r) for r in (REG.get_referencers(chemin, OPTS) or [])]
            for r in refs:
                if _classe(r) in ANIMS and not charger_anims:
                    continue
                try:
                    unreal.load_asset(r)
                except Exception:
                    pass
            ok = EAL.consolidate_assets(nanos, [sq])
            dire("[D] %s -> SKEL_Mannequin : %s (%d referent(s))" % (chemin, "OK" if ok else "ECHEC", len(refs)))
        except Exception as e:
            dire("[D] %s : ERREUR %s" % (chemin, str(e)[:120]))

    unreal.EditorLoadingAndSavingUtils.save_dirty_packages(False, True)

    # E. remesure
    _, morts2, _, sans2, ref2 = mesurer(racine)
    dire("[E] apres : %d referent(s) encore a rebrancher, %d cible(s) a miroir restante(s), %d sans miroir"
         % (len(ref2), len(morts2), len(sans2)))
    dire("[E] squelettes des SK apres : %s" % _squelettes_des_sk(racine))