#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# nuit_2026-09-11.sh — cuire Defender, prouver, consigner, puis ETEINDRE.
#
#   bash .hermes/nuit_2026-09-11.sh
#
# Demande du 2026-09-11 (Hanibes, avant d'aller dormir) : « eteins mon
# ordinateur quand tu as fini ». Ce script est ce « fini » : il fait ce qui
# restait a faire — le cook de Defender, dont l'exclusion a ete retiree — puis
# ecrit son verdict dans le HANDOFF que le prochain agent lira, puis eteint.
#
# ── LES REGLES QU'IL RESPECTE ─────────────────────────────────────────────────
#   · le serveur et le client nanos sont ARRETES d'abord : le pack est une
#     jonction, le cook le reecrirait sous leurs pieds ;
#   · un cook partiel (« Packages Remain 0 » absent) NE reconstruit PAS le pack :
#     Assets.toml deviendrait faux et le serveur refuserait des assets presents ;
#   · l'inventaire est regenere ENTRE le cook et le pack (lecon du 10/09 : 204
#     assets cuits, copies, declares nulle part parce que l'inventaire datait) ;
#   · chaque etape a un TEMOIN qui mesure la question posee, et le verdict est
#     ecrit meme en cas d'echec — surtout en cas d'echec ;
#   · l'extinction a lieu QUOI QU'IL ARRIVE, avec 2 minutes de grace
#     (`shutdown /a` pour l'annuler). Un cook bloque est borne a 100 minutes.
# ══════════════════════════════════════════════════════════════════════════════
set -u

RACINE="E:/narvosprime-web-prototype"
UE="D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe"
ADK="$RACINE/WebPortal/Server/adk/NanosWorldADK.uproject"
TOML="$RACINE/WebPortal/Server/Assets/narvos/Assets.toml"
HANDOFF="$RACINE/.hermes/HANDOFF_FABLE_2026-09-11.md"
COOK="$RACINE/.hermes/cook_defender_$(date +%Y-%m-%d_%H%M).log"
JOURNAL="$RACINE/.hermes/nuit_2026-09-11.log"
DEBUT=$(date +%s)

dire() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$JOURNAL"; }
consigner() { printf '%s\n' "$*" >> "$HANDOFF"; }

eteindre() {
  dire "=== EXTINCTION dans 120 s (shutdown /a pour annuler) ==="
  consigner ""
  consigner "_Machine eteinte automatiquement a $(date +%H:%M) le $(date +%Y-%m-%d), a la demande de Hanibes._"
  # ⚠ MSYS convertit `/s` en chemin quand il appelle un .exe Windows : le
  # `taskkill //PID` de la journee en est la trace. On coupe la conversion
  # pour cette ligne, et on double par cmd.exe si jamais elle echouait —
  # c'est la seule ligne que Hanibes a explicitement demandee.
  # (Cette ligne a d'abord ete ecrite par un heredoc bash, qui a mange un
  #  antislash et laisse un `\n` litteral — le piege documente dans la memoire
  #  du projet. Reecrite avec l'outil d'edition, pas par heredoc.)
  MSYS_NO_PATHCONV=1 shutdown /s /t 120 /c "NARVOS : travail de nuit termine - voir .hermes/HANDOFF_FABLE_2026-09-11.md"
  if [ $? -ne 0 ]; then
    dire "    shutdown.exe a refuse — repli par cmd.exe"
    MSYS_NO_PATHCONV=1 cmd /c "shutdown /s /t 120"
  fi
}

: > "$JOURNAL"
consigner ""
consigner "## RESULTAT DE LA NUIT (ecrit par nuit_2026-09-11.sh)"
consigner ""

# ── 0. Arreter le jeu ────────────────────────────────────────────────────────
dire "=== 0. arret du serveur et du client nanos (le pack est une jonction)"
taskkill //IM NanosWorldServer.exe //F >/dev/null 2>&1 && dire "    serveur arrete" || dire "    serveur : deja arrete"
taskkill //IM NanosWorld.exe //F >/dev/null 2>&1 && dire "    client arrete" || dire "    client : deja arrete"
sleep 5
if tasklist 2>/dev/null | grep -qi "UnrealEditor"; then
  dire "ARRET : un UnrealEditor tourne encore. Pas de cook. Extinction."
  consigner "- ❌ Cook NON lance : un UnrealEditor tournait deja."
  eteindre; exit 1
fi

AVANT=$(grep -cE '^\s+SK_[A-Za-z0-9_]+ = "Narvos/Defender/' "$TOML" 2>/dev/null; true)
dire "    SkeletalMesh Defender declares AVANT : ${AVANT:-0}"

# ── 1. Cook, borne a 100 min ─────────────────────────────────────────────────
dire "=== 1. cook (Defender/Demo n'est plus exclu ; le tueur est en quarantaine)"
timeout 6000 "$UE" "$ADK" -run=Cook -targetplatform=Windows -unattended -nosplash > "$COOK" 2>&1
CODE=$?
dire "    le cook a rendu la main apres $(( ($(date +%s) - DEBUT) / 60 )) min (code $CODE)"

if ! grep -qE "Packages Remain 0 " "$COOK"; then
  dire "    ARRET : « Packages Remain 0 » ABSENT — cook partiel ou bloque."
  DERNIER=$(grep -oE "Cooked packages [0-9]+ Packages Remain [0-9]+" "$COOK" | tail -1)
  TUEUR=$(grep -E "Fatal|Assertion failed|LogWindows: Error: \[Callstack\]" "$COOK" | head -3 | cut -c1-200)
  consigner "- ❌ **Cook Defender ECHOUE** (code $CODE, $(( ($(date +%s) - DEBUT) / 60 )) min). Dernier compteur : \`${DERNIER:-aucun}\`."
  consigner "  Le pack N'A PAS ete reconstruit (un cook partiel rendrait Assets.toml faux)."
  consigner "  Journal : \`$COOK\`. Premieres lignes fatales :"
  consigner '  ```'
  consigner "$TUEUR"
  consigner '  ```'
  consigner "  Piste : un AUTRE asset de Defender/Demo tue le cook. Chercher \`Enemy_Anim\` / \`Assertion\` dans le journal, mettre le coupable en \`adk/_quarantaine/\` (meme chemin), relancer."
  eteindre; exit 1
fi
dire "    TEMOIN OK : Packages Remain 0"

# ── 2. Inventaire (le registre, pas les noms) ────────────────────────────────
dire "=== 2. inventaire"
"$UE" "$ADK" -run=pythonscript -script="$RACINE/scripts/adk-dump-assets.py" -unattended -nosplash -nopause > /dev/null 2>&1
INV=$(grep -c "Narvos/Defender" "$RACINE/WebPortal/Server/adk/_assets-inventory.json")
dire "    inventaire : $INV entree(s) Defender"

# ── 3. Pack ──────────────────────────────────────────────────────────────────
dire "=== 3. reconstruction du pack"
node "$RACINE/scripts/nanos-build-asset-pack.mjs" --apply > "$RACINE/.hermes/pack_2026-09-11.log" 2>&1
grep -E "ABSENT\(S\) DE L'INVENTAIRE|Assets.toml :" "$RACINE/.hermes/pack_2026-09-11.log" | tee -a "$JOURNAL"

# ── 4. Temoins ───────────────────────────────────────────────────────────────
APRES=$(grep -cE '^\s+SK_[A-Za-z0-9_]+ = "Narvos/Defender/' "$TOML" 2>/dev/null; true)
TOTAL=$(grep -cE '= "Narvos/Defender/' "$TOML" 2>/dev/null; true)
dire "=== 4. temoin : SkeletalMesh Defender declares : ${APRES:-0} (attendu : 60) — ${TOTAL:-0} cle(s) Defender au total"
if [ "${APRES:-0}" -ge 60 ]; then
  consigner "- ✅ **Cook Defender OK** ($(( ($(date +%s) - DEBUT) / 60 )) min). \`Packages Remain 0\`. **${APRES} SkeletalMesh** et ${TOTAL} cles Defender declarees dans Assets.toml (avant : ${AVANT:-0})."
else
  consigner "- ⚠ Cook fini (\`Packages Remain 0\`) mais **${APRES:-0} SkeletalMesh Defender declares** (attendu 60), ${TOTAL:-0} cles au total. Verifier \`.hermes/pack_2026-09-11.log\` (inventaire perime ? dossier non copie ?)."
fi

# ── 5. Catalogues qui lisent le pack ─────────────────────────────────────────
dire "=== 5. catalogues regeneres depuis le pack"
node "$RACINE/scripts/narvos-pack-props-to-lua.mjs" --apply 2>&1 | tail -2 | tee -a "$JOURNAL"
node "$RACINE/scripts/narvos-animaux-to-lua.mjs" --apply 2>&1 | head -1 | tee -a "$JOURNAL"
node "$RACINE/scripts/narvos-armes-base-to-lua.mjs" --apply 2>&1 | head -1 | tee -a "$JOURNAL"
node "$RACINE/scripts/narvos-verifier-catalogues.mjs" 2>&1 | tail -2 | tee -a "$JOURNAL"

# ── 6. Batterie ──────────────────────────────────────────────────────────────
dire "=== 6. batterie"
node "$RACINE/scripts/lua-harness/tout.mjs" > "$RACINE/.hermes/batterie_2026-09-11.log" 2>&1
BILAN=$(tail -1 "$RACINE/.hermes/batterie_2026-09-11.log")
dire "    $BILAN"
consigner "- Batterie apres la nuit : \`$BILAN\`"
node "$RACINE/scripts/narvos-assets-cuits-jamais-appeles.mjs" 2>&1 | tail -2 | tee -a "$JOURNAL"
consigner "- Paquets cuits jamais employes apres la nuit : \`$(node "$RACINE/scripts/narvos-assets-cuits-jamais-appeles.mjs" 2>&1 | tail -2 | head -1)\`"

dire "=== TERMINE en $(( ($(date +%s) - DEBUT) / 60 )) min ==="
eteindre