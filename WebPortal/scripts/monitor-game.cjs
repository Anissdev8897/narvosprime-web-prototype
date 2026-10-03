#!/usr/bin/env node

/**
 * NARVOS PRIME — Continuous Game Monitor
 * =======================================
 * Monitors the game process long-term:
 *   1. Kills existing processes on port 3005
 *   2. Starts `npm run go` in background
 *   3. Watches stdout/stderr for errors (ERROR, Uncaught, failed, crash)
 *   4. Logs all errors to a file with timestamps
 *   5. Takes periodic screenshots via Playwright
 *   6. Generates a summary report every 60 seconds
 *   7. Runs indefinitely until Ctrl+C
 *
 * Usage:
 *   node scripts/monitor-game.cjs [--interval 60] [--screenshot-interval 30]
 *
 * Output:
 *   monitor-results/<runId>/error.log      — timestamped errors
 *   monitor-results/<runId>/screenshots/   — periodic screenshots
 *   monitor-results/<runId>/report.json    — latest summary report
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// ─── Configuration ────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'monitor-results');
const GAME_URL = process.env.GAME_URL || 'http://localhost:3005';
const VIEWPORT = { width: 1920, height: 1080 };

// CLI args
const args = process.argv.slice(2);
function getArg(flag, fallback) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}
const REPORT_INTERVAL_SEC = parseInt(getArg('--interval', '60'), 10);
const SCREENSHOT_INTERVAL_SEC = parseInt(getArg('--screenshot-interval', '30'), 10);
const MAX_ERRORS_IN_MEMORY = 500;

// ─── Error patterns (case-insensitive regex) ──────────────────────────────────

const ERROR_PATTERNS = [
  /ERROR/i,
  /Uncaught/i,
  /failed/i,
  /crash/i,
  /FATAL/i,
  /TypeError/i,
  /ReferenceError/i,
  /SyntaxError/i,
  /RangeError/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
  /Cannot find module/i,
  /Unexpected token/i,
  /out of memory/i,
  /segfault/i,
];

// ─── Global state ─────────────────────────────────────────────────────────────

let runId;
let runDir;
let screenshotDir;
let errorLogPath;
let reportPath;
let gameProcess = null;
let monitorInterval = null;
let screenshotInterval = null;
let browser = null;
let page = null;
let shuttingDown = false;

const errors = [];           // { timestamp, source, text }
const screenshots = [];      // { timestamp, path }
let startTime;
let errorCount = 0;
let screenshotCount = 0;
let lastScreenshotTime = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function ts() {
  return new Date().toISOString();
}

function tsShort() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function log(msg) {
  const t = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[${t}] ${msg}`);
}

function header(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(60)}`);
}

function appendError(source, text) {
  const entry = {
    timestamp: ts(),
    source,
    text: text.slice(0, 500),
  };
  errors.push(entry);
  errorCount++;

  // Trim in-memory list if it gets too large
  while (errors.length > MAX_ERRORS_IN_MEMORY) {
    errors.shift();
  }

  // Write to error log file immediately
  try {
    fs.appendFileSync(errorLogPath, JSON.stringify(entry) + '\n', 'utf-8');
  } catch (e) {
    // silently ignore write failures
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Process Killing ──────────────────────────────────────────────────────────

function killExistingProcesses() {
  log('Killing existing processes on port 3005 ...');
  const myPid = process.pid;

  try {
    const out = execSync('netstat -ano | findstr :3005 | findstr LISTENING', {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    const lines = out.trim().split(/\r?\n/);
    for (const line of lines) {
      const pid = line.trim().split(/\s+/).pop();
      if (pid && parseInt(pid) !== myPid) {
        try {
          execSync(`taskkill -PID ${pid} -F`, { stdio: 'ignore' });
          log(`  Killed PID ${pid} on port 3005`);
        } catch {
          // already dead
        }
      }
    }
  } catch {
    // Nothing listening on 3005 — that's fine
  }

  // Kill zombie electron processes
  try {
    execSync('taskkill -F -IM electron.exe 2>nul', { stdio: 'ignore' });
  } catch {
    // none running
  }

  log('Process cleanup complete.\n');
}

// ─── Screenshot capture via Playwright ────────────────────────────────────────

async function initBrowser() {
  log('Launching headless Chromium for screenshots ...');
  browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--disable-gpu-sandbox',
      '--enable-unsafe-swiftshader',
    ],
  });

  const context = await browser.newContext({
    viewport: VIEWPORT,
    ignoreHTTPSErrors: true,
  });
  page = await context.newPage();

  // Capture console errors from the browser page itself
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      appendError('browser:console', msg.text());
      log(`  🔴 [browser console] ${msg.text().slice(0, 150)}`);
    }
  });

  page.on('pageerror', (err) => {
    appendError('browser:page', err.message);
    log(`  💥 [browser page error] ${err.message}`);
  });

  page.on('requestfailed', (req) => {
    const failure = req.failure()?.errorText || 'unknown';
    // Only log if it's not a "normal" failure (like aborted requests on navigation)
    if (failure !== 'net::ERR_ABORTED') {
      appendError('browser:request', `${req.url()} — ${failure}`);
    }
  });

  log('Browser ready for screenshots.');
}

async function takeScreenshot() {
  if (!page || shuttingDown) return null;

  const filename = `screenshot-${tsShort()}.png`;
  const filepath = path.join(screenshotDir, filename);

  try {
    // Navigate to the game if we haven't, or refresh to get current state
    const currentUrl = page.url();
    if (!currentUrl || currentUrl === 'about:blank') {
      await page.goto(GAME_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      }).catch(() => {
        // Game might not be ready yet — that's fine
      });
    }

    await sleep(2000); // let the page settle
    await page.screenshot({ path: filepath, fullPage: false });
    screenshotCount++;
    lastScreenshotTime = Date.now();

    screenshots.push({ timestamp: ts(), path: filepath });
    // Keep only last 100 screenshot entries in memory
    while (screenshots.length > 100) screenshots.shift();

    log(`  📸 Screenshot #${screenshotCount} → ${filename}`);
    return filepath;
  } catch (err) {
    log(`  ⚠️ Screenshot failed: ${err.message}`);
    return null;
  }
}

// ─── Summary Report ───────────────────────────────────────────────────────────

function generateReport() {
  const now = Date.now();
  const elapsedSec = Math.round((now - startTime) / 1000);
  const minutes = Math.floor(elapsedSec / 60);
  const seconds = elapsedSec % 60;

  // Count errors by source in the current window
  const errorsBySource = {};
  for (const e of errors) {
    errorsBySource[e.source] = (errorsBySource[e.source] || 0) + 1;
  }

  const report = {
    timestamp: ts(),
    runId,
    uptime: `${minutes}m ${seconds}s`,
    uptimeSeconds: elapsedSec,
    gameUrl: GAME_URL,
    process: gameProcess
      ? { pid: gameProcess.pid, exited: gameProcess.exitCode !== null, exitCode: gameProcess.exitCode }
      : { pid: null, exited: true, exitCode: null },
    errors: {
      total: errorCount,
      bySource: errorsBySource,
      last10: errors.slice(-10),
    },
    screenshots: {
      total: screenshotCount,
      last: lastScreenshotTime ? new Date(lastScreenshotTime).toISOString() : null,
    },
    config: {
      reportIntervalSec: REPORT_INTERVAL_SEC,
      screenshotIntervalSec: SCREENSHOT_INTERVAL_SEC,
    },
  };

  // Write report
  try {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  } catch (e) {
    log(`  ⚠️ Failed to write report: ${e.message}`);
  }

  // Print summary to console
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  📊 SUMMARY REPORT — Uptime: ${minutes}m ${seconds}s`);
  console.log(`  Errors total: ${errorCount}   |   Screenshots: ${screenshotCount}`);
  if (Object.keys(errorsBySource).length > 0) {
    console.log(`  Errors by source:`);
    for (const [src, count] of Object.entries(errorsBySource)) {
      console.log(`    ${src}: ${count}`);
    }
  }
  if (errorCount > 0) {
    console.log(`  Last 3 errors:`);
    for (const e of errors.slice(-3)) {
      console.log(`    [${e.source}] ${e.text.slice(0, 120)}`);
    }
  }
  console.log(`${'─'.repeat(60)}\n`);

  return report;
}

// ─── Process Monitoring ───────────────────────────────────────────────────────

function isErrorLine(line) {
  return ERROR_PATTERNS.some(pattern => pattern.test(line));
}

function startGameProcess() {
  log('Starting: npm run go');
  log('(This runs: kill-node → try-wasm → electron:dev → start)');

  gameProcess = spawn('npm', ['run', 'go'], {
    cwd: PROJECT_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    env: {
      ...process.env,
      FORCE_COLOR: '0',       // strip ANSI for cleaner log parsing
      BROWSER: 'none',        // don't open browser
    },
  });

  log(`Game process started (PID: ${gameProcess.pid})`);

  gameProcess.stdout.on('data', (data) => {
    const lines = data.toString().split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      // Always print the line so we can see what's happening
      console.log(`  [game:out] ${line.slice(0, 200)}`);

      if (isErrorLine(line)) {
        appendError('game:stdout', line);
        log(`  🔴 ERROR DETECTED in stdout: ${line.slice(0, 150)}`);
      }
    }
  });

  gameProcess.stderr.on('data', (data) => {
    const lines = data.toString().split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      console.log(`  [game:err] ${line.slice(0, 200)}`);

      // stderr is almost always worth logging as an error
      if (line.trim()) {
        appendError('game:stderr', line);
        if (isErrorLine(line)) {
          log(`  🔴 ERROR DETECTED in stderr: ${line.slice(0, 150)}`);
        }
      }
    }
  });

  gameProcess.on('close', (code) => {
    const msg = `Game process exited with code ${code}`;
    log(`  ⚠️ ${msg}`);
    appendError('game:process', msg);

    if (!shuttingDown) {
      log('  Attempting restart in 10 seconds ...');
      setTimeout(() => {
        if (!shuttingDown) {
          log('  Restarting game process ...');
          startGameProcess();
        }
      }, 10000);
    }
  });

  gameProcess.on('error', (err) => {
    const msg = `Failed to start game process: ${err.message}`;
    log(`  ❌ ${msg}`);
    appendError('game:process', msg);
  });
}

// ─── Shutdown ─────────────────────────────────────────────────────────────────

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  header(`SHUTDOWN (${signal || 'manual'})`);

  // Stop intervals
  if (monitorInterval) clearInterval(monitorInterval);
  if (screenshotInterval) clearInterval(screenshotInterval);

  // Final report
  generateReport();

  // Kill game process
  if (gameProcess && !gameProcess.killed) {
    log('Killing game process ...');
    try {
      // On Windows, we need to kill the whole tree
      execSync(`taskkill -PID ${gameProcess.pid} -F -T`, { stdio: 'ignore' });
    } catch {
      gameProcess.kill('SIGTERM');
    }
  }

  // Close browser
  if (page) {
    try { await page.close(); } catch (_) { /* ignore */ }
  }
  if (browser) {
    try { await browser.close(); } catch (_) { /* ignore */ }
  }

  log(`Monitor stopped. Results in: ${runDir}`);
  log(`  Error log : ${errorLogPath}`);
  log(`  Report    : ${reportPath}`);
  log(`  Screenshots: ${screenshotDir}`);

  process.exit(0);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Setup output directories
  runId = tsShort();
  runDir = path.join(OUTPUT_DIR, `run-${runId}`);
  screenshotDir = path.join(runDir, 'screenshots');
  errorLogPath = path.join(runDir, 'error.log');
  reportPath = path.join(runDir, 'report.json');

  ensureDir(runDir);
  ensureDir(screenshotDir);

  header('NARVOS PRIME — CONTINUOUS GAME MONITOR');
  log(`Run ID     : ${runId}`);
  log(`Output     : ${runDir}`);
  log(`Game URL   : ${GAME_URL}`);
  log(`Report interval  : ${REPORT_INTERVAL_SEC}s`);
  log(`Screenshot interval: ${SCREENSHOT_INTERVAL_SEC}s`);
  log('');

  // 1. Kill existing processes
  killExistingProcesses();

  // Wait a moment for ports to be released
  await sleep(2000);

  // 2. Start game
  startGameProcess();

  // 3. Initialize screenshot browser after a warm-up delay
  log('Waiting 15s for game to start before initializing screenshot browser ...');
  await sleep(15000);

  try {
    await initBrowser();
  } catch (err) {
    log(`  ⚠️ Could not initialize screenshot browser: ${err.message}`);
    log('  Screenshot capture disabled. Monitoring will continue.');
  }

  // 4. Take initial screenshot
  if (page) {
    await takeScreenshot();
  }

  // 5. Set up periodic screenshot capture
  screenshotInterval = setInterval(async () => {
    if (!shuttingDown) {
      await takeScreenshot();
    }
  }, SCREENSHOT_INTERVAL_SEC * 1000);

  // 6. Set up periodic report generation
  monitorInterval = setInterval(() => {
    if (!shuttingDown) {
      generateReport();
    }
  }, REPORT_INTERVAL_SEC * 1000);

  // 7. Handle graceful shutdown
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGHUP', () => shutdown('SIGHUP'));

  // On Windows, SIGINT might not work well with spawn; also listen for exit
  process.on('exit', () => {
    if (gameProcess && !gameProcess.killed) {
      try { gameProcess.kill(); } catch (_) { /* ignore */ }
    }
  });

  log('\n✅ Monitor running. Press Ctrl+C to stop.\n');

  // Start counting
  startTime = Date.now();
}

// ─── Entry point ──────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('Fatal error in monitor:', err);
  process.exit(1);
});
