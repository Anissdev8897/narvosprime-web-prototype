$ErrorActionPreference = 'Stop'
$taskRoot = 'D:/mes_projet/narvosprime-web-prototype'
$taskAdk = "$taskRoot/WebPortal/Server/adk"
if (Get-Process UnrealEditor,UnrealEditor-Cmd -ErrorAction SilentlyContinue) { throw 'Unreal tourne deja' }
$taskRefs = Get-Content -Raw "$taskRoot/.hermes/ASTRA_city_resave_resultat_20260915.json" | ConvertFrom-Json
if (-not $taskRefs.ok) { throw 'References ville non validees' }
& node "$taskRoot/scripts/lua-harness/rendu-client-check.mjs"
if ($LASTEXITCODE -ne 0) { throw 'Reglages de rendu incompatibles' }
$taskOutput = "$taskAdk/Saved/Cooked-Astra-20260915"
if (Test-Path -LiteralPath $taskOutput) { throw 'Sortie de cook deja presente : inspecter avant relance' }
$taskArgs = @(
 '"' + "$taskAdk/NanosWorldADK.uproject" + '"',
 '-run=Cook', '-TargetPlatform=Windows', '-unattended', '-nosplash', '-NoSound',
 '-DisablePlugins=UnrealMCPServer',
 '-ini:Game:[/Script/UnrealEd.ProjectPackagingSettings]:bCookAll=False',
 '-Map=/Game/Narvos/Maps/Map_Narvos',
 '-CookDir="' + "$taskAdk/Content/Narvos/PontMetaHuman" + '"',
 '-CookDir="' + "$taskAdk/Content/Narvos/SpaceShips_Vol1" + '"',
 '-CookDir="' + "$taskAdk/Content/Narvos/MetaCustom/Skeletal_Meshes" + '"',
 '-OutputDir="' + "$taskOutput/[Platform]" + '"',
 '-abslog="' + "$taskRoot/.hermes/ASTRA_cook_lot_20260915.log" + '"'
)
$taskStart = [DateTime]::UtcNow.ToString('o')
$taskProc = Start-Process -FilePath 'D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe' -ArgumentList $taskArgs -WindowStyle Hidden -PassThru
@{start=$taskStart;pid=$taskProc.Id;arguments=$taskArgs;output=$taskOutput;status='running'} | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 "$taskRoot/.hermes/ASTRA_cook_lot_process_20260915.json"
$taskProc.WaitForExit()
@{start=$taskStart;end=[DateTime]::UtcNow.ToString('o');pid=$taskProc.Id;exit_code=$taskProc.ExitCode;output=$taskOutput;status='exited'} | ConvertTo-Json | Set-Content -Encoding utf8 "$taskRoot/.hermes/ASTRA_cook_lot_process_20260915.json"
Write-Output "Cook termine, code $($taskProc.ExitCode). Aucune livraison automatique."