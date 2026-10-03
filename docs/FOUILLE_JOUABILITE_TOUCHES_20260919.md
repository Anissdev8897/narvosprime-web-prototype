# Fouille des cadavres · Jouabilité · Touches — et liaisons de l'audit

**Date :** 2026-09-19 · **Auteur :** Hermes
**Statut :** écrit, câblé, batterie verte (111 harnais · 14 071 assertions · 0 rouge) — **pas encore vu en jeu**.

---

## 1. Fouille des cadavres

**Avant** : à la mort d'un PNJ, le butin partait DIRECTEMENT dans le sac (message chat).
**Maintenant** : le butin attend sur le cadavre (120 s, aligné sur sa durée de vie). Le tueur reçoit « N objet(s) sur le cadavre — fouiller (F1) ».

- **Modèle pur** `Shared/Logic/Fouille.lua` (prouvé : `fouille.mjs`, 22 assertions) : entrées numérotées, prendre un objet ou une partie, tout prendre, poids Σ weight×quantité, **filtre auto-loot** (familles + rareté minimale), sac plein = rien ne quitte le cadavre.
- **Exécutant** `Server/Fouille.lua` : cadavre le plus proche < 2,5 m ; menu poussé PAR LE SERVEUR (`Narvos:Fouille`) — un client modifié ne peut pas s'ouvrir un menu vide ; prise sélective / tout prendre revalidés (proximité + sac) ; les objets refusés **retournent au cadavre**.
- **Menu WebUI** (`index.js` + section `#fouille`) : liste avec libellé, ×quantité, poids par ligne et poids total ; boutons « Prendre » et « Tout prendre » ; ESC ferme.
- **Commande** `fouiller` (défaut **F1**) dans le système de touches existant ; touche annoncée dynamiquement dans le message (jamais en dur).
- **Branché à l'inventaire existant** : `Inventory.AddItemToGrid` + `EnregistrerSac` + `EnvoyerInventaire` — aucun inventaire parallèle.

## 2. Menu « Jouabilité » (Échap → Paramètres)

- **Registre extensible** `Shared/Logic/Jouabilite.lua` (prouvé : `jouabilite.mjs`, 25 assertions) : chaque réglage = une entrée `{ id, type, defaut, valeurs… }`. Types : `toggle`, `choix`, `multi`, `groupe` (sous-paramètres). **Ajouter un futur paramètre = une ligne dans la table** — le serveur, la base SQL et l'écran suivent (preuve d'extension à chaud dans le harnais).
- Paramètres livrés :
  - **Auto-loot** (toggle) : à la mort, le filtre décide et le sac reçoit ; le reste attend sur le cadavre.
  - **Auto-loot avancé** (groupe) : **types d'objets** (armes, équipements/bijoux, consommables, ressources, autres — multi) + **rareté minimale** (tout/commun/rare/épique/légendaire — choix).
  - **Auto-marche** (toggle) : après un départ en avant, on continue sans tenir la touche (voir §3).
- Persistance **par compte** en SQL (table `jouabilite`, même pattern que `commandes`) ; validation en liste blanche côté serveur ; l'écran rend le registre dynamiquement (`#jouabilite`, clics `data-jouabilite-*`, « défaut » par paramètre + « Tout réinitialiser »).

## 3. Système de touches (Paramètres → Touches)

- **Nouvelles commandes** : `fouiller` (F1) et `auto_marche` (F2) — ajoutées à la LISTE FERMÉE existante, arbitrage des conflits et dédoublonnage base>défaut inchangés (harnais commandes : **199 assertions**).
- **Touches étendues** (doc locale `input.mdx` citée ligne à ligne) : pavé numérique `Num 0-9 + − * / .` (moteur `NumPadOne…`, distinct des chiffres), directionnelles `Haut/Bas/Gauche/Droite`, spéciales `Espace, Entrée, Suppr, Insert, Début, Fin, PgPréc, PgSuiv`. Liste blanche conservée : `KEYV` et tout nom inventé restent refusés.
- **AZERTY / QWERTY** : le client lit `Input.GetGameKeyBindings()` (liaisons RÉELLES du déplacement sur SA machine) et les rapporte au serveur (`Narvos:TouchesReservees`) — sur un AZERTY, **Z Q S D deviennent intouchables** en plus de W A S D ; sur un QWERTY, Z reste assignable (prouvé dans le harnais).
- Réinitialiser une touche / tout existait déjà (`Narvos:ReinitialiserCommande`) et couvre les nouvelles commandes.
- **Auto-marche** : nanos ne synthétise pas de touche → le client détecte le relâchement de la marche avant native (`Input.Bind("MoveForward", Released)`) et envoie le cap caméra toutes les 250 ms ; le serveur (`Narvos:AutoMarcheAvancer`) fait `MoveTo` à 8 m, gardé par le réglage du compte. Toute touche de déplacement native arrête (`StopMovement`). **À vérifier en jeu** : la fluidité de `MoveTo` sur un personnage joueur (API prouvée sur les PNJ).

## 4. Liaisons de l'audit (la liste)

- **`Logic/ObjetsHyper.lua`** : `Adapter` — chaque entrée de pack AJOUTÉE est complétée (jamais écrasée) : `poids→weight`, `prix→value`, `category`/icône par type, **stats par prix** (armes : `attackPower` = prix/45, min 3 — même idée que le générateur de loot procédural), **useEffect heal/mana** déduit du libellé pour les consommables inertes (que la roue refusait). Les **21 recettes sans station** (craft « à la main » du pack) sont assignées à l'**établi** (workbench) — copie profonde, catalogue jamais muté.
- **`Logic/Loot.lua`** : `Adapter` (statBonus→stats, slot→equipSlot, kind→type, empilabilité), `Integrer(items)`, `EnregistrerDef(items, entree)`.
- **`Shared/Index.lua`** : intégration après ButinEnnemi — log `[LOOT] N definition(s) de drop reliee(s) au sac`.
- **`Server/Index.lua`** : `VerserButin` enregistre chaque drop inconnu AVANT de le verser ; les `gen_*` sont **persistés** (`loot_gen_defs`) et **relus au démarrage** — un sac survit au redémarrage sans fantôme.
- **Prouvé** par `liaisons-loot.mjs` (13 assertions, chargement complet réel) : 0 définition loot hors sac, 0 objet pack sans valeur/poids/icône, 0 consommable inerte, 0 arme sans dégâts, 0 recette sans station, gen_* inscrit + versé + visible dans la vue.

## 5. Vérifications

| Contrôle | Résultat |
|---|---|
| `jouabilite.mjs` | 25/25 |
| `fouille.mjs` | 22/22 |
| `commandes.mjs` (dont 14 nouvelles assertions touches/AZERTY) | 199/199 |
| `liaisons-loot.mjs` | 13/13 |
| Harnais existants non cassés | objets-hyper, objets-isp, loot-smoke verts |
| Syntaxe (wasmoon `load()`) | 8 fichiers serveur + Client/Index.lua OK · index.js (`node --check`) OK |
| **Batterie complète** | **111 harnais · 14 071 assertions · 0 rouge** |

## 6. Tester en jeu

1. Relancer le serveur — les logs doivent montrer `[LOOT] … reliee(s)` et `[POSE] 10 entite(s)`.
2. Tuer un PNJ → message « … fouiller (F1) » → s'approcher → **F1** → prendre / tout prendre → l'inventaire reçoit (I).
3. Échap → **Jouabilité** → activer **auto-loot** + régler l'avancé (types + rareté) → tuer un autre PNJ → le butin arrive seul selon le filtre.
4. Jouabilité → **auto-marche** → avancer puis lâcher → on continue ; toute touche de déplacement arrête. (Fluidité MoveTo à confirmer.)
5. Échap → **Commandes** → réassigner une action sur une touche du pavé ou une flèche → vérifier l'affichage ; sur un clavier AZERTY, Z doit être refusé (« sert au déplacement sur votre clavier »).

## 7. Limites connues

- **Auto-marche** : `MoveTo` serveur sur un personnage joueur — à mesurer en jeu (navmesh, fluidité). Alternative si besoin : abaisser le pas ou passer par les axes moteur.
- **Fouille** : une seule personne à la fois n'est pas verrouillée — deux joueurs peuvent ouvrir le même cadavre ; le premier qui prend gagne (l'état est partagé, la vue se met à jour au prochain geste).
- **Loot** : les `gen_*` s'accumulent dans `loot_gen_defs` sans borne — un purgeur (âge/nombre) pourra s'ajouter.
- Indentation du HTML des sections jouabilité/fouille à harmoniser (rendu identique).