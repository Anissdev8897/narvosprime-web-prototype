// ══════════════════════════════════════════════════════════════════════════════
// reporters/html.mjs — Générateur de rapport HTML avec graphiques
//
// Produit un rapport HTML complet avec tableaux, barres de progression,
// indicateurs de régression et graphiques SVG embarqués.
// ══════════════════════════════════════════════════════════════════════════════

import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Génère un rapport HTML à partir des résultats de benchmark.
 *
 * @param {Array} results - Résultats des benchmarks
 * @param {Object} reportData - Données complètes du rapport
 * @param {string} outputDir - Répertoire de sortie
 * @returns {string} Le contenu HTML généré
 */
export function generateHTML(results, reportData = null, outputDir = '.') {
  const summary = reportData?.summary ?? {};
  const trending = reportData?.trending ?? {};
  const meta = reportData?.meta ?? {};

  // Grouper les résultats
  const byGroup = {};
  for (const r of results) {
    if (!byGroup[r.group]) byGroup[r.group] = [];
    byGroup[r.group].push(r);
  }

  const groupKeys = Object.keys(byGroup);

  // Générer les tableaux de résultats
  let tablesHtml = '';
  for (const [groupName, items] of Object.entries(byGroup)) {
    const groupLabel = groupName.charAt(0).toUpperCase() + groupName.slice(1);
    tablesHtml += `
    <div class="group-section">
      <h2>${escapeHtml(groupLabel)}</h2>
      <table>
        <thead>
          <tr>
            <th>Benchmark</th>
            <th>Moyenne</th>
            <th>Min</th>
            <th>Max</th>
            <th>p50</th>
            <th>p95</th>
            <th>Éch.</th>
            <th>Tendance</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (const r of items) {
      const trend = trending[r.name];
      let trendCell = '<span class="trend-na">N/A</span>';
      if (trend && trend.changePercent !== 0 && trend.previousValue !== null) {
        const isRegression = trend.changePercent > 5;
        const cls = isRegression ? 'trend-bad' : 'trend-good';
        const arrow = trend.changePercent > 0 ? '↑' : '↓';
        trendCell = `<span class="${cls}">${arrow} ${Math.abs(trend.changePercent).toFixed(2)}%</span>`;
      }

      tablesHtml += `
          <tr>
            <td>${escapeHtml(r.name)}</td>
            <td class="num">${r.meanMs.toFixed(4)}</td>
            <td class="num">${(r.minMs ?? 0).toFixed(4)}</td>
            <td class="num">${(r.maxMs ?? 0).toFixed(4)}</td>
            <td class="num">${(r.p50Ms ?? 0).toFixed(4)}</td>
            <td class="num">${(r.p95Ms ?? 0).toFixed(4)}</td>
            <td class="num">${r.samples ?? r.iterations ?? '—'}</td>
            <td>${trendCell}</td>
          </tr>
      `;
    }

    tablesHtml += `
        </tbody>
      </table>
    </div>
    `;
  }

  // Graphique SVG des tendances (barres horizontales)
  let svgGraph = '';
  if (Object.keys(trending).length > 0) {
    const entries = Object.entries(trending).filter(([_, t]) => t.previousValue !== null).slice(0, 20);
    if (entries.length > 0) {
      const barHeight = 28;
      const labelWidth = 350;
      const chartWidth = 800;
      const chartHeight = entries.length * barHeight + 40;
      const maxVal = Math.max(...entries.map(([_, t]) => Math.max(t.currentValue, t.previousValue))) * 1.2;

      let bars = '';
      entries.forEach(([name, t], i) => {
        const y = 30 + i * barHeight;
        const wCur = Math.max(2, (t.currentValue / maxVal) * (chartWidth - labelWidth - 30));
        const wPrev = Math.max(2, (t.prevValue ?? 0) / maxVal * (chartWidth - labelWidth - 30));
        const color = t.changePercent > 5 ? '#ef4444' : '#22c55e';
        bars += `
          <text x="5" y="${y + barHeight / 2 + 4}" font-size="11" fill="#ccc">${escapeHtml(name.substring(0, 45))}</text>
          <rect x="${labelWidth}" y="${y + 2}" width="${wPrev}" height="8" fill="#4b5563" rx="3" />
          <rect x="${labelWidth}" y="${y + 14}" width="${wCur}" height="8" fill="${color}" rx="3" />
          <text x="${labelWidth + wCur + 5}" y="${y + 21}" font-size="10" fill="${color}">${t.currentValue.toFixed(3)}ms</text>
        `;
      });

      svgGraph = `
      <div class="graph-section">
        <h2>Comparaison visuelle (actuel vs précédent)</h2>
        <svg viewBox="0 0 ${chartWidth} ${chartHeight}" width="100%" height="${chartHeight + 40}" style="background: #1e1e2e; border-radius: 8px;">
          <rect x="0" y="0" width="${chartWidth}" height="${chartHeight}" fill="#1e1e1e" rx="8" />
          <text x="5" y="20" font-size="12" fill="#888">Benchmark</text>
          <text x="${labelWidth}" y="20" font-size="12" fill="#888">Précédent</text>
          <text x="${labelWidth + 180}" y="20" font-size="12" fill="#888">Actuel</text>
          ${bars}
        </svg>
        <p class="legend"><span class="dot prev"></span> Précédent &nbsp; <span class="dot cur"></span> Actuel</p>
      </div>
      `;
    }
  }

  // Détection de régressions
  let regressionHtml = '';
  const regressions = Object.entries(trending)
    .filter(([_, t]) => t.changePercent > 5 && t.previousValue !== null);

  if (regressions.length > 0) {
    regressionHtml = `
    <div class="regression-section">
      <h2>⚠️ Régressions détectées (>5%)</h2>
      <ul>
    `;
    for (const [name, t] of regressions) {
      regressionHtml += `<li><strong>${escapeHtml(name)}</strong> : +${t.changePercent.toFixed(2)}% (${t.previousValue.toFixed(4)} → ${t.currentValue.toFixed(4)} ms)</li>`;
    }
    regressionHtml += `
      </ul>
    </div>
    `;
  }

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport de Benchmarks — NARVOS PRIME</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f0f1a;
      color: #e0e0e0;
      padding: 40px;
    }
    .container { max-width: 1000px; margin: 0 auto; }
    h1 { color: #f0f0f0; font-size: 28px; margin-bottom: 4px; }
    .subtitle { color: #888; font-size: 14px; margin-bottom: 30px; }
    h2 { color: #c0c0f0; font-size: 20px; margin: 28px 0 14px; }
    .summary-cards {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px; margin-bottom: 30px;
    }
    .card {
      background: #1a1a2e; border-radius: 10px; padding: 20px; border: 1px solid #2a2a4a;
    }
    .card .value { font-size: 28px; font-weight: 700; color: #f0f0ff; }
    .card .label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
    .regression-section {
      background: #2a1515; border: 1px solid #5a2020;
      border-radius: 10px; padding: 20px; margin-bottom: 24px;
    }
    .regression-section h2 { color: #ef4444; margin-top: 0; }
    .regression-section li { margin: 8px 0; color: #f0a0a0; }
    table {
      width: 100%; border-collapse: collapse; margin: 12px 0 24px;
    }
    th { background: #1a1a2e; color: #a0a0c0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; padding: 10px 12px; text-align: left; border-bottom: 2px solid #2a2a4a; }
    td { padding: 8px 12px; border-bottom: 1px solid #1a1a2e; font-size: 13px; }
    tr:hover td { background: #1a1a2e; }
    .num { font-family: 'SF Mono', 'Fira Code', monospace; text-align: right; }
    .trend-na { color: #555; font-style: italic; }
    .trend-good { color: #22c55e; font-weight: 600; }
    .trend-bad { color: #ef4444; font-weight: 700; }
    .group-section { margin-bottom: 10px; }
    .graph-section { margin: 30px 0; }
    .legend { font-size: 12px; color: #888; margin-top: 8px; }
    .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; vertical-align: middle; }
    .dot.prev { background: #4b5563; }
    .dot.cur { background: #22c55e; }
    .meta { color: #666; font-size: 12px; margin-top: 40px; border-top: 1px solid #1a1a2e; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Rapport de Benchmarks</h1>
    <p class="subtitle">NARVOS PRIME — ${new Date().toLocaleString()} ${meta.branch ? '— branch: ' + escapeHtml(meta.branch) : ''}</p>

    <div class="summary-cards">
      <div class="card">
        <div class="value">${summary.totalBenchmarks ?? results.length}</div>
        <div class="label">Benchmarks</div>
      </div>
      <div class="card">
        <div class="value">${summary.groups ?? groupKeys.length}</div>
        <div class="label">Groupes</div>
      </div>
      <div class="card">
        <div class="value">${(summary.overallMeanMs ?? 0).toFixed(4)}</div>
        <div class="label">Moyenne globale (ms)</div>
      </div>
      <div class="card">
        <div class="value">${regressions.length}</div>
        <div class="label">Régressions > 5%</div>
      </div>
    </div>

    ${regressionHtml}
    ${tablesHtml}
    ${svgGraph}

    <div class="meta">
      <p>Rapport généré automatiquement par scripts/bench/bench.mjs</p>
      ${meta.commit ? `<p>Commit : <code>${escapeHtml(meta.commit)}</code></p>` : ''}
      ${meta.host ? `<p>Hôte : ${escapeHtml(meta.host)}</p>` : ''}
    </div>
  </div>
</body>
</html>`;

  const htmlPath = join(outputDir, 'bench-report.html');
  writeFileSync(htmlPath, html);
  console.log(`  ✓ Rapport HTML: ${htmlPath}`);

  return html;
}

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default { generateHTML };
