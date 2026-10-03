# Enquête IA des PNJ agressifs et niveaux — synthèse (15/09/2026, 18 h, agent en lecture seule)

## Verdict
1. **Détection cassée** : `narvos-map-proto/Server/Ia.lua` (Tick) transmet les joueurs `{ id, x, y, z }`, `Logic/Ia.lua` lit `c.position` (ChoisirCible, Decider). Aucun joueur n'est jamais vu. Prouvé par exécution (joueur à 1 m : `repos/attendre` en format serveur, `poursuite → attaque` en format des tests). Aucun harnais n'exécute `Server/Ia.lua`.
2. **Aucune NavMesh** (`NavMeshBoundsVolume` / `RecastNavMesh` absents) dans Map_Narvos, Map_Tower, Map_Alien, Map_Forge, Map_Orbital, Map_Megastructure, ForestKitONE (source et cuit). La doc nanos exige une NavMesh pour `MoveTo` (`docs/core-concepts/scripting/artificial-intelligence.mdx:30`). Bloqueur probable hors Lua ; comportement exact de `MoveTo` sans NavMesh NON VÉRIFIÉ.
3. **Niveaux jamais appliqués** : tous les PNJ 100 PV / 8 dégâts / 0 défense ; `narvos_niveau` jamais écrit ; mais tuer un PNJ de `tower` rapporte 4 272 XP (niveau plancher 30).
4. **Mort** : XP attribuée si un joueur a porté le coup ; cadavres jamais détruits (`Peuplement.lua:170`, `Spawner.Compte` compte les morts) ; pas de butin ; quêtes « tuer N » ignorent les CharacterSimple.

## Chaîne réelle
- Peuplement : 24 points (tower, alien), anneaux 150/260 m, **5 m au-dessus du sol** (Index.lua ~3779-3814). Espèces Defender (`sk_murdock`, `sk_shadowops`, `sk_murdockexecutionerv2`, `sk_wraithlunarops`, `sk_murdockwasteland`, Character, SKEL_Mannequin) + `venom_stalker` (CharacterSimple, squelette propre, idle/marche seulement).
- `IaServeur.Prendre` : profil par rôle (ennemi → patrouilleur, monstre → traqueur), ancre = position d'apparition (en l'air), `degats = 8`.
- Décision : états repos/patrouille/poursuite/attaque/repli, cadence 200 ms ; patrouilleur détection 15 m / attaque 2 m / abandon 26 m / laisse 30 m / fuite 25 % ; traqueur 22 / 2,5 / 40 / 60 m, sans fuite. Rayon 3D, pas de ligne de vue (Trace client seulement).
- Poursuite : `MoveTo(cible, 150)` réémis 5×/s ; StopMovement déclenche MoveComplete → réveils en boucle.
- Attaque : cadence 1,2 s, dégâts au début du geste, portée non revérifiée, défense du joueur ignorée ; anim ACB_Attack_0x IP (Character) ou gestes de famille ; CharacterSimple sans anim.
- Repli : l'ancre en l'air fait viser z+500 à l'infini ; un blessé < 25 % ne réengage jamais.

## Règle web à porter (npcLeveling.ts, Npc.tsx, npcStatPresets.ts)
- PV `(1+(L−1)×0,12)×enemyStatMult` ; dégâts `(1+(L−1)×0,10)×enemyStatMult` ; XP `round(13×L^1,5×2)`.
- PV max = `round(classe.hp × multPV(L) × hpMult)` ; dégâts = `(sortPrincipal.damage ?? attackPower) × 0,35 × multDégâts(L)` ; cadence `max(cooldown ?? 1,6 ; 1,8)` s ; défense `round(classe.defense × (1+(L−1)×0,05))` ; dégâts reçus × `(1 − resistMult)`.
- Rangs : mob {échelle 1, PV ×1, résist 0}, boss {1,8 ; ×4 ; 0,2}, `clampResist` [0 ; 0,9]. Classe par défaut `warrior_bruiser`.
- `levelFromDistance(zone, d, dmin, dmax)`, `levelTierColor` (≤10 gris, ≤20 vert, ≤30 bleu, ≤40 violet, sinon orange).
- Plages : forge 1-20, orbital 10-30, tower 30-50 ; alien/capitale/foret/megastructure absentes (défaut 1-20).

## API vérifiée (JSON)
`MoveTo(Vector, acceptance=50)` / `Follow(Actor, …)` / `StopMovement` [authority], `MoveComplete(self, succeeded)`, `Character:LookAt` / `SetGaitMode` / `SetSpeedMultiplier` [server], `SetMaxHealth` / `SetHealth` / `Respawn` [server], `SetLifeSpan` [authority], `TakeDamage` : la valeur rendue multiplie les dégâts (0 annule ; cumul entre abonnés non documenté), `Trace.*` / `Navigation.*` [client]. Enums : DamageType.Melee = 6, GaitMode Walking = 1 / Sprinting = 2.

## Animations
Attaque (Character, SKEL_Mannequin vérifié) : `narvos::ACB_Attack_0{1,2,3}_{A,B,C}_IP_Anim`, `PrimaryAttack_C_Slow`, `PrimaryAttack_D_Slow`, `Rifle_Kick`, `ZombieAttack_Left/Right`. Réactions : `HitReact_Front/Back/Left/Right`, `ACB_Hurt_0x_IP_Anim`. Mort : `ACB_Dead_IP_Anim`, `MM_Death_Front_01_Anim` (… Back/Left/Right). ⚠ `ACB_Dead_IP_Anim_2` = autre fichier (rang, pas nom).

## Plan (étapes)
0. Mesurer `MoveTo` sans NavMesh (compagnon ou PNJ du menu N).
1. Perception : ajouter `position` et `vie` aux cibles ; harnais `ia-serveur.mjs` exécutant `Server/Ia.lua` avec doublures.
2. Mouvement : réancrer au sol, réémettre `MoveTo` seulement si la cible a bougé (~2 m) ou si l'état change, `SetGaitMode`, `LookAt`, TakeDamage pour CharacterSimple, témoin « MoveTo refusé ».
3. Niveaux purs dans `Logic/Progression.lua` (MultVieEnnemi, MultDegatsEnnemi, NiveauParDistance, CouleurPalier, StatistiquesEnnemi) + parité TS dans `progression.mjs`.
4. Appliquer : `SetMaxHealth`/`SetHealth`, `narvos_niveau`/`narvos_rang` synchronisés ; coup différé, portée revérifiée, défense du joueur ; défense du PNJ dans Frappes/Sorts.
5. Mort : `SetLifeSpan`, `Spawner.Compte` sans morts, témoins.
6. Options : famille « Defender » (gestes), butin, résistance, quêtes CharacterSimple.

## Décisions pour Hanibes
Fuite à 25 % ; plages de niveau des mondes absents ; tower démarre niveau 30 ; cadence web ≥ 1,8 s vs 1,2 s ; boss ; butin ; régénération au retour.