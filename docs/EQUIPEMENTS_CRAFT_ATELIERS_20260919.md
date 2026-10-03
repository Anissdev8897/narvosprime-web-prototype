# Équipements 3D · /craft · ateliers manuels · marchands — brief du 19/09

**Date :** 2026-09-19 · **Auteur :** Hermes
**Statut :** écrit, câblé, batterie verte (111 harnais · 14 078 assertions · 0 rouge) — à voir en jeu.

---

## 1. Équipements attachés au corps 3D

**Avant** : l'inventaire déclarait « TORSE : Armure Cybernétique » mais le modèle 3D restait en sous-vêtements (prouvé par les captures). Seules les armes se tenaient (PickUp natif).

**Maintenant** :
- **12 emplacements** (`Inventory.EQUIPMENT_SLOTS_ORDERED`) : Casque, Torse, Jambes, **Chaussures**, Arme principale, Arme secondaire, **Collier**, **Anneau 1**, **Anneau 2**, Bijoux, **Ceinture**, **Cape** — les 6 nouveaux couvrent le brief + les « slots solo » de l'UI web héritée (GameMenus.tsx : belt, boots, cloak, ring1, ring2, amulet). Sans émoticône dans les libellés.
- **`Logic/Equipement3D.lua`** (pur) : slot → socket du squelette (casque→head, torse→spine_03, jambes→pelvis, chaussures→foot_r, collier/bijoux→neck_01, anneaux→index_01_l/r) + meshes de repli cuits pour les items sans `mesh` (SM_ArmorHelmet/Chest/Shoes, SM_Ring_*, SM_Necklace_* — vérifiés dans Assets.toml).
- **Rhabillage serveur** : à chaque équiper/déséquiper (`AppliquerEtatSac`) ET au spawn (reconnexion déjà équipé) — `AddStaticMeshAttached`/`RemoveStaticMeshAttached`, mêmes primitives que la garde-robe, mémoire `narvos_equips` pour retirer les anciens.
- Limite : couronne/diadème sans mesh cuit → bonus de stats invisible (dit en commentaire) ; les nouveaux slots (ring1/ring2/necklace/belt/cloak) attendent des items avec ces `equipSlot` — le catalogue Items.lua est GÉNÉRÉ (TS) et intouchable ici.

## 2. Commande /craft

- `/craft` : ouvre le menu de craft de la station dans laquelle on se tient ; sinon « Approchez-vous d'un atelier ». Commande de jeu (pas DEV), même garde de proximité que la fabrication elle-même.

## 3. PNJ marchands / vente

- Chaîne complète audité : interagir [Y] → dialogue → « Voir la boutique » → `EnvoyerBoutique` → `Narvos:Boutique` → achats/ventes gardés par proximité (8 marchands posés et incarnés).
- **Corrigé** : `EnvoyerBoutique` exige désormais `marchand_proche` — le stock ne s'ouvrait plus à distance (l'achat était déjà gardé, l'affichage ne l'était pas).
- Limite connue : `dialogue_joueur` global unique (deux joueurs en dialogue simultané peuvent se marcher dessus) — à traiter plus tard.

## 4. Ateliers plaçables manuellement

- **Spawn automatique DÉSACTIVÉ** : `PoserAteliers()` + `PoserEtabliAssemblage()` ne posent plus rien au démarrage — plus de cercle forcé.
- **Les 5 ateliers sont plaçables à la main** (menu props → « Entités de jeu ») : forge, établi, alchimie, raffinerie + **établi d'assemblage** (nouveau dans PoseRecolte).
- Pose → persistance (`recolte_places`) → relecture au boot → interaction : les 4 stations ouvrent leur craft (OuvrirAtelier), l'établi branche l'assemblage pièce par pièce (`AssemblageServeur.Entrer/Sortir`).

## 5. Corrections issues de tes logs (12:53–13:10)

- **`MoveTo: You cannot MoveTo Characters which have Player controlling it`** (spam) : l'auto-marche par MoveTo serveur est REMPLACÉ par `Input.InputKey` côté client (doc officielle) — on force la touche réelle de marche avant (`GetMappedKeys("MoveForward")`, donc Z sur AZERTY, W sur QWERTY, jamais codé en dur) ; toute frappe physique de déplacement arrête ; aucun événement script n'est déclenché par le forçage (pas de boucle).
- **`Player not found for Remote Event 'Narvos:TouchesReservees'`** : l'envoi attend la première réception de `Narvos:Commandes` (session prouvée) ou l'ouverture de l'écran Commandes.

## 6. Vérifications

| Contrôle | Résultat |
|---|---|
| Syntaxe (wasmoon) | 6 fichiers modifiés OK (Server/Index, Client/Index, Shared/Index, Inventory, PoseRecolte, Equipement3D) |
| Harnais mis à jour | tests.lua (12 slots), pose-recolte.mjs (11 entités, 9 cuites), portee-check vert |
| **Batterie** | **111 harnais · 14 078 assertions · 0 rouge** |

## 7. Tester en jeu

1. Équiper Casque/Armure/Bottes (inventaire) → le personnage doit PORTER les meshes (casque sur la tête, plastron, bottes) ; déséquiper → ils disparaissent ; se déconnecter/reconnecter → toujours équipé.
2. `/craft` près d'un atelier → menu ; loin → refus.
3. Menu props → « Entités de jeu » → poser une forge à l'endroit voulu → s'approcher → le craft s'ouvre ; redémarrer le serveur → elle est toujours là.
4. Auto-marche (F2 ou Jouabilité) : avancer puis lâcher → on continue ; touche de déplacement → stop ; vérifier Z (AZERTY) et W (QWERTY).