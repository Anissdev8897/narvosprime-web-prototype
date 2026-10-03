#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# scripts/cleanup.sh — Nettoyage CI pour NarvosPrime WebPortal
#
# Utilisation : ./scripts/cleanup.sh [--check] [--fix]
#   --check  : vérifie seulement (code sortie ≠ 0 si problème)
#   --fix    : applique les corrections automatiques
#
# Ce script :
#   1. Supprime les fichiers *.bak dans src/
#   2. Vérifie le nombre de console.log (alerte si > 100)
#   3. Vérifie les fichiers résiduels
#   4. Lance tsc (vérification statique)
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail
cd "$(dirname "$0")/.."

MODE="${1:---check}"
ERRORS=0

info()  { printf "\033[36m[INFO]\033[0m  %s\n" "$*"; }
ok()    { printf "\033[32m[OK]\033[0m    %s\n" "$*"; }
warn()  { printf "\033[33m[WARN]\033[0m  %s\n" "$*" >&2; }
fail()  { printf "\033[31m[FAIL]\033[0m %s\n" "$*" >&2; ERRORS=$((ERRORS + 1)); }

# ── 1. Fichiers .bak ───────────────────────────────────────────────────────
info "Recherche des fichiers .bak dans src/…"
BAK_COUNT=$(find src/ -name "*.bak" -type f 2>/dev/null | wc -l)
if [ "$BAK_COUNT" -gt 0 ]; then
  if [ "$MODE" = "--fix" ]; then
    find src/ -name "*.bak" -type f -delete
    ok "Supprimé $BAK_COUNT fichier(s) .bak"
  else
    fail "Trouvé $BAK_COUNT fichier(s) .bak — utilisez --fix pour les supprimer"
  fi
else
  ok "Aucun fichier .bak"
fi

# ── 2. console.log / console.warn / console.error ──────────────────────────
info "Analyse des appels console.*…"
CONSOLE_COUNT=$(grep -rn "console\.\(log\|warn\|error\|info\|debug\)" src/ \
  --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
info "Total appels console.* : $CONSOLE_COUNT"
if [ "$CONSOLE_COUNT" -gt 200 ]; then
  fail "Trop d'appels console.* ($CONSOLE_COUNT, seuil: 200)"
elif [ "$CONSOLE_COUNT" -gt 100 ]; then
  warn "Appels console.* élevé ($CONSOLE_COUNT) — envisager nettoyage"
else
  ok "Nombre d'appels console.* acceptable ($CONSOLE_COUNT)"
fi

# Lister console.log (pas warn/error) non-DEV pour information
CONSOLE_LOG_COUNT=$(grep -rn "console\.log" src/ \
  --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "if (DEV)" | wc -l)
info "console.log (non-DEV) : $CONSOLE_LOG_COUNT"

# ── 3. Fichier résiduels (_.ts, .jsx, etc.) ────────────────────────────────
info "Recherche fichiers résiduels…"
for ext in ".jsx" ".js.bak"; do
  FOUND=$(find src/ -name "*$ext" -type f 2>/dev/null | wc -l)
  if [ "$FOUND" -gt 0 ]; then
    if [ "$MODE" = "--fix" ]; then
      find src/ -name "*$ext" -type f -delete
      ok "Nettoyé $FOUND fichier(s) *$ext"
    else
      fail "Trouvé $FOUND fichier(s) *$ext — utilisez --fix"
    fi
  else
    ok "Aucun fichier *$ext"
  fi
done

# ── 4. tsc (vérification statique) ─────────────────────────────────────────
info "Vérification TypeScript (tsc --noEmit)…"
if npx tsc --noEmit 2>&1; then
  ok "TypeScript OK"
else
  fail "TypeScript signale des erreurs"
fi

# ── 5. Résumé ──────────────────────────────────────────────────────────────
echo ""
if [ "$ERRORS" -eq 0 ]; then
  info "✓ Tout est propre"
else
  fail "⚠ $ERRORS problème(s) détecté(s)"
fi
exit "$ERRORS"
