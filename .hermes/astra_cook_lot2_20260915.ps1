$ErrorActionPreference = 'Stop'
$taskRoot = 'D:/mes_projet/narvosprime-web-prototype'
$taskAdk = "$taskRoot/WebPortal/Server/adk"
if (Get-Process UnrealEditor,UnrealEditor-Cmd -ErrorAction SilentlyContinue) { throw 'Unreal tourne deja' }
$taskProof = Get-Content -Raw "$taskRoot/.hermes/ASTRA_mcs_postprocess_resultat_20260915.json" | ConvertFrom-Json
if (-not $taskProof.ok) { throw 'Postprocess non sauvegardes' }
$taskShader = Get-Content -Raw "$taskRoot/.hermes/ASTRA_city_shader_validation_20260915.json" | ConvertFrom-Json
if (-not $taskShader.ok) { throw 'Materiaux ville non valides' }
$taskOutput = "$taskAdk/Saved/Cooked-Astra-20260915-02"
if (Test-Path -LiteralPath $taskOutput) { throw 'Sortie deja presente' }
# -PACKAGE est explicitement supporte par CookCommandlet.cpp (UE5.7, ligne 366).
# Cibles modifiees et leurs dependances, pas tout le dossier des anciens ponts.
$taskPackages = @(
 '/Game/Narvos/PontMetaHuman/BP_NarvosMH_F',
 '/Game/Narvos/PontMetaHuman/BP_NarvosMH_M',
 '/Game/Narvos/MetaCustom/Skeletal_Meshes/Metahuman_Tall_Medium_Female/SK_Set_3_Work_Skirt',
 '/Game/Narvos/MetaCustom/Skeletal_Meshes/Metahuman_Tall_Medium_Female/SK_Set_3_Work_Top'
)
$taskPackages += @($taskProof.meshes | ForEach-Object { $_.mesh.Split('.')[0] })
$taskArgs = @(
 ('"' + "$taskAdk/NanosWorldADK.uproject" + '"'),
 '-run=Cook', '-TargetPlatform=Windows', '-unattended', '-nosplash', '-NoSound',
 '-DisablePlugins=UnrealMCPServer',
 '-ini:Game:[/Script/UnrealEd.ProjectPackagingSettings]:bCookAll=False',
 '-Map=/Game/Narvos/Maps/Map_Narvos',
 ('-PACKAGE=' + ($taskPackages -join '+')),
 ('-CookDir="' + "$taskAdk/Content/Narvos/SpaceShips_Vol1" + '"'),
 ('-OutputDir="' + "$taskOutput/[Platform]" + '"'),
 ('-abslog="' + "$taskRoot/.hermes/ASTRA_cook_lot2_20260915.log" + '"')
)
$taskStart = [DateTime]::UtcNow.ToString('o')
$taskProc = Start-Process -FilePath 'D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe' -ArgumentList $taskArgs -WindowStyle Hidden -PassThru
@{start=$taskStart;pid=$taskProc.Id;arguments=$taskArgs;output=$taskOutput;status='running'} | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 "$taskRoot/.hermes/ASTRA_cook_lot2_process_20260915.json"
$taskProc.WaitForExit()
@{start=$taskStart;end=[DateTime]::UtcNow.ToString('o');pid=$taskProc.Id;exit_code=$taskProc.ExitCode;output=$taskOutput;status='exited'} | ConvertTo-Json | Set-Content -Encoding utf8 "$taskRoot/.hermes/ASTRA_cook_lot2_process_20260915.json"
Write-Output "Cook lot 2 termine, code $($taskProc.ExitCode). Aucune livraison automatique."