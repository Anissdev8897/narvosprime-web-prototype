#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# narvos-lancer-serveur.sh — vérifier PUIS lancer le serveur nanos sur Map_Narvos.
#
#   bash scripts/narvos-lancer-serveur.sh            # vérifie et lance
#   bash scripts/narvos-lancer-serveur.sh --verifier  # vérifie seulement
#
# ── POURQUOI CE SCRIPT EXISTE ─────────────────────────────────────────────────
# Le serveur n'a JAMAIS été lancé sur `Map_Narvos`. Quand il refuse de démarrer,
# il le fait pour une poignée de raisons connues, toutes vérifiables AVANT — et
# son message d'erreur ne les nomme pas toujours. Chaque contrôle ci-dessous
# correspond à un piège déjà payé sur ce projet.
# ══════════════════════════════════════════════════════════════════════════════
set -u

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STEAM="D:/steam/steamapps/common/nanos-world-playtest/Server"
EXE="$STEAM/NanosWorldServer.exe"
UE_BUILD="D:/Epic Games/UE_5.7/Engine/Build/Build.version"

echecs=0
ok()   { printf "  \033[32mOK\033[0m    %s\n" "$1"; }
nok()  { printf "  \033[31mNON\033[0m   %s\n" "$1"; echecs=$((echecs + 1)); }
note() { printf "        %s\n" "$1"; }

echo "═══ Contrôles avant lancement ═══"

# ── 1. Aucun cook en cours ───────────────────────────────────────────────────
# Le pack d'assets est une JONCTION vers le dépôt : un cook en cours le réécrit
# sous les pieds du serveur, qui lirait un `Assets.toml` à moitié écrit.
if [ "$(tasklist 2>/dev/null | grep -ci 'UnrealEditor')" -eq 0 ]; then
  ok "aucun cook en cours"
else
  nok "un processus Unreal tourne — le pack est peut-être en cours de réécriture"
  note "attendre la fin de la chaîne de cook avant de lancer"
fi

# ── 2. Le binaire du serveur ─────────────────────────────────────────────────
[ -f "$EXE" ] && ok "binaire du serveur présent" || nok "NanosWorldServer.exe introuvable : $EXE"

# ── 3. Les jonctions vers le dépôt ───────────────────────────────────────────
# ⚠ Une mise à jour Steam du dossier `Server/` les EMPORTE. Elles se refont par
# `node scripts/nanos-deploy-server.mjs --apply`.
for p in narvos narvos-map-proto; do
  if [ -L "$STEAM/Packages/$p" ] || [ -d "$STEAM/Packages/$p" ]; then
    ok "paquet « $p » relié"
  else
    nok "paquet « $p » absent de $STEAM/Packages"
    note "refaire : node scripts/nanos-deploy-server.mjs --apply"
  fi
done

# ── 4. Le pack d'assets est une JONCTION, pas une copie ──────────────────────
# Une copie serait figée à la date où on l'a faite : le cook mettrait à jour le
# dépôt, et le serveur continuerait de lire l'ancien pack sans rien dire.
if [ -L "$STEAM/Assets/narvos" ]; then
  ok "pack d'assets relié au dépôt (jonction)"
elif [ -d "$STEAM/Assets/narvos" ]; then
  nok "pack d'assets COPIÉ et non relié — il sera périmé dès le prochain cook"
else
  nok "pack d'assets absent : $STEAM/Assets/narvos"
fi

# ── 5. Version du moteur déclarée = version réelle ───────────────────────────
# nanos compare le nombre DÉCLARÉ dans Assets.toml, pas le contenu. Le gabarit
# officiel porte « 5.7.0 » ; recopié tel quel, le serveur refuse le pack entier.
TOML="$RACINE/WebPortal/Server/Assets/narvos/Assets.toml"
if [ -f "$TOML" ]; then
  declaree=$(grep -oE 'unreal_version *= *"[0-9.]+"' "$TOML" | grep -oE '[0-9.]+' | head -1)
  reelle=$(grep -oE '"(Major|Minor|Patch)Version": [0-9]+' "$UE_BUILD" 2>/dev/null \
           | grep -oE '[0-9]+' | tr '\n' '.' | sed 's/\.$//')
  if [ -n "$reelle" ] && [ "$declaree" != "$reelle" ]; then
    nok "unreal_version déclarée $declaree, moteur réel $reelle — le pack sera refusé"
    note "corriger la ligne dans $TOML (une ligne, pas de recook)"
  else
    ok "version moteur cohérente ($declaree)"
  fi
else
  nok "Assets.toml introuvable — le pack n'a jamais été construit"
fi

# ── 6. La map demandée est DANS le pack ──────────────────────────────────────
# `map_asset = "narvos::Map_Narvos"` : si l'entrée manque, le serveur démarre et
# ne charge rien.
if grep -qE '^\s+Map_Narvos = ' "$TOML" 2>/dev/null; then
  ok "Map_Narvos présente dans le pack cuit"
else
  nok "Map_Narvos ABSENTE de Assets.toml — relancer la chaîne de cook"
fi

# ── 7. Ce que Config.toml demande ────────────────────────────────────────────
# ⚠ Le serveur lit CELUI DE STEAM, pas celui du dépôt.
CFG="$STEAM/Config.toml"
if [ -f "$CFG" ]; then
  grep -q 'map *= *"narvos-map-proto"' "$CFG" && ok "map = narvos-map-proto" \
    || nok "Config.toml ne demande pas la map « narvos-map-proto »"
  grep -q '"narvos"' "$CFG" && ok "paquet et assets « narvos » déclarés" \
    || nok "Config.toml ne déclare pas « narvos »"
else
  nok "Config.toml absent côté Steam : $CFG"
fi

echo
if [ "$echecs" -gt 0 ]; then
  echo "═══ $echecs contrôle(s) en échec — lancement ANNULÉ ═══"
  exit 1
fi
echo "═══ tous les contrôles passent ═══"

[ "${1:-}" = "--verifier" ] && { echo "(--verifier : on s'arrête là)"; exit 0; }

echo
echo "═══ Lancement ═══"
echo "  ⚠ La base est migrée au démarrage : ALTER TABLE personnages ADD COLUMN"
echo "    inventaire TEXT. Premier démarrage sur une base existante = normal."
echo "  ⚠ Ctrl+C pour arrêter. Le serveur écoute sur 7777 (requêtes 7778)."
echo
cd "$STEAM" || exit 1
# Cette installation Steam lance le client avec -playtest. Le serveur exige
# --playtest (deux tirets) pour le même APPID, sinon la connexion locale expire.
# https://docs.nanos-world.com/fr/docs/getting-started/quick-start
"./NanosWorldServer.exe" --playtest