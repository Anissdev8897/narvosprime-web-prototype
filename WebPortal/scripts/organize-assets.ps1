# ==============================================================================
# WebPortal/scripts/organize-assets.ps1 - Organise les assets RPG
#
# Source : public/models/assets_character/
# Cible  : public/models/assets_character/rpg/
# ==============================================================================

$ErrorActionPreference = "Stop"

$BASE_PATH = "E:/narvosprime-web-prototype/WebPortal"
$SRC = "$BASE_PATH/public/models/assets_character"
$DST = "$BASE_PATH/public/models/assets_character/rpg"

# 1) Creation des repertoires cibles
$dirs = @(
  "$DST/characters/ModularParts",
  "$DST/characters/Outfits",
  "$DST/characters/textures",
  "$DST/weapons",
  "$DST/animations"
)
foreach ($d in $dirs) {
  if (-not (Test-Path -LiteralPath $d)) {
    New-Item -ItemType Directory -Path $d -Force | Out-Null
    Write-Output "Dossier cree : $d"
  }
}

# 2) Copie des parties modulaires (glTF + bin)
$modularSrc = "$SRC/Modular Character Outfits - Fantasy[Source]/Exports/glTF (Godot-Unreal)/Modular Parts"
if (Test-Path -LiteralPath $modularSrc) {
  Get-ChildItem -LiteralPath $modularSrc -Include *.gltf,*.bin,*.png -Recurse | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination "$DST/characters/ModularParts" -Force
  }
  Write-Output "[OK] Parties modulaires copiees"
} else {
  Write-Output "[!] Source Modular Parts introuvable : $modularSrc"
}

# 3) Copie des tenues completes (Outfits)
$outfitSrc = "$SRC/Modular Character Outfits - Fantasy[Source]/Exports/glTF (Godot-Unreal)/Outfits"
if (Test-Path -LiteralPath $outfitSrc) {
  Get-ChildItem -LiteralPath $outfitSrc -Include *.gltf,*.bin,*.png -Recurse | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination "$DST/characters/Outfits" -Force
  }
  Write-Output "[OK] Tenues completes copiees"
}

# 4) Copie des textures PBR a plat
$texSrc = "$SRC/Modular Character Outfits - Fantasy[Source]/Textures"
if (Test-Path -LiteralPath $texSrc) {
  Get-ChildItem -LiteralPath $texSrc -Include *.png -Recurse | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination "$DST/characters/textures" -Force
  }
  Write-Output "[OK] Textures PBR copiees"
}

# 5) Copie et renommage des armes (Sorceres weapons)
$weaponMap = @{
  "arcane+staff+3d+model_epic_GLB.glb" = "arcane_staff_epic.glb"
  "fantasy+staff+3d+model_GLB.glb"     = "fantasy_staff.glb"
  "wooden+wand+3d+model_GLB.glb"       = "wooden_wand.glb"
}
$weaponSrc = "$SRC/Sorceres_hi_poly/Weapons"
foreach ($srcName in $weaponMap.Keys) {
  $srcFile = Join-Path $weaponSrc $srcName
  if (Test-Path -LiteralPath $srcFile) {
    Copy-Item -LiteralPath $srcFile -Destination "$DST/weapons/$($weaponMap[$srcName])" -Force
    Write-Output "[OK] Arme copiee : $($weaponMap[$srcName])"
  } else {
    Write-Output "[!] Arme source introuvable : $srcFile"
  }
}

# 6) Copie des animations (FBX Sorceres)
$animSrc = "$SRC/Sorceres_hi_poly"
if (Test-Path -LiteralPath $animSrc) {
  $keyAnims = @(
    "Breathing Idle.fbx", "Running.fbx",
    "Standing Sprint Forward.fbx",
    "Standing 2H Cast Spell 01.fbx", "Standing 2H Magic Attack 01.fbx",
    "Standing 2H Magic Area Attack 01.fbx", "Standing React Death Forward.fbx"
  )
  foreach ($a in $keyAnims) {
    $srcFile = Join-Path $animSrc $a
    if (Test-Path -LiteralPath $srcFile) {
      Copy-Item -LiteralPath $srcFile -Destination "$DST/animations" -Force
      Write-Output "[OK] Anim copiee : $a"
    } else {
      Write-Output "[!] Anim introuvable : $srcFile"
    }
  }
}

Write-Output ""
Write-Output "=== Organisation terminee avec succes. ==="
