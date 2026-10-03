$ErrorActionPreference = 'Stop'
$taskRoot = 'D:/mes_projet/narvosprime-web-prototype'
$taskAdk = "$taskRoot/WebPortal/Server/adk"
if (Get-Process UnrealEditor,UnrealEditor-Cmd -ErrorAction SilentlyContinue) { throw 'Unreal tourne deja' }
foreach ($taskName in @('face_activation','face_geometrie_realtime','face_nettoyage')) {
 $taskProof = Get-Content -Raw "$taskRoot/.hermes/ASTRA_${taskName}_20260915.json" | ConvertFrom-Json
 if (-not $taskProof.ok) { throw "Preuve invalide : $taskName" }
}
$taskOutput = "$taskAdk/Saved/Ck4"
if (Test-Path -LiteralPath $taskOutput) { throw 'Sortie deja presente' }
$taskPackages = @('/Game/Narvos/PontMetaHuman/BP_NarvosMH_F','/Game/Narvos/PontMetaHuman/BP_NarvosMH_M','/Game/Narvos/PontMetaHuman/ABP_NarvosPersonnalisationVisage')
$taskArgs = @(
 ('"' + "$taskAdk/NanosWorldADK.uproject" + '"'),
 '-run=Cook', '-TargetPlatform=Windows', '-unattended', '-nosplash', '-NoSound',
 '-DisablePlugins=UnrealMCPServer',
 '-ini:Game:[/Script/UnrealEd.ProjectPackagingSettings]:bCookAll=False',
 '-Map=/Game/NanosWorld/Maps/NanosWorldEntryMap',
 ('-PACKAGE=' + ($taskPackages -join '+')),
 ('-OutputDir="' + "$taskOutput/[Platform]" + '"'),
 ('-abslog="' + "$taskRoot/.hermes/ASTRA_cook_lot4_20260915.log" + '"')
)
$taskRecord = @{start=[DateTime]::UtcNow.ToString('o');arguments=$taskArgs;output=$taskOutput;required_packages=$taskPackages;status='running'}
$taskProc = Start-Process -FilePath 'D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe' -ArgumentList $taskArgs -WindowStyle Hidden -PassThru
$taskRecord.pid=$taskProc.Id
$taskRecord | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 "$taskRoot/.hermes/ASTRA_cook_lot4_process_20260915.json"
$taskProc.WaitForExit()
$taskRecord.end=[DateTime]::UtcNow.ToString('o');$taskRecord.exit_code=$taskProc.ExitCode;$taskRecord.status='exited'
$taskRecord | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 "$taskRoot/.hermes/ASTRA_cook_lot4_process_20260915.json"
Write-Output "Cook lot 4 termine, code $($taskProc.ExitCode). Aucune livraison automatique."