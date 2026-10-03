# Pose manuelle des gisements et ateliers (menu de props)

**Date :** 2026-09-19 · **Auteur :** Hermes · **Demande :** « les faire spawn dans le menu de props et pouvoir les placer nous manuellement »
**Statut :** écrit, câblé, batterie verte — **pas encore vu en jeu**.

---

## 1. Ce qui existe déjà (et qui a été réutilisé)

- **Menu de props** réservé aux admins : `menu_props` → `Narvos:DemanderProps` → `Server/Props.lua` (`Poser` : position calculée CÔTÉ SERVEUR, garde d'édition, plafond 60, cadence 250 ms). Gizmo pour ajuster les décors posés.
- **Les meshes** : les 4 minerais (`SM_Ore_Iron`, `SM_Crystal_Large_01`, `SM_Ruby`, `SM_Ore_Uranium`) et les 4 stations sont CUITS et déjà dans les catalogues (`PropsNarvos.lua` généré, `Ateliers.lua` généré). Un admin pouvait donc déjà poser ces meshes comme **décor** — mais **inertes** : pas de déclencheur, pas d'état, pas de récolte, pas de panneau.
- **Persistance** : `Package.SetPersistentData` / `.data/PersistentData.toml` (pattern `EditionPnj`, et des chaînes simples sont acceptées — `nanos-world-discord` en stocke).

## 2. Ce qui a été ajouté

### Le décideur (pur, prouvé)
- **`Shared/Logic/PoseRecolte.lua`** : catalogue des **10 entités posables** (6 gisements + 4 ateliers) construit depuis les catalogues RÉELS ; clés d'instance uniques (`gisement:filon_metal_rare#2`) ; plafond par entrée (12) ; `PlanDePose` (déclencheur 2,5 m + ligne de persistance, ou refus motivé) ; `Serialiser`/`DepuisPersistance` à ordre stable.
- **`scripts/lua-harness/pose-recolte.mjs`** : **74 assertions** — dont chaque mesh déclaré vérifié contre le pack CUIT (`Assets.toml`), le cube de repli pour les 2 gisements sans mesh, l'unicité des clés, l'aller-retour de persistance.
- Câblé dans **`Shared/Index.lua`** (log `[POSE] 10 entité(s) posable(s) a la main, 2 en cube de repli`).

### L'exécution (moteur)
- **`Server/Props.lua`** : `UtiliserPoseurEntite(fn)` (même discipline que la garde, fermée par défaut) ; `Poser` route les ids d'entités vers le poseur AVANT le catalogue de décors ; `Envoyer` ajoute la section `entites` au menu.
- **`Server/Index.lua`** :
  - `PoserEntite(id, position, yaw, persister)` : prop + `SetValue("narvos_entite", cle)` + **déclencheur sphérique 2,5 m** + état de récolte (gisement) ou `OuvrirAtelier` (station) ;
  - `ReposerPosees()` au démarrage (après `PoserGisements()`) ;
  - `RefDeGisement(id)` : une instance posée à la main porte SON état — récolter un filon posé ne touche pas la repousse de son frère du cercle ;
  - `Narvos:Recolter` et `Reperer` résolvent instances ET nœuds du catalogue.
- **`Client/UI/ateliers.js`** : section « Entités de jeu » dans le rail du menu, marques `gisement` / `atelier` / `cube (repli)`. Le clic part par le pont existant `NarvosProps:Poser` → `Narvos:PoserProp`.

## 3. Vérifications

| Contrôle | Résultat |
|---|---|
| `pose-recolte.mjs` | 74 assertions, 0 échec |
| `cablage-check.mjs` | modules câblés, champs existants — OK (le garde-fou a refusé un champ créé hors module : corrigé en déclarant `ENTREES` DANS le module) |
| `modules-orphelins-check.mjs` | OK (il avait refusé le module non câblé : câblé depuis) |
| Syntaxe (wasmoon `load()`) | `Props.lua`, `Server/Index.lua`, `Shared/Index.lua`, `PoseRecolte.lua` OK · `ateliers.js` (`node --check`) OK |
| **Batterie complète** | **106 harnais · 13 968 assertions · 0 échec · 0 ROUGE** |

## 4. Tester en jeu (admin)

1. Relancer le serveur (`bash scripts/narvos-lancer-serveur.sh`) — le câblage se charge au démarrage.
2. Ouvrir le **menu props** → nouvelle catégorie **« Entités de jeu »** → cliquer un gisement ou un atelier : il se pose devant toi (même règles que les décors : garde d'édition, cadence).
3. S'approcher (< 2,5 m) : le panneau de récolte / d'atelier s'ouvre comme sur les nœuds du cercle. Récolter un filon posé à la main : il repousse **pour lui** (état par instance).
4. **Redémarrer le serveur** : les entités posées sont **relues** (`[POSE] N entite(s) … relue(s) depuis la persistance`) — elles survivent au redémarrage.

## 5. Limites connues (à trancher plus tard)

- **`organisme_alien` et `puissance_amelioree`** : aucun mesh cuit → cube de repli (marqué « cube (repli) » dans le menu).
- **Pas de gizmo ni de retrait** sur les entités posées (le gizmo n'attache que les décors du joueur) : retirer = supprimer la ligne dans `.data/PersistentData.toml` (`recolte_places`) puis redémarrer — ou un futur `/retirerentite`.
- **`/exporter`** n'inclut pas encore les entités (elles sont persistées, pas figées en catalogue) : à brancher si tu veux les exporter avec la map.
- L'**échelle** des minerais Hyper n'est pas mesurée (champ `echelle` prêt dans le module).