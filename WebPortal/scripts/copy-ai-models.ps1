# Script pour copier les modeles IA depuis model_ai_3D vers narvosprime-web-prototype
# Usage: .\scripts\copy-ai-models.ps1

$sourceDir = "C:\mes_projets\model_ai_3D\09-Chatbot"
$targetDir = "C:\mes_projets\narvosprime-web-prototype\public"

Write-Host "🚀 Copie des modeles IA..." -ForegroundColor Cyan

# Creer le dossier public s'il n'existe pas
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

# Modeles disponibles
$models = @("LysringV4", "Mistral-7B-v0.1", "Qwen3-4B")

foreach ($model in $models) {
    $sourcePath = Join-Path $sourceDir $model
    $targetPath = Join-Path $targetDir $model
    
    if (Test-Path $sourcePath) {
        Write-Host "📦 Copie de $model..." -ForegroundColor Yellow
        
        # Supprimer l'ancien dossier s'il existe
        if (Test-Path $targetPath) {
            Remove-Item -Path $targetPath -Recurse -Force
            Write-Host "   ✓ Ancien dossier supprime" -ForegroundColor Gray
        }
        
        # Copier le modele
        Copy-Item -Path $sourcePath -Destination $targetPath -Recurse -Force
        
        # Verifier les fichiers requis
        $configFile = Join-Path $targetPath "config.json"
        if (Test-Path $configFile) {
            Write-Host "   ✅ $model copie avec succes" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Attention: config.json non trouve dans $model" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ❌ $model non trouve dans $sourcePath" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "✅ Copie terminee!" -ForegroundColor Green
Write-Host "📂 Modeles disponibles dans: $targetDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 Pour utiliser un modele different, modifiez services/localAIService.ts" -ForegroundColor Yellow
