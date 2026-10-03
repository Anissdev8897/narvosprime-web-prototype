# P1.4 — Lisibilité du combat (dégâts flottants, crits, minimap) — Design

**Date** : 2026-06-12 · **Statut** : approuvé (Phase 1)
**Objectif** : le feedback qui rend le farm satisfaisant — voir ses dégâts, sentir ses
crits, se repérer.

## Spécification

### 1. Dégâts flottants (le cœur du feedback ARPG)
- Module hors-React `combat/damageEvents.ts` : bus léger `emit({pos, amount, kind})` /
  ring-buffer consommé par le rendu. `kind: "hit" | "crit" | "player_hurt" | "heal"`.
- Émission au POINT UNIQUE : `NpcHandle.applyDamage` est appelé partout (flèches, sorts,
  mêlée, poings, DoT) → wrapper dans `Npc.tsx` au moment d'enregistrer le handle : émet
  l'événement avec `posRef` + montant AVANT d'appliquer (1 ligne par perso, zéro chantier
  par source de dégâts). Dégâts SUBIS par le joueur : émission dans `handleNpcHitPlayer`.
- Rendu : `DamageNumbers.tsx` dans le Canvas — pool de sprites texte (drei `Text`,
  ~24 slots réutilisés, jamais de mount/unmount par hit = zéro coût React) : montée 1,2 s
  + fondu. Style : blanc (hit), **orange + plus gros** (crit), rouge (subis), vert (soin).

### 2. Coups critiques (la stat dormante devient réelle)
- `critChance` existe (stats + gear + talents `critFlat`) mais AUCUN jet n'est fait.
- Jet UNIQUE dans un helper `combat/rollDamage.ts` : `roll(base, critChance)` →
  `{amount, isCrit}` avec crit = ×1,75. Branché sur les dégâts JOUEUR : auto-attaque,
  flèches (au spawn), sorts d'archétype, mains nues. (PNJ : pas de crit v1.)
- Feedback : nombre orange agrandi + micro screenShake (0,04) sur crit.

### 3. Minimap (se repérer, trouver le farm)
- `MinimapHud.tsx` DOM (canvas 2D 160×160, coin haut-droit sous la boussole d'objectifs si
  présente) — AUCUN rendu 3D (pas de 2e caméra → zéro coût GPU).
- Dessin par frame légère (interval 100 ms, pas par frame de rendu) :
  - fond disque sombre semi-transparent, Nord fixe ;
  - joueur au centre (flèche orientée par yaw) ;
  - ennemis vivants < 60 m : points rouges (`npcRegistry.forEachEnemyInRadius`) ;
  - marchands/maître d'armes : points jaunes ; portails : losanges violets (stores existants) ;
  - nœuds de récolte disponibles < 60 m : points verts (harvestRegistry).
- Échelle fixe 60 m → bord. Toggle touche **M** (rebindable, groupe Interface).

## Tests
- Unitaires : rollDamage (distribution crit ~p, ×1,75) ; damageEvents (ring-buffer, ordre).
- Manuel : chiffres sur chaque source (sort/flèche/poing/DoT), orange sur crit, rouges
  sur dégâts subis ; minimap : points cohérents, toggle M.

## Hors scope
Carte monde plein écran, ping/marqueurs, quête sur minimap (Phase 2).