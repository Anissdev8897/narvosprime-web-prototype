# ══════════════════════════════════════════════════════════════════════════════
# adk-convertir-world-partition.ps1 — passer Map_Narvos en World Partition.
#
#   powershell -File scripts/adk-convertir-world-partition.ps1
#   powershell -File scripts/adk-convertir-world-partition.ps1 -Appliquer
#
# ⚠ ÉDITEUR FERMÉ. Un commandlet et l'éditeur ne cohabitent pas : le commandlet
#    prend le verrou du projet et échoue, ou pire, écrit pendant que l'éditeur
#    tient les mêmes paquets en mémoire.
#
# ── CE QUE FAIT LA CONVERSION, ET POURQUOI ELLE VA À NOTRE CAS ────────────────
# `UWorldPartitionConvertCommandlet` ne convertit pas seulement un niveau : il
# RAMASSE SES SOUS-NIVEAUX et les fond dans le monde partitionné
# (`GatherAndPrepareSubLevelsToConvert`, UE 5.7 source, WorldPartitionConvert-
# Commandlet.cpp:274). Notre assemblage du 2026-09-06 — `Map_Narvos` persistant
# + `Map_Orbital`/`Map_Forge`/`Map_Tower`/`Map_Alien` en LevelStreamingDynamic
# décalés — est donc exactement son entrée.
#
# Ce que ça change, concrètement :
#
#   AVANT (sous-niveaux)                  APRÈS (World Partition)
#   ────────────────────────              ───────────────────────────────────
#   4 niveaux chargés d'un bloc           cellules chargées autour du joueur
#   tout ou rien, par niveau              granularité = la cellule
#   pas de HLOD                           HLOD sur ce qui est hors cellule
#   pas de Data Layer                     un Data Layer par monde
#   Level.LoadStreamLevel(nom)            plus utile : le streaming est spatial
#
# ── POURQUOI C'EST SÛR À ESSAYER ─────────────────────────────────────────────
# Le commandlet écrit une map NOUVELLE, suffixée (`GetConversionSuffix`) : la
# `Map_Narvos` actuelle n'est pas touchée. On compare, puis on renomme.
#
# ── ⚠ ESSAI DU 2026-09-06 : ÉCHEC MESURÉ, ET SA CAUSE ────────────────────────
#
# Première exécution : 14 minutes de conversion, puis CRASH, code de sortie 3.
#
#     LogWorldPartitionConvertCommandlet: Display: PartitionLandscape started...
#     Assertion failed: WorldPartition
#     Engine/Source/Runtime/Engine/Private/ActorPartition/ActorPartitionSubsystem.cpp:250
#
# La ligne qui assère est `UWorldPartition* WorldPartition = InCellCoord.Level->
# GetWorldPartition(); check(WorldPartition);`. Elle est atteinte depuis
# `FLandscapeConfigHelper::PartitionLandscape`, appelée en fin de conversion
# (WorldPartitionConvertCommandlet.cpp:1097).
#
# Autrement dit : le partitionnement d'un Landscape demande que son niveau porte
# un World Partition. Nos trois Landscape vivent encore dans des SOUS-NIVEAUX au
# moment où l'étape tourne, et un sous-niveau n'en a pas.
#
# Rien n'a été abîmé : aucune carte n'a été écrite, les cinq `.umap` d'origine
# ont gardé leur horodatage.
#
# ── LES DEUX VOIES QUI RESTENT, ET CE QU'IL FAUT VÉRIFIER AVANT ──────────────
#
# A. EN DEUX PASSES. `-OnlyMergeSubLevels` saute justement `PartitionFoliage` ET
#    `PartitionLandscape` (le même `if (!bOnlyMergeSubLevels)`, ligne 1076), et
#    écrit un `_OFPA` où tout est fondu dans UN niveau. Une seconde passe,
#    normale cette fois, trouverait alors les Landscape dans le niveau principal.
#
#    ⚠ À VÉRIFIER AVANT DE S'Y FIER : la fusion applique-t-elle la
#    `LevelTransform` de chaque sous-niveau ? Nos trois mondes ne se distinguent
#    QUE par elle (−80 km, +20 km, +40 km). Si la fusion l'ignore, les trois
#    Landscape se superposent à l'origine — et c'est irrécupérable sans repartir
#    de la sauvegarde.
#
# B. CUIRE LES DÉCALAGES D'ABORD. Déplacer les acteurs de chaque sous-niveau à
#    leur position finale, remettre chaque `LevelTransform` à l'identité, PUIS
#    convertir. Plus long, mais la variable qui gêne disparaît au lieu d'être
#    contournée.
#
# Tant que l'un des deux n'est pas mesuré, l'assemblage en sous-niveaux reste la
# version qui marche, et c'est elle qu'on cuit.

# ── CE QUI RESTE À VÉRIFIER APRÈS, ET QUI NE SE DEVINE PAS ───────────────────
#   1. le cook nanos accepte-t-il une map partitionnée ? La doc nanos annonce le
#      support (blog de janvier 2023, copie locale
#      `docs/docs-master/blog/2023-02-01-january.mdx:157` : « full support to
#      Level Streaming and World Partition … integrated with Level Entities ») —
#      annoncé n'est pas mesuré ;
#   2. le SERVEUR streame-t-il ? `WorldPartitionServerStreamingMode` existe dans
#      le moteur ; par défaut un serveur dédié charge TOUT. Si nanos laisse le
#      défaut, la mémoire serveur ne baisse pas — seul le client y gagne ;
#   3. les Landscapes : la conversion les découpe en LandscapeStreamingProxy.
#      Recompter les composants après, jamais se fier au « Success » du log.
# ══════════════════════════════════════════════════════════════════════════════

param(
    [switch]$Appliquer,
    [string]$Carte = "/Game/Narvos/Maps/Map_Narvos"
)

$ErrorActionPreference = "Stop"

$Racine = Split-Path -Parent $PSScriptRoot
$Projet = Join-Path $Racine "WebPortal\Server\adk\NanosWorldADK.uproject"
$Editeur = "D:\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe"

if (-not (Test-Path $Projet)) { throw "Projet introuvable : $Projet" }
if (-not (Test-Path $Editeur)) { throw "Editeur introuvable : $Editeur" }

# L'editeur tient-il le projet ? Un commandlet lance par-dessus echoue tard, avec
# un message qui ne designe pas la cause.
$ouvert = Get-Process -Name "UnrealEditor" -ErrorAction SilentlyContinue
if ($ouvert) {
    throw "L'editeur Unreal tourne (PID $($ouvert.Id -join ', ')). Le fermer avant de convertir."
}

# -AllowCommandletRendering : la conversion construit des proxies HLOD, qui
# demandent le rendu. Sans lui, le commandlet passe mais ne genere aucun HLOD.
$args = @(
    "`"$Projet`"",
    "-run=WorldPartitionConvertCommandlet",
    $Carte,
    "-AllowCommandletRendering",
    "-SkipStableGUIDValidation",
    "-unattended",
    "-nosplash"
)

Write-Host "Carte    : $Carte"
Write-Host "Commande : $Editeur $($args -join ' ')"

if (-not $Appliquer) {
    Write-Host ""
    Write-Host "Simulation. Rien lance. Ajouter -Appliquer pour convertir."
    Write-Host "La carte convertie sera ecrite SOUS UN NOUVEAU NOM : l'originale reste."
    exit 0
}

& $Editeur @args
$code = $LASTEXITCODE
Write-Host ""
Write-Host "Code de sortie : $code"
Write-Host "Log : WebPortal\Server\adk\Saved\Logs\NanosWorldADK.log"
Write-Host ""
Write-Host "⚠ Le code 0 ne prouve rien. Rouvrir l'editeur et RECOMPTER :"
Write-Host "   - les 3 Landscape sont-ils presents et decoupes en proxies ?"
Write-Host "   - les 2 InstancedFoliageActor ont-ils garde leurs instances ?"
Write-Host "   - les 303 acteurs semes dans l'espace sont-ils tous la ?"
exit $code