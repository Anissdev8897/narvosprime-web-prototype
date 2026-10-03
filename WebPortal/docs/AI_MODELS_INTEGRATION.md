# 🤖 Intégration des Modèles IA pour PNJ

## 📋 Vue d'Ensemble

Architecture modulaire pour intégrer et gérer les modèles IA essentiels pour rendre les PNJ plus intelligents.

## 🎯 Modèles Sélectionnés

### ✅ Modèles Actifs (Priorité HAUTE)

1. **LysringV4** (`/LysringV4`)
   - **Type**: CHATBOT
   - **Usage**: Dialogues, réponses contextuelles, interactions joueur-PNJ
   - **Statut**: ✅ Activé par défaut
   - **Priorité**: HAUTE

### 🔄 Modèles Disponibles (Non Activés)

2. **Mistral-7B-v0.1** (`/Mistral-7B-v0.1`)
   - **Type**: CHATBOT
   - **Usage**: Dialogue avancé, compréhension contextuelle
   - **Statut**: ❌ Désactivé (peut être activé plus tard)
   - **Priorité**: MOYENNE

3. **Qwen3-4B** (`/Qwen3-4B`)
   - **Type**: CHATBOT
   - **Usage**: Dialogue rapide, réponses courtes
   - **Statut**: ❌ Désactivé
   - **Priorité**: MOYENNE

4. **CodeLlama-7B-Instruct** (`/codellama-7b-instruct`)
   - **Type**: AGENT
   - **Usage**: Comportements autonomes, décisions, routines, réactions
   - **Statut**: ❌ Désactivé (à implémenter)
   - **Priorité**: HAUTE (pour comportements)

## 🏗️ Architecture

### Services Créés

1. **`AIModelManager`** (`services/aiModelManager.ts`)
   - Gestion centralisée des modèles IA
   - Configuration et statut des modèles
   - Chargement et vérification de disponibilité
   - Recommandation de modèles selon le use case

2. **`NPCAIService`** (`services/npcAIService.ts`)
   - Service dédié aux PNJ
   - Génération de comportements
   - Génération de dialogues
   - Cache pour optimiser les performances

3. **Intégration dans `PreloadService`**
   - Chargement automatique des modèles activés au démarrage
   - Progression affichée dans `LoadingScreen`
   - Gestion des erreurs et fallback

## 🔄 Flux de Chargement

```
MainMenu → LoadingScreen → PreloadService.preloadAll()
                              ↓
                    AIModelManager.loadAllEnabledModels()
                              ↓
                    localAIService.loadModel() (pour LysringV4)
                              ↓
                    GameEngine (PNJ peuvent utiliser l'IA)
```

## 📝 Utilisation

### Pour les Comportements de PNJ

```typescript
import { npcAIService } from '../services/npcAIService';

const behavior = await npcAIService.generateBehavior({
  npcId: 'merchant_001',
  npcType: 'MERCHANT',
  faction: Faction.HUMAN,
  currentState: 'IDLE',
  playerDistance: 5.0,
  playerReputation: 50,
  playerKillCount: 0
});
```

### Pour les Dialogues de PNJ

```typescript
const dialogue = await npcAIService.generateDialogue({
  npcId: 'merchant_001',
  npcType: 'MERCHANT',
  faction: Faction.HUMAN,
  playerMessage: 'Hello',
  context: 'Player approaching merchant',
  playerReputation: 50
});
```

## 🔧 Configuration

### Activer/Désactiver un Modèle

```typescript
import { aiModelManager } from '../services/aiModelManager';

// Activer un modèle
aiModelManager.setModelEnabled('mistral-7b', true);

// Désactiver un modèle
aiModelManager.setModelEnabled('lysringv4', false);
```

### Vérifier le Statut

```typescript
const status = aiModelManager.getModelStatus('lysringv4');
console.log(status?.status); // 'LOADED' | 'LOADING' | 'NOT_LOADED' | 'ERROR'
```

## 🚀 Ajouter un Nouveau Modèle

1. Ajouter la configuration dans `AIModelManager.MODEL_CONFIGS`:

```typescript
{
  id: 'nouveau-modele',
  name: 'Nouveau Modèle',
  type: 'CHATBOT' | 'AGENT' | 'VISION_LANGUAGE',
  path: '/nouveau-modele',
  description: 'Description du modèle',
  useCase: ['use case 1', 'use case 2'],
  priority: 'HIGH' | 'MEDIUM' | 'LOW',
  enabled: false
}
```

2. Implémenter le chargement dans `AIModelManager.loadModel()`

3. Utiliser le modèle dans `NPCAIService` si nécessaire

## 📊 États des PNJ Supportés

- `IDLE`: Inactif, en attente
- `TRADE`: Mode commerce
- `COMBAT`: Mode combat
- `FLEE`: Fuite
- `SURVEILLANCE`: Surveillance du joueur
- `INVESTIGATE`: Enquête (meurtres joueurs)

## 🎯 Prochaines Étapes

1. ✅ Architecture modulaire créée
2. ✅ Intégration dans PreloadService
3. ⏳ Implémenter Web Worker pour éviter blocage main thread
4. ⏳ Optimiser quantisation q8 → q4
5. ⏳ Implémenter batching des requêtes
6. ⏳ Intégrer CodeLlama pour comportements autonomes
7. ⏳ Ajouter support vision-language pour compréhension environnement

## 🔍 Vérification

Pour vérifier que tout fonctionne :

1. Démarrer le jeu depuis `MainMenu`
2. Observer le `LoadingScreen` - doit afficher le chargement des modèles IA
3. Vérifier la console pour les logs de chargement
4. Les PNJ doivent pouvoir utiliser l'IA pour leurs comportements et dialogues

## 📝 Notes

- Les modèles sont chargés une seule fois au démarrage
- Cache de 5 secondes pour optimiser les performances
- Fallback automatique si aucun modèle n'est disponible
- Architecture extensible pour ajouter facilement de nouveaux modèles