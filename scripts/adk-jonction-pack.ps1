# ══════════════════════════════════════════════════════════════════════════════
# adk-jonction-pack.ps1 — remplacer la COPIE d'un pack dans l'ADK par une
# JONCTION vers son dossier d'origine dans asset_game.
#
#   powershell -File scripts\adk-jonction-pack.ps1 -Source "<asset_game>\...\Content\Hyper" -Cible "<adk>\Content\Hyper"
#
# ── POURQUOI ──────────────────────────────────────────────────────────────────
# Le 2026-09-12, Hyper Inventory V2 a ete COPIE dans l'ADK : 10,2 Go en double.
# Hanibes : « tu préfères pas déplacer que copier, c'est énorme de copier ».
#
# Deplacer aurait retire le pack d'asset_game, ou il est la SEULE copie connue
# de ce qu'il a achete (aucune archive d'origine retrouvee). La jonction evite
# les deux couts : zero octet duplique, et l'original reste a sa place.
#
# ── ⚠ CE QUE LA JONCTION IMPLIQUE ─────────────────────────────────────────────
# L'editeur voit le pack a son chemin d'origine (`/Game/Hyper/`) et le LIT sans
# le modifier : un commandlet, un export ou un cook ne sauvegardent rien. MAIS
# un asset Hyper ouvert puis SAUVE dans l'editeur serait reecrit DANS
# asset_game, en 5.7. La promotion sous Narvos/ cree de NOUVEAUX fichiers et ne
# touche pas l'original.
#
# ── LE SEUL RETRAIT, ET SA GARDE ──────────────────────────────────────────────
# La copie de l'ADK est retiree — et SEULEMENT si elle est identique a la source,
# fichier pour fichier (nombre ET octets). Une difference arrete tout : elle
# voudrait dire que l'editeur a deja reecrit la copie, et ces octets-la n'existent
# nulle part ailleurs.
# ══════════════════════════════════════════════════════════════════════════════
param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Cible
)

$ErrorActionPreference = "Stop"

function Mesure($dossier) {
    $f = Get-ChildItem -LiteralPath $dossier -Recurse -File -Force
    return [pscustomobject]@{
        Fichiers = ($f | Measure-Object).Count
        Octets   = ($f | Measure-Object -Property Length -Sum).Sum
    }
}

if (Get-Process | Where-Object { $_.ProcessName -like "*UnrealEditor*" }) {
    Write-Output "ARRET : un processus Unreal tourne. Il lit peut-etre la cible."
    exit 1
}
if (-not (Test-Path -LiteralPath $Source)) {
    Write-Output "ARRET : source absente : $Source"
    exit 1
}

$item = Get-Item -LiteralPath $Cible -Force -ErrorAction SilentlyContinue
if ($item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    Write-Output "Deja une jonction : $Cible -> $($item.Target)"
    exit 0
}

$src = Mesure $Source
Write-Output ("source : {0} fichier(s), {1:N0} octet(s)" -f $src.Fichiers, $src.Octets)

if ($item) {
    $cop = Mesure $Cible
    Write-Output ("copie  : {0} fichier(s), {1:N0} octet(s)" -f $cop.Fichiers, $cop.Octets)
    if ($cop.Fichiers -ne $src.Fichiers -or $cop.Octets -ne $src.Octets) {
        Write-Output "ARRET : la copie DIFFERE de la source. Elle a peut-etre ete reecrite par"
        Write-Output "        l'editeur ; ces octets n'existent nulle part ailleurs. Rien n'est retire."
        exit 1
    }
    Remove-Item -LiteralPath $Cible -Recurse -Force
    Write-Output "copie identique retiree"
}

# Le PARENT doit exister : vrai pour `Content/Hyper`, faux pour
# `Content/Hypernova/CrystalKeeper` (2026-09-13). Un dossier, jamais un fichier :
# `-Force` sur un dossier cree s'il manque et ne vide rien.
$parent = Split-Path -Parent $Cible
if (-not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
    Write-Output "dossier parent cree : $parent"
}

New-Item -ItemType Junction -Path $Cible -Target $Source | Out-Null

# ⚠ LE SEUL CONTROLE QUI VAUT : un recompte A TRAVERS la jonction.
$via = Mesure $Cible
Write-Output ("via la jonction : {0} fichier(s), {1:N0} octet(s)" -f $via.Fichiers, $via.Octets)
if ($via.Fichiers -ne $src.Fichiers) {
    Write-Output "ARRET : la jonction ne rend pas le meme contenu."
    exit 1
}
Write-Output "jonction posee : $Cible -> $Source"