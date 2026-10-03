# OBJECTIFS GAMEPLAY — état réel au 2026-09-11 (soir)

Confrontation de `objetic_gameplay.txt` (la feuille de route RP en 15 catégories) avec ce
qui existe VRAIMENT dans le port nanos (`WebPortal/Server/nanos_world/packages/`).

Légende :
- ✅ **en jeu prouvé** (un journal serveur ou une session l'a montré)
- 🟡 **écrit et câblé, jamais vu en jeu** (atteignable par le joueur : touche, commande, UI)
- 🟠 **partiel** (une brique existe, la boucle n'est pas fermée)
- ❌ **absent**

**Réponse courte : non, la liste n'est pas validée.** C'est une feuille de route RP complète.
Le port a les FONDATIONS (comptes, personnage, apparence, inventaire persistant, craft,
récolte, marchands, IA, voyage, édition de map) ; la COUCHE RP (métiers, factions, banque,
propriétés, missions, communication, justice) est presque entièrement à écrire.

---

## Ce qui a été fait ce soir et reste À TESTER (serveur `--playtest`)

| quoi | comment tester | témoin |
|---|---|---|
| Pont MetaHuman (14 pièces) | `/metahumain corps_f_base`, puis `/metahumain tenue_f_armure` ; ou touche **U** | journal `[METAHUMAIN] pose …` ; à l'écran : la tenue suit-elle les animations, ou fige-t-elle ? Si elle fige : `/metahumain porteur cache` |
| Personnages Defender | touche **N** (menu PNJ, admin) ; peuplement des mondes tower/alien | 12 personnages au menu ; plus de géants gris dans les mondes |
| Marchands : parler + boutique | s'approcher d'un marchand, touche **Y** → dialogue → « Voir la boutique » | panneau boutique, achat/vente, solde |
| Outils de récolte | chez Drog (ressources) : pioche, foreuse, collecteur | les 6 gisements exploitables |
| Points de TP | **F6** ou `/tp` (admin) : « Créer ici », puis destination ; passer avec **Y** | journal `[TP] n point(s) … poses` ; `[TP] <joueur> : a -> b` |
| Droits admin | outils DEV, spawn, véhicules, export F3 : admin seulement (`commandes_dev = false`) | journal « Droits : Hanibes (…) est ADMINISTRATEUR » |

---

## 1. RP — identité et vie du personnage

| objectif | état | ce qui existe |
|---|---|---|
| Métier / profession | ❌ | à définir (Q4 validée : s'inspirer de Hyper Skill Level Manager — compétences par métier, XP par action) |
| Grades / carrière | ❌ | — |
| Factions avec hiérarchie | ❌ | 3 factions en DONNÉES (AKARLYS/ZAYAN/MEZALAYIS), aucune appartenance jouable |
| Organisations / guildes | ❌ | — |
| Entreprises de joueurs | ❌ | — |
| Réputation | 🟠 | `Logic/Reputation.lua` câblé ; conditions de dialogue `reputation_min` ; aucun gain, rien en base |
| Permis / licences, casier | ❌ | — |
| Identité / ID | 🟠 | compte + personnage + Steam ID ; pas de carte d'identité en jeu |
| Propriété | ❌ | les zones servent aux permissions d'ÉDITION, pas à la possession |

## 1 bis. Communication

| objectif | état | ce qui existe |
|---|---|---|
| Chat local / radio / canaux / téléphone / MP / contacts | ❌ | le chat natif nanos (global) ; `Logic/Chat.lua` (port du chat web) câblé jamais appelé — à retirer plutôt qu'à brancher |

## 2. Économie

| objectif | état | ce qui existe |
|---|---|---|
| Argent | 🟡 | `credits` persistés (colonne), `Roster.MajCredits` |
| Paiement marchand | 🟡 | achat/vente serveur (`Logic/Boutique.lua`, prouvé par harnais) + **panneau boutique ce soir** |
| Compte bancaire, carte, ATM, virements | ❌ | l'ATM du CITY_PACK est cuit, sans système |
| Salaires, taxes, factures, contrats | ❌ | — |
| Prix variables | ❌ | `Reputation.ReductionMarchand` existe, jamais appelé |
| Commerce entre joueurs | ❌ | — |
| Maisons, bâtiments, entrepôts, hôtel | ❌ | — |
| Chaîne ressource → transformation → fabrication → commerce | 🟠 | récolte (6 gisements) → ateliers de craft → établi d'assemblage (43 plans) → revente ; pas de raffinage |

## 3. Craft et récolte

| objectif | état | ce qui existe |
|---|---|---|
| Récolte / minage / extraction | 🟡 | 6 gisements (Forge seulement), outils vendus chez Drog depuis ce soir |
| Agriculture | 🟠 | `Logic/Agriculture.lua` câblé, jamais appelé |
| Fabrication, stations | 🟡 | 4 ateliers (placeholders `SM_Cube`), relais corrigés ce matin |
| Assemblage, plans | 🟡 | établi + `Catalogs/Plans.lua` (43) |
| Épaves, recyclage, raffinage, déconstruction, qualité, niveau d'atelier, machines | ❌ | — |
| Craft d'armes / munitions / véhicules / vêtements / électronique | 🟠 | selon les recettes du catalogue ; pas de craft de véhicule |
| « Les ressources existent dans le monde » | 🟠 | gisements posés à la Forge uniquement |

## 4. Véhicules

| objectif | état | ce qui existe |
|---|---|---|
| Spawn | 🟡 | `/vehicule` (admin), 12 voitures cuites — **jamais vues rouler**, corps physiques sur les roues à corriger |
| Achat, vente, propriété, garage, assurance, carburant, dégâts, pièces, plaque… | ❌ | un marchand « Garagiste » existe (web) |
| Aériens / spatiaux | ❌ | nanos n'a pas de véhicule volant (Q2 ouverte) |

## 5. Construction

| objectif | état | ce qui existe |
|---|---|---|
| Mode construction, placement, rotation, snap | 🟡 | F3 + gizmo (10 cm / 15°) + 449 props de base + props Narvos |
| Permissions | 🟡 | zones (liste de permissions, fermée par défaut) |
| Persistance | 🟠 | export vers catalogue (admin) ; **le chargeur au démarrage manque** |
| Fondations/murs/portes/électricité/défenses/stockage, propriétaire, réparation | ❌ | — |

## 6. Monde vivant

| objectif | état | ce qui existe |
|---|---|---|
| PNJ marchands | 🟡 | 8, incarnés par des corps de packs ; **dialogue + boutique ce soir** |
| PNJ ennemis / patrouilles | 🟡 | IA patrouilleur/traqueur ; **Defender ce soir** à la place des Meshy |
| Civils, policiers, médecins, ouvriers, scientifiques, pirates | ❌ | les corps existent (Troopers, Defender, CITY_PACK) |
| Routines, réactions | ❌ | — |
| Événements dynamiques | 🟠 | `WorldSim` (port web) câblé, jamais appelé |

## 7. Missions

| objectif | état | ce qui existe |
|---|---|---|
| Quêtes / missions | 🟠 | `Logic/Quetes.lua` + catalogue ; aucune acceptation (`give_quest` ignoré), rien en base |
| Contrats, générées, suivi | ❌ | — |

## 8. Factions — ❌ (données seulement)

## 9. Territoires et propriétés

| objectif | état | ce qui existe |
|---|---|---|
| Accès aux intérieurs | 🟡 | **points de TP ce soir** (génériques, toutes maps) |
| Maisons, magasins, hangars, portes verrouillables, coffres privés | ❌ | coffres de BUTIN seulement |

## 10. Survie — ❌ (santé native nanos ; potions via la roue d'objets 🟡)

## 11. Technologie futuriste

| objectif | état | ce qui existe |
|---|---|---|
| HUD personnel, radar | 🟡 | HUD WebUI, radar (H) |
| Caméras de sécurité | 🟠 | `Logic/Cameras.lua` câblé, jamais appelé ; meshes Defender cuits |
| Implants, drones, piratage, terminaux, badges | ❌ | le drone DRAGONFLY du CITY_PACK est cuit, sans système |

## 12. Mort / blessures — 🟠 (mort/respawn natifs nanos ; le reste ❌)

## 13. Administration

| objectif | état | ce qui existe |
|---|---|---|
| Droits admin appliqués côté serveur | 🟡 | **ce soir** : règle unique `PeutGerer`, Steam ID + base |
| Téléportation, spawn d'objets | 🟡 | `/monde`, `/tp aller`, menus armes/PNJ/props (admin) |
| Panel admin, logs d'actions, sanctions, bans, tickets | ❌ | journal serveur seulement |

## 14. Persistance

| donnée | état |
|---|---|
| compte, personnage, apparence, inventaire, argent | ✅ / 🟡 (inventaire persistant depuis le 06/09) |
| équipement | ❌ (`EnregistrerSac` écrit `equipment = {}` — Q5) |
| véhicules, propriétés, métier, faction, réputation, compétences, missions | ❌ |
| constructions | 🟠 (export) |
| **progression** | ❌ — le niveau ne monte jamais (Q4 : à définir, validée) |

## 15. Multijoueur et performances — ❌ rien mesuré (10 / 50 / 100 / 200 / 400 joueurs)

---

## Phase 1 de la feuille de route (« stabiliser le moteur ») — où on en est

| étape | état |
|---|---|
| Cook | ✅ deux cooks complets ce soir (`Packages Remain 0`) |
| World Partition | ❌ non employé (Map_Narvos persistant + sous-niveaux) |
| Import assets | 🟠 packs promus ; audit : 3 369 dépendances mortes, 855 rapatriables ; **textures de la ville : séance prête** |
| Animations | 🟠 3 480 cuites ; Freeflow et Defender réparés |
| Mutable | ❌ l'exemple officiel est dans le projet ; porteur Mutable à construire (graphe Blueprint via MCP) |
| Props | 🟡 |
| Véhicules | 🟡 (jamais vus rouler) |
| Test Map_Narvos | à faire en jeu |
| Systèmes écrits jamais exécutés | 🟠 20 modules câblés sans appelant (audit systèmes §2.12) |

## Proposition pour la suite (après ton test)

1. Corriger ce que ton test remontera (MetaHuman, marchands, TP, Defender).
2. Séance éditeur **textures de la ville** + second cook (tout est prêt : `scripts/adk-session-ville.py`, `.hermes/cook_ville_2026-09-11.sh`).
3. **Progression** (Q4) : niveau + XP par action (combat, récolte, craft), métiers façon Hyper Skill Level Manager, persistance — le socle des métiers et des factions.
4. Persistance manquante : équipement, réputation, quêtes acceptées.
5. Porteur **Mutable** (une pièce fusionnée au lieu de N) — graphe via l'UnrealMCPServer.