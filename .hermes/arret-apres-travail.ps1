# ==============================================================================
# arret-apres-travail.ps1 - eteindre le PC la nuit du 2026-09-12 au 13, sans rien
# couper.
#
# Demande de Hanibes : " tu peux eteindre le pc a 3 ", puis " calcul selon le
# cook ", puis " mon telechargement se finit a 3 ".
#
# DONC DEUX CONDITIONS, TOUTES LES DEUX :
#   1. PAS AVANT 03:00 - un telechargement se termine a cette heure-la.
#   2. JAMAIS PENDANT UN TRAVAIL EN COURS :
#        - un cook Unreal (UnrealEditor-Cmd) : l'interrompre ne perd rien, mais
#          il faudrait le relancer en entier ;
#        - la reconstruction du pack (node nanos-build-asset-pack.mjs) : elle VIDE
#          la destination avant de recopier. Coupee au milieu, elle laisse le pack
#          nanos a moitie vide et le serveur ne demarre plus.
#
# !! TROIS CONSTATS " RIEN NE TOURNE " D'AFFILEE, A 60 s D'INTERVALLE. Entre la fin
# d'un cook et le debut de la reconstruction du pack, il n'y a que quelques
# secondes sans processus : un seul constat pourrait tomber pile dans ce trou.
#
# !! PLAFOND A 06:30, SAUF POUR LE PACK. Un cook fige ne doit pas garder le PC
# allume toute la journee ; un cook coupe ne perd rien. La reconstruction du pack,
# elle, n'est JAMAIS coupee, meme passe le plafond.
#
# Journal : .hermes/arret.log
# ==============================================================================

$journal = "D:\mes_projet\narvosprime-web-prototype\.hermes\arret.log"
function Dire($t) { "{0}  {1}" -f (Get-Date -Format "HH:mm:ss"), $t | Add-Content -Path $journal -Encoding utf8 }

function TravailEnCours {
    $cook = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like "UnrealEditor*" })
    $pack = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match "nanos-build-asset-pack|adk-copier-hyper" })
    return [pscustomobject]@{ Cook = $cook.Count; Pack = $pack.Count }
}

Dire "veilleur demarre (PID $PID)"

$trois = (Get-Date).Date.AddHours(3)
if ($trois -lt (Get-Date).AddHours(-12)) { $trois = $trois.AddDays(1) }
$plafond = $trois.Date.AddHours(6).AddMinutes(30)

while ((Get-Date) -lt $trois) { Start-Sleep -Seconds 60 }
Dire "03:00 atteint - j'attends la fin du travail en cours"

$libres = 0
while ($libres -lt 3) {
    $t = TravailEnCours
    if ($t.Cook -eq 0 -and $t.Pack -eq 0) {
        $libres++
        Dire "rien ne tourne ($libres/3)"
    } else {
        if ($libres -gt 0) { Dire "travail repris (cook=$($t.Cook), pack=$($t.Pack)) - compteur remis a zero" }
        $libres = 0
        if ((Get-Date) -gt $plafond -and $t.Pack -eq 0) {
            Dire "plafond 06:30 depasse avec seulement un cook en cours - un cook coupe ne perd rien : arret"
            break
        }
    }
    Start-Sleep -Seconds 60
}

Dire "arret dans 120 s"
shutdown.exe /s /t 120 /c "NARVOS : travail de nuit termine, arret demande par Hanibes"
Dire "shutdown a rendu $LASTEXITCODE"