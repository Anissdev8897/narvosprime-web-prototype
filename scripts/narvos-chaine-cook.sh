#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# narvos-chaine-cook.sh — cuire, inventorier, packager, vérifier.
#
#   bash scripts/narvos-chaine-cook.sh
#
# Sans import : à lancer quand le contenu de l'ADK a été modifié autrement —
# assets copiés à la main, matériaux rebranchés, renommages.
#
# ⚠ UN SEUL UNREAL À LA FOIS. Deux commandlets sur le même projet se marchent
# dessus : l'un verrouille le DDC, l'autre échoue sans le dire clairement.
# ══════════════════════════════════════════════════════════════════════════════

set -u

RACINE="E:/narvosprime-web-prototype"
ADK="$RACINE/WebPortal/Server/adk/NanosWorldADK.uproject"
UE="D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe"
JOURNAL="$RACINE/WebPortal/Server/adk/Saved/Logs/NanosWorldADK.log"
INVENTAIRE="$RACINE/WebPortal/Server/adk/_assets-inventory.json"

horodate() { date +%H:%M:%S; }

# ── REPRISE A L'ETAPE PACK (2026-09-14) ───────────────────────────────────────
#   bash scripts/narvos-chaine-cook.sh --depuis-pack
#
# Le 2026-09-13 a 23:11, le cook (90 228 paquets, « Packages Remain 0 ») et
# l'inventaire etaient FINIS quand le PC s'est eteint pendant la copie du pack :
# destination videe, copie partielle. Recuire deux heures pour recopier des
# fichiers deja cuits n'a aucun sens. Cette option saute COOK et INVENTAIRE,
# mais seulement si la preuve est sur disque : le dernier journal de COOK dit
# « Packages Remain 0 » ET l'inventaire est plus recent que ce journal. Sinon
# elle refuse — reprendre sur un cook mort reecrirait Assets.toml depuis rien.
DEPUIS_PACK=0
APRES_PROMOTION=0
if [ "${1:-}" = "--depuis-pack" ]; then DEPUIS_PACK=1; fi
if [ "${1:-}" = "--apres-promotion" ]; then APRES_PROMOTION=1; fi

if [ ! -f "$UE" ];  then echo "ARRET : UnrealEditor-Cmd introuvable"; exit 1; fi
if [ ! -f "$ADK" ]; then echo "ARRET : projet ADK introuvable"; exit 1; fi

if tasklist 2>/dev/null | grep -qi "UnrealEditor-Cmd"; then
  echo "ARRET : un UnrealEditor tourne deja. Le fermer avant de relancer."
  exit 1
fi

# ⚠ AJOUTE LE 2026-09-13 : un reglage de rendu de l'ADK absent du CLIENT change le
# format des donnees cuites. Trois reglages MetaHuman (index d'os 16 bits,
# influences illimitees) rendaient corps et visage INVISIBLES en jeu, parfaits
# dans l'editeur. On ne cuit pas un pack que le client ne saura pas dessiner.
if ! node "$RACINE/scripts/lua-harness/rendu-client-check.mjs"; then
  echo "ARRET : reglages de rendu ADK != client nanos (voir ci-dessus). Pas de cook."
  exit 1
fi

if [ "$DEPUIS_PACK" -eq 1 ]; then
  # Le journal de cook : le plus recent des journaux du projet qui porte la
  # commande de cook (l'inventaire, lance apres, a pris le nom sans suffixe).
  JOURNAL_COOK=""
  for f in $(ls -t "$RACINE"/WebPortal/Server/adk/Saved/Logs/NanosWorldADK*.log 2>/dev/null); do
    if grep -aq -- "-run=Cook" "$f" 2>/dev/null; then JOURNAL_COOK="$f"; break; fi
  done
  if [ -z "$JOURNAL_COOK" ] || ! grep -aq "Packages Remain 0" "$JOURNAL_COOK"; then
    echo "ARRET : --depuis-pack sans cook FINI sur disque (journal : ${JOURNAL_COOK:-aucun}). Relancer la chaine complete."
    exit 1
  fi
  if [ ! -f "$INVENTAIRE" ] || [ "$INVENTAIRE" -ot "$JOURNAL_COOK" ]; then
    echo "ARRET : --depuis-pack mais l'inventaire est absent ou plus ancien que le cook. Relancer la chaine complete."
    exit 1
  fi
  echo "=== REPRISE A L'ETAPE PACK  $(horodate) ==="
  echo "  cook fini : $(basename "$JOURNAL_COOK") ; inventaire : $(date -r "$INVENTAIRE" +%d/%m\ %H:%M)"
fi

if [ "$DEPUIS_PACK" -eq 0 ] && [ "$APRES_PROMOTION" -eq 0 ]; then
echo "=== COOK  $(horodate) ==="
"$UE" "$ADK" -run=Cook -targetplatform=Windows -unattended -nosplash 2>&1 | tail -4
# ⚠ `| tail` MASQUE le code de sortie du cook : sans PIPESTATUS, les etapes
# suivantes s'executent meme si le cook est mort, et PACK --apply reecrit
# Assets.toml a partir d'un cook partiel. Mesure le 2026-09-06 et le 2026-09-07.
# ⚠ LE CODE DE SORTIE NE DIT PAS SI LE COOK A PLANTE.
# Mesure le 2026-09-07 : un cook peut traiter ses 75 139 paquets, compiler tous
# ses shaders, sortir proprement — et RENDRE 1, parce qu il a compte
# 11 585 erreurs NON FATALES (dont 525 « Content is missing from cook », qui
# sont la consequence directe de nos propres exclusions).
#
# Le vrai signal de completion est « Packages Remain 0 » dans le journal. Un
# cook qui plante s arrete AVANT, sur « Assertion failed ».
COOK_FINI=0
if grep -q "Packages Remain 0" "$JOURNAL" 2>/dev/null; then COOK_FINI=1; fi
if [ "$COOK_FINI" -eq 0 ]; then
  echo "  ARRET : le cook a echoue. Le pack n'est PAS reecrit."
  echo "  Cause probable dans le dernier Saved/Logs/*backup*.log : chercher"
  echo "  la ligne « Zero key hash » JUSTE AVANT l'assertion."
  exit 1
fi
echo "  fin $(horodate)"

echo
echo "=== INVENTAIRE  $(horodate) ==="
# ⚠ `journal()` ecrit par `unreal.log` : la sortie va dans le JOURNAL DU PROJET,
# pas sur stdout. Filtrer stdout ne montrerait rien.
"$UE" "$ADK" -run=pythonscript \
  -script="$RACINE/scripts/adk-dump-assets.py" -unattended -nosplash > /dev/null 2>&1
grep "NARVOS" "$JOURNAL" 2>/dev/null | sed 's/.*\[NARVOS\] /  /' | tail -15
fi  # fin du bloc COOK + INVENTAIRE, saute par --depuis-pack

echo
echo "=== PACK  $(horodate) ==="
# ⚠ LE PACK EST REECRIT SOUS Server/Assets : jamais sous un serveur ou un client
# nanos vivant, qui servirait ou lirait des fichiers a moitie copies. Ajoute le
# 2026-09-13 : la chaine peut tourner des heures, et Hanibes teste pendant ce
# temps la version precedente. On ATTEND sa fermeture (au plus ATTENTE_NANOS_MIN
# minutes), on ne tue rien.
ATTENTE_NANOS_MIN=${ATTENTE_NANOS_MIN:-240}
attente=0
while tasklist 2>/dev/null | grep -qiE "NanosWorldServer|NanosWorld\.exe"; do
  if [ "$attente" -ge "$ATTENTE_NANOS_MIN" ]; then
    echo "  ARRET : nanos tourne encore apres $ATTENTE_NANOS_MIN min — pack NON reecrit (le cook est garde)."
    exit 1
  fi
  [ "$attente" -eq 0 ] && echo "  nanos tourne : attente de sa fermeture avant de reecrire le pack ($(horodate))"
  sleep 60
  attente=$((attente + 1))
done
# ⚠ 2026-09-26 : le builder exige `--staging <identifiant>` — il ne remplace
# PLUS le pack actif (securite anti-ecrasement). L'ancien appel `--apply` seul
# crashait (exit 1) mais le `| tail` masquait le code de sortie : la chaine
# continuait avec un pack PERIME. On construit le staging et on S'ARRETE avec
# les commandes de promotion a lancer explicitement (backup + remplacement).
if [ "$APRES_PROMOTION" -eq 1 ]; then
  echo "  --apres-promotion : le pack actif a deja ete promu. Enchainement direct des generateurs."
else
  STAGING_ID="chaine-$(date +%Y%m%d-%H%M%S)"
  node "$RACINE/scripts/nanos-build-asset-pack.mjs" --apply --staging "$STAGING_ID" 2>&1 | tail -8
  code_pack=${PIPESTATUS[0]}
  if [ "$code_pack" -ne 0 ]; then
    echo "  ARRET : le build du pack a echoue (code $code_pack) — voir ci-dessus. Pack actif INTACT."
    exit 1
  fi
  echo
  echo "  Pack STAGING construit : WebPortal/Server/AssetBuilds/$STAGING_ID/narvos/"
  echo "  PROMOTION MANUELLE (le builder ne remplace plus le pack actif) :"
  echo "    1. Verifier le staging (Assets.toml + comptage + harnais pack-staging-check.mjs)"
  echo "    2. cp WebPortal/Server/Assets/narvos/Assets.toml WebPortal/Server/AssetBackups/$STAGING_ID/"
  echo "    3. Remplacer WebPortal/Server/Assets/narvos/ par le contenu du staging"
  echo "  Puis relancer : bash scripts/narvos-chaine-cook.sh --apres-promotion"
  exit 0
fi

echo
echo "=== CATALOGUE DES PROPS  $(horodate) ==="
# ⚠ APRES le pack, jamais avant : ce script lit `Assets.toml`, que l'etape
# precedente vient de reecrire. Lance en amont, il catalogue le pack PRECEDENT
# et se declare content — nos meshes resteraient cuits et innommables.
node "$RACINE/scripts/narvos-pack-props-to-lua.mjs" --apply 2>&1 | tail -8

# ⚠ AJOUTES LE 2026-09-13 : cette chaine ne lancait que CINQ des NEUF generateurs
# que narvos-verifier-catalogues.mjs sort du verrou d'identite
# (REGENERES_PAR_LA_CHAINE). Spawnables, Animations, ObjetsHyper et Modular
# restaient au pack PRECEDENT — des cles `_N` qui sont des RANGS, decales par la
# moindre promotion — et plus rien ne les gardait. Les scripts de lot les
# lancaient : la liste avait ete recopiee, une copie avait glisse.
# Garde : scripts/lua-harness/chaine-generateurs-check.mjs (lit la liste dans le
# verificateur, exige chaque generateur ICI, apres le pack).
echo
echo "=== SPAWNABLES (mannequins par chemin)  $(horodate) ==="
node "$RACINE/scripts/narvos-spawnables-to-lua.mjs" --apply 2>&1 | tail -6

echo
echo "=== ANIMATIONS  $(horodate) ==="
node "$RACINE/scripts/narvos-anims-to-lua.mjs" --apply 2>&1 | tail -6

echo
echo "=== OBJETS HYPER  $(horodate) ==="
node "$RACINE/scripts/narvos-hyper-to-lua.mjs" --apply 2>&1 | tail -6

echo
echo "=== MODULAIRE ET METAHUMANS (porteur par chemin)  $(horodate) ==="
node "$RACINE/scripts/narvos-modular-to-lua.mjs" --apply 2>&1 | tail -6

echo
echo "=== OBJETS DIVERS (talkie, smartphone, porte a code)  $(horodate) ==="
# Meme regle que les props : APRES le pack. Les cles sont choisies par CHEMIN ;
# lance avant, il relirait le pack precedent.
node "$RACINE/scripts/narvos-objets-divers-to-lua.mjs" --apply 2>&1 | tail -8

echo
echo "=== MINIMAP AKO (widget, bornes, proxies)  $(horodate) ==="
# Par CHEMIN, apres le pack ; PRETE = false tant qu'une piece n'est pas declaree.
node "$RACINE/scripts/narvos-minimap-to-lua.mjs" --apply 2>&1 | tail -8

echo
echo "=== OBJETS INVENTORYSYSTEMPRO  $(horodate) ==="
# Meshes par CHEMIN dans le pack reconstruit ; l'export des Data Assets
# (adk/_isp/*.json) ne change qu'avec une nouvelle session d'editeur.
node "$RACINE/scripts/narvos-isp-to-lua.mjs" --apply 2>&1 | tail -8

echo
echo "=== GESTES DES FAMILLES DE PNJ  $(horodate) ==="
node "$RACINE/scripts/narvos-gestes-to-lua.mjs" --apply 2>&1 | tail -6

echo
echo "=== VERIFICATION  $(horodate) ==="
node "$RACINE/scripts/narvos-verifier-catalogues.mjs" 2>&1 | tail -14

echo
echo "=== MODULES ABSENTS DU CLIENT NANOS  $(horodate) ==="
# ⚠ AJOUTE LE 2026-09-13 : le client a CRASHE a la pose de BP_NarvosMH_M — un Anim
# Blueprint du pack avait un noeud (AnimNode_LiveLinkPose) dont le module n'est pas
# compile dans le client. Declare, present, bon type, imports /Game/ resolus : aucun
# controle ne le voyait. Sortie courte, affichee EN ENTIER (un `tail` a deja cache
# un bilan, feedback_tail_masque_le_bilan). BLOQUANT = crash au chargement.
node "$RACINE/scripts/narvos-modules-client-absents.mjs" 2>&1

echo
echo "=== TERMINE  $(horodate) ==="