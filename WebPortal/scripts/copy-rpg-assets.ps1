# ==============================================================================
# copy-rpg-assets.ps1 - Copie les assets RPG retenus vers public/assets/rpg/
#
# Source : dossier Godot asset/new (modeles bruts)
# Cible  : WebPortal/public/assets/rpg/ (servis par Vite)
#
# Usage : pwsh ./scripts/copy-rpg-assets.ps1
# ==============================================================================

$ErrorActionPreference = "Stop"

$SRC = "E:/narvosprime-web-prototype/inpi/Godot/nouveau-projet-de-jeu-(4.5)/asset/new"
$DST = "E:/narvosprime-web-prototype/WebPortal/public/assets/rpg"

# Creation des dossiers cible
$dirs = @(
  "$DST/characters/ModularParts",
  "$DST/characters/Outfits",
  "$DST/characters/textures",
  "$DST/weapons",
  "$DST/animations"
)
foreach ($d in $dirs) { New-Item -ItemType Directory -Path $d -Force | Out-Null }

# 1. Parties modulaires (glTF + bin)
$modularSrc = Join-Path $SRC "Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Modular Parts"
if (Test-Path -LiteralPath $modularSrc) {
  Get-ChildItem -LiteralPath $modularSrc -Include *.gltf,*.bin,*.png -Recurse | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination "$DST/characters/ModularParts" -Force
  }
  Write-Output "[OK] Parties modulaires copiees"
} else {
  Write-Output "[!] Modular Parts introuvable : $modularSrc"
}

# 2. Tenues completes (fallback)
$outfitSrc = Join-Path $SRC "Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Outfits"
if (Test-Path -LiteralPath $outfitSrc) {
  Get-ChildItem -LiteralPath $outfitSrc -Include *.gltf,*.bin,*.png -Recurse | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination "$DST/characters/Outfits" -Force
  }
  Write-Output "[OK] Tenues completes copiees"
}

# 3. Textures PBR
$texSrc = Join-Path $SRC "Modular Character Outfits - Fantasy[Standard]/Textures"
if (Test-Path -LiteralPath $texSrc) {
  Get-ChildItem -LiteralPath $texSrc -Include *.png -Recurse | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination "$DST/characters/textures" -Force
  }
  Write-Output "[OK] Textures PBR copiees"
}

# 4. Armes (Sorceres GLB) - renommage propre
$weaponMap = @{
  "arcane+staff+3d+model_epic_GLB.glb" = "arcane_staff_epic.glb"
  "fantasy+staff+3d+model_GLB.glb"     = "fantasy_staff.glb"
  "wooden+wand+3d+model_GLB.glb"       = "wooden_wand.glb"
}
$weaponSrc = Join-Path $SRC "Sorceres_hi_poly/Weapons"
foreach ($srcName in $weaponMap.Keys) {
  $srcFile = Join-Path $weaponSrc $srcName
  if (Test-Path -LiteralPath $srcFile) {
    Copy-Item -LiteralPath $srcFile -Destination "$DST/weapons/$($weaponMap[$srcName])" -Force
    Write-Output "[OK] Arme : $($weaponMap[$srcName])"
  }
}

# 5. Animations (Sorceres FBX - conversion GLB documentee dans ARCHITECTURE.md)
$animSrc = Join-Path $SRC "Sorceres_hi_poly"
if (Test-Path -LiteralPath $animSrc) {
  $keyAnims = @(
    "Breathing Idle.fbx", "Standing Walk Forward.fbx", "Running.fbx",
    "Standing Sprint Forward.fbx", "Standing Jump.fbx",
    "Standing 1H Magic Attack 01.fbx", "Standing 2H Magic Attack 01.fbx",
    "Standing 2H Cast Spell 01.fbx", "Standing 2H Magic Area Attack 01.fbx",
    "Standing React Small From Front.fbx", "Standing React Death Forward.fbx"
  )
  foreach ($a in $keyAnims) {
    $srcFile = Join-Path $animSrc $a
    if (Test-Path -LiteralPath $srcFile) {
      Copy-Item -LiteralPath $srcFile -Destination "$DST/animations" -Force
    }
  }
  Write-Output "[OK] Animations cles copiees (FBX - conversion GLB requise)"
}

Write-Output ""
Write-Output "=== Copie terminee. Cible : $DST ==="
$count = (Get-ChildItem -Path $DST -Recurse -File | Measure-Object).Count
Write-Output "Total fichiers copies : $count"
