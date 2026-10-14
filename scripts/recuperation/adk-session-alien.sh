#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# adk-session-alien.sh — rebatit Map_Alien (le monde « Azur ») et la monte dans Map_Narvos,
# puis PROUVE sur le disque que rien d'autre n'a bouge.
#
#   bash scripts/recuperation/adk-session-alien.sh
#
# 1. copie la carte d'exemple du pack MW Landscape depuis le cache d'Epic (C:, hors du disque
#    perdu) a la place qu'elle avait dans l'ADK avant son renommage du 06/09 ;
# 2. garde une copie de Map_Narvos ;
# 3. lance adk-session-alien.py (editeur complet : renommer, oter le ciel, deplacer le
#    terrain, prouver le sol, sauver, monter dans Map_Narvos) ;
# 4. relit : Map_Alien ecrite, carte d'exemple disparue, sous-niveaux survivants INCHANGES
#    (sha256 de la sauvegarde du 04/10).
#
# Rejouable : une Map_Alien deja la n'est pas refaite, elle est seulement montee si elle ne
# l'est pas.
# ══════════════════════════════════════════════════════════════════════════════
set -u -o pipefail
RACINE="E:/narvosprime-web-prototype"
ADK="$RACINE/WebPortal/Server/adk"
CARTES="$ADK/Content/Narvos/Maps"
EXEMPLE="LandscapeAutoMaterial_Island_Example.umap"
DEPOT_EXEMPLE="$ADK/Content/Narvos/MWLandscapeAutoMaterial/Maps"
SAUVEGARDE="$ADK/_sauvegardes/maps-avant-sessions-monde-2026-10-04"
cd "$RACINE" || exit 1

if [ -f "$CARTES/Map_Alien.umap" ]; then
  echo "Map_Alien.umap existe deja : la session ne fera que la monter si besoin."
elif [ ! -f "$DEPOT_EXEMPLE/$EXEMPLE" ]; then
  source_cache=$(ls -d "C:/ProgramData/Epic/EpicGamesLauncher/VaultCache"/MWLandsc*/data/Content/MWLandscapeAutoMaterial/Maps/"$EXEMPLE" 2>/dev/null | head -1)
  [ -n "$source_cache" ] || { echo "ARRET : carte d'exemple introuvable dans le cache d'Epic."; exit 1; }
  # Un paquet Unreal commence par C1 83 2A 9E : nom et taille justes ne prouvent pas le contenu.
  [ "$(head -c 4 "$source_cache" | od -An -tx1 | tr -d ' \n')" = "c1832a9e" ] || { echo "ARRET : $source_cache n'est pas un paquet Unreal."; exit 1; }
  mkdir -p "$DEPOT_EXEMPLE"
  cp -p "$source_cache" "$DEPOT_EXEMPLE/$EXEMPLE" || exit 1
  echo "carte d'exemple copiee du cache d'Epic : $(stat -c %s "$DEPOT_EXEMPLE/$EXEMPLE") octets"
fi
[ -f "$SAUVEGARDE/Map_Narvos.avant-alien.umap" ] || cp -p "$CARTES/Map_Narvos.umap" "$SAUVEGARDE/Map_Narvos.avant-alien.umap"

NARVOS_DELAI_MIN="${NARVOS_DELAI_MIN:-60}" bash scripts/recuperation/adk-session.sh recuperation/adk-session-alien.py || exit 1

echo "=== preuves, relues sur le disque"
code=0
if [ -f "$CARTES/Map_Alien.umap" ]; then
  echo "    Map_Alien.umap : $(stat -c %s "$CARTES/Map_Alien.umap") octets"
else
  echo "    Map_Alien.umap ABSENTE"; code=1
fi
if [ -f "$DEPOT_EXEMPLE/$EXEMPLE" ]; then
  echo "    la carte d'exemple est ENCORE sous MWLandscapeAutoMaterial/Maps : elle repartirait dans le pack"; code=1
fi
# Les survivants du disque : la session ne devait en reecrire aucun.
( cd "$CARTES" && grep -v "Content/" "$SAUVEGARDE/sha256.txt" | sha256sum -c --quiet 2>&1 | sed 's/^/    /' ) || code=1
( cd "$ADK" && grep "Content/" "$SAUVEGARDE/sha256.txt" | sha256sum -c --quiet 2>&1 | sed 's/^/    /' ) || code=1
[ "$code" -eq 0 ] && echo "    sous-niveaux survivants : inchanges (sha256)"
echo "=== verdict : $([ "$code" -eq 0 ] && echo "Map_Alien rebatie et montee — a sonder : adk-session.sh recuperation/adk-sonder-monde.py" || echo "A LIRE — une preuve manque (voir ci-dessus)")"
exit "$code"
