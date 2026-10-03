# 🗺️ Guide de Cohérence Level Design - Narvos Prime

Ce guide définit les règles pour créer des cartes (maps) cohérentes avec l'univers de **Narvos Prime**.

## 📐 Perspective et Grille
Narvos Prime utilise une **perspective isométrique** stricte (vue 3/4).
*   **Ratio Isométrique** : 2:1 (deux pixels de largeur pour un pixel de hauteur).
*   **Taille de tuile (Tile size)** : 32x32px ou 64x64px.
*   **Alignement** : Les maps sont composées de tuiles modulaires répétitives (Seamless).

---

## 🌍 Cohérence par Planète (Faction)
Chaque planète possède son propre "Tileset" et sa palette de couleurs dédiée.

### 1. AQUARYS-4 (Factions: Akarlys)
*   **Style** : Aéropolis Prime. Sci-fi militaire propre, verre, eau.
*   **Couleurs** : Bleu (#3b82f6), Argent, Blanc Ceramic.
*   **Objets clés** : Portails holographiques, cristaux aqua-lumina, sols métalliques polis.

### 2. DÉSERTICA (Factions: Mezalayis)
*   **Style** : Frontier Hub. Brutaliste, récupération, poussière.
*   **Couleurs** : Jaune (#eab308), Anthracite, Ocre (Sable).
*   **Objets clés** : Plaques de métal rouillées, barils de fuel, antennes paraboliques de fortune.

### 3. FUNGARIA (Factions: Zayan)
*   **Style** : Vhar'Kul Nexus. Organique, alien, biotechnologie.
*   **Couleurs** : Violet (#a855f7), Vert fluo (Poisons), Indigo.
*   **Objets clés** : Champignons géants bioluminescents, pilier de cristal, sols organiques pulsants.

---

## 🏗️ Structure d'une Map (Calques)
Pour assurer la profondeur visuelle, segmentez vos assets en 3 types :

1.  **Le Sol (Background)** : Tuiles répétitives (métal, sable, herbe fongique). **Doit être plat.**
2.  **Les Obstacles (Midground)** : Murs, caisses, bâtiments. Ils doivent avoir une ombre projetée vers le **Sud-Est**.
3.  **Le Décor (Foreground)** : Eléments qui passent *devant* le joueur (arches, arbres, câbles suspendus) pour créer un effet de profondeur.

---

## ✍️ Guide des Prompts pour Maps (IA)

Pour générer des assets de map cohérents, utilisez ce template de prompt :

> **Prompt Template** :
> "[THEME] modular tileset, [VIEW], [ELEMENT], sci-fi [FACTION] style, Dofus-style cartoon rendering, clean thick outlines, vibrant flat colors, seamless tiling, transparent PNG, isolated on white background"

**Exemple pour une porte Akarlys** :
> "Aéropolis Prime modular building, isometric view, holographic security door, sci-fi military human style, Dofus-style cartoon rendering, clean thick outlines, blue neon lights, white metal, transparent PNG, isolated"

---

## ⚖️ Échelle et Proportions
*   **Joueurs** : Mesurent environ 1.5 tuile de hauteur.
*   **Portes** : Doivent mesurer 2 tuiles de hauteur.
*   **Objets d'inventaire** : Toujours centrés dans une icône 32x32px.

---

*Document de référence pour le projet Narvos Prime - 2026*