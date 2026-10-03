# -*- coding: utf-8 -*-
"""
adk-exporter-datatables.py — exporter en JSON toutes les DataTables d'un
dossier, pour que NOS generateurs Lua puissent les lire. Ne modifie rien.

    NARVOS_DOSSIER=/Game/Hyper \
    UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript \
      -script="<...>/scripts/adk-exporter-datatables.py" \
      -unattended -nosplash -nopause

Ecrit un fichier par table dans `WebPortal/Server/adk/_datatables/<Nom>.json`,
plus un index `_index.json`.

-- POURQUOI ---------------------------------------------------------------------
Hyper Inventory V2 range TOUTES ses donnees dans des DataTables : DT_Items,
DT_Equipment, DT_Ammo, DT_Loot_Lists, DT_VendorTraceLists, DT_Buildables...
(documentation du pack, section « Datatables »). Ses Blueprints de logique
supposent un serveur Unreal ; notre serveur est Lua. Ce qui s'integre a notre
architecture, ce sont ces DONNEES.

-- ⚠ LA STRUCTURE VIENT DE L'EDITEUR, JAMAIS DE LA DOCUMENTATION --------------
Les champs de DT_Items sont montres dans une CAPTURE du PDF, pas en texte. Les
recopier de l'image donnerait un generateur qui lit des champs inventes. On
exporte donc la table telle que l'editeur la voit, et le generateur Lua lit ce
JSON — la structure reelle, pas celle qu'on croit.

-- ⚠ SI UNE TABLE REND VIDE ------------------------------------------------------
Une DataTable dont la STRUCTURE de ligne ne se charge pas (struct Blueprint d'un
pack 5.1 ouvert en 5.7) s'exporte en `[]` sans lever. Le journal du cook du
2026-09-12 porte deja « Missing RowStruct while saving DataTable » 28 fois. Une
table vide est donc SIGNALEE, jamais prise pour une table sans donnees.
"""
import json
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

import unreal

DOSSIER = os.environ.get("NARVOS_DOSSIER", "/Game/Hyper")
SORTIE = os.environ.get(
    "NARVOS_SORTIE",
    "E:/narvosprime-web-prototype/WebPortal/Server/adk/_datatables")

os.makedirs(SORTIE, exist_ok=True)

# ── ⚠ LISTE BLANCHE, PAS BALAYAGE ───────────────────────────────────────────────
# Premiere execution, 2026-09-12 a 22:19 : DT_Ammo exportee, puis le processus
# est MORT sur la table suivante —
#
#     StaticFindFirstObject: Ambiguous object name S_Colour ...
#     Assertion failed: Stack.Top() == EJson::Object  [JsonWriter.h:272]
#
# J'avais accuse `DT_Colourways` (la structure `S_Colour` existe en double, dans
# Hyper et AdvancedARPGCombat). FAUX : le journal ecrit au fil de l'eau a donne la
# vraie table au run suivant — « EN COURS : DT_Buildables ». Une assertion C++ tue
# le processus : aucun `try` Python ne la rattrape.
#
# On n'exporte donc QUE les tables dont nos catalogues ont besoin. Vide, la
# variable garde l'ancien comportement (tout le dossier).
LISTE = [t for t in os.environ.get("NARVOS_TABLES", "").split(",") if t]

# ── LES TABLES QUI ONT DEJA TUE UN RUN ─────────────────────────────────────────
# Si le journal precedent se termine sur « EN COURS : X », le processus est mort
# pendant X. On la note dans `_mortelles.txt` et on la SAUTE : chaque relance
# avance d'au moins une table au lieu de mourir au meme endroit.
MORTELLES_F = os.path.join(SORTIE, "_mortelles.txt")
mortelles = set()
if os.path.isfile(MORTELLES_F):
    with open(MORTELLES_F, encoding="utf-8") as f:
        mortelles = {l.strip() for l in f if l.strip()}
if os.path.isfile(os.path.join(SORTIE, "_journal.txt")):
    with open(os.path.join(SORTIE, "_journal.txt"), encoding="utf-8") as f:
        dernieres = [l.strip() for l in f if l.strip()]
    if dernieres and dernieres[-1].startswith("EN COURS : "):
        mortelles.add(dernieres[-1][len("EN COURS : "):])
        with open(MORTELLES_F, "w", encoding="utf-8") as f:
            f.write("\n".join(sorted(mortelles)))

# Journal ECRIT sur disque, en plus du log : le 2026-09-12, une sonde a tourne
# « avec succes » sans qu'aucune de ses lignes n'apparaisse dans le journal du
# commandlet. Un fichier a nous ne depend pas de la categorie de log.
JOURNAL = os.path.join(SORTIE, "_journal.txt")
_lignes = []


def dire(t):
    print(t)
    unreal.log("[NARVOS] " + t)
    _lignes.append(t)


registre = unreal.AssetRegistryHelpers.get_asset_registry()
registre.scan_paths_synchronous([DOSSIER], True)
registre.wait_for_completion()

donnees = registre.get_assets_by_path(DOSSIER, recursive=True) or []
tables = [d for d in donnees if str(d.asset_class_path.asset_name) == "DataTable"]
if LISTE:
    tables = [d for d in tables if str(d.asset_name) in LISTE]
    absentes = sorted(set(LISTE) - {str(d.asset_name) for d in tables})
    if absentes:
        dire("⚠ tables demandees et INTROUVABLES : %s" % ", ".join(absentes))
if mortelles:
    tables = [d for d in tables if str(d.asset_name) not in mortelles]
    dire("tables SAUTEES (elles ont tue un run precedent) : %s" % ", ".join(sorted(mortelles)))
dire("%d DataTable(s) sous %s" % (len(tables), DOSSIER))

index = []
vides = 0
for d in sorted(tables, key=lambda x: str(x.asset_name)):
    chemin = str(d.package_name)
    nom = str(d.asset_name)

    # ⚠ ECRIT AVANT l'export, pas apres. Une assertion C++ tue le processus sans
    # laisser Python finir : le journal de fin n'est alors jamais ecrit, et on
    # ignore quelle table a tue l'export — exactement la premiere execution.
    with open(JOURNAL, "w", encoding="utf-8") as f:
        f.write("\n".join(_lignes + ["EN COURS : " + nom]))

    table = unreal.EditorAssetLibrary.load_asset(chemin)
    if table is None:
        dire("  ILLISIBLE  %s" % chemin)
        index.append({"nom": nom, "chemin": chemin, "etat": "illisible"})
        continue

    struct = None
    try:
        rs = table.get_editor_property("row_struct")
        struct = rs.get_name() if rs else None
    except Exception:
        struct = None

    # ── COLONNE PAR COLONNE, SANS L'ECRIVAIN JSON D'UNREAL ─────────────────────
    # `export_data_table_to_json_string` passe par FJsonWriter, et c'est lui qui
    # leve `Stack.Top() == EJson::Object` sur certaines structures Blueprint d'un
    # pack 5.1. Lire chaque colonne en CHAINES ne passe pas par lui. On perd le
    # typage fin (tout arrive en texte) ; le generateur Lua convertit ce qu'il
    # lit, et c'est un prix bien plus bas qu'un processus mort.
    try:
        DTL = unreal.DataTableFunctionLibrary
        noms_lignes = [str(n) for n in (DTL.get_data_table_row_names(table) or [])]
        colonnes = [str(c) for c in (DTL.get_data_table_column_names(table) or [])]
        valeurs = {}
        for c in colonnes:
            valeurs[c] = list(DTL.get_data_table_column_as_string(table, c) or [])
        lignes = []
        for i, nl in enumerate(noms_lignes):
            ligne = {"Name": nl}
            for c in colonnes:
                col = valeurs.get(c) or []
                ligne[c] = col[i] if i < len(col) else None
            lignes.append(ligne)
        brut = json.dumps(lignes, ensure_ascii=False)
    except Exception as err:
        dire("  EXPORT REFUSE  %s : %s" % (nom, err))
        index.append({"nom": nom, "chemin": chemin, "etat": "export refuse", "struct": struct})
        continue

    n = len(lignes) if isinstance(lignes, list) else 0
    etat = "ok" if n > 0 else "VIDE"
    if n == 0:
        vides += 1

    with open(os.path.join(SORTIE, nom + ".json"), "w", encoding="utf-8") as f:
        f.write(brut or "[]")

    champs = sorted(lignes[0].keys()) if n > 0 and isinstance(lignes[0], dict) else []
    dire("  %-5s %-32s %4d ligne(s)  struct=%s" % (etat, nom, n, struct))
    if champs:
        dire("        champs : %s" % ", ".join(champs[:24]))
    index.append({"nom": nom, "chemin": chemin, "etat": etat, "lignes": n,
                  "struct": struct, "champs": champs})

with open(os.path.join(SORTIE, "_index.json"), "w", encoding="utf-8") as f:
    json.dump(index, f, ensure_ascii=False, indent=1)

dire("")
dire("%d table(s) exportee(s), %d VIDE(S)." % (len(index), vides))
if vides:
    dire("⚠ Une table vide n'est pas une table sans donnees : sa structure de ligne")
    dire("  ne s'est peut-etre pas chargee (struct Blueprint d'un pack 5.1).")

with open(JOURNAL, "w", encoding="utf-8") as f:
    f.write("\n".join(_lignes))