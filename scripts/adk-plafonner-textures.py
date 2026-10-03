# -*- coding: utf-8 -*-
"""
adk-plafonner-textures.py — plafonner la taille CUITE des textures d'un dossier.
Ne touche pas aux fichiers source.

    NARVOS_DOSSIER=/Game/CraftingStations \
    NARVOS_MAX=1024 NARVOS_MAX_ICONES=256 NARVOS_APPLIQUER=1 \
    python scripts/ue-remote.py --fichier scripts/adk-plafonner-textures.py

⚠ JAMAIS EXÉCUTÉ (écrit le 2026-09-12, éditeur fermé). Essai par défaut :
sans `NARVOS_APPLIQUER=1`, il compte et n'écrit rien.

── POURQUOI ─────────────────────────────────────────────────────────────────
Mesuré sur « Survival Crafting Stations » : 264 textures pèsent **4,2 Go** des
4,4 Go du pack. 138 dépassent 16 Mo, la plus lourde fait 48 Mo, et les 31 icônes
d'interface pèsent 66 Mo à elles seules.

Le pack nanos que le client télécharge fait déjà 71 Go. Embarquer 4,2 Go pour
31 stations d'artisanat serait payer le prix d'un monde pour un meuble.

`max_texture_size` est exactement le bon levier : il plafonne ce que le COOK
écrit, sans retoucher la source ni le matériau. Une texture de 4 096 ramenée à
1 024 pèse seize fois moins.

── ⚠ CE QUI DÉCIDE DU PLAFOND ───────────────────────────────────────────────
Une station se regarde à deux mètres : 1 024 suffit. Une icône d'interface se
regarde à 64 pixels : 256 est déjà généreux. Ces deux valeurs sont des réglages,
pas une vérité — elles se changent ici, et le cook suivant les applique.

── ⚠ UNE ÉCRITURE UNREAL QUI RATE NE DIT RIEN ───────────────────────────────
`save_asset` a `only_if_is_dirty=True` par défaut : il rend « True » sans rien
écrire. On force donc l'écriture et on RECOMPTE à la fin.
"""
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

import unreal

DOSSIER = os.environ.get("NARVOS_DOSSIER", "/Game/CraftingStations")
MAX = int(os.environ.get("NARVOS_MAX", "1024"))
MAX_ICONES = int(os.environ.get("NARVOS_MAX_ICONES", "256"))
MOTIF_ICONES = os.environ.get("NARVOS_MOTIF_ICONES", "/Icons/")
APPLIQUER = os.environ.get("NARVOS_APPLIQUER") == "1"


def dire(t):
    print(t)
    unreal.log("[NARVOS] " + t)


registre = unreal.AssetRegistryHelpers.get_asset_registry()
donnees = registre.get_assets_by_path(DOSSIER, recursive=True) or []
textures = [d for d in donnees
            if str(d.asset_class_path.asset_name) in ("Texture2D", "TextureCube")]

dire("%d texture(s) sous %s" % (len(textures), DOSSIER))
dire("plafond : %d  (icones : %d, motif « %s »)" % (MAX, MAX_ICONES, MOTIF_ICONES))
if not APPLIQUER:
    dire("ESSAI — NARVOS_APPLIQUER=1 pour ecrire")

poses, deja, refus = 0, 0, 0
for d in sorted(textures, key=lambda x: str(x.asset_name)):
    chemin = str(d.package_name)
    tex = unreal.EditorAssetLibrary.load_asset(chemin)
    if tex is None:
        refus += 1
        continue

    vise = MAX_ICONES if MOTIF_ICONES in chemin else MAX
    try:
        actuel = int(tex.get_editor_property("max_texture_size") or 0)
    except Exception as err:
        dire("  illisible : %s — %s" % (chemin, err))
        refus += 1
        continue

    if actuel == vise:
        deja += 1
        continue

    if not APPLIQUER:
        poses += 1
        continue

    try:
        tex.set_editor_property("max_texture_size", vise)
        # only_if_is_dirty=False : sinon l'ecriture est annoncee et n'a pas lieu.
        unreal.EditorAssetLibrary.save_asset(chemin, only_if_is_dirty=False)
        poses += 1
    except Exception as err:
        dire("  refus : %s — %s" % (chemin, err))
        refus += 1

dire("")
dire("=== BILAN ===")
dire("  plafond %s : %d" % ("pose" if APPLIQUER else "a poser", poses))
dire("  deja au plafond : %d" % deja)
dire("  refus / illisibles : %d" % refus)

# ── LE SEUL CONTROLE QUI VAUT : un recomptage APRES ecriture ─────────────────
if APPLIQUER:
    restants = 0
    for d in textures:
        tex = unreal.EditorAssetLibrary.load_asset(str(d.package_name))
        if tex is None:
            continue
        vise = MAX_ICONES if MOTIF_ICONES in str(d.package_name) else MAX
        try:
            if int(tex.get_editor_property("max_texture_size") or 0) != vise:
                restants += 1
        except Exception:
            restants += 1
    dire("  recomptage : %d texture(s) encore HORS plafond" % restants)
    if restants:
        dire("  ⚠ l'ecriture n'a pas pris pour toutes — ne pas cuire avant d'avoir compris")