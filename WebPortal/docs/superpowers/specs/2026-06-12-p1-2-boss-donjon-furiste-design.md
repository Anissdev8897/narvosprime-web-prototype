# P1.2 — Boss du Donjon Furiste — Design

**Date** : 2026-06-12 · **Statut** : approuvé (Phase 1)
**Objectif** : transformer le donjon (portail + quête seulement) en VRAI endgame rejouable :
clé → boss → coffre → recommencer.

## Existant réutilisé
- Mécanique boss COMPLÈTE dans `Npc.tsx` (rank boss : AoE télégraphiées, paliers d'enrage
  75/50/25 %, ultime périodique, aura, nom doré) — il suffit de PLACER un boss et de câbler
  sa mort.
- `gateOpen` (mur scellé) masque déjà le boss jusqu'à l'ouverture.
- Loot procédural + LOOT_CATALOG + toasts + statusEffects.

## Spécification

### Clé du donjon (l'économie d'entrée)
- Nouvel item `key_donjon_furiste` (LOOT_CATALOG) : rare, 250 cr, icône 🗝️.
- Sources : achat (Oracle Vesh, marchand arcanique) + **drop ~5 %** sur les monstres ≥ niv 15
  + **recette Forgeron niv 20** (2 aciers + 1 cristal) → lie le craft à l'endgame.
- Le PORTAIL du donjon consomme 1 clé à l'entrée (en plus du déverrouillage quête existant).
  Sans clé → message "Il vous faut une Clé du Donjon Furiste".

### Run de donjon (module `donjon/dungeonRun.ts`, hors-React)
État : `idle → inProgress → bossDown`. Démarre à l'entrée (clé consommée), se termine à la
mort du boss. Sortie/mort du joueur en cours de run → run perdu (la clé est consommée — le
risque, c'est le sel).

### Boss
- Placement admin existant (rank boss) sur la map donjon, `respawnSec 0` (P1.1) — il ne
  réapparaît PAS dans un run.
- Sa mort (front déjà détecté) → `dungeonRun.bossDown()` → fanfare (toast + son) + COFFRE.

### Coffre de fin (la dopamine)
- Composant `DungeonChest` spawné à la position du boss à sa mort : mesh simple + interaction E.
- Contenu : **1 objet RARE+ garanti** (reroll du procédural jusqu'à ≥ rare) + 2 rolls
  procéduraux niveau boss + 150-300 cr + 1 recette rare (10 %, future table).
- Ouvrir le coffre clôt le run ; un toast récapitule le butin.

### Rejouable
- Re-entrée = nouvelle clé → reset : `gateOpen` refermé, monstres du donjon remontés
  (epoch de respawn forcé), nouveau run. Aucun cooldown v1 (la clé EST le cooldown).

## Tests
- Unitaires : dungeonRun (transitions, clé consommée 1×, bossDown → reward roll ≥ rare).
- Manuel : entrer sans clé (refus) → avec clé → tuer boss → coffre → re-entrée reset.

## Hors scope
Affixes hebdo (M+), classement de temps, multi-boss, difficulté à paliers (Phase 2/3).