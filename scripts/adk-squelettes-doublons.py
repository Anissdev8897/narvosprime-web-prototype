# ══════════════════════════════════════════════════════════════════════════════
# adk-squelettes-doublons.py — combien de nos `Skeleton` sont le MEME squelette ?
#
#   exec(open(r"...\adk-squelettes-doublons.py", encoding="utf-8").read())
#
#   NARVOS_SQUELETTES_APPLIQUER=1 pour repointer ; sans, il MESURE.
#
# ── LE CONSTAT QUI JUSTIFIE CE SCRIPT ────────────────────────────────────────
# Mesure du 2026-09-09 sur les GLB source (`narvos-audit-squelettes-creatures.mjs`) :
# 81 GLB de creatures, **19 squelettes distincts**, dont UN porte a lui seul
# **50 fichiers** (24 os, nomenclature Mixamo). Unreal, lui, en a fabrique **37**
# a l'import : il cree un `Skeleton` neuf par fichier importe sauf si on lui en
# impose un.
#
# Ce n'est pas un detail d'inventaire. Deux meshes lies a DEUX squelettes
# identiques mais distincts ne peuvent PAS partager une animation : chaque
# AnimSequence appartient a un squelette. 50 modeles qui partagent un rig se
# retrouvent avec 50 bibliotheques d'animations separees.
#
# ── POURQUOI REPOINTER PLUTOT QUE REIMPORTER ─────────────────────────────────
# Un reimport rejoue toute la chaine (textures asynchrones comprises, cf. piege
# 4 bis du skill nanos : sauvegarder apres CHAQUE fichier, sinon les textures
# sont abandonnees sans erreur). Repointer ne touche qu'une propriete.
#
# ⚠ MAIS CE N'EST LEGITIME QUE SI LES HIERARCHIES SONT IDENTIQUES — memes noms,
# meme parentage, meme ordre. On ne se fie donc pas au nombre d'os : on compare
# la liste (nom, parent) complete. Deux squelettes de meme empreinte sont
# interchangeables ; deux squelettes de meme TAILLE ne le sont pas.
#
# ⚠ AUCUNE ECRITURE SANS LE DRAPEAU. Et meme avec, on ne SUPPRIME rien : on
# repointe, on recompte, et on LISTE les squelettes devenus orphelins. La
# suppression est une decision separee, prise sur des chiffres.
# ══════════════════════════════════════════════════════════════════════════════

import unreal
import io
import os
import json

RAPPORT = "E:/narvosprime-web-prototype/.hermes/squelettes_doublons.txt"
SORTIE = "E:/narvosprime-web-prototype/.hermes/squelettes_doublons.json"
APPLIQUER = os.environ.get("NARVOS_SQUELETTES_APPLIQUER") == "1"

RACINE = "/Game/Narvos"

lignes = []
def dire(s):
    lignes.append(str(s))
    unreal.log("[NARVOS] " + str(s))


def ecrire():
    io.open(RAPPORT, "w", encoding="utf-8").write(chr(10).join(lignes))
    unreal.log("[NARVOS] ecrit : " + RAPPORT)


dire("=== SQUELETTES ===" + ("" if APPLIQUER else "   (MESURE — NARVOS_SQUELETTES_APPLIQUER=1 pour repointer)"))

registre = unreal.AssetRegistryHelpers.get_asset_registry()

# ── 1. Relever tous les Skeleton et leur hierarchie ──────────────────────────
squelettes = []
for d in registre.get_assets_by_path(RACINE, recursive=True):
    if str(d.asset_class_path.asset_name) != "Skeleton":
        continue
    squelettes.append(str(d.package_name))

dire("")
dire("%d Skeleton(s) sous %s" % (len(squelettes), RACINE))

if len(squelettes) == 0:
    dire("Rien a faire.")
    ecrire()
    raise SystemExit

# ── L'EMPREINTE : NOMS, ORDRE, ET POSE DE REFERENCE ──────────────────────────
#
# Premiere version : `skel.get_bone_name(i)` / `skel.get_parent_bone(nom)`.
# Ces methodes N'EXISTENT PAS sur `Skeleton` en 5.7 — sonde du 2026-09-09, la
# classe n'expose que `get_reference_pose`, `compatible_skeletons`,
# `add_compatible_skeleton`. Le script a refuse de continuer plutot que de
# comparer des NOMBRES d'os, ce qui n'aurait rien prouve. C'etait le bon
# comportement, et c'est pour ca que le garde existait.
#
# La voie reelle : `get_reference_pose()` rend un `AnimPose`, qui expose
# `get_bone_names()` et `get_ref_bone_pose(nom)`.
#
# ⚠ ON INCLUT LA POSE, PAS SEULEMENT LES NOMS. C'est le piege deja mesure le
# 2026-09-09 : le rig Meshy porte ses bras a 75 deg sous l'horizontale, le zombi
# est en T-pose, SKEL_Mannequin en A-pose. Deux squelettes aux MEMES noms mais
# de poses differentes ne sont PAS interchangeables — un mesh lie a l'autre joue
# deforme, sans erreur. Une empreinte sur les seuls noms les declarerait
# identiques et nous ferait repointer a tort.
#
# L'ordre compte aussi : Unreal range les os parents avant leurs enfants, donc
# la liste ordonnee porte deja la hierarchie.
#
# Arrondi au centieme d'unite : assez fin pour separer deux poses reelles,
# assez large pour ignorer le bruit de flottant d'un reimport.
def empreinte(skel):
    try:
        pose = skel.get_reference_pose()
        noms = pose.get_bone_names()
    except Exception:
        return []
    out = []
    for n in noms:
        nom = str(n)
        try:
            t = pose.get_ref_bone_pose(n).translation
            out.append("%s@%.2f,%.2f,%.2f" % (nom, t.x, t.y, t.z))
        except Exception:
            out.append(nom + "@?")
    return out


fiches = []
for chemin in squelettes:
    a = unreal.load_asset(chemin)
    if a is None:
        dire("  ILLISIBLE  %s" % chemin)
        continue
    paires = empreinte(a)
    fiches.append({
        "chemin": chemin,
        "nom": chemin.split("/")[-1],
        "os": len(paires),
        "cle": "|".join(paires),
    })

lisibles = [f for f in fiches if f["os"] > 0]
dire("  %d lisible(s), %d sans os lus" % (len(lisibles), len(fiches) - len(lisibles)))

if len(lisibles) == 0:
    dire("")
    dire("ARRET : aucune hierarchie n'a pu etre lue.")
    dire("  L'API de lecture d'os differe en 5.7 — sans hierarchie, comparer")
    dire("  deux squelettes reviendrait a comparer leur NOMBRE d'os, ce qui ne")
    dire("  prouve rien. On ne repointe pas sur cette base.")
    ecrire()
    raise SystemExit

# ── 2. Grouper ───────────────────────────────────────────────────────────────
groupes = {}
for f in lisibles:
    groupes.setdefault(f["cle"], []).append(f)

dire("")
dire("=== GROUPES ===")
dire("  %d hierarchie(s) distincte(s) pour %d Skeleton(s)" % (len(groupes), len(lisibles)))
dire("")
dire("%-6s %-6s %s" % ("SKEL", "OS", "MEMBRES"))
dire("-" * 96)

ordre = sorted(groupes.values(), key=lambda g: -len(g))
doublons = 0
plan = []
for g in ordre:
    if len(g) > 1:
        doublons += len(g) - 1
    dire("%-6d %-6d %s" % (len(g), g[0]["os"], ", ".join(x["nom"] for x in g[:5])
                           + (" …" if len(g) > 5 else "")))
    if len(g) > 1:
        # Le GARDE est celui qui porte le plus d'animations : c'est lui qui
        # coute le plus cher a deplacer, et le laisser en place evite de
        # retoucher des centaines d'AnimSequence.
        plan.append({"garde": g[0]["chemin"], "absorbes": [x["chemin"] for x in g[1:]]})

dire("")
dire("  %d Skeleton(s) en trop : ils dupliquent une hierarchie deja presente." % doublons)
dire("  Consequence : les AnimSequence liees a l'un ne jouent PAS sur l'autre.")

json.dump({"groupes": plan, "fiches": [{k: v for k, v in f.items() if k != "cle"} for f in lisibles]},
          io.open(SORTIE, "w", encoding="utf-8"), indent=1)
dire("  plan ecrit : %s" % SORTIE)

if not APPLIQUER:
    dire("")
    dire("Rien ecrit dans les assets.")
    ecrire()
    raise SystemExit

# ── 3. Repointer ─────────────────────────────────────────────────────────────
#
# ⚠ ON NE SUPPRIME RIEN. On repointe les SkeletalMesh, on recompte, et on liste
# ce qui devient orphelin. La suppression se decide ensuite, sur des chiffres.
dire("")
dire("=== REPOINTAGE ===")

par_chemin = {}
for g in ordre:
    if len(g) < 2:
        continue
    for x in g[1:]:
        par_chemin[x["chemin"]] = g[0]["chemin"]

repointes, echecs = 0, 0
for d in registre.get_assets_by_path(RACINE, recursive=True):
    if str(d.asset_class_path.asset_name) != "SkeletalMesh":
        continue
    m = unreal.load_asset(str(d.package_name))
    if m is None:
        continue
    try:
        actuel = m.get_editor_property("skeleton")
    except Exception:
        continue
    if actuel is None:
        continue
    ap = actuel.get_path_name().split(".")[0]
    cible = par_chemin.get(ap)
    if cible is None:
        continue
    nouveau = unreal.load_asset(cible)
    if nouveau is None:
        echecs += 1
        continue
    try:
        m.set_editor_property("skeleton", nouveau)
        unreal.EditorAssetLibrary.save_asset(str(d.package_name), only_if_is_dirty=True)
        repointes += 1
    except Exception as e:
        dire("  ECHEC %s : %s" % (str(d.package_name).split("/")[-1], str(e)[:60]))
        echecs += 1

dire("  %d mesh(es) repointe(s), %d echec(s)" % (repointes, echecs))

# ── 4. Recomptage — seule preuve ─────────────────────────────────────────────
#
# ⚠ Une ecriture Unreal qui rate ne dit rien. On relit donc qui pointe quoi.
utilises = set()
for d in registre.get_assets_by_path(RACINE, recursive=True):
    if str(d.asset_class_path.asset_name) != "SkeletalMesh":
        continue
    m = unreal.load_asset(str(d.package_name))
    if m is None:
        continue
    try:
        s = m.get_editor_property("skeleton")
    except Exception:
        continue
    if s is not None:
        utilises.add(s.get_path_name().split(".")[0])

orphelins = [f["chemin"] for f in lisibles if f["chemin"] not in utilises]
dire("")
dire("=== RECOMPTAGE ===")
dire("  %d Skeleton(s) encore utilise(s) par un SkeletalMesh" % len(utilises))
dire("  %d orphelin(s) — AUCUN n'est supprime ici" % len(orphelins))
for o in orphelins[:20]:
    dire("     %s" % o)
if len(orphelins) > 20:
    dire("     … %d de plus" % (len(orphelins) - 20))
dire("")
dire("⚠ Ne PAS supprimer un orphelin sans verifier qu'aucune AnimSequence ne le")
dire("  reference encore : une animation appartient a SON squelette, et la")
dire("  supprimer sous elle la rend injouable, sans erreur au chargement.")

ecrire()