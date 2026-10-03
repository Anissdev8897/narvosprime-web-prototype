# -*- coding: utf-8 -*-
"""
adk-sonder-bp-metacustom.py — que peut-on APPELER dans les Blueprints du Meta
Customization System ? Ne modifie rien.

    python scripts/ue-remote.py --fichier scripts/adk-sonder-bp-metacustom.py

── POURQUOI CETTE SONDE ──────────────────────────────────────────────────────
Mesuré le 2026-09-12 :

  · `Blueprint:CallBlueprintEvent(nom, ...)` est d'autorité BOTH côté nanos
    (libraries/api-main/Stable/Classes/Blueprint.json) — le SERVEUR peut donc
    déclencher la logique d'un Blueprint Unreal ;
  · les Blueprints du Meta Customization System sont cuits ET déclarés dans
    Assets.toml depuis la correction du builder (BP_Meta_Styler,
    BP_Meta_Body_Tool, BP_Meta_Face_Tool, BP_Gender_Changer, BP_Playable_MH…).

Il manque UNE chose pour brancher le système maître au lieu de le porter : le
NOM des événements et des variables qu'il expose. `CallBlueprintEvent` sur un
nom faux ne lève rien côté Lua — c'est le mode d'échec le plus cher de ce
projet. On lit donc ce que la classe expose, au lieu de le deviner.

── MÉTHODE ───────────────────────────────────────────────────────────────────
UE expose les fonctions Blueprint sur l'objet par défaut de la classe générée.
On liste donc `dir(CDO)` et on SOUSTRAIT ce que porte déjà un Actor nu : ce qui
reste appartient au Blueprint. C'est une mesure, pas une supposition.
"""
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

import unreal

BPS = [
    "/Game/Narvos/MetaCustom/Meta_Styler/Bluepritns/BP_Meta_Styler",
    "/Game/Narvos/MetaCustom/Meta_Body_Tool/Blueprints/BP_Meta_Body_Tool",
    "/Game/Narvos/MetaCustom/Meta_Face_Tool/Blueprints/BP_Meta_Face_Tool",
    "/Game/Narvos/MetaCustom/Meta_Styler/Bluepritns/BP_Gender_Changer",
    "/Game/Narvos/MetaCustom/Premade_Blueprints/BP_Playable_MH",
    "/Game/Narvos/MetaCustom/Premade_Blueprints/BP_MH_Male_Playable",
    "/Game/Narvos/MetaCustom/Premade_Blueprints/BP_MH_Playable_Female1",
    "/Game/Narvos/MetaCustom/Premade_Blueprints/BP_RPG_MH_Male",
]


def dire(t):
    print(t)
    unreal.log("[NARVOS] " + t)


# Référence : ce que porte un Actor nu. Tout ce qui dépasse vient du Blueprint.
base = set(dir(unreal.get_default_object(unreal.Actor)))
base |= set(dir(unreal.get_default_object(unreal.Pawn)))
try:
    base |= set(dir(unreal.get_default_object(unreal.Character)))
except Exception:
    pass

sous_systeme = None
try:
    sous_systeme = unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem)
except Exception as err:
    dire("SubobjectDataSubsystem indisponible : %s" % err)

for chemin in BPS:
    dire("")
    dire("=" * 78)
    bp = unreal.EditorAssetLibrary.load_asset(chemin)
    if bp is None:
        dire("ABSENT : " + chemin)
        continue

    nom = chemin.rsplit("/", 1)[-1]
    dire(nom)

    # ── La classe générée et son objet par défaut ─────────────────────────────
    cls = None
    try:
        cls = unreal.load_class(None, chemin + "." + nom + "_C")
    except Exception as err:
        dire("  classe générée illisible : %s" % err)
    if cls is None:
        continue

    try:
        dire("  parent : %s" % unreal.get_default_object(cls).get_class().get_name())
    except Exception:
        pass

    cdo = None
    try:
        cdo = unreal.get_default_object(cls)
    except Exception as err:
        dire("  CDO illisible : %s" % err)

    if cdo is not None:
        propres = sorted(n for n in dir(cdo) if not n.startswith("_") and n not in base)
        fonctions = [n for n in propres if callable(getattr(cdo, n, None))]
        variables = [n for n in propres if not callable(getattr(cdo, n, None))]
        dire("  %d fonction(s)/événement(s) propres :" % len(fonctions))
        for f in fonctions:
            dire("      %s" % f)
        dire("  %d variable(s) propre(s) :" % len(variables))
        for v in variables[:40]:
            dire("      %s" % v)

    # ── Les composants du Blueprint ──────────────────────────────────────────
    if sous_systeme is not None:
        try:
            handles = sous_systeme.k2_gather_subobject_data_for_blueprint(bp)
            noms = []
            for h in handles:
                obj = unreal.SubobjectDataBlueprintFunctionLibrary.get_object(
                    unreal.SubobjectDataBlueprintFunctionLibrary.get_data(h))
                if obj is not None:
                    noms.append("%s (%s)" % (obj.get_name(), obj.get_class().get_name()))
            dire("  %d composant(s) : %s" % (len(noms), ", ".join(noms)))
        except Exception as err:
            dire("  composants illisibles : %s" % err)

dire("")
dire("Fin de sonde — rien n'a été modifié.")