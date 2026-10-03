// ══════════════════════════════════════════════════════════════════════════════
// reporters/markdown.mjs — Générateur de rapport Markdown
//
// Produit un rapport Markdown lisible avec tableaux et tendances.
// ══════════════════════════════════════════════════════════════════════════════

import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Génère un rapport Markdown à partir des résultats de benchmark.
 *
 * @param {Array} results - Résultats des benchmarks
 * @param {Object} reportData - Données complètes du rapport (optionnel)
 * @param {string} outputDir - Répertoire de sortie
 * @returns {string} Le contenu Markdown généré
 */
export function generateMarkdown(results, reportData = null, outputDir = '.') {
  const timestamp = new Date().toISOString();
  const lines = [];

  lines.push('# Rapport de Benchmarks\n');
  lines.push(`*Généré le : ${new Date().toLocaleString()}*`);
  lines.push('');

  // Résumé
  const summary = reportData?.summary ?? computeSummary(results);
  lines.push('## Résumé\n');
  lines.push(`- **Total benchmarks** : ${summary.totalBenchmarks}`);
  lines.push(`- **Groupes** : ${summary.groups}`);
  lines.push(`- **Moyenne globale** : ${summary.overallMeanMs.toFixed(4)} ms`);
  lines.push('');

  // Résultats par groupe
  const byGroup = {};
  for (const r of results) {
    if (!byGroup[r.group]) byGroup[r.group] = [];
    byGroup[r.group].push(r);
  }

  for (const [groupName, items] of Object.entries(byGroup)) {
    const groupLabel = groupName.charAt(0).toUpperCase() + groupName.slice(1);
    lines.push(`---`);
    lines.push(`## ${groupLabel}\n`);

    // Tableau
    lines.push('| Benchmark | Moyenne (ms) | Min (ms) | Max (ms) | p95 (ms) | Échantillons |');
    lines.push('|-----------|-------------|---------|---------|---------|-------------|');

    for (const r of items) {
      const p95Str = r.p95Ms !== undefined ? r.p95Ms.toFixed(4) : '—';
      lines.push(
        `| ${r.name} | ${r.meanMs.toFixed(4)} | ${(r.minMs ?? 0).toFixed(4)} | ${(r.maxMs ?? 0).toFixed(4)} | ${p95Str} | ${r.samples ?? r.iterations ?? '—'} |`
      );
    }
    lines.push('');
  }

  // Tendances (régression)
  if (reportData?.trending) {
    lines.push('---');
    lines.push('## Tendances\n');

    const regressions = Object.entries(reportData.trending)
      .filter(([_, t]) => t.changePercent !== 0 && t.previousValue !== null);

    if (regressions.length > 0) {
      lines.push('| Benchmark | Valeur actuelle | Précédente | Changement |');
      lines.push('|-----------|----------------|------------|------------|');
      for (const [name, t] of regressions) {
        const arrow = t.changePercent > 0 ? '⚠️' : '✅';
        const pctStr = `${t.changePercent > 0 ? '+' : ''}${t.changePercent.toFixed(2)}%`;
        lines.push(`| ${name} | ${t.currentValue.toFixed(4)} ms | ${(t.previousValue ?? 0).toFixed(4)} ms | ${arrow} ${pctStr} |`);
      }
    } else {
      lines.push('*Aucune donnée de tendance disponible (première run).*');
    }
    lines.push('');
  }

  // Métadonnées
  if (reportData?.meta) {
    lines.push('---');
    lines.push('## Métadonnées\n');
    const { meta } = reportData;
    if (meta.commit) lines.push(`- **Commit** : \`${meta.commit}\``);
    if (meta.branch) lines.push(`- **Branche** : \`${meta.branch}\``);
    if (meta.host) lines.push(`- **Hôte** : \`${meta.host}\``);
    if (meta.nodeVersion) lines.push(`- **Node.js** : \`${meta.nodeVersion}\``);
    lines.push('');
  }

  const content = lines.join('\n');

  // Sauvegarder
  const mdPath = join(outputDir, 'bench-report.md');
  writeFileSync(mdPath, content);
  console.log(`  ✓ Rapport Markdown: ${mdPath}`);

  return content;
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
    };
  }

  return {
    totalBenchmarks: results.length,
    groups: Object.keys(byGroup).length,
    overallMeanMs: results.reduce((s, r) => s + r.meanMs, 0) / results.length,
  };
}

export default { generateMarkdown };
