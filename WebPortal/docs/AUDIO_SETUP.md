# 🎵 Configuration Audio - Instructions

## ⚠️ IMPORTANT : Déplacement des fichiers

Pour que les fichiers audio soient accessibles par le navigateur, le dossier `soun_effect` doit être dans `public/`.

### Étape 1 : Déplacer le dossier

```bash
# Windows (PowerShell)
Move-Item -Path "soun_effect" -Destination "public\soun_effect"

# Linux/Mac
mv soun_effect public/soun_effect
```

### Étape 2 : Vérifier la structure

Après le déplacement, la structure doit être :

```
public/
└── soun_effect/
    ├── Backgrounds/
    │   └── TAH Digital SFX Ambience 01.wav
    ├── Buttons/
    │   ├── TAH Digital SFX Button 01.wav
    │   ├── TAH Digital SFX Button 02.wav
    │   └── TAH Digital SFX Button 03.wav
    └── ...
```

### Étape 3 : Redémarrer le serveur de développement

```bash
npm run dev
```

## ✅ Vérification

Les fichiers audio seront accessibles via :
- `/soun_effect/Backgrounds/TAH Digital SFX Ambience 01.wav`
- `/soun_effect/Buttons/TAH Digital SFX Button 01.wav`
- etc.

## 📝 Notes

- Les chemins dans le code utilisent `/soun_effect/...` (chemin absolu depuis la racine du serveur)
- Vite sert automatiquement les fichiers de `public/` à la racine
- Si les fichiers ne sont pas dans `public/`, ils ne seront pas accessibles par le navigateur