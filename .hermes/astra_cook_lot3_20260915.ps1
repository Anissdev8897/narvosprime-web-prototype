$ErrorActionPreference = 'Stop'
$taskRoot = 'D:/mes_projet/narvosprime-web-prototype'
$taskAdk = "$taskRoot/WebPortal/Server/adk"
if (Get-Process UnrealEditor,UnrealEditor-Cmd -ErrorAction SilentlyContinue) { throw 'Unreal tourne deja' }
foreach ($taskName in @('mcs_postprocess_resultat','noise_correction','city_orm_repli','ik_mains')) {
 $taskProof = Get-Content -Raw "$taskRoot/.hermes/ASTRA_${taskName}_20260915.json" | ConvertFrom-Json
 if (-not $taskProof.ok) { throw "Preuve invalide : $taskName" }
}
$taskOutput = "$taskAdk/Saved/Ck3"
if (Test-Path -LiteralPath $taskOutput) { throw 'Sortie deja presente' }
$taskMeshes = (Get-Content -Raw "$taskRoot/.hermes/ASTRA_mcs_postprocess_resultat_20260915.json" | ConvertFrom-Json).meshes
$taskPackages = @(
 '/Game/Narvos/PontMetaHuman/BP_NarvosMH_F',
 '/Game/Narvos/PontMetaHuman/BP_NarvosMH_M',
 '/Game/Narvos/MetaCustom/Skeletal_Meshes/Metahuman_Tall_Medium_Female/SK_Set_3_Work_Skirt',
 '/Game/Narvos/MetaCustom/Skeletal_Meshes/Metahuman_Tall_Medium_Female/SK_Set_3_Work_Top',
 '/Game/Narvos/PontMetaHuman/IK_NarvosMetaHuman',
 '/Game/Narvos/PontMetaHuman/IK_NarvosMetaHumanCorps',
 '/Game/Narvos/PontMetaHuman/RTG_NanosVersMetaHuman',
 '/Game/Narvos/PontMetaHuman/RTG_NanosVersMetaHumanCorps'
)
$taskPackages += @($taskMeshes | ForEach-Object { $_.mesh.Split('.')[0] })
$taskRequired = $taskPackages + @('/Game/Narvos/Maps/Map_Narvos','/Game/Narvos/Maps/Map_Orbital','/Game/Narvos/Maps/Map_Megastructure','/Game/Narvos/MetaCustom/Material/Inst_Set_3_Work_Suit')
$taskShips = Get-ChildItem -LiteralPath "$taskAdk/Content/Narvos/SpaceShips_Vol1" -Recurse -Filter 'BP_GB*.uasset' | Where-Object { $_.BaseName -ne 'BP_GB5_NukeFrigate_Missile' }
if ($taskShips.Count -ne 5) { throw 'Inventaire vaisseaux inattendu' }
$taskRequired += @($taskShips | ForEach-Object { '/Game/' + [IO.Path]::GetRelativePath("$taskAdk/Content",$_.FullName).Replace('\','/').Replace('.uasset','') })
$taskArgs = @(
 ('"' + "$taskAdk/NanosWorldADK.uproject" + '"'),
 '-run=Cook', '-TargetPlatform=Windows', '-unattended', '-nosplash', '-NoSound',
 '-DisablePlugins=UnrealMCPServer',
 '-ini:Game:[/Script/UnrealEd.ProjectPackagingSettings]:bCookAll=False',
 '-Map=/Game/Narvos/Maps/Map_Narvos',
 ('-PACKAGE=' + ($taskPackages -join '+')),
 ('-CookDir="' + "$taskAdk/Content/Narvos/SpaceShips_Vol1" + '"'),
 ('-OutputDir="' + "$taskOutput/[Platform]" + '"'),
 ('-abslog="' + "$taskRoot/.hermes/ASTRA_cook_lot3_20260915.log" + '"')
)
$taskRecord = @{start=[DateTime]::UtcNow.ToString('o');arguments=$taskArgs;output=$taskOutput;required_packages=$taskRequired;status='running'}
$taskProc = Start-Process -FilePath 'D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe' -ArgumentList $taskArgs -WindowStyle Hidden -PassThru
$taskRecord.pid=$taskProc.Id
$taskRecord | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 "$taskRoot/.hermes/ASTRA_cook_lot3_process_20260915.json"
$taskProc.WaitForExit()
$taskRecord.end=[DateTime]::UtcNow.ToString('o');$taskRecord.exit_code=$taskProc.ExitCode;$taskRecord.status='exited'
$taskRecord | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 "$taskRoot/.hermes/ASTRA_cook_lot3_process_20260915.json"
Write-Output "Cook lot 3 termine, code $($taskProc.ExitCode). Aucune livraison automatique."