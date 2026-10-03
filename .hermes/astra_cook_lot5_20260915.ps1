$ErrorActionPreference = 'Stop'
$taskRoot = 'D:/mes_projet/narvosprime-web-prototype'
$taskAdk = "$taskRoot/WebPortal/Server/adk"
if (Get-Process UnrealEditor,UnrealEditor-Cmd -ErrorAction SilentlyContinue) { throw 'Unreal tourne deja' }
$taskProof = Get-Content -Raw "$taskRoot/.hermes/ASTRA_forge_collisions_reparation_20260915.json" | ConvertFrom-Json
if (-not $taskProof.ok -or $taskProof.modified.Count -ne 623) { throw 'Reparation non verifiee' }
$taskOutput = "$taskAdk/Saved/Ck5"
if (Test-Path -LiteralPath $taskOutput) { throw 'Sortie deja presente' }
$taskPackages = @($taskProof.modified)
$taskArgs = @(
 ('"' + "$taskAdk/NanosWorldADK.uproject" + '"'),
 '-run=Cook', '-TargetPlatform=Windows', '-unattended', '-nosplash', '-NoSound',
 '-DisablePlugins=UnrealMCPServer',
 '-ini:Game:[/Script/UnrealEd.ProjectPackagingSettings]:bCookAll=False',
 '-Map=/Game/NanosWorld/Maps/NanosWorldEntryMap',
 ('-CookDir="' + "$taskAdk/Content/Narvos/chunks_unreal_v3" + '"'),
 ('-OutputDir="' + "$taskOutput/[Platform]" + '"'),
 ('-abslog="' + "$taskRoot/.hermes/ASTRA_cook_lot5_20260915.log" + '"')
)
$taskRecord = @{start=[DateTime]::UtcNow.ToString('o');arguments=$taskArgs;output=$taskOutput;required_packages=$taskPackages;status='running'}
$taskProc = Start-Process -FilePath 'D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe' -ArgumentList $taskArgs -WindowStyle Hidden -PassThru
$taskRecord.pid=$taskProc.Id
$taskRecord | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 "$taskRoot/.hermes/ASTRA_cook_lot5_process_20260915.json"
$taskProc.WaitForExit()
$taskRecord.end=[DateTime]::UtcNow.ToString('o');$taskRecord.exit_code=$taskProc.ExitCode;$taskRecord.status='exited'
$taskRecord | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 "$taskRoot/.hermes/ASTRA_cook_lot5_process_20260915.json"
Write-Output "Cook lot 5 termine, code $($taskProc.ExitCode). Aucune livraison automatique."