#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# session-visage-foret.sh — CRASH du visage MetaHuman + FORET grise, en UN cook
# (2026-09-13 soir).
#
#   0. preconditions (redirects, copies du visage) ; ATTENDRE la fermeture de
#      l'editeur — ne rien tuer : Hanibes l'a ouvert, il le ferme SANS SAUVEGARDER ;
#   1. quarantaine des deux Face_AnimBP d'origine (LiveLinkPose, crash client) ;
#   2. restauration des 55 paquets OpenWorlds aux references effacees ;
#   3. VERIFICATION dans un editeur complet (visage redirige, maitres de la foret
#      compiles) — le cook ne part que si le visage est prouve ;
#   4. chaine de cook generale (le pack attend la fermeture de nanos) ;
#   5. preuves CUITES + garde des modules absents + batterie.
#
#   bash .hermes/session-visage-foret.sh
#
# Bilan unique : .hermes/bilan_visage_foret_2026-09-13.log
# ══════════════════════════════════════════════════════════════════════════════
set -u
RACINE="E:/narvosprime-web-prototype"
UE_GUI="D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor.exe"
ADK="$RACINE/WebPortal/Server/adk/NanosWorldADK.uproject"
BILAN="$RACINE/.hermes/bilan_visage_foret_2026-09-13.log"
PACK="$RACINE/WebPortal/Server/Assets/narvos/Narvos"
CONTENT="$RACINE/WebPortal/Server/adk/Content"
LOGS="$RACINE/WebPortal/Server/adk/Saved/Logs"
JOURNAL_ADK="$LOGS/NanosWorldADK.log"
QUARANTAINE="$RACINE/WebPortal/Server/adk/_quarantaine"
MANIFESTE="WebPortal/Server/adk/_manifests/openworlds-foret-restauration.json"
INI="$RACINE/WebPortal/Server/adk/Config/DefaultEngine.ini"
DELAI_VERIF_S=$((40 * 60))
cd "$RACINE" || exit 1

dire() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$BILAN"; }
unreal_ouvert() { tasklist 2>/dev/null | grep -qi "UnrealEditor"; }

# ── 0. Preconditions ─────────────────────────────────────────────────────────
dire "=== 0. preconditions"
if ! node scripts/lua-harness/redirects-idempotents-check.mjs > .hermes/redirects_visage_foret.log 2>&1; then
  dire "ARRET : redirects non idempotents :"; grep "ECHEC" .hermes/redirects_visage_foret.log | tee -a "$BILAN"; exit 1
fi
for motif in "ABP_NarvosVisage.ABP_NarvosVisage_C" "ABP_NarvosVisageOutil.ABP_NarvosVisageOutil_C" 'OldName="/Game/OpenWorlds/"'; do
  if ! grep -q "$motif" "$INI"; then dire "ARRET : redirect absent de DefaultEngine.ini : $motif"; exit 1; fi
done
for abp in ABP_NarvosVisage ABP_NarvosVisageOutil; do
  if [ ! -f "$CONTENT/Narvos/PontMetaHuman/$abp.uasset" ]; then dire "ARRET : copie absente : $abp"; exit 1; fi
done
if unreal_ouvert; then dire "    un editeur Unreal est ouvert : attente de sa fermeture (on ne tue rien — fermer SANS sauvegarder)"; fi
while unreal_ouvert; do sleep 30; done
dire "    aucun Unreal ouvert"

# ── 1. Quarantaine des visages d'origine ─────────────────────────────────────
dire "=== 1. quarantaine des Face_AnimBP d'origine"
for rel in "Narvos/MetaCustom/Metahuman_Ref/Common/Face/Face_AnimBP.uasset" "Narvos/MetaCustom/Meta_Face_Tool/Animations/Face_AnimBP.uasset"; do
  src="$CONTENT/$rel"; dst="$QUARANTAINE/$rel"
  if [ ! -f "$src" ]; then dire "    deja hors Content/ : $rel"; continue; fi
  if [ -f "$dst" ]; then dire "ARRET : $dst existe deja (conflit de quarantaine)"; exit 1; fi
  mkdir -p "$(dirname "$dst")" && mv "$src" "$dst" && dire "    deplace : $rel"
done

# ── 2. Restauration OpenWorlds ───────────────────────────────────────────────
dire "=== 2. restauration des paquets OpenWorlds aux references effacees"
node scripts/adk-restaurer-originaux.mjs "$MANIFESTE" --apply > .hermes/restauration_foret.log 2>&1
CODE=$?
grep -E "^RESTAURATION|restaure|ABSENT|ECHEC|ARRET" .hermes/restauration_foret.log | tee -a "$BILAN"
if [ "$CODE" -ne 0 ]; then dire "ARRET : restauration (code $CODE)"; exit 1; fi

# ── 3. Verification dans l'editeur ───────────────────────────────────────────
dire "=== 3. verification editeur (visage redirige, foret compilee)"
"$UE_GUI" "$ADK" -ExecutePythonScript="$RACINE/scripts/adk-verifier-visage-foret.py" -unattended -nosplash > .hermes/verif_visage_foret_editeur.log 2>&1 &
PID=$!
ecoule=0
while kill -0 "$PID" 2>/dev/null; do
  sleep 30; ecoule=$((ecoule + 30))
  if [ "$ecoule" -ge "$DELAI_VERIF_S" ]; then
    dire "    DELAI DEPASSE : l'editeur lance par CE script est arrete"
    kill "$PID" 2>/dev/null; sleep 10; taskkill //F //PID "$PID" > /dev/null 2>&1; break
  fi
done
sleep 20
cp "$JOURNAL_ADK" .hermes/verif_visage_foret_journal.log 2>/dev/null
grep -a "\[VERIF\]" .hermes/verif_visage_foret_journal.log | sed 's/.*\[VERIF\] /    /' | awk '!vu[$0]++' | tee -a "$BILAN"
# ⚠ Les [Compiler] se lisent sur les lignes LogBlueprint SEULEMENT : la premiere
# execution (15:37) a compte les messages [VERIF] du script, qui contiennent le mot
# « [Compiler] », et a refuse le cook sur un visage pourtant prouve.
ERREURS_VISAGE=$(grep -a "LogBlueprint" .hermes/verif_visage_foret_journal.log | grep -a "\[Compiler\]" | grep -a -c "PontMetaHuman")
VISAGE_OK=$(grep -a "\[VERIF\] VISAGE OK" .hermes/verif_visage_foret_journal.log | sort -u | wc -l)
dire "    visage : $VISAGE_OK/2 gabarit(s) Face rediriges, $ERREURS_VISAGE erreur(s) LogBlueprint [Compiler] sous PontMetaHuman"
# Les echecs de materiaux se comptent DANS la fermeture du niveau foret : a 15:37,
# « 14 sous OpenWorlds » etaient M_Generic et 13 maisons que la foret ne cite pas.
python scripts/narvos-echecs-materiaux.py .hermes/verif_visage_foret_journal.log "$MANIFESTE" --code > .hermes/echecs_foret_verif.log 2>&1
CODE_FORET=$?
sed 's/^/    foret : /' .hermes/echecs_foret_verif.log | tee -a "$BILAN"
dire "    (avant restauration : 16 echecs dans la fermeture, journaux de 09:51 et 14:44)"
if [ "$VISAGE_OK" -lt 2 ] || [ "$ERREURS_VISAGE" -ne 0 ]; then
  dire "ARRET : le visage n'est pas prouve dans l'editeur — pas de cook (le crash reviendrait)."
  exit 1
fi
if [ "$CODE_FORET" -ne 0 ]; then
  dire "    ATTENTION : des materiaux de la foret echouent encore — le cook part pour le visage."
fi

# ── 4. Chaine generale ───────────────────────────────────────────────────────
dire "=== 4. chaine de cook generale (le pack attend la fermeture de nanos)"
bash scripts/narvos-chaine-cook.sh > .hermes/chaine_visage_foret.log 2>&1
CODE=$?
grep -aE "^===|ARRET|attente|reference\(s\) morte|morte\(s\)|BLOQUANT|IDENTITE" .hermes/chaine_visage_foret.log | head -60 | tee -a "$BILAN"
if [ "$CODE" -ne 0 ] || ! grep -q "=== TERMINE" .hermes/chaine_visage_foret.log; then
  dire "ARRET : chaine incomplete (code $CODE)"; exit 1
fi

# ── 5. Preuves cuites ────────────────────────────────────────────────────────
dire "=== 5. preuves cuites"
COOK_LOG=$(grep -l "Packages Remain 0" $(ls -t "$LOGS"/NanosWorldADK*.log) 2>/dev/null | head -1)
dire "    journal du cook : $(basename "$COOK_LOG")"
python scripts/narvos-echecs-materiaux.py "$COOK_LOG" "$MANIFESTE" > .hermes/echecs_foret_cook.log 2>&1
sed 's/^/    foret (cuit) : /' .hermes/echecs_foret_cook.log | tee -a "$BILAN"
dire "    foret (cuit) : avant = 16 echecs dans la fermeture ; $(grep -a -c "dependency on package /Game/OpenWorlds/" "$COOK_LOG") dependance(s) vers /Game/OpenWorlds/ (avant : 280)"
for m in M_Trees M_TreesBarks M_TreesSSTEx M_Mask_Variation M_Compress_Emission M_Water; do
  dire "      $m : $(grep -a -c "FLocalVertexFactory" "$PACK/OpenWorlds/Materials/$m.uexp" 2>/dev/null) mention(s) FLocalVertexFactory"
done
# Les shaders du TERRAIN ne vivent pas dans M_LandscapeMaster : Unreal les cuit dans les
# instances par composant du NIVEAU (mesure du 13/09 : 0 dans le maitre, 3 dans ForestKitONE.uexp).
dire "      terrain : $(grep -a -o "FLandscape[A-Za-z]*VertexFactory[A-Za-z]*" "$PACK/OpenWorlds/Levels/ForestKitONE.uexp" 2>/dev/null | sort -u | wc -l) type(s) FLandscape*VertexFactory dans ForestKitONE.uexp"
dire "      SM_CedrusA cite MI_Cedrus_Bark : $(grep -a -c "MI_Cedrus_Bark" "$PACK/OpenWorlds/Meshes/Trees/SM_CedrusA.uasset" 2>/dev/null)"
# Chemin COMPLET jusqu'au nom : la 1re regex s'arretait au premier sous-dossier de
# Textures/ et comptait 3 dossiers au lieu de 25 textures.
dire "      MI_LandscapeForestKitOne : $(grep -a -o "/Game/Narvos/OpenWorlds/[A-Za-z0-9_/]*/Textures/[A-Za-z0-9_/]*" "$PACK/OpenWorlds/Landscape/MI_LandscapeForestKitOne.uasset" 2>/dev/null | sort -u | wc -l) texture(s) citee(s)"
dire "    visage : BP_NarvosMH_M cite ABP_NarvosVisage : $(grep -a -c "ABP_NarvosVisage" "$PACK/PontMetaHuman/BP_NarvosMH_M.uasset" 2>/dev/null) ; cite encore Face_AnimBP : $(grep -a -c "Face_AnimBP" "$PACK/PontMetaHuman/BP_NarvosMH_M.uasset" 2>/dev/null)"
dire "    visage : ABP_NarvosVisage cuit cite LiveLinkAnimationCore : $(grep -a -c "LiveLinkAnimationCore" "$PACK/PontMetaHuman/ABP_NarvosVisage.uasset" 2>/dev/null)"
node scripts/narvos-modules-client-absents.mjs > .hermes/modules_absents_visage_foret.log 2>&1
grep -E "^BLOQUANT|^COMPILATION|absent\(s\) du client" .hermes/modules_absents_visage_foret.log | tee -a "$BILAN"
node scripts/lua-harness/tout.mjs > .hermes/batterie_visage_foret.log 2>&1
grep -E "harnais ·" .hermes/batterie_visage_foret.log | tee -a "$BILAN"
dire "FIN"