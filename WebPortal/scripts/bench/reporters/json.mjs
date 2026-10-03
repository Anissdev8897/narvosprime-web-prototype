// ══════════════════════════════════════════════════════════════════════════════
// reporters/json.mjs — Générateur de rapport JSON
//
// Produit un rapport complet avec métadonnées et résultats historisés.
// ══════════════════════════════════════════════════════════════════════════════

import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Génère un rapport JSON à partir des résultats de benchmark.
 *
 * @param {Array} results - Résultats des benchmarks
 * @param {Object} meta - Métadonnées (commit, branch, date, host, etc.)
 * @param {string} outputDir - Répertoire de sortie
 * @returns {Object} Le rapport généré
 */
export function generateReport(results, meta = {}, outputDir = '.') {
  const timestamp = new Date().toISOString();

  // Charger l'historique si disponible
  const historyPath = join(outputDir, 'bench-history.json');
  let history = [];
  if (existsSync(historyPath)) {
    try {
      history = JSON.parse(readFileSync(historyPath, 'utf-8'));
    } catch (e) {
      // historique corrompu, on recommence
    }
  }

  // Calculer les trending (moyennes des N dernières runs)
  const trending = computeTrending(results, history);

  const report = {
    meta: {
      timestamp,
      ...meta,
    },
    results,
    summary: computeSummary(results),
    trending,
    historyCount: history.length,
  };

  // Sauvegarder le rapport principal
  const reportPath = join(outputDir, 'bench-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`  ✓ Rapport JSON: ${reportPath}`);

  // Ajouter au historique
  history.push({
    timestamp,
    results: results.map(r => ({
      name: r.name,
      group: r.group,
      meanMs: r.meanMs,
      minMs: r.minMs,
      maxMs: r.maxMs,
      samples: r.samples,
      ...meta,
    })),
  });

  // Limiter l'historique aux 100 dernières runs
  if (history.length > 100) {
    history = history.slice(-100);
  }
  writeFileSync(historyPath, JSON.stringify(history, null, 2));

  return report;
}

function computeSummary(results) {
  const byGroup = {};
  for (const r of results) {
    if (!byGroup[r.group]) byGroup[r.group] = [];
    byGroup[r.group].push(r);
  }

  const groups = {};
  for (const [name, items] of Object.entries(byGroup)) {
    groups[name] = {
      count: items.length,
      meanMs: items.reduce((s, r) => s + r.meanMs, 0) / items.length,
      minMs: Math.min(...items.map(r => r.meanMs)),
      maxMs: Math.max(...items.map(r => r.meanMs)),
    };
  }

  return {
    totalBenchmarks: results.length,
    groups: Object.keys(byGroup).length,
    byGroup: groups,
    overallMeanMs: results.reduce((s, r) => s + r.meanMs, 0) / results.length,
    timestamp: new Date().toISOString(),
  };
}

function computeTrending(results, history) {
  // Pour chaque benchmark, extraire les X dernières valeurs
  const trending = {};
  for (const r of results) {
    const key = r.name;
    const values = [];
    // Run actuelle
    values.push({ value: r.meanMs, timestamp: new Date().toISOString(), current: true });

    // Historique
    for (const h of history.slice(-20)) {
      const match = h.results.find(hr => hr.name === key);
      if (match && match.meanMs !== undefined) {
        values.push({ value: match.meanMs, timestamp: h.timestamp, current: false });
      }
    }

    if (values.length >= 2) {
      const sorted = values.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const prevValues = sorted.filter(v => !v.current);
      const change = prevValues.length > 0
        ? ((sorted[sorted.length - 1].value - prevValues[prevValues.length - 1].value) / prevValues[prevValues.length - 1].value) * 100
        : 0;

      trending[key] = {
        currentValue: r.meanMs,
        previousValue: prevValues.length > 0 ? prevValues[prevValues.length - 1].value : null,
        changePercent: change,
        dataPoints: values.length,
      };
    }
  }

  return trending;
}

export default { generateReport };
