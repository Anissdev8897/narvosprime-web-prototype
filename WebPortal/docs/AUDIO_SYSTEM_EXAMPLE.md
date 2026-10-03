# 🎵 Système Audio - Guide d'Utilisation

## Vue d'ensemble

Le système audio utilise le service `audioService` qui gère :
- ✅ Chargement des buffers audio (préchargement)
- ✅ Lecture des sons avec anti-spam (0.15s par défaut)
- ✅ Normalisation du volume (0.0 à 1.0)
- ✅ Gestion des loops et des sons multiples

## 📁 Structure des fichiers

```
soun_effect/
├── Backgrounds/
│   └── TAH Digital SFX Ambience 01.wav  (Ambiance de chargement)
├── Buttons/
│   ├── TAH Digital SFX Button 01.wav    (INITIATE SIMULATION)
│   ├── TAH Digital SFX Button 02.wav    (SYSTEM OPTIONS)
│   └── TAH Digital SFX Button 03.wav    (TERMINATE)
└── ...
```

## 🔧 Exemple d'utilisation TypeScript/React

### 1. Chargement des buffers (préchargement)

```typescript
import { audioService } from '../services/audioService';

// Précharger plusieurs sons au démarrage
useEffect(() => {
  const preloadSounds = async () => {
    await audioService.preloadSounds([
      { path: '/soun_effect/Buttons/TAH Digital SFX Button 01.wav', config: { volume: 0.5 } },
      { path: '/soun_effect/Buttons/TAH Digital SFX Button 02.wav', config: { volume: 0.5 } },
      { path: '/soun_effect/Buttons/TAH Digital SFX Button 03.wav', config: { volume: 0.5 } }
    ]);
  };
  preloadSounds();
}, []);
```

### 2. Jouer un son avec anti-spam

```typescript
import { audioService } from '../services/audioService';

// Dans un gestionnaire d'événement (ex: onMouseEnter)
const handleButtonHover = () => {
  audioService.playSound(
    '/soun_effect/Buttons/TAH Digital SFX Button 01.wav',
    { 
      volume: 0.5,           // Volume normalisé (0.0 à 1.0)
      antiSpamDelay: 150     // Anti-spam de 0.15 secondes
    }
  );
};
```

### 3. Ambiance en loop (chargement)

```typescript
import { audioService } from '../services/audioService';
import { useEffect, useRef } from 'react';

const LoadingScreen = () => {
  const ambienceRef = useRef<string | null>(null);
  
  useEffect(() => {
    const ambiencePath = '/soun_effect/Backgrounds/TAH Digital SFX Ambience 01.wav';
    ambienceRef.current = ambiencePath;
    
    const startAmbience = async () => {
      // Charger et jouer en loop
      await audioService.loadAudio(ambiencePath, { loop: true, volume: 0.6 });
      await audioService.playSound(ambiencePath, { loop: true, volume: 0.6 });
    };
    
    startAmbience();
    
    // Cleanup: arrêter l'ambiance
    return () => {
      if (ambienceRef.current) {
        audioService.stopSound(ambienceRef.current);
      }
    };
  }, []);
  
  return <div>Loading...</div>;
};
```

### 4. Gestion du volume maître

```typescript
import { audioService } from '../services/audioService';

// Définir le volume maître (0.0 à 1.0)
audioService.setMasterVolume(0.8); // 80% du volume
```

### 5. Exemple complet : Bouton avec hover

```typescript
import React, { useEffect } from 'react';
import { audioService } from '../services/audioService';

const MenuButton: React.FC<{ label: string; soundPath: string; onClick: () => void }> = ({ 
  label, 
  soundPath, 
  onClick 
}) => {
  // Précharger le son au montage
  useEffect(() => {
    audioService.loadAudio(soundPath, { volume: 0.5 });
  }, [soundPath]);
  
  // Gestionnaire de hover avec anti-spam
  const handleMouseEnter = () => {
    audioService.playSound(soundPath, { 
      volume: 0.5, 
      antiSpamDelay: 150  // 0.15 secondes d'anti-spam
    });
  };
  
  return (
    <button
      onMouseEnter={handleMouseEnter}
      onClick={onClick}
      className="hover:bg-white/10 transition-all"
    >
      {label}
    </button>
  );
};

// Utilisation
const MainMenu = () => {
  const menuItems = [
    { 
      label: 'INITIATE SIMULATION', 
      sound: '/soun_effect/Buttons/TAH Digital SFX Button 01.wav',
      action: () => console.log('Starting...')
    },
    { 
      label: 'SYSTEM OPTIONS', 
      sound: '/soun_effect/Buttons/TAH Digital SFX Button 02.wav',
      action: () => console.log('Options...')
    },
    { 
      label: 'TERMINATE', 
      sound: '/soun_effect/Buttons/TAH Digital SFX Button 03.wav',
      action: () => console.log('Exiting...')
    }
  ];
  
  return (
    <div>
      {menuItems.map((item, index) => (
        <MenuButton
          key={index}
          label={item.label}
          soundPath={item.sound}
          onClick={item.action}
        />
      ))}
    </div>
  );
};
```

## 🎛️ Configuration

### Paramètres par défaut

- **Volume par défaut** : 0.7 (70%)
- **Anti-spam par défaut** : 150ms (0.15 secondes)
- **Volume maître** : 1.0 (100%)

### Normalisation du volume

Tous les volumes sont automatiquement normalisés entre 0.0 et 1.0 :
- `0.0` = Silencieux
- `0.5` = 50% du volume
- `1.0` = Volume maximum

Le volume final = `volume configuré × volume maître`

## 🔍 API du service

### Méthodes principales

```typescript
// Charger un buffer audio
audioService.loadAudio(path: string, config?: AudioConfig): Promise<HTMLAudioElement>

// Jouer un son
audioService.playSound(path: string, config?: AudioConfig): Promise<void>

// Arrêter un son
audioService.stopSound(path: string): void

// Arrêter tous les sons
audioService.stopAllSounds(): void

// Précharger plusieurs sons
audioService.preloadSounds(sounds: Array<{path: string, config?: AudioConfig}>): Promise<void>

// Définir le volume maître
audioService.setMasterVolume(volume: number): void
```

### Interface AudioConfig

```typescript
interface AudioConfig {
  volume?: number;        // Volume normalisé (0.0 à 1.0)
  loop?: boolean;         // Boucler le son
  antiSpamDelay?: number; // Délai anti-spam en millisecondes
}
```

## 📝 Notes importantes

1. **Anti-spam** : Empêche la lecture répétée trop rapide d'un même son (par défaut 150ms)
2. **Préchargement** : Toujours précharger les sons fréquemment utilisés pour éviter la latence
3. **Cleanup** : Toujours arrêter les sons en loop lors du démontage des composants
4. **Volume maître** : Affecte tous les sons en cours et futurs

## 🐛 Dépannage

### Le son ne se joue pas
- Vérifier que le chemin du fichier est correct
- Vérifier que le fichier existe dans `public/soun_effect/`
- Vérifier la console pour les erreurs de chargement

### Le son se répète trop rapidement
- Augmenter `antiSpamDelay` (ex: 300 pour 0.3 secondes)

### Le volume est trop fort/faible
- Ajuster le `volume` dans la config (0.0 à 1.0)
- Ajuster le `masterVolume` pour tous les sons