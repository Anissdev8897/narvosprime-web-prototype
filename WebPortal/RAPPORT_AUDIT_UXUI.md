# 🔍 RAPPORT D'AUDIT UX/UI — NARVOS PRIME Web Prototype

**Équipe AUDIT UX/UI (10 agents)**  
**Date :** 2026-07-29  
**Périmètre :** src/rpg/ui/, src/rpg/runtime/, src/components/, src/rpg/forge/, docs/SPECIFICATIONS_HUD_SYSTEM.md

---

## SOMMAIRE

1. [Résumé Exécutif](#1-résumé-exécutif)
2. [Écarts Spécifications vs Implémentation](#2-écarts-spécifications-vs-implémentation)
3. [Analyse des Composants UI](#3-analyse-des-composants-ui)
4. [Analyse du HUD](#4-analyse-du-hud)
5. [Analyse de l'Éditeur Forge](#5-analyse-de-léditeur-forge)
6. [Analyse du God-Component RpgGameWorld](#6-analyse-du-god-component-rpggameworld)
7. [Accessibilité](#7-accessibilité)
8. [Performances de Rendu](#8-performances-de-rendu)
9. [Cohérence Visuelle](#9-cohérence-visuelle)
10. [Recommandations](#10-recommandations)

---

## 1. RÉSUMÉ EXÉCUTIF

| Section | Note | Verdict |
|---|---|---|
| Conformité aux specs | 🔴 2/10 | Le document SPECIFICATIONS_HUD_SYSTEM.md décrit un système de HUD/Radar/Carte qui n'a PAS été implémenté. Aucun fichier cité (NewHUD.tsx, HealthBar.tsx, radarService.ts, mapService.ts, MapView.tsx) n'existe dans le code. |
| Qualité HUD | 🟡 7/10 | GameHUD.tsx est bien fait visuellement, mais manque d'accessibilité. |
| Forge Editor | 🟢 8/10 | Solide, bien structuré, fonctionnel. Inline styles partout = pas de thème partagé. |
| God-Component | 🔴 1/10 | RpgGameWorld.tsx = **3995 lignes**. Violation massive du principe de responsabilité unique. |
| Accessibilité | 🔴 3/10 | ARIA quasi absent. Navigation clavier limitée. Indicateurs couleur-only. |
| Performance | 🟡 5/10 | Minimap et cooldowns tickent correctement, mais RpgGameWorld a trop de useState/useEffect. |
| Cohérence visuelle | 🟡 5/10 | **Trois systèmes de style différents** : CSS Modules (HUD), inline styles Forge, inline styles panneaux. |

---

## 2. ÉCARTS SPÉCIFICATIONS VS IMPLÉMENTATION

Le document `docs/SPECIFICATIONS_HUD_SYSTEM.md` (1074 lignes) décrit une refonte complète du HUD. **Tous les items sont cochés ✅ comme "faits"** mais **aucun fichier listé n'existe** :

| Fichier spécifié | Statut réel | Fichier réel équivalent |
|---|---|---|
| `components/NewHUD.tsx` | ❌ ABSENT | `src/rpg/runtime/GameHUD.tsx` (implémentation différente) |
| `components/HealthBar.tsx` | ❌ ABSENT | Barre HP intégrée dans GameHUD.tsx |
| `components/ArmorBar.tsx` | ❌ ABSENT | Barre Shield intégrée dans GameHUD.tsx |
| `components/WeaponDisplay.tsx` | ❌ ABSENT | Non implémenté |
| `services/hudService.ts` | ❌ ABSENT | Pas d'équivalent |
| `components/Radar.tsx` (v2) | ❌ ABSENT | `MinimapHud.tsx` (canvas 2D, pas le même design) |
| `services/radarService.ts` | ❌ ABSENT | Pas d'équivalent |
| `components/MapView.tsx` | ❌ ABSENT | `WorldMapOverlay.tsx` (design radicalement différent) |
| `services/mapService.ts` | ❌ ABSENT | Pas d'équivalent |
| `services/fogOfWarService.ts` | ❌ ABSENT | Pas d'équivalent |
| `StatsHUD.tsx` (désactivé) | ❌ FICHIER SUPPRIMÉ | StatsHUD n'existe plus (recherche grep: 0 résultat) |
| `GameEngine.tsx` (modifié) | ❌ ABSENT | Le composant s'appelle `RpgGameWorld.tsx` |

### Code couleur faction (spec vs réalité)

La spec définit des couleurs faction (Akarlys rouge/bleu, Zayan violet/vert, Mezalayis jaune/orange). GameHUD.tsx utilise **un seul jeu de couleurs** basé sur l'élément de classe (element.color), pas sur la faction. **Les couleurs faction ne sont pas implémentées.**

### Radar 5 mètres (spec) vs Minimap 60 mètres (code)

La spec décrit un radar 5m avec scanlines, cercles concentriques, traînées de mouvement, légende. La minimap réelle couvre **60m** avec détection ennemis (rouge), récolte (vert), portails (violet). Le design réel est plus fonctionnel mais ne correspond pas du tout à la spec.

---

## 3. ANALYSE DES COMPOSANTS UI

### 3.1 Inventaire des composants `src/rpg/ui/`

| Composant | Lignes | Notes |
|---|---|---|
| `StaminaBar.tsx` | 63 | ✅ Bien fait. ARIA progressbar present. useSyncExternalStore. Cache quand ratio ≥ 1. |
| `TimeHud.tsx` | 50 | ✅ Propre. Icônes soleil/lune. useSyncExternalStore. |
| `WeatherHud.tsx` | 60 | ✅ Propre. Icônes météo. Masqué si désactivé. |
| `StatusEffectHud.tsx` | 76 | ✅ Bon. Barre de progression pour chaque effet. |
| `TargetHealthBar.tsx` | 98 | ✅ Excellent. Barre fantôme (dégâts différés 600ms). CSS module soigné. |
| `TargetHealthBar.module.css` | 171 | ✅ Très complet. Clip-path, scanlines, animations, variable CSS `--accent`. |
| `LootPanel.tsx` | 277 | ✅ Complet. Groupage items, détails, Tout Prendre. CSS module. |
| `EmoteMenu.tsx` | 93 | ✅ Onglets, catégories, annulation d'émote en cours. |
| `AnimDebugHud.tsx` | 149 | ✅ Sondage 10Hz (pas 60), historique transitions FSM. |
| `WorldMapOverlay.tsx` | 534 | ✅ Canvas 2D 30Hz. Hexagones, grille, POI, zoom/pan, téléportation. |
| `WorldMapOverlay.module.css` | ~120 | Propre. |
| `CharacterCreator.tsx` | 235 | ✅ Inline styles (intentionnel). R3F + panneau de personnalisation. |
| `PetPanel.tsx` | 175 | ✅ Inline styles. Compact, XP bar, summon/recall. |
| `ReputationPanel.tsx` | 147 | ✅ Barres de progression par faction, paliers, récompenses. |

### 3.2 Points forts
- `useSyncExternalStore` utilisé partout → pas de re-rendus superflus
- Composants qui retournent `null` quand inutiles (StaminaBar: ratio=1, StatusEffectHud: pas d'effets)
- CSS Modules pour TargetHealthBar et LootPanel : encapsulation propre

### 3.3 Points faibles
- **Mélange de styles** : 3 composants utilisent CSS Modules (TargetHealthBar, LootPanel, WorldMapOverlay), 5 utilisent des inline styles (PetPanel, ReputationPanel, AnimDebugHud, TimeHud, WeatherHud), et CharacterCreator a un objet `styles` statique
- **Pas d'accessibilité** sur EmoteMenu, LootPanel, PetPanel, ReputationPanel
- **LootPanel** : pas de `aria-label`, les icônes sont des entités HTML (`&#x2715;`, `&#x1F4B0;`)

---

## 4. ANALYSE DU HUD

### 4.1 GameHUD (`src/rpg/runtime/GameHUD.tsx` — 298 lignes)

**Style :** "Visière Spartan techno-arcane" — réussi visuellement.

**Points forts :**
- CSS Module complet (522 lignes) avec clip-path polygons, scanlines, glow effects
- Variable CSS `--accent` injectée inline → personnalisation par classe
- Cooldown ticker via requestAnimationFrame (pas setInterval)
- Cooldown radial sweep (conic-gradient)
- Texte flottant (dégâts, soins) avec animation CSS
- Réticule sci-fi en CSS pur

**Points faibles :**
- `spellIconFor()` utilise des icônes Lucide (importées individuellement — tree-shaking ok)
- Dépendance aux images `spellIcon()` avec fallback `onError`
- Pas d'ARIA sur la barre de sorts
- Le style `<style>` injecté dans le JSX pour `narvosLowMana` = anti-pattern React
- `useEffect` pour le ticker cooldown se ré-abonne sur changement de `stats`, `inventory`, `cooldowns`, `spells`

### 4.2 MinimapHud (`src/rpg/runtime/MinimapHud.tsx` — 92 lignes)

**Style :** Canvas 2D, 10Hz.

**Points forts :**
- **Aucun rendu 3D** → zéro coût GPU
- Ticking à 10Hz (setInterval 100ms) → pas de rendu par frame
- Tri par registres (npcRegistry.forEachEnemyInRadius avec broadphase, pas de scan global)
- Détection : ennemis (rouge), récolte (vert), portails (violet losange)
- Flèche orientée yaw pour le joueur, Nord fixe

**Points faibles :**
- `useEffect` se ré-abonne si `playerPosition`, `cameraState`, ou `mapId` changent (refs stables normalement)
- Aucun ARIA (c'est un canvas → nécessite fallback texte)
- Taille fixe 160px, range fixe 60m

### 4.3 TargetHealthBar (`src/rpg/ui/TargetHealthBar.tsx` — 98 lignes)

**Le composant HUD le mieux conçu.** Barre fantôme avec délai 600ms, gradient HP selon seuil (vert >60%, jaune >30%, rouge), animations d'entrée/transition. CSS Module complet avec scanlines, clip-path cohérent avec GameHUD.

---

## 5. ANALYSE DE L'ÉDITEUR FORGE

### 5.1 Structure (`src/rpg/forge/`)

| Fichier | Lignes | Rôle |
|---|---|---|
| `ForgeEditor.tsx` | 653 | Point d'entrée : état + rendu |
| `ForgeToolbar.tsx` | 258 | Barre d'outils + StatusBar |
| `ForgeBuilderScene.tsx` | — | Scène R3F (éditeur 3D) |
| `ForgeBuiltMap.tsx` | — | Carte publiée dans le jeu |
| `ForgePanels.tsx` | — | Panneaux Water/Terrain/Layers/Settings/Weather/Prefab |
| `ForgeMapBackdrop.tsx` | — | Fond de carte |
| `forgeTheme.tsx` | 80 | Thème partagé + helpers |
| `forgeSceneStore.ts` | — | Store Zustand |
| `ForgeSync.ts` | — | Synchronisation live |
| `AssetBrowser.tsx` | — | Navigateur d'assets |

### 5.2 Points forts
- **Thème partagé** : `forgeTheme.tsx` exporte `FORGE` (constantes) + helpers `panel()`, `hudButton()`, `hudInput()`, `SectionTitle`, `ForgeShell`
- **Raccourcis clavier** complets : 1-7 outils, Ctrl+Z/Y undo/redo, Ctrl+S save, Delete supprimer, Ctrl+D dupliquer
- **Undo/Redo** : `EditHistory` en ref (pas de perte de performance)
- **Auto-save** paramétrable (défaut 120s)
- **Forge Live** : co-édition temps réel (WebRTC/WebSocket via forgeSync)
- **Multi-terrains** : tuiles multiples, chacune avec offset/size/heightmap/color
- **Chemins spline** : Route, Sentier, Pont, Rail → geometry Mesh à partir de points cliqués
- **Végétation** : dispersion aléatoire (6 instances, scale/rotation random)
- **Matériau PBR** par objet : tint, texture, repeat, roughness, metalness, emissive
- **Calques (layers)** : visibilité, verrouillage, couleur, filtrage par calque
- **Météo** : préréglages, angle soleil, intensité, brouillard, ombres

### 5.3 Points faibles
- **Inline styles partout** (sauf ToolbarButton qui utilise inline aussi) → pas de CSS Modules
- **Aucun ARIA** sur les boutons de la toolbar
- **`alert()`** utilisé pour les notifications (publish) → bloquant, pas stylisé
- **`window.prompt()`** absent (commenté "n'existe pas sous Electron") → nom auto pour prefabs
- **DOM manipulation directe** : `document.getElementById('save-indicator')` + `setTimeout` pour retour visuel
- **localStorage** pour prefabs (pas de base de données)
- Toolbar très long (18 boutons + toggles + séparateurs) → pourrait être catégorisé/compacté

---

## 6. ANALYSE DU GOD-COMPONENT RpgGameWorld

### 6.1 Métriques

| Métrique | Valeur |
|---|---|
| Lignes totales | **3995** |
| Imports | ~150 |
| useState | ~50 |
| useEffect | ~45 |
| useRef | ~40 |
| useCallback | ~30 |
| Interfaces | ~15 |

### 6.2 Responsabilités identifiées (violation SRP)

Le fichier gère **tout** :
1. ✅ Rendu 3D Canvas + maps + streaming
2. ✅ Personnage joueur (création, mouvement, mort, respawn)
3. ✅ HUD stats/inventaire/sorts/quêtes
4. ✅ Inventaire + butin + coffres
5. ✅ Combat (arcanes, auto-attaque, combo, charge)
6. ✅ Vaisseaux (pilotage, téléportation, warp, dégâts)
7. ✅ PNJ (placement, réapparition, marchands, maître d'armes)
8. ✅ Édition admin/Forge (NpcAdmin, PropAdmin, HarvestAdmin, DonjonAdmin)
9. ✅ Donjons (portails, salles, boss, coffre, monstergate)
10. ✅ Musique adaptative (exploration/combat/boss)
11. ✅ Bûcheron/récolte/mini-jeu
12. ✅ Métier/artisanat
13. ✅ Événements monde (EventDirector, FactionsAI)
14. ✅ Gestion GPU lost / context restoration
15. ✅ Système de quêtes + récompenses
16. ✅ Talents
17. ✅ Réputation
18. ✅ Écran de chargement 2 phases + reveal + safety timeout 180s
19. ✅ Exports (handleHeal, handleMana, addCredits...)

### 6.3 Risques
- **Taille critique** : >3000 lignes = composant impossible à tester unitairement
- **Dette technique** : `refs-closure` pattern partout pour éviter les re-rendus (signe que l'état devrait être externalisé)
- **UseEffect cascade** : 45 useEffect avec des dépendances qui se chevauchent → comportement non déterministe
- **État plats** : 50 useState → impossible de raisonner sur l'état global
- **Commentaire explicite** : certaines sections avouent "ces quatre-là manquaient" (ligne 967)

---

## 7. ACCESSIBILITÉ

### 7.1 État des lieux

| Composant | ARIA | Nav. clavier | Alternatives textuelles |
|---|---|---|---|
| StaminaBar | ✅ `role="progressbar"`, `aria-valuenow/min/max` | ❌ | ✅ Couleur + texte |
| GameHUD | ❌ | ✅ (touches 1-6 sorts) | ❌ Indicateurs couleur-only (HP gradient) |
| MinimapHud | ❌ (canvas sans fallback) | ❌ | ❌ |
| TargetHealthBar | ❌ | ❌ | ✅ Couleur + % |
| LootPanel | ❌ | ❌ (double-clic) | ❌ |
| EmoteMenu | ❌ | ✅ (Echap/G ferme) | ❌ |
| Forge toolbar | ❌ | ✅ (raccourcis 1-7) | ❌ Icônes emoji |
| WorldMapOverlay | ❌ | ✅ (Echap ferme) | ❌ |

### 7.2 Problèmes majeurs
1. **Couleur-only** : HP gradient (vert→jaune→rouge), faction colors, mana low pulse — rien n'est doublé d'un label textuel ou d'un pattern
2. **Canvas sans fallback** : MinimapHud et WorldMapOverlay ne fournissent aucune alternative textuelle
3. **icônes emoji** : Les boutons Forge utilisent des emoji comme icônes (🌊, ⛰️, 🔄) — pas accessibles aux lecteurs d'écran
4. **Pointer-events: none** sur le HUD = inaccessible (mais c'est le comportement attendu d'un HUD overlay)

---

## 8. PERFORMANCES DE RENDU

### 8.1 Bonnes pratiques observées

| Composant | Pratique | Impact |
|---|---|---|
| StaminaBar | `useSyncExternalStore` + ratio ≥ 1 → null | Zéro re-rendu quand statique |
| MinimapHud | setInterval 100ms (pas useFrame) | Pas de rendu 60fps inutile |
| WorldMapOverlay | requestAnimationFrame throttle 33ms (~30fps) | Bon équilibre qualité/performance |
| AnimDebugHud | setInterval 100ms quand visible, null sinon | Aucune allocation quand masqué |
| TargetHealthBar | Barre fantôme avec setTimeout, pas de frame loop | Pas de ticking continu |
| Forge EditHistory | stocké en ref → pas de re-render React | Performance optimale |
| NPC staging | 2 PNJ / 90ms par lot + délai 500ms après reveal | Évite le freeze initial |

### 8.2 Problèmes identifiés

1. **RpgGameWorld effet cascade** : useEffect dépend de `[stats, inventory, cooldowns, spells]` (ligne 110) — large → se déclenche souvent
2. **Minimap ré-abonnement** : useEffect dépend de `[playerPosition, cameraState, mapId]` — refs stables normalement mais pourrait causer des re-créations d'interval
3. **GameHUD cooldown ticker** : ré-abonnement sur `[stats, inventory, cooldowns, spells]` (ligne 110) → se ré-abonne et crée un nouveau RAF à chaque changement de stats
4. **setState dans RAF loop** : `setCooldowns()` dans requestAnimationFrame → un render React 60fps juste pour les cooldowns. Pourrait utiliser une ref et un interval à plus basse fréquence

---

## 9. COHÉRENCE VISUELLE

### 9.1 Trois systèmes de style différents

| Système | Composants | Font | Couleurs | Structure |
|---|---|---|---|---|
| **HUD (CSS Modules)** | GameHUD, TargetHealthBar, LootPanel, WorldMapOverlay | Chakra Petch / Inter | `--accent` CSS variable | Fichiers .module.css |
| **Forge (inline + theme)** | ForgeEditor, ForgeToolbar, tous les panneaux Forge | JetBrains Mono (mono) | Constante `FORGE` (cyan #22d3ee) | Inline styles + forgeTheme.tsx |
| **Panneaux (inline)** | PetPanel, ReputationPanel, AnimDebugHud | system-ui / monospace (fallback) | Hardcodé (#e2e8f0, #64748b, etc.) | Objets style inline |

### 9.2 Incohérences

| Aspect | HUD | Forge | Panneaux |
|---|---|---|---|
| **Bordures** | Clip-path polygon (biseau) | bordures plates 1px | border-radius 12-16px (arrondi) |
| **Arrière-plan** | `rgba(6,10,18,0.72)` / backdrop blur | `rgba(6,11,20,0.82)` | `rgba(8,6,16,0.96)` |
| **Couleur accent** | `var(--accent)` variable CSS | `FORGE.accent: #22d3ee` | Pas de variable — hardcodé |
| **Ombre** | Box-shadow néon | Box-shadow subtil | Box-shadow purple |
| **Font** | Chakra Petch (titres) / Inter (corps) | JetBrains Mono (100% mono) | system-ui |

### 9.3 Conclusion visuelle
Le HUD a une identité forte ("visière Spartan techno-arcane") réussie. La Forge a aussi son identité propre (terminal holographique). Les panneaux (Pet, Reputation) ressemblent à un design générique "dark mode" — ils ne partagent PAS l'identité visuelle du HUD. Il y a un **manque d'harmonisation globale**.

---

## 10. RECOMMANDATIONS

### 🔴 Priorité Haute (bloquant)

1. **Refactorer RpgGameWorld.tsx** — Extraire en *au moins* 6-8 modules :
   - `usePlayerState.ts` (stats, inventory, progression)
   - `useSpaceship.ts` (pilotage, warp, vaisseaux)
   - `useCombat.ts` (spells, auto-attack, combos)
   - `useWorldState.ts` (NPC, portals, donjon, harvest)
   - `useLoading.ts` (2-phase loading, GPU lost)
   - `RpgGameWorld.tsx` (orchestration uniquement)

2. **Mettre à jour ou supprimer SPECIFICATIONS_HUD_SYSTEM.md** — Le document promet des fonctionnalités qui n'existent pas. Soit :
   - Le mettre à jour pour refléter l'implémentation réelle (GameHUD, MinimapHud, WorldMapOverlay)
   - Soit implémenter les composants manquants (NewHUD, HealthBar, radarService, mapService, MapView)

### 🟡 Priorité Moyenne

3. **Ajouter ARIA sur tous les composants interactifs** :
   - `role="progressbar"` sur GameHUD HP/Shield/Mana/Stamina barres
   - `aria-label` sur les boutons de la Forge (les emoji ne sont pas lus)
   - `role="dialog"` sur LootPanel, EmoteMenu, PetPanel, ReputationPanel
   - Fallback texte pour les canvas (Minimap, WorldMap)

4. **Harmoniser le design system** : Créer un fichier `designTokens.ts` partagé avec :
   - Couleurs de base commune (`--nv-bg-panel`, `--nv-text`, `--nv-accent`)
   - Espacements standards (4-8-12-16-20-24-28)
   - Font stack unifiée (Chakra Petch pour titres, Inter pour corps)
   - Unified clip-path / border-radius

5. **Optimiser les re-rendus** :
   - Extraire le ticker cooldown de GameHUD dans un hook séparé
   - Utiliser `useSyncExternalStore` pour Minimap plutôt que setInterval dans useEffect

### 🟢 Priorité Faible

6. **Forge Editor** :
   - Remplacer les `alert()` bloquants par des toasts stylisés
   - Remplacer `document.getElementById('save-indicator')` par un état React
   - Ajouter un système de notifications (toast) partagé

7. **LootPanel** :
   - Ajouter support clavier (Tab, Enter, Escape)
   - Remplacer les entités HTML par des composants d'icône

8. **Tests** : Ajouter des tests unitaires pour les composants critiques du HUD

---

## ANNEXE : FICHIERS ANALYSÉS

```
src/rpg/ui/           (17 fichiers)
src/rpg/runtime/      GameHUD.tsx, MinimapHud.tsx, RpgGameWorld.tsx
src/rpg/forge/        (16 fichiers)
src/components/        (12 fichiers)
docs/                 SPECIFICATIONS_HUD_SYSTEM.md
```

**Composant le plus long :** `RpgGameWorld.tsx` — 3995 lignes  
**Composant le mieux conçu :** `TargetHealthBar.tsx` — 98 lignes, ARIA partiel, CSS Module complet, barre fantôme  
**Écart le plus critique :** Spec vs Implémentation — 0/10 fichiers listés dans la spec existent dans le code