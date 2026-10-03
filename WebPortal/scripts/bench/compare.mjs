#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════
// scripts/bench/compare.mjs — Compare les benchmarks entre branches
//
// Usage :
//   node scripts/bench/compare.mjs                          # Compare avec les données stockées
//   node scripts/bench/compare.mjs --branch main            # Compare avec la branche main
//   node scripts/bench/compare.mjs --threshold 10           # Seuil de régression personnalisé
//
// npm run bench:compare
// ══════════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const HISTORY_PATH = join(__dirname, 'bench-history.json');

// ══════════════════════════════════════════════════════════════════════════════
// Utilitaires
// ══════════════════════════════════════════════════════════════════════════════

function readJSON(path) {
  try {
    if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {}
  return null;
}

/**
 * Calcule les différences entre deux séries de résultats.
 *
 * @param {Array} current - Résultats actuels
 * @param {Array} baseline - Résultats de référence
 * @param {number} threshold - Seuil de régression en %
 * @returns {Object} Différences et verdict
 */
function compareResults(current, baseline, threshold = 5) {
  const comparisons = [];
  const baselineMap = new Map();

  for (const b of baseline) {
    baselineMap.set(b.name, b);
  }

  for (const c of current) {
    const b = baselineMap.get(c.name);
    if (b && b.meanMs > 0) {
      const changePercent = ((c.meanMs - b.meanMs) / b.meanMs) * 100;
      comparisons.push({
        name: c.name,
        group: c.group,
        current: c.meanMs,
        baseline: b.meanMs,
        changePercent,
        isRegression: changePercent > threshold,
        isImprovement: changePercent < -threshold,
        unit: c.unit || 'ms',
      });
    } else if (!b) {
      comparisons.push({
        name: c.name,
        group: c.group,
        current: c.meanMs,
        baseline: null,
        changePercent: null,
        isRegression: false,
        isImprovement: false,
        note: 'Nouveau benchmark (pas de baseline)',
        unit: c.unit || 'ms',
      });
    }
  }

  const regressions = comparisons.filter(c => c.isRegression);
  const improvements = comparisons.filter(c => c.isImprovement);

  return {
    totalCompared: comparisons.length,
    regressions,
    improvements,
    comparisons,
    verdict: regressions.length === 0 ? 'PASS' : 'REGRESSION',
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const thresholdIdx = args.indexOf('--threshold');
  const threshold = thresholdIdx !== -1 && args[thresholdIdx + 1]
    ? parseFloat(args[thresholdIdx + 1])
    : 5;

  const targetBranch = args.includes('--branch')
    ? args[args.indexOf('--branch') + 1]
    : 'main';

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   NARVOS PRIME — Comparaison de Benchmarks                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  Branche cible: ${targetBranch}`);
  console.log(`  Seuil régression: >${threshold}%`);
  console.log('');

  // 1. Lire les résultats actuels
  const currentReport = readJSON(join(__dirname, 'bench-report.json'));
  if (!currentReport) {
    console.error('  ✗ Aucun rapport de benchmark trouvé. Lancez d\'abord "npm run bench".');
    process.exit(1);
  }

  const currentResults = currentReport.results || [];
  console.log(`  Résultats actuels: ${currentResults.length} benchmarks`);

  // 2. Essayer de récupérer la baseline depuis l'historique
  let baselineResults = [];

  // 2a. Depuis la baseline stockée dans data/
  const baselinePath = join(DATA_DIR, `baseline-${targetBranch}.json`);
  if (existsSync(baselinePath)) {
    baselineResults = readJSON(baselinePath);
    console.log(`  Baseline chargée: ${baselinePath} (${baselineResults.length} benchmarks)`);
  }

  // 2b. Depuis l'historique (dernière run sur cette machine)
  if (baselineResults.length === 0) {
    const history = readJSON(HISTORY_PATH);
    if (history && history.length > 0) {
      const lastRun = history[history.length - 1];
      baselineResults = lastRun.results || [];
      console.log(`  Baseline depuis historique: ${baselineResults.length} benchmarks`);
    }
  }

  if (baselineResults.length === 0) {
    console.log('  ⚠ Aucune baseline disponible. Exécutez les benchmarks d\'abord sur la branche de référence.');
    console.log('  La baseline sera créée automatiquement après la première exécution sur cette branche.\n');
    process.exit(0);
  }

  // 3. Comparer
  console.log('');
  const result = compareResults(currentResults, baselineResults, threshold);

  console.log(`  Comparés: ${result.totalCompared} benchmarks`);
  console.log(`  ✅ Améliorations: ${result.improvements.length}`);
  console.log(`  ⚠️  Régressions: ${result.regressions.length}`);
  console.log(`  Verdict: ${result.verdict}`);
  console.log('');

  // Détail des régressions
  if (result.regressions.length > 0) {
    console.log('  ⚠️  RÉGRESSIONS DÉTECTÉES:');
    for (const reg of result.regressions) {
      const pct = `+${reg.changePercent.toFixed(2)}%`;
      console.log(`    • ${reg.name}`);
      console.log(`      ${reg.baseline.toFixed(4)} → ${reg.current.toFixed(4)} ${reg.unit}  (${pct})`);
    }
    console.log('');
  }

  // Détail des améliorations
  if (result.improvements.length > 0) {
    console.log('  ✅ AMÉLIORATIONS:');
    for (const imp of result.improvements.slice(0, 10)) {
      const pct = `${imp.changePercent.toFixed(2)}%`;
      console.log(`    • ${imp.name}: ${pct}`);
    }
    if (result.improvements.length > 10) {
      console.log(`    ... et ${result.improvements.length - 10} autres`);
    }
    console.log('');
  }

  // 4. Sauvegarder le rapport de comparaison
  const compareReport = {
    timestamp: new Date().toISOString(),
    targetBranch,
    threshold,
    currentBranch: currentReport.meta?.branch || 'unknown',
    currentCommit: currentReport.meta?.commit || 'unknown',
    totalCompared: result.totalCompared,
    regressions: result.regressions,
    improvements: result.improvements,
    verdict: result.verdict,
  };

  mkdirSync(DATA_DIR, { recursive: true });
  const comparePath = join(__dirname, 'bench-compare.json');
  writeFileSync(comparePath, JSON.stringify(compareReport, null, 2));
  console.log(`  Rapport de comparaison: ${comparePath}`);
  console.log('');

  if (result.verdict === 'REGRESSION') {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
