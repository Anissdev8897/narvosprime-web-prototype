$ErrorActionPreference='Stop'
$taskRoot='D:/mes_projet/narvosprime-web-prototype'
$taskAdk="$taskRoot/WebPortal/Server/adk"
if (Get-Process UnrealEditor,UnrealEditor-Cmd -ErrorAction SilentlyContinue) {throw 'Unreal actif'}
if (-not (Get-Content -Raw "$taskRoot/.hermes/ASTRA_city_orm_repli_20260915.json" | ConvertFrom-Json).ok) {throw 'Repli non valide'}
$taskPlan=Get-Content -Raw "$taskRoot/.hermes/ASTRA_city_shader_lot2_plan_20260915.json" | ConvertFrom-Json
$taskPackages=@($taskPlan.assets | Where-Object restore | ForEach-Object {$_.new})
$taskOutput="$taskAdk/Saved/Cm3"
if (Test-Path -LiteralPath $taskOutput) {throw 'Sortie deja presente'}
$taskArgs=@(
 ('"'+"$taskAdk/NanosWorldADK.uproject"+'"'),'-run=Cook','-TargetPlatform=Windows',
 '-unattended','-nosplash','-NoSound','-DisablePlugins=UnrealMCPServer',
 '-ini:Game:[/Script/UnrealEd.ProjectPackagingSettings]:bCookAll=False',
 '-CookSinglePackage',('-PACKAGE='+($taskPackages -join '+')),
 ('-OutputDir="'+"$taskOutput/[Platform]"+'"'),
 ('-abslog="'+"$taskRoot/.hermes/ASTRA_cook_materiaux_20260915.log"+'"')
)
$taskStart=[DateTime]::UtcNow.ToString('o')
$taskProc=Start-Process -FilePath 'D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe' -ArgumentList $taskArgs -WindowStyle Hidden -PassThru
@{status='running';pid=$taskProc.Id;output=$taskOutput;start=$taskStart;scope='18 materiaux et dependances'} | ConvertTo-Json | Set-Content -Encoding utf8 "$taskRoot/.hermes/ASTRA_cook_materiaux_process_20260915.json"
$taskProc.WaitForExit()
@{status='exited';pid=$taskProc.Id;output=$taskOutput;start=$taskStart;end=[DateTime]::UtcNow.ToString('o');exit_code=$taskProc.ExitCode;scope='18 materiaux et dependances'} | ConvertTo-Json | Set-Content -Encoding utf8 "$taskRoot/.hermes/ASTRA_cook_materiaux_process_20260915.json"
Write-Output "Qualification materiaux terminee : $($taskProc.ExitCode)"