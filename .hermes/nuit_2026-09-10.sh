#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# nuit_2026-09-10.sh — promotion de City_Traffic_Pro, puis cook, puis la chaîne.
#
# Le patron dort. Chaque étape VÉRIFIE avant de laisser passer la suivante :
# une étape qui échoue en silence ferait tourner les 3 h suivantes pour rien.
#
# ── POURQUOI LA PROMOTION D'ABORD ─────────────────────────────────────────────
# `Assets.toml` déclare `unreal_folders = ["Narvos"]` : SEUL `Content/Narvos/`
# part dans le pack. `City_Traffic_Pro` est resté à la racine de `Content/` —
# c'est pour ça qu'il est compté **0 fois** dans `Assets.toml` alors que ses
# 587 `.uasset` sont là depuis des semaines. Cuire sans le promouvoir
# reproduirait exactement le même zéro.
#
# ── LES TÉMOINS, ET POURQUOI CEUX-LÀ ──────────────────────────────────────────
#   · promotion : un RECOMPTAGE dans un processus neuf. Le retour de
#     `rename_asset` ment dans les deux sens (41 `False` pour 1 907 arrivées).
#   · cook : « Packages Remain 0 ». Le code de sortie ne dit rien — il peut
#     rendre 1 en ayant tout cuit (11 585 erreurs non fatales attendues).
#   · pack : le compte de clés `City_Traffic_Pro` dans `Assets.toml`, qui doit
#     passer de 0 à non-nul. C'est LA question qu'on pose à cette nuit.
# ══════════════════════════════════════════════════════════════════════════════
set -u

RACINE="E:/narvosprime-web-prototype"
UE="D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe"
ADK="$RACINE/WebPortal/Server/adk/NanosWorldADK.uproject"
JOURNAL="$RACINE/WebPortal/Server/adk/Saved/Logs/NanosWorldADK.log"
TOML="$RACINE/WebPortal/Server/Assets/narvos/Assets.toml"
COOK="$RACINE/.hermes/cook_2026-09-10.log"

dire() { echo "[$(date +%H:%M:%S)] $*"; }

attendre_unreal() {
  # Deux processus Unreal sur le même projet corrompent le registre d'assets.
  for _ in $(seq 1 1080); do
    tasklist 2>/dev/null | grep -qi "UnrealEditor-Cmd" || return 0
    sleep 10
  done
  dire "ARRET : un UnrealEditor-Cmd tourne encore apres 3 h."
  exit 1
}

dire "=== 0. attente d'un Unreal libre"
attendre_unreal

# ── 1. PROMOTION ──────────────────────────────────────────────────────────────
AVANT=$(grep -c "City_Traffic_Pro" "$TOML" 2>/dev/null || echo 0)
dire "=== 1. promotion de City_Traffic_Pro  (cles dans Assets.toml avant : $AVANT)"

# `Demo/` exclu de la PROMOTION, pas seulement du cook : 196 des 290 Mo, dont un
# `.umap` de 124 Mo. Deplacer 196 Mo qui ne seront jamais cuits ne sert a rien,
# et chaque asset deplace est un redirecteur de plus a ecrire.
NARVOS_PACKS="City_Traffic_Pro" NARVOS_EXCLURE="City_Traffic_Pro/Demo" NARVOS_APPLIQUER=1 \
  "$UE" "$ADK" -run=pythonscript \
  -script="$RACINE/scripts/adk-promouvoir-packs.py" \
  -unattended -nosplash -nopause > "$RACINE/.hermes/promotion_ctp.log" 2>&1

grep "NARVOS" "$JOURNAL" 2>/dev/null | sed 's/.*\[NARVOS\] /  /' | tail -20

attendre_unreal

# Recomptage dans un processus NEUF : le seul temoin qui vaille.
PROMUS=$(find "$RACINE/WebPortal/Server/adk/Content/Narvos/City_Traffic_Pro" -name "*.uasset" 2>/dev/null | wc -l)
dire "recomptage : $PROMUS .uasset sous Content/Narvos/City_Traffic_Pro"
if [ "$PROMUS" -lt 100 ]; then
  dire "ARRET : la promotion n'a pas abouti (<100 assets). On NE cuit PAS :"
  dire "  trois heures pour reproduire le meme zero dans Assets.toml."
  exit 1
fi

# ── 2. COOK ───────────────────────────────────────────────────────────────────
dire "=== 2. cook  (~3 h 10 attendues, mesure du 2026-09-09 : 3 h 08 m 52 s)"
# ⚠ Ligne RELEVEE dans le journal du cook du 2026-09-09, pas reconstituee :
#   -run=Cook -targetplatform=Windows -unattended -nosplash
# (`commandline=` en tete de cook_2026-09-09b.log). Ne pas y ajouter de drapeau
# sans raison : c'est la seule invocation dont on sache qu'elle a rendu
# « Packages Remain 0 » sur ce projet.
"$UE" "$ADK" -run=Cook -targetplatform=Windows \
  -unattended -nosplash > "$COOK" 2>&1
dire "le cook a rendu la main"

if grep -qE "Packages Remain 0 " "$COOK"; then
  dire "  TEMOIN OK : Packages Remain 0"
else
  dire "  ARRET : « Packages Remain 0 » ABSENT."
  dire "  On NE reecrit PAS le pack a partir d'un cook partiel : Assets.toml"
  dire "  deviendrait faux et le serveur refuserait des assets pourtant presents."
  grep -oE "Cooked packages [0-9]+ Packages Remain [0-9]+" "$COOK" | tail -1
  exit 1
fi

# ── 3. LA CHAINE ──────────────────────────────────────────────────────────────
attendre_unreal
dire "=== 3. inventaire"
"$UE" "$ADK" -run=pythonscript -script="$RACINE/scripts/adk-dump-assets.py" \
  -unattended -nosplash -nopause > /dev/null 2>&1
grep "NARVOS" "$JOURNAL" 2>/dev/null | sed 's/.*\[NARVOS\] /  /' | tail -8

dire "=== 4. pack"
# ⚠ `--apply` OBLIGATOIRE : sans le drapeau il SIMULE, ecrit « Rien ecrit. » et
# sort en code 0 — Assets.toml resterait perime et la verification signalerait
# des references mortes pour des assets pourtant bien cuits.
node "$RACINE/scripts/nanos-build-asset-pack.mjs" --apply 2>&1 | tail -8

dire "=== 5. catalogues + verification"
node "$RACINE/scripts/narvos-verifier-catalogues.mjs" 2>&1 | tail -6

# ⚠ DEUX DEFAUTS CORRIGES ICI APRES COUP, LE 2026-09-10.
#
# 1. `grep -c ... || echo 0` imprime DEUX lignes quand il n'y a aucune
#    correspondance : `grep -c` sort deja « 0 » ET rend le code 1, donc le `||`
#    ajoute un second « 0 ». Le `[ "$APRES" -gt 0 ]` levait alors
#    « integer expression expected ». `; true` suffit.
#
# 2. Le temoin comptait la CHAINE « City_Traffic_Pro », pas ce qu'on veut savoir.
#    Il a annonce « P1 DEBLOQUE » sur 107 cles dont 88 etaient des `SM_`, les
#    versions STATIQUES des voitures. Une StaticMesh ne conduit pas :
#    `VehicleWheeled` exige un SkeletalMesh avec des os de roues. Le vrai temoin
#    est le nombre de SkeletalMesh sous `Cars/Meshes/Skeletal_Meshes/`.
#    C'est la troisieme fois de la session qu'un temoin mesure autre chose que
#    la question posee.
APRES=$(grep -cE '= "Narvos/City_Traffic_Pro/Cars/Meshes/Skeletal_Meshes/' "$TOML" 2>/dev/null; true)
dire ""
dire "=== VERDICT DE LA NUIT ==="
dire "  SkeletalMesh de voiture declares dans Assets.toml : $APRES  (attendu : 12)"
if [ "${APRES:-0}" -ge 12 ]; then
  dire "  P1 DEBLOQUE cote pack : les 12 voitures PILOTABLES sont cuites et declarees."
  dire "  Reste la question runtime : VehicleWheeled accepte-t-il Car_Skeleton ?"
  dire "  Elle ne se tranche qu'en lancant le serveur."
else
  dire "  ECHEC : toujours 0 cle. Le cook a tourne pour rien sur ce point."
fi

dire "=== 6. batterie"
node "$RACINE/scripts/lua-harness/tout.mjs" 2>&1 | tail -3
dire "=== TERMINE ==="