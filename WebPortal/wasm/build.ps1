# Build NarvosEngine C++ -> WebAssembly via Emscripten (Windows)
# Prerequisites: emsdk installed. Run emsdk_env.bat first.
#
# Usage:
#   cd WebPortal\wasm
#   .\build.ps1          # release
#   .\build.ps1 debug    # debug with DWARF

param([string]$BuildType = "Release")
if ($BuildType -eq "debug") { $BuildType = "Debug" }

$ErrorActionPreference = "Stop"
Push-Location $PSScriptRoot

$buildDir = "build"
if (-not (Test-Path $buildDir)) { New-Item -ItemType Directory $buildDir | Out-Null }

# Vendor GLM if missing
if (-not (Test-Path "vendor\glm")) {
    Write-Host "Fetching GLM (header-only)..."
    New-Item -ItemType Directory -Force vendor | Out-Null
    git clone --depth 1 --branch 1.0.1 https://github.com/g-truc/glm.git vendor\glm
}

Write-Host "=== NarvosEngine WASM Build ($BuildType) ==="

emcmake cmake -B $buildDir -S . -DCMAKE_BUILD_TYPE=$BuildType -DCMAKE_CXX_STANDARD=20
emmake cmake --build $buildDir --parallel

Write-Host ""
Write-Host "Build complete. Output:"
Get-ChildItem dist\narvos-engine.* | Format-Table Name, Length -AutoSize
Write-Host ""
Write-Host "Copy dist\narvos-engine.{js,wasm} to WebPortal\public\wasm\"

Pop-Location
