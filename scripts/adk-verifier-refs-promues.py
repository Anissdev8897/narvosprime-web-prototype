# ══════════════════════════════════════════════════════════════════════════════
# adk-verifier-refs-promues.py — un asset promu sous `Narvos/` pointe-t-il
# encore l'ANCIEN chemin ?
#
#   NARVOS_ANCIENS=/Game/Defender,/Game/SmartLocomotion \
#   UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript -script="…"
#
# ⚠ EDITEUR FERME. Sortie dans `Saved/Logs/NanosWorldADK.log`, pas sur stdout.
#
# ── POURQUOI ──────────────────────────────────────────────────────────────────
# `rename_asset` reecrit les referents CHARGES et laisse un redirecteur a
# l'ancienne place. Les redirecteurs restes hors de `Narvos/` ne sont pas cuits
# (`unreal_folders = ["Narvos"]`) : un asset promu qui passerait encore par eux
# aurait, en jeu, une reference vers du VIDE — un mesh gris ou absent, sans la
# moindre erreur au cook.
#
# La resorption automatique a echoue le 2026-09-06 : `AssetData.get_asset()`
# sur un ObjectRedirector rend la CIBLE, pas le redirecteur, et
# `fixup_referencers` a leve (commandlet « result -1 »). D'ou ce controle
# separe : mesurer d'abord s'il y a un probleme, avant d'ecrire quoi que ce soit.
# ══════════════════════════════════════════════════════════════════════════════

import os

import unreal


def chemin_unreal(p):
    p = p.replace("\\", "/").strip().strip("/")
    i = ("/" + p).find("/Game/")
    if i > 0:
        return ("/" + p)[i:]
    return "/" + p if p.startswith("Game/") else "/Game/" + p


RACINE = "/Game/Narvos"
ANCIENS = [chemin_unreal(p) for p in os.environ.get("NARVOS_ANCIENS", "").split(",") if p.strip()]


def journal(m):
    unreal.log("[NARVOS] " + m)


if not ANCIENS:
    journal("ARRET : NARVOS_ANCIENS est vide")
    raise SystemExit(0)

registre = unreal.AssetRegistryHelpers.get_asset_registry()
registre.search_all_assets(True)

journal("anciens chemins surveilles : %s" % ", ".join(ANCIENS))
journal("")

# Redirecteurs restes en place, par chemin.
for ancien in ANCIENS:
    n = 0
    for d in registre.get_assets_by_path(ancien, recursive=True):
        if str(d.asset_class_path.asset_name) == "ObjectRedirector":
            n += 1
    journal("%-28s %d redirecteur(s) restant(s)" % (ancien, n))

journal("")
journal("=== dependances de Narvos/ vers les anciens chemins")

coupables = []
for d in registre.get_assets_by_path(RACINE, recursive=True):
    paquet = str(d.package_name)
    try:
        deps = registre.get_dependencies(paquet) or []
    except Exception:
        continue
    for dep in deps:
        s = str(dep)
        if any(s.startswith(a + "/") for a in ANCIENS):
            coupables.append((paquet, s))
            break

journal("%d asset(s) promu(s) pointent encore l'ancien chemin" % len(coupables))
for paquet, dep in coupables[:40]:
    journal("  %s" % paquet)
    journal("      -> %s" % dep)
if len(coupables) > 40:
    journal("  … et %d autre(s)" % (len(coupables) - 40))

journal("")
if coupables:
    journal("⚠ Ces references sortiront VIDES en jeu : leur cible n'est pas sous")
    journal("   Narvos/, donc pas cuite. A reparer avant de cuire.")
else:
    journal("Aucune. Les redirecteurs restants ne sont references que depuis")
    journal("l'exterieur de Narvos/ — ils ne partiront pas au cook, sans effet.")