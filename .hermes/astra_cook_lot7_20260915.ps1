$ErrorActionPreference = 'Stop'
$taskRoot='D:/mes_projet/narvosprime-web-prototype'
$taskAdk="$taskRoot/WebPortal/Server/adk"
if(Get-Process UnrealEditor,UnrealEditor-Cmd -ErrorAction SilentlyContinue){throw 'Unreal tourne deja'}
$taskProof=Get-Content -Raw "$taskRoot/.hermes/ASTRA_mcs_lot7_source_20260915.json" | ConvertFrom-Json
if(-not $taskProof.ok){throw 'Source non verifiee'}
$taskPackages=@('/Game/Narvos/PontMetaHuman/BP_NarvosMH_M','/Game/Narvos/PontMetaHuman/BP_NarvosMH_F')
$taskOutput="$taskAdk/Saved/Ck7"
if(Test-Path -LiteralPath $taskOutput){throw 'Sortie deja presente'}
$taskArgs=@(('"'+"$taskAdk/NanosWorldADK.uproject"+'"'),'-run=Cook','-TargetPlatform=Windows','-unattended','-nosplash','-NoSound','-DisablePlugins=UnrealMCPServer','-ini:Game:[/Script/UnrealEd.ProjectPackagingSettings]:bCookAll=False','-Map=/Game/NanosWorld/Maps/NanosWorldEntryMap',('-PACKAGE='+($taskPackages -join '+')),('-OutputDir="'+"$taskOutput/[Platform]"+'"'),('-abslog="'+"$taskRoot/.hermes/ASTRA_cook_lot7_20260915.log"+'"'))
$taskRecord=@{start=[DateTime]::UtcNow.ToString('o');arguments=$taskArgs;output=$taskOutput;required_packages=$taskPackages;status='running'}
$taskProc=Start-Process 'D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe' -ArgumentList $taskArgs -WindowStyle Hidden -PassThru
$taskRecord.pid=$taskProc.Id
$taskRecord | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 "$taskRoot/.hermes/ASTRA_cook_lot7_process_20260915.json"
$taskProc.WaitForExit()
$taskRecord.end=[DateTime]::UtcNow.ToString('o');$taskRecord.exit_code=$taskProc.ExitCode;$taskRecord.status='exited'
$taskRecord | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 "$taskRoot/.hermes/ASTRA_cook_lot7_process_20260915.json"
Write-Output "Cook lot7 termine, code $($taskProc.ExitCode). Pas de livraison automatique."