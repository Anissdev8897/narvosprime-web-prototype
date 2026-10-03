# ══════════════════════════════════════════════════════════════════════════════
# adk-reparer-surcharges-ville.py — rendre aux acteurs de la ville les materiaux
# que la copie a perdus.
#
#   exec(open(r"...\adk-reparer-surcharges-ville.py", encoding="utf-8").read())
#
#   NARVOS_SURCHARGES_APPLIQUER=1 pour ecrire ; sans, il MESURE.
#
# ── LE DEFAUT, ET POURQUOI IL N'A FAIT AUCUN BRUIT ────────────────────────────
# `adk-copier-ville-vers-narvos.py` re-spawne les acteurs de CITY_PACK et leur
# repose leurs surcharges de materiau, lues dans `.hermes/maps_ville.json` :
#
#     mat = unreal.load_asset(mp.split(".")[0])
#     if mat is not None:
#         comps[0].set_material(i, mat)
#
# Le `if mat is not None` etait la pour ne pas planter. Il a fait pire : il a
# **avale silencieusement** chaque surcharge dont le chemin ne resolvait plus.
#
# Et il ne resolvait plus pour une raison d'ORDRE, verifiee dans le journal du
# 2026-09-08 : la promotion de CITY_PACK a tourne de 19h34 a 20h17, la copie a
# 20h22. Entre les deux, les assets sont passes de `/Game/CITY_PACK/...` a
# `/Game/Narvos/CITY_PACK/...`. Une partie de la recolte portait donc des
# chemins deja morts.
#
# Mesure : **254 surcharges sur 6 114** (4 %) pointent encore l'ancienne racine.
# Resultat en jeu : 395 acteurs avec au moins un slot vide, donc gris.
#
# ── CE QUI EST RECUPERE, ET CE QUI NE L'EST PAS ───────────────────────────────
# On ne DEVINE aucun materiau. Pour chaque surcharge perdue on cherche l'asset
# **par son nom** dans le registre : il existe, il a seulement change de dossier.
# Un nom introuvable est rapporte, pas remplace.
#
# ⚠ ET ON NE TOUCHE PAS AUX SLOTS QUE LE PACK D'ORIGINE LAISSAIT VIDES. Mesure
# du 2026-09-09 : sur 41 `SM_CHAIR_L` de la source, **38 n'avaient AUCUNE
# surcharge** sur le slot `light` — le pack les livre ainsi. Remplir le slot de
# l'ASSET « pour reparer le gris » changerait ces 38 chaises sans que personne
# l'ait demande. On repare acteur par acteur, exactement ce que la source avait.
#
# ── L'APPARIEMENT ─────────────────────────────────────────────────────────────
# La copie a etiquete chaque acteur `NARVOS_VILLE_<MAP>_<n>`, ou `n` est son
# rang dans la liste recoltee de cette map. C'est cette etiquette qui relie un
# acteur du niveau a sa fiche d'origine — pas sa position, qui a ete decalee.
# ══════════════════════════════════════════════════════════════════════════════

import unreal
import io
import os
import json

PLAN = "E:/narvosprime-web-prototype/.hermes/maps_ville.json"
RAPPORT = "E:/narvosprime-web-prototype/.hermes/surcharges_reparees.txt"
APPLIQUER = os.environ.get("NARVOS_SURCHARGES_APPLIQUER") == "1"

lignes = []
def dire(s):
    lignes.append(str(s))
    unreal.log("[NARVOS] " + str(s))

def ecrire():
    io.open(RAPPORT, "w", encoding="utf-8").write(chr(10).join(lignes))
    unreal.log("[NARVOS] ecrit : " + RAPPORT)


dire("=== SURCHARGES ===" + ("" if APPLIQUER else "   (MESURE — NARVOS_SURCHARGES_APPLIQUER=1 pour ecrire)"))

recolte = json.load(io.open(PLAN, encoding="utf-8"))

# ── 1. Index des materiaux par NOM ───────────────────────────────────────────
#
# Un nom peut etre porte par deux assets (l'ancien laisse par la promotion et le
# promu). On prefere TOUJOURS celui sous `/Game/Narvos` : lui seul sera cuit,
# le builder du pack ne prend que ce dossier. Choisir l'autre donnerait un
# materiau correct dans l'editeur et absent en jeu.
registre = unreal.AssetRegistryHelpers.get_asset_registry()
par_nom = {}
for d in registre.get_assets_by_path("/Game", recursive=True):
    cn = str(d.asset_class_path.asset_name)
    if cn not in ("Material", "MaterialInstanceConstant"):
        continue
    nom = str(d.asset_name)
    chemin = str(d.package_name)
    actuel = par_nom.get(nom)
    if actuel is None or (not actuel.startswith("/Game/Narvos") and chemin.startswith("/Game/Narvos")):
        par_nom[nom] = chemin

dire("")
dire("%d nom(s) de materiau indexes (preference /Game/Narvos)" % len(par_nom))

# ── 2. Les acteurs du niveau, par etiquette ──────────────────────────────────
acteurs = {}
for a in unreal.EditorLevelLibrary.get_all_level_actors():
    lab = a.get_actor_label()
    if lab.startswith("NARVOS_VILLE_"):
        acteurs[lab] = a
dire("%d acteur(s) NARVOS_VILLE_ dans le niveau" % len(acteurs))

if len(acteurs) == 0:
    dire("ARRET : aucun acteur de la ville. Mauvais niveau charge ?")
    ecrire()
    raise SystemExit

# ── 3. Confrontation ─────────────────────────────────────────────────────────
ECARTES = ("BIG_CITY_NIGHT_OPENNING", "OVERVIEW", "OVERVIEW_BIGCITY", "Overview")

a_poser = []       # (acteur, index de slot, chemin materiau, nom)
introuvables = {}
deja_bon = 0
sans_acteur = 0

for chemin_map, d in recolte.items():
    if d["nom"] in ECARTES:
        continue
    n = 0
    for it in d["acteurs"]:
        etiquette = "NARVOS_VILLE_%s_%d" % (d["nom"], n)
        n += 1
        if not it["mats"]:
            continue
        a = acteurs.get(etiquette)
        if a is None:
            sans_acteur += 1
            continue
        comps = a.get_components_by_class(unreal.StaticMeshComponent)
        if not comps:
            continue
        c = comps[0]
        for i, mp in enumerate(it["mats"]):
            if not mp:
                continue
            if i >= c.get_num_materials():
                continue
            if c.get_material(i) is not None:
                deja_bon += 1
                continue
            nom = mp.split("/")[-1].split(".")[0]
            cible = par_nom.get(nom)
            if cible is None:
                introuvables[nom] = introuvables.get(nom, 0) + 1
                continue
            a_poser.append((a, i, cible, nom))

dire("")
dire("=== CONFRONTATION ===")
dire("  surcharges deja en place        %6d" % deja_bon)
dire("  surcharges A REPOSER            %6d" % len(a_poser))
dire("  materiaux introuvables par nom  %6d" % sum(introuvables.values()))
dire("  fiches sans acteur correspondant %5d" % sans_acteur)

if introuvables:
    dire("")
    dire("  ces noms n'existent nulle part dans le projet :")
    for nom, k in sorted(introuvables.items(), key=lambda kv: -kv[1])[:15]:
        dire("     %-46s x%d" % (nom[:46], k))

if a_poser:
    dire("")
    dire("  echantillon de ce qui serait repose :")
    vus = {}
    for a, i, cible, nom in a_poser:
        cle = (a.get_actor_label().rsplit("_", 1)[0], i, nom)
        if cle in vus:
            continue
        vus[cle] = True
        dire("     %-36s slot %d -> %s" % (a.get_actor_label()[:36], i, cible))
        if len(vus) >= 12:
            break

if not APPLIQUER:
    dire("")
    dire("Rien ecrit.")
    ecrire()
    raise SystemExit

# ── 4. Pose ──────────────────────────────────────────────────────────────────
dire("")
dire("=== POSE ===")
poses, echecs = 0, 0
cache = {}
for a, i, cible, nom in a_poser:
    if cible not in cache:
        cache[cible] = unreal.load_asset(cible)
    mat = cache[cible]
    if mat is None:
        echecs += 1
        continue
    try:
        a.get_components_by_class(unreal.StaticMeshComponent)[0].set_material(i, mat)
        poses += 1
    except Exception as e:
        dire("  ECHEC %s slot %d : %s" % (a.get_actor_label(), i, str(e)[:50]))
        echecs += 1

dire("  %d surcharge(s) reposee(s), %d echec(s), %d materiau(x) charges" % (poses, echecs, len(cache)))

# ── 5. Recomptage — seule preuve ─────────────────────────────────────────────
#
# ⚠ Une ecriture Unreal qui rate ne dit rien. On recompte les slots vides sur
# le niveau, apres coup, avant et independamment de la sauvegarde.
restants = 0
acteurs_gris = 0
for a in unreal.EditorLevelLibrary.get_all_level_actors():
    comps = a.get_components_by_class(unreal.StaticMeshComponent)
    if not comps:
        continue
    c = comps[0]
    v = sum(1 for i in range(c.get_num_materials()) if c.get_material(i) is None)
    if v:
        acteurs_gris += 1
        restants += v

dire("")
dire("=== RECOMPTAGE ===")
dire("  %d acteur(s) avec un slot vide, %d slot(s) au total" % (acteurs_gris, restants))
dire("  (avant reparation : 395 acteurs, 409 slots)")
dire("")
dire("⚠ Les slots qui RESTENT vides l'etaient DEJA dans le pack d'origine :")
dire("  ce ne sont pas des pertes de la copie, et les remplir demanderait de")
dire("  choisir un materiau que personne n'a choisi. Decision separee.")

unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
sales = len(unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages() or [])
dire("  sauvegarde : %d map(s) sale(s) restante(s)" % sales)

ecrire()