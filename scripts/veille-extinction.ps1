# =============================================================================
# veille-extinction.ps1 - attendre la fin de la promotion, fermer l'editeur,
# eteindre le PC.
#
#   Lance DETACHE : il survit a la fermeture de Claude Code.
#   Annuler la veille  :  Get-Process powershell | Stop-Process
#   Annuler l'extinction une fois lancee :  shutdown /a
#
# -- TOUT EST EN ASCII, ET C'EST DELIBERE ------------------------------------
# Premiere version : un tiret cadratin dans une chaine. PowerShell 5.1 lit le
# fichier en cp1252, l'octet devient trois caracteres, et le parseur meurt sur
# "Jeton inattendu << la >>". Le script n'aurait jamais demarre, et personne
# n'aurait ete la pour le voir. Pas d'accent, pas de tiret long, pas de fleche.
#
# -- COMMENT LA FIN EST DETECTEE ---------------------------------------------
# adk-promouvoir-packs.py termine en imprimant, via journal() :
#     Confirmer dans un processus NEUF : adk-dump-assets.py,
# C'est sa DERNIERE ligne, apres la sauvegarde. On compte ce marqueur : il
# valait 1 au lancement (passe CITY_PACK du 2026-09-08), on attend 2.
#
# ON NE COMPTE PAS LES ASSETS SUR DISQUE : le compte atteindrait sa cible AVANT
# la sauvegarde finale, et on eteindrait pendant l'ecriture. Le marqueur vient
# apres.
#
# -- POURQUOI ATTENDRE LE SILENCE DU JOURNAL ---------------------------------
# Les textures compilent en asynchrone. Le marqueur dit que le script Python a
# rendu la main, pas que le moteur a fini d'ecrire.
# =============================================================================

$ErrorActionPreference = 'Continue'

$Journal   = 'E:\narvosprime-web-prototype\WebPortal\Server\adk\Saved\Logs\NanosWorldADK.log'
$Rapport   = 'E:\narvosprime-web-prototype\.hermes\extinction_auto.txt'
$Marqueur  = 'Confirmer dans un processus NEUF'
$Cible     = 2
$MaxHeures = 10
$SilenceMin = 3

$lignes = New-Object System.Collections.ArrayList
function Dire($texte) {
    $ligne = "{0}  {1}" -f (Get-Date -Format 'HH:mm:ss'), $texte
    [void]$lignes.Add($ligne)
    try { $lignes | Out-File -FilePath $Rapport -Encoding utf8 } catch { }
}

Dire "veille demarree. Marqueur attendu : $Cible occurrence(s)."

$debut = Get-Date
$fini = $false
$raison = ''

while (-not $fini) {
    Start-Sleep -Seconds 120

    $ecoule = (New-TimeSpan -Start $debut -End (Get-Date)).TotalHours
    if ($ecoule -ge $MaxHeures) {
        $raison = "DELAI DEPASSE ($MaxHeures h). La promotion n a pas fini."
        Dire $raison
        break
    }

    # Si l'editeur a disparu, la promotion est incomplete, mais le PC doit
    # s'eteindre : on le note et on continue vers l'extinction.
    $editeur = Get-Process -Name 'UnrealEditor' -ErrorAction SilentlyContinue
    if ($null -eq $editeur) {
        $raison = 'EDITEUR ABSENT : ferme ou plante. Promotion INCOMPLETE.'
        Dire $raison
        break
    }

    if (-not (Test-Path $Journal)) { continue }

    $n = 0
    try {
        $n = (Select-String -Path $Journal -Pattern $Marqueur -SimpleMatch -ErrorAction SilentlyContinue |
              Measure-Object).Count
    } catch { continue }

    if ($n -ge $Cible) {
        $raison = 'PROMOTION TERMINEE (marqueur vu).'
        Dire $raison
        $fini = $true
    }
}

# -- Attendre que le journal se taise ---------------------------------------
Dire 'attente du silence du journal...'
$dernier = -1
$stables = 0
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 60
    $taille = 0
    try { $taille = (Get-Item $Journal -ErrorAction SilentlyContinue).Length } catch { }
    if ($taille -eq $dernier) {
        $stables = $stables + 1
        if ($stables -ge $SilenceMin) { break }
    } else {
        $stables = 0
        $dernier = $taille
    }
}
Dire "journal stable depuis $stables minute(s)."

# -- Fermer l'editeur PROPREMENT --------------------------------------------
#
# CloseMainWindow() envoie WM_CLOSE : l'editeur finit ses ecritures et sort.
# Stop-Process -Force le tue net, a n'employer qu'en dernier recours et
# seulement parce que la sauvegarde du script est deja faite.
$editeur = Get-Process -Name 'UnrealEditor' -ErrorAction SilentlyContinue
if ($null -ne $editeur) {
    Dire 'fermeture de l editeur (WM_CLOSE)...'
    try { [void]$editeur.CloseMainWindow() } catch { }
    $attendu = 0
    while ($attendu -lt 900) {
        Start-Sleep -Seconds 10
        $attendu = $attendu + 10
        $editeur = Get-Process -Name 'UnrealEditor' -ErrorAction SilentlyContinue
        if ($null -eq $editeur) { break }
    }
    if ($null -ne $editeur) {
        Dire 'pas de reponse apres 15 min : arret force (sauvegarde deja faite).'
        try { Stop-Process -Name 'UnrealEditor' -Force -ErrorAction SilentlyContinue } catch { }
        Start-Sleep -Seconds 20
    } else {
        Dire 'editeur ferme proprement.'
    }
} else {
    Dire 'editeur deja absent.'
}

try { Stop-Process -Name 'UnrealTraceServer' -Force -ErrorAction SilentlyContinue } catch { }

# -- Ce qui pourrait retenir l'extinction ------------------------------------
#
# Une seule application avec du travail non sauvegarde suffit a annuler un
# `shutdown /s` : Windows affiche sa boite de dialogue et attend, indefiniment,
# devant un ecran que personne ne regarde. On coupe donc d'abord ce qu'on sait
# etre du travail A NOUS, puis on force le reste.
#
# Releve du 2026-09-09 a 01:27, seuls processus lourds presents :
#   UnrealEditor 13,6 Go (fenetre)  UnrealTraceServer  claude x13  node x4
# Unreal est deja ferme proprement plus haut. Le reste n'a rien a sauvegarder.
foreach ($nom in @('node', 'ShaderCompileWorker', 'UnrealEditor-Cmd', 'EpicWebHelper')) {
    try { Stop-Process -Name $nom -Force -ErrorAction SilentlyContinue } catch { }
}
Dire 'processus annexes coupes.'

# -- Extinction --------------------------------------------------------------
#
# `/f` ferme de force ce qui reste. Sans lui, une seule fenetre qui pose une
# question annule tout : on retrouverait le PC allume au matin, avec une boite
# de dialogue et six heures perdues.
Dire "raison : $raison"
Dire 'extinction dans 60 s. Pour annuler : shutdown /a'
shutdown /s /f /t 60 /c "NARVOS : promotion terminee, extinction programmee. Annuler : shutdown /a"
Dire 'commande d extinction envoyee.'