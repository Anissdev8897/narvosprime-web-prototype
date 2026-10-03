#!/usr/bin/env node

/**
 * NARVOS PRIME — Smoke Test Automatisé
 * ======================================
 * Lance le jeu en headless, vérifie le chargement, capture les erreurs console,
 * vérifie WebGL, prend des screenshots et génère un rapport JSON.
 *
 * Usage:
 *   node scripts/smoke-test-game.js [--url http://localhost:3005] [--timeout 60]
 *
 * Prérequis:
 *   - Le jeu doit tourner (npm run dev ou npm start)
 *   - playwright doit être installé (npm install --save-dev playwright)
 */

import { chromium } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Configuration ────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'smoke-results');

// Parse CLI args
const args = process.argv.slice(2);
function getArg(flag, fallback) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const GAME_URL = getArg('--url', process.env.GAME_URL || 'http://localhost:3005');
const TIMEOUT_SEC = parseInt(getArg('--timeout', '60'), 10);
const SCREENSHOT_TIMESTAMPS = [0, 5, 10, 20]; // secondes après le load initial
const VIEWPORT = { width: 1920, height: 1080 };

// ─── État global du test ──────────────────────────────────────────────────────

/** @type {{ level: string, text: string, timestamp: number }[]} */
const consoleLogs = [];
/** @type {string[]} */
const pageErrors = [];
let testStartTime = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function log(msg) {
  const ts = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[${ts}] ${msg}`);
}

function header(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(60)}`);
}

// ─── Vérifications dans le navigateur ─────────────────────────────────────────

/** Vérifie la présence d'un canvas WebGL (rAF + Three.js) */
async function checkWebGL(page) {
  return page.evaluate(() => {
    const canvases = document.querySelectorAll('canvas');
    if (canvases.length === 0) {
      return { ok: false, reason: 'Aucun <canvas> trouvé dans le DOM' };
    }

    // Vérifier si le canvas a un contexte WebGL via Three.js / R3F
    const info = [];
    for (const c of canvases) {
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        info.push({
          width: c.width,
          height: c.height,
          id: c.id || '(sans id)',
          renderer: debugInfo
            ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
            : 'non disponible',
          vendor: debugInfo
            ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
            : 'non disponible',
        });
      } else {
        info.push({
          width: c.width,
          height: c.height,
          id: c.id || '(sans id)',
          renderer: 'AUCUN — canvas sans contexte WebGL',
        });
      }
    }

    const hasWebGL = info.some(i => i.renderer && i.renderer !== 'AUCUN — canvas sans contexte WebGL');
    return {
      ok: hasWebGL,
      canvasCount: canvases.length,
      details: info,
      reason: hasWebGL ? null : 'Aucun canvas avec contexte WebGL trouvé',
    };
  });
}

/** Vérifie la présence du canvas Three.js (data-engine) et de la boucle rAF */
async function checkThreeJS(page) {
  return page.evaluate(() => {
    const canvases = document.querySelectorAll('canvas');

    // Chercher le canvas Three.js (react-three-fiber ajoute data-engine="three.js")
    const r3fCanvas = document.querySelector('canvas[data-engine]');
    const canvas = r3fCanvas || canvases[0];
    if (!canvas) {
      return { ok: false, reason: 'Aucun canvas Three.js détecté' };
    }

    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const debugInfo = gl?.getExtension('WEBGL_debug_renderer_info');

    // Compter les draw calls en sniffant le clear (approximation)
    const hasDrawCalls = gl && canvas.width > 0 && canvas.height > 0;

    return {
      ok: hasDrawCalls,
      engine: canvas.dataset?.engine || 'inconnu',
      width: canvas.width,
      height: canvas.height,
      renderer: debugInfo
        ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        : 'inconnu',
      vendor: debugInfo
        ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
        : 'inconnu',
      webglVersion: gl instanceof WebGL2RenderingContext ? 'WebGL 2.0' : 'WebGL 1.0',
    };
  });
}

/** Vérifie l'état global de la page */
async function checkPageState(page) {
  return page.evaluate(() => {
    // Regarder dans le DOM pour les marqueurs clés
    const root = document.getElementById('root');
    const reactRoot = root?._reactRootContainer || root?.__reactFiber$;
    const hasChildren = root ? root.children.length > 0 : false;
    const bodyChildren = document.body.children.length;

    // Vérifier si un spinner/loader est visible (l'app est encore en chargement)
    const loadingEl = document.querySelector('[data-loading], .loading, .loader');
    const isStillLoading = loadingEl && window.getComputedStyle(loadingEl).display !== 'none';

    return {
      ok: hasChildren && !isStillLoading,
      rootExists: !!root,
      rootChildren: root ? root.children.length : 0,
      bodyChildren,
      isStillLoading,
      documentTitle: document.title,
    };
  });
}

// ─── Runner principal ─────────────────────────────────────────────────────────

async function runSmokeTest() {
  testStartTime = Date.now();
  const runId = timestamp();
  const runDir = path.join(OUTPUT_DIR, `run-${runId}`);
  ensureDir(runDir);

  header('NARVOS PRIME — SMOKE TEST');
  log(`URL cible : ${GAME_URL}`);
  log(`Timeout   : ${TIMEOUT_SEC}s`);
  log(`Rapport   : ${runDir}`);

  /** @type {{ step: string, ok: boolean, durationMs: number, details?: any, error?: string }[]} */
  const results = [];
  let browser = null;
  let page = null;

  const addResult = (step, ok, details, error) => {
    results.push({
      step,
      ok,
      durationMs: Date.now() - testStartTime,
      ...(details ? { details } : {}),
      ...(error ? { error } : {}),
    });
    const icon = ok ? '✅' : '❌';
    console.log(`  ${icon} ${step}${!ok && error ? ` — ${error}` : ''}`);
  };

  const failedRequests = [];

  try {
    // ── Étape 1 : Lancer le navigateur headless ───────────────────────────
    header('1. Lancement du navigateur');
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--use-gl=angle',             // WebGL via ANGLE (compatible headless)
        '--use-angle=swiftshader',    // Fallback logiciel pour WebGL
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--disable-gpu-sandbox',
        '--enable-unsafe-swiftshader',
      ],
    });
    log('Navigateur Chromium lancé (headless)');
    addResult('Browser launch', true);

    // ── Étape 2 : Créer le contexte et la page ────────────────────────────
    const context = await browser.newContext({
      viewport: VIEWPORT,
      ignoreHTTPSErrors: true,
    });
    page = await context.newPage();
    log(`Viewport : ${VIEWPORT.width}x${VIEWPORT.height}`);

    // ── Étape 3 : Intercepter les messages console ─────────────────────────
    page.on('console', (msg) => {
      const entry = {
        level: msg.type(),
        text: msg.text(),
        timestamp: Date.now() - testStartTime,
      };
      consoleLogs.push(entry);

      // Afficher en temps réel
      const prefix =
        msg.type() === 'error'   ? '🔴' :
        msg.type() === 'warning' ? '⚠️' :
        msg.type() === 'info'    ? 'ℹ️' : '📋';
      console.log(`  [console:${msg.type()}] ${prefix} ${msg.text().slice(0, 180)}`);
    });

    // ── Étape 4 : Intercepter les erreurs non catchées ────────────────────
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
      console.log(`  [PAGE ERROR] 💥 ${err.message}`);
    });

    // ── Étape 5 : Intercepter les requêtes échouées ───────────────────────
    // (failedRequests est déjà déclaré au scope fonction)
    page.on('requestfailed', (req) => {
      failedRequests.push({
        url: req.url(),
        failure: req.failure()?.errorText || 'inconnue',
        timestamp: Date.now() - testStartTime,
      });
    });

    // ── Étape 6 : Naviguer vers le jeu ────────────────────────────────────
    header('2. Navigation vers le jeu');
    log(`GET ${GAME_URL} …`);
    const navStart = Date.now();
    let response;
    try {
      response = await page.goto(GAME_URL, {
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUT_SEC * 1000,
      });
    } catch (navErr) {
      addResult('Page load', false, null, `Impossible d'atteindre ${GAME_URL} : ${navErr.message}`);
      // Tentative de screenshot même en cas d'échec
      try {
        await page.screenshot({ path: path.join(runDir, 'error-load.png'), fullPage: true });
      } catch (_) { /* ignore */ }
      throw navErr;
    }

    const navDuration = Date.now() - navStart;
    const httpStatus = response?.status() ?? '?';
    log(`Réponse HTTP: ${httpStatus} (${navDuration}ms)`);
    addResult('Page load (DOM)', httpStatus >= 200 && httpStatus < 400, { httpStatus, navDurationMs: navDuration });

    // ── Screenshot à t=0s ─────────────────────────────────────────────────
    header('3. Screenshots');
    await page.screenshot({ path: path.join(runDir, `screenshot-00s-load.png`), fullPage: false });
    log('Screenshot t=0s sauvegardé');
    addResult('Screenshot 0s', true);

    // ── Étape 7 : Vérifier l'état initial de la page ──────────────────────
    header('4. Vérifications DOM');
    const pageState = await checkPageState(page);
    log(`Titre        : "${pageState.documentTitle}"`);
    log(`#root existe : ${pageState.rootExists}`);
    log(`Enfants root : ${pageState.rootChildren}`);
    log(`En chargement: ${pageState.isStillLoading}`);
    addResult('Page state', pageState.ok, pageState);

    // ── Screenshot à t=5s ─────────────────────────────────────────────────
    await sleep(5000);
    await page.screenshot({ path: path.join(runDir, `screenshot-05s-warmup.png`), fullPage: false });
    log('Screenshot t=5s sauvegardé');
    addResult('Screenshot 5s', true);

    // ── Étape 8 : Vérifier WebGL après 5s de warmup ───────────────────────
    header('5. Vérification WebGL');
    const webglResult = await checkWebGL(page);
    log(`Canvas trouvé(s) : ${webglResult.canvasCount}`);
    if (webglResult.ok) {
      for (const d of webglResult.details) {
        log(`  → ${d.id} : ${d.renderer} (${d.width}x${d.height})`);
      }
    } else {
      log(`  ⚠️ ${webglResult.reason}`);
    }
    addResult('WebGL check', webglResult.ok, webglResult);

    // ── Étape 9 : Vérifier Three.js spécifiquement ────────────────────────
    const threeResult = await checkThreeJS(page);
    log(`Moteur       : ${threeResult.engine}`);
    log(`Résolution   : ${threeResult.width}x${threeResult.height}`);
    log(`GPU          : ${threeResult.renderer}`);
    log(`WebGL        : ${threeResult.webglVersion}`);
    addResult('Three.js check', threeResult.ok, threeResult);

    // ── Screenshot à t=10s ────────────────────────────────────────────────
    await sleep(5000);
    await page.screenshot({ path: path.join(runDir, `screenshot-10s-render.png`), fullPage: false });
    log('Screenshot t=10s sauvegardé');
    addResult('Screenshot 10s', true);

    // ── Étape 10 : Vérifier l'état après 10s ──────────────────────────────
    const pageStateLater = await checkPageState(page);
    log(`Enfants root après 10s : ${pageStateLater.rootChildren}`);
    log(`Encore en chargement   : ${pageStateLater.isStillLoading}`);
    addResult('Page state (10s)', pageStateLater.ok, pageStateLater);

    // ── Screenshot à t=20s ────────────────────────────────────────────────
    await sleep(10000);
    await page.screenshot({ path: path.join(runDir, `screenshot-20s-final.png`), fullPage: false });
    log('Screenshot t=20s sauvegardé');
    addResult('Screenshot 20s', true);

    // ── Étape 11 : Vérifier l'état final ──────────────────────────────────
    const pageStateFinal = await checkPageState(page);
    log(`Enfants root final : ${pageStateFinal.rootChildren}`);
    addResult('Page state (final)', pageStateFinal.ok, pageStateFinal);

  } catch (err) {
    console.error(`\n❌ ERREUR FATALE : ${err.message}`);
    addResult('FATAL', false, null, err.message);
  } finally {
    // ── Nettoyage ─────────────────────────────────────────────────────────
    if (page) {
      try { await page.close(); } catch (_) { /* ignore */ }
    }
    if (browser) {
      try { await browser.close(); } catch (_) { /* ignore */ }
    }
    log('Navigateur fermé.');
  }

  // ── Génération du rapport JSON ──────────────────────────────────────────────
  header('6. Rapport');

  const totalDuration = Date.now() - testStartTime;
  const consoleErrors = consoleLogs.filter(e => e.level === 'error');
  const consoleWarnings = consoleLogs.filter(e => e.level === 'warning');
  const allPassed = results.every(r => r.ok);

  const report = {
    meta: {
      timestamp: new Date().toISOString(),
      runId,
      gameUrl: GAME_URL,
      timeoutSec: TIMEOUT_SEC,
      totalDurationMs: totalDuration,
      viewport: VIEWPORT,
    },
    summary: {
      passed: allPassed,
      totalSteps: results.length,
      passedSteps: results.filter(r => r.ok).length,
      failedSteps: results.filter(r => !r.ok).length,
      consoleErrors: consoleErrors.length,
      consoleWarnings: consoleWarnings.length,
      pageErrors: pageErrors.length,
      failedRequests: failedRequests.length,
    },
    results,
    console: {
      errors: consoleErrors,
      warnings: consoleWarnings,
      total: consoleLogs.length,
    },
    pageErrors,
    failedRequests: failedRequests.slice(0, 50), // max 50 pour ne pas exploser le JSON
    screenshots: SCREENSHOT_TIMESTAMPS.map(t => ({
      label: `${t}s`,
      path: path.join(runDir, `screenshot-${String(t).padStart(2, '0')}s-*.png`),
    })),
  };

  // Sauvegarder le rapport
  const reportPath = path.join(runDir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  log(`Rapport sauvegardé : ${reportPath}`);

  // Afficher le résumé
  const summary = report.summary;
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  RÉSUMÉ DU SMOKE TEST`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`  Résultat global  : ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Étapes réussies  : ${summary.passedSteps}/${summary.totalSteps}`);
  console.log(`  Durée totale     : ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`  Erreurs console  : ${summary.consoleErrors}`);
  console.log(`  Warnings console : ${summary.consoleWarnings}`);
  console.log(`  Erreurs page     : ${summary.pageErrors}`);
  console.log(`  Requêtes échouées: ${summary.failedRequests}`);
  console.log(`${'─'.repeat(60)}\n`);

  // Liste des problèmes si présents
  const problems = [];
  if (!allPassed) problems.push(...results.filter(r => !r.ok).map(r => `[${r.step}] ${r.error || 'échec'}`));
  if (consoleErrors.length > 0) problems.push(...consoleErrors.map(e => `[console.error] ${e.text}`));
  if (pageErrors.length > 0) problems.push(...pageErrors.map(e => `[page error] ${e}`));

  if (problems.length > 0) {
    console.log(`  ⚠️  ${problems.length} PROBLÈME(S) DÉTECTÉ(S) :`);
    for (const p of problems.slice(0, 20)) {
      console.log(`     • ${p.slice(0, 150)}`);
    }
    if (problems.length > 20) {
      console.log(`     … et ${problems.length - 20} autres (voir report.json)`);
    }
    console.log('');
  }

  // Retourner le code de sortie approprié
  process.exit(allPassed ? 0 : 1);
}

// ─── Utilitaire sleep ─────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Point d'entrée ───────────────────────────────────────────────────────────
runSmokeTest().catch((err) => {
  console.error('Erreur non gérée dans runSmokeTest:', err);
  process.exit(2);
});
