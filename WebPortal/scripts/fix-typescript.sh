#!/bin/bash
# Script pour corriger automatiquement les erreurs TypeScript courantes

# 1. Corriger texture.image.src
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/texture\.image\.src/(texture.image as HTMLImageElement).src/g'
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/texture\.image\.currentSrc/(texture.image as HTMLImageElement).currentSrc/g'
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/texture\.image\.width/(texture.image as HTMLImageElement).width/g'
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/texture\.image\.height/(texture.image as HTMLImageElement).height/g'

# 2. Corriger setLoop
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/\.setLoop(THREE\.LoopRepeat)/.setLoop(THREE.LoopRepeat, Infinity)/g'
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/\.setLoop(THREE\.LoopOnce)/.setLoop(THREE.LoopOnce, 1)/g'

# 3. Corriger stopAllActions
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/\.stopAllActions()/.stopAllAction()/g'

echo "Corrections appliquées!"

