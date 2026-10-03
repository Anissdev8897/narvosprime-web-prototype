# dev-split.ps1 — Ouvre 4 fenêtres PowerShell + vérifie MySQL :
#   0. MySQL   (vérifie/démarre le service)
#   1. WASM    (build:wasm + copy:wasm automatique)
#   2. Vite    (dev server, port 3005)
#   3. Electron (compile TS, attend Vite, lance l'app)
#   4. Logs    (tsc --watch en continu)
#
# Usage : .\scripts\dev-split.ps1      (depuis WebPortal/)
#    ou : npm run dev:split

$root = Split-Path -Parent $PSScriptRoot
$wp   = "$root"

# ── MySQL ────────────────────────────────────────────────────────
$svc = Get-Service -Name 'mysql' -ErrorAction SilentlyContinue
if ($svc) {
    if ($svc.Status -ne 'Running') {
        Write-Host "MySQL arrete, demarrage..." -ForegroundColor Yellow
        Start-Service -Name 'mysql' -ErrorAction SilentlyContinue
        Write-Host "MySQL demarre." -ForegroundColor Green
    } else {
        Write-Host "MySQL deja en cours." -ForegroundColor Green
    }
} else {
    Write-Host "Service MySQL non trouve. Verifier l'installation." -ForegroundColor Red
}

# ── Fenêtre 1 : WASM Build ──────────────────────────────────────
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$wp'; `$Host.UI.RawUI.WindowTitle = 'NARVOS - WASM Build'; Write-Host '=== WASM Build ===' -ForegroundColor Magenta; npm run build:wasm; npm run copy:wasm; Write-Host ''; Write-Host 'Build termine. Pour rebuild : npm run build:wasm; npm run copy:wasm' -ForegroundColor DarkGray"
)

# ── Fenêtre 2 : Vite ────────────────────────────────────────────
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$wp'; `$Host.UI.RawUI.WindowTitle = 'NARVOS - Vite :3005'; Write-Host '=== Vite Dev Server ===' -ForegroundColor Cyan; npm run dev"
)

# ── Fenêtre 3 : Electron ────────────────────────────────────────
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$wp'; `$Host.UI.RawUI.WindowTitle = 'NARVOS - Electron'; Write-Host '=== Electron ===' -ForegroundColor Green; Write-Host 'Compilation TS...' -ForegroundColor DarkGray; npm run electron:build:ts; Write-Host 'Rebuild better-sqlite3...' -ForegroundColor DarkGray; npx @electron/rebuild -f -w better-sqlite3; Write-Host 'Attente Vite sur :3005...' -ForegroundColor Yellow; npx wait-on http://localhost:3005; Write-Host 'Lancement Electron...' -ForegroundColor Green; `$env:NODE_ENV='development'; npx electron dist-electron/main.cjs"
)

# ── Fenêtre 4 : Logs (tsc watch) ────────────────────────────────
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$wp'; `$Host.UI.RawUI.WindowTitle = 'NARVOS - Logs (tsc)'; Write-Host '=== TypeScript Watch ===' -ForegroundColor Yellow; npx tsc --noEmit --watch --preserveWatchOutput"
)

Write-Host ""
Write-Host "4 fenetres ouvertes : WASM / Vite / Electron / Logs + MySQL verifie" -ForegroundColor Green
