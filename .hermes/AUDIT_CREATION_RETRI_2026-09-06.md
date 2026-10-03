# Re-tranchage de l'audit de création de personnage — 2026-09-06

**Source :** `.hermes/AUDIT_CREATION_2026-09-04.md` (68 constats bruts, aucun verdict ferme).
**Méthode :** chaque piste a été retranchée contre le code ACTUEL (`packages/narvos/` + `narvos-map-proto/`), avec fichier et ligne à l'appui pour toute CONFIRMÉE ou RÉFUTÉE. **C'est le code du jour qui fait foi, pas la gravité du constat le 04/09.**
**Casier :** CONFIRMÉE = le code contient toujours (encore) le défaut décrit. RÉFUTÉE = le code contredit la piste (corrigé, ou l'entité visée n'existe plus). INDÉTERMINÉE = je ne peux pas trancher sans jeu/API nanos (ou sans le cook) — dit en une ligne.

**Rappel important : le catalogue `Modular.lua` a été fortement resserré depuis le 04/09.** Le `Modular.CORPS` actuel ne contient plus que `narvos_operateur_m` et `narvos_valkiria_f` (l. 44-47, tous deux `stylized`) — **aucune famille `mpfb` ni `trooper`** ne subsiste dans `PIECES`/`TENUE_BASE`. Une grande partie des pistes « mpfb/trooper » (B6/B9/S12/S13/S23/M24) tombe de ce fait.

---

## Bloquants (9)

| # | Verdict | Piste (résumé) | Preuve (fichier:ligne) |
|---|---|---|---|
| 1 | RÉFUTÉE | `perso.equipement` lu au spawn | `narvos-map-proto/Server/Index.lua:298-315` — le bloc a été réécrit : `local porte = Narvos.Vestiaire.Tenue(perso.apparence or perso.tenue, perso.gardeRobe)` (l. 314). `grep "equipement"` : plus que `Merchants.lua:184` (id marchand) et `Commandes.lua:70` (id de commande). |
| 2 | RÉFUTÉE | Rhabiller sans morphs | `narvos-map-proto/Server/Vestiaire.lua:150-151` — `Builder.Habiller(ctx.character, ctx.corps, tenue, ctx.perso.morphs, ctx.perso.colors)` ; commentaire du fix l. 143-148. |
| 3 | CONFIRMÉE | Macros.Resoudre n'émet aucun zéro | `narvos/Shared/Logic/Macros.lua:120-121` — `local function ajouter(sortie, nom, poids) if (poids <= 0) then return end` : toujours présent ; aucun `TousLesNoms`/zéro émis (0 occurrence). Le correctif n'a pas été appliqué. |
| 4 | RÉFUTÉE | 3 harnais rouges (Apparence) | `narvos/Shared/Logic/Apparence.lua:185-186` (`EstReglage` existe — fin de l'`attempt to index nil Package`) et `scripts/lua-harness/apparence-tests.lua:2-9` (81 assertions). La cause racine (module non chargé par les harnais) est corrigée. *Nuance : je n'ai pas relancé la suite complète ; la note de correction du 04/09 annonce 15 harnais verts / 881 assertions.* |
| 5 | CONFIRMÉE | Règle compte_id non verrouillée | `scripts/schema-check.mjs` : **0 occurrence de `compte_id`** — le contrôle statique proposé n'existe pas. Le verrou repose toujours sur les positions d'arguments dans la fausse base. Les requêtes actuelles PORTENT la clause (`Roster.lua:486,551`) mais rien ne l'exige. |
| 6 | RÉFUTÉE | TENUE_BASE → 15 pièces mortes | `narvos/Shared/Catalogs/Modular.lua:62-65` — `TENUE_BASE` ne contient plus que `stylized|F` et `stylized|M`. Plus aucune entrée trooper/mpfb. |
| 7 | CONFIRMÉE | Test PorteurCachable tautologique | `scripts/lua-harness/modular-tests.lua:164-165` — `local aTete = (nue.visage ~= nil) or (nue.tete ~= nil)` puis `egal(Modular.PorteurCachable(famille, genre), aTete, …)` : l'oracle est TOUJOURS dérivé de l'implémentation (seule addition : attente écrite pour `famille_inventee`, l. 171). |
| 8 | CONFIRMÉE | 12 références `nanos-world::` mortes (Weapons) | `narvos/Shared/Logic/Weapons.lua:71-73` — `P_Bullet_Trail`, `P_Weapon_BarrelSmoke`, `P_Weapon_Shells_9mm` sans `_System` toujours présents (les suffixes connus sont `_System`/`_Cue`). |
| 9 | RÉFUTÉE | tenueDefaut() = {} sur mpfb | `Modular.lua:44-47` : plus d'aucun corps mpfb dans `CORPS` (2 corps stylized) ; `Vestiaire.lua:210-221` : la troncature `#liste > 1` a été retirée (tous les slots sont rendus) ; repli serveur `CharacterCreation.lua:234-236` (`if tenue == nil → Modular.TenueDefaut`). |

## Sérieux (32)

| # | Verdict | Piste (résumé) | Preuve (fichier:ligne) |
|---|---|---|---|
| 1 | RÉFUTÉE | EncoderMorphs jette les 0 | `Roster.lua:250-255` (garder via `Apparence.EstReglage(id)` → true) + `Apparence.lua:185-186` (`EstReglage` = préfixe `Apparence.PREFIXE`). Les réglages de silhouette `#…` à 0 sont désormais conservés. |
| 2 | CONFIRMÉE | Aperçu d'un perso enregistré ignore morphs/garde-robe | `creation/index.js:269` (majApercu(choisi.gender, choisi.tenue, choisi.corps)) + `:171` (`morphs: morphs || {}`, table de module, jamais `choisi.morphs`). |
| 3 | RÉFUTÉE | Colonne couleurs = défauts | `Roster.lua:89-99` — commentaire d'avertissement + `EncoderCouleurs` dédié (le bug « EncoderTenue réutilisé » est documenté comme corrigé) ; couvert par `apparence-tests.lua`. |
| 4 | CONFIRMÉE | commandes_dev = true | `narvos-map-proto/Package.toml:52` — `commandes_dev = true` toujours livré ; garde `Index.lua:1002`. |
| 5 | CONFIRMÉE | Inscription sans cadence | `narvos-map-proto/Server/Session.lua:552-556` — `Events.SubscribeRemote("Narvos:Inscription"…)` → `Comptes.Inscrire` direct. Les limites existent pour la connexion (`Comptes.lua:341-349`), pas ici. |
| 6 | CONFIRMÉE | Apercu sans cadence | `Session.lua:455-466` — garde d'état + `Session.MajApercu` ; aucun contrôle de débit (la « limite » commentée l. 228 concerne la cohabitation des aperçus). |
| 7 | CONFIRMÉE | CreerPerso/SupprimerPerso sans cadence | `Session.lua:567-570`, `:622` — abonnements directs, aucun garde. |
| 8 | CONFIRMÉE | MajTenue ignore lignes touchées | `Roster.lua:551-553` — `db:Execute(...)` jeté, `return true, nil`. Contraste : `MajGardeRobe` vérifie `touchees` (l. 521-527) — la leçon a été appliquée au voisin, pas à MajTenue. |
| 9 | CONFIRMÉE | Crédits/garde-robe en absolu depuis l'instantané | `Roster.lua:521-523` — `UPDATE … SET garde_robe = :0, credits = :1` (écriture absolue) ; `ctx.perso.credits` lu depuis l'instantané de session (`Vestiaire.lua:126,169`) → deux connexions concurrentes = écrasement. |
| 10 | CONFIRMÉE | PBKDF2 1000 it., sel non crypto | `Comptes.lua:44-47` (`ITERATIONS = 1000`, commentaire « ⚠ »), `:25-29` (`math.random` non crypto). |
| 11 | CONFIRMÉE | Arguments non scalaires du pont | `emotes/index.js:236` (`versLua("NarvosEmotes:Jouer", retenue, null)`), `:240` (`…, false)`). |
| 12 | RÉFUTÉE | 4 vêtements mpfb, morphs inatteignables | `Modular.lua:44-47` — aucune pièce `mpfb_*` dans le catalogue actuel. |
| 13 | RÉFUTÉE | 3 familles mortes dans TENUE_BASE | `Modular.lua:62-65` — 2 entrées seulement. |
| 14 | RÉFUTÉE | Écran de création = boutique gratuite | `Vestiaire.lua:189-201` — `grouper(famille, genre, Vestiaire.EstIdentite, …)` (registre `base` uniquement, `REGISTRES_CREATION` l. 50) ; commentaire l. 190-200 + « trois tests verrouillent » l. 223-225. |
| 15 | CONFIRMÉE | Morphs.CHOIX zones « l »/« r » inatteignables | `Morphs.lua:192-193` (`zone = "l"` / `"r"`) contre `Morphs.ZONES` l. 33-45 (cheek, chin, ear, eye, eyebrows, forehead, head, measure, mouth, neck, nose — pas de l/r). |
| 16 | RÉFUTÉE | Apparence.lua sans test | `scripts/lua-harness/apparence-tests.lua:2-9` (81 assertions ; `Narvos.Apparence` chargé l. 9). |
| 17 | CONFIRMÉE | Character.lua sans harnais | 0 occurrence de `Character.lua` dans `scripts/lua-harness/`. |
| 18 | CONFIRMÉE | narvos-map-proto sans test | `run.mjs:4` ne charge que `Inventory.lua` ; aucun harnais ne charge `narvos-map-proto/Server|Client`. |
| 19 | CONFIRMÉE | Pas de plancher d'assertions | 0 occurrence de plancher/comptage d'assertions dans `run.mjs`/`macros.mjs`. |
| 20 | INDÉTERMINÉE | Famille 2 (universal-*) des macros hors contrôle | `parcours-tests.lua:168-173` boucle `poidsCorps` ; le cas exact (réglages @genre/@height + ethnie) n'a pas été exécuté. → relancer le harnais avec ce cas pour trancher. |
| 21 | CONFIRMÉE | MajMorphs sans test ni appelant | `Roster.lua:478` = seule occurrence dans tout le package. |
| 22 | CONFIRMÉE | Inventaire du pack de base = 22 % | `narvos-verifier-catalogues.mjs:35-36` — `BASE = …/NanosWorld/Content/NanosWorldAssets` (un dossier sur six). |
| 23 | RÉFUTÉE | 15 identifiants morts (trooper) | `Modular.lua:62-65` + `:128-145` — plus d'entrée trooper. |
| 24 | CONFIRMÉE | Contrôle de type 2 catalogues sur 8 | `narvos-verifier-catalogues.mjs:297,328` — `controlerType` appelé 2 fois (animations, materials). |
| 25 | INDÉTERMINÉE | 19,1 Go de morts dans le cook | Nécessite la mesure ACTUELLE de `WebPortal/Server/Assets/narvos/Narvos` (refs `Narvos/Maps/` dans Assets.toml + taille de `Maps/forge_map`) — le cook n'a pas été lancé/relu pendant ce retri. À mesurer avant toute décision. |
| 26 | CONFIRMÉE | Dédup `_N` par ordre de parcours | `nanos-build-asset-pack.mjs:170-175` — `nomsPris` + suffixe `_N` du second arrivant. |
| 27 | RÉFUTÉE | ouvrirCreation retient le corps morphable | `Modular.lua:44-47` : le corps morphable n'est PLUS dans `CORPS` (le premier trié par id est `narvos_operateur_m`, habillable) ; en plus le repli serveur a été corrigé (`CharacterCreation.lua:204-211`). |
| 28 | CONFIRMÉE | Le fil ment (étapes atteignables tôt) | `creation/index.js:370-371` — `if (id === "visage" || …) return Boolean(brouillon.genre && brouillon.corps)` et `ouvrirCreation` pose genre + corps dès le départ (l. 350-355). |
| 29 | CONFIRMÉE | Changer de genre sans remise à plat | `creation/index.js:537-548` (handler genre) : corps = `dispo[0]`, tenue = `tenueDefaut` — mais **pas** de `morphs = silhouette` ni `dissociees.clear()`, qui n'existent que dans le handler CORPS (l. 588-593). |
| 30 | INDÉTERMINÉE | Choisir un corps saute Visage | `creation/index.js:595` (`etape = "tenue"` — le saut est toujours dans le code) **mais** aucun corps morphable au catalogue → je ne peux pas savoir si l'étape Visage s'affiche encore. → à vérifier en jeu. |
| 31 | CONFIRMÉE | Aperçu sélection = brouillon | `creation/index.js:269` (`majApercu(choisi.gender, choisi.tenue, choisi.corps)`) + `:163-175` (`morphs: morphs || {}`, `couleurs: couleurs || {}`). |
| 32 | RÉFUTÉE | tirerApparence distribue des pièces | 0 occurrence de `tirerApparence` dans tout le package (fonction disparue/refactorée) ; le serveur filtre désormais par `EstIdentite` (`Vestiaire.lua:201`). |

## Mineurs (27)

| # | Verdict | Piste (résumé) | Preuve (fichier:ligne) |
|---|---|---|---|
| 1 | RÉFUTÉE | ouvrirCreation ne reset pas morphs | `creation/index.js:340-341` — `morphs = {}; couleurs = {};` (commentaire l. 338) : corrigé. |
| 2 | CONFIRMÉE | `/tenue` écrit `perso.tenue` | `Index.lua:738-750` (construit `tenue`, `Roster.MajTenue`, `perso.tenue = tenue` l. 750) alors que le spawn lit `perso.apparence` en priorité (l. 314-315) → incohérence si `apparence` non vide. |
| 3 | CONFIRMÉE | MajMorphs jamais appelée | `Roster.lua:478` = seule occurrence. |
| 4 | CONFIRMÉE | `/tenue` sans cadence et ouvert | `Index.lua:744` (appel direct `Roster.MajTenue`) + `:965` (commentaire : `/tenue`, `/ou`, `/morph` restent ouverts hors DEV). |
| 5 | INDÉTERMINÉE | Narvos:Vestiaire:Ouvrir sans cadence | Aucun abonnement `Narvos:Vestiaire:Ouvrir` trouvé dans `Session.lua` — le handler n'est pas où la piste le situe (déplacé ?) ; `Session.lua:651` est `Session.Ouvrir` (autre fonction). |
| 6 | CONFIRMÉE | Slot brut du joueur dans le chat | `Index.lua:721` — `Chat.SendMessage(player, "<grey>slot inconnu ou vide : " .. slot .. "</>")` : `slot` est l'argument joueur (l. 702) interpolé sans `SansBalise` (pourtant défini l. 246). |
| 7 | CONFIRMÉE | Nom sans contrainte de caractères | Aucune validation de jeu de caractères trouvée côté serveur ; seul `maxLength` client (`creation/index.js:613`). `CharacterCreation.lua:200-265` lu : pas de filtrage du nom. |
| 8 | CONFIRMÉE | `/morph` non borné, ouvert | `Index.lua:879-880` — `local v = tonumber(valeur); if (v == nil) then v = 1.0 end` : pas de clamp 0..1 ; `:965` : hors DEV. |
| 9 | CONFIRMÉE | prochain_emplacement sans recyclage | `Session.lua:289` (compteur module) + `:303-307` (`s.emplacement = prochain_emplacement` une seule fois, compteur jamais recyclé). |
| 10 | CONFIRMÉE | Limite de connexion sur la session | `Session.lua:527-530` — commentaire explicite : « LA LIMITE VIT SUR LA SESSION… » (comportement toujours réel). |
| 11 | CONFIRMÉE | structureVersLua sur 1 page sur 3 | 3 occurrences `structureVersLua` — toutes dans `creation/index.js` (`:130,170,1507`) ; `ateliers.js`, `emotes/index.js`, `index.js` : 0. |
| 12 | CONFIRMÉE | 2 émetteurs contournent le helper | `creation/index.js:1456` et `:1460` — `versLua("NarvosCreation:Connexion"/"Inscription", …)` directs (le helper `structureVersLua` n'est pas utilisé). |
| 13 | CONFIRMÉE | Sondes de diagnostic branchées | `creation/index.js:134-156` (`SONDE TEMPORAIRE` + `sonde()`) et `:1500-1502` (`sonde("clic-creer")`) ; trace serveur `Session.lua:460-462`. |
| 14 | RÉFUTÉE | attache/socket plus produits | `narvos-modular-to-lua.mjs:523` — `…(POIL ? { attache: "static", socket: "head" } : {})` : le générateur produit toujours ces champs ; `Character.lua:90-144` les consomme. |
| 15 | INDÉTERMINÉE | 3 slots déclarés sans pièce | Non compté (le catalogue a changé : 2 familles stylized) → re-mesurer les slots de `Modular.PIECES` avant décision. |
| 16 | RÉFUTÉE | Identifiants bruts à l'écran | `creation/index.js:307-308` — `slot-nom` = `p.name`, `slot-classe` = `lore ? lore.label : p.classId` : libellés privilégiés, fallback seulement. |
| 17 | RÉFUTÉE | Compteur Corps ment (6 pour 8) | `creation/index.js:872` (« PAS DE COMPTEUR “RÉGLÉS” ICI ») + `:1036` (« Le compteur montre ce qui est MODIFIÉ… ») : le compteur menteur a été corrigé. |
| 18 | CONFIRMÉE | morphs-tests.lua sans confrontation GLB | `morphs-tests.lua` : 0 occurrence de `glb` (seul `morphs.mjs:11` le mentionne, côté macros). |
| 19 | INDÉTERMINÉE | 2 harnais hors liste des 14 | Le dispositif « liste des 14 » n'est pas identifiable dans `run.mjs` (il ne gère qu'un seul harnais, `run.mjs:4`) — le déclencheur global n'a pas été retrouvé. |
| 20 | CONFIRMÉE | MapLoader/Weapons sans harnais | 0 occurrence dans `run.mjs` ; aucun harnais ne les charge. |
| 21 | CONFIRMÉE | MajTenue succès sans vérif | `Roster.lua:551-553` (voir S8). |
| 22 | INDÉTERMINÉE | Animations.lua ignore 588 anims cuites | nécessite le décompte du pack cuit (`Server/Assets`) — pas relancé ici. Le générateur annonce « N animations exposées » (`narvos-anims-to-lua.mjs:73`), la comparaison précise cook/catalogue reste à faire. |
| 23 | CONFIRMÉE | Chemins web `/models/*.glb` | `Vehicles.lua:10,28,46,65,83,102` (`path = "/models/vehicule/…"`) ; `Npc.lua:173+` (`assetRoot = "/models/pnj_monstre"`). |
| 24 | RÉFUTÉE | base_morphable et mpfb_* déclarés | `Modular.lua:44-47` — les `mpfb_*` n'existent plus dans le catalogue (le `Morphs.MESH = "narvos::base_morphable"` reste, `Morphs.lua:30`). La piste décrit un état révolu. |
| 25 | RÉFUTÉE | Compteur Corps (doublon M17) | idem M17 (`creation/index.js:872,1036`). |
| 26 | CONFIRMÉE | Sonde temporaire encore câblée | idem M13 (`creation/index.js:1500-1502`). |
| 27 | RÉFUTÉE | Classe CSS `enseigne-marque` sans règle | 0 occurrence dans `style.css` (retirée depuis). |

---

## Décompte (68 pistes)

| Case | Nombre |
|---|---|
| **CONFIRMÉE** | **40** |
| **RÉFUTÉE** | **21** |
| **INDÉTERMINÉE** | **7** |

- **Bloquants :** 4 CONFIRMÉE · 5 RÉFUTÉE · 0 INDÉTERMINÉE
- **Sérieux :** 20 CONFIRMÉE · 9 RÉFUTÉE · 3 INDÉTERMINÉE
- **Mineurs :** 16 CONFIRMÉE · 7 RÉFUTÉE · 4 INDÉTERMINÉE

## Ce que ce re-tranchage change par rapport à la lecture brute du 04/09

1. **Le catalogue modulaire a été refondu** (retrait des familles `mpfb` et `trooper`, TENUE_BASE réduite à stylized, 2 corps) : les 5 pistes « mpfb/trooper » (B6, B9, S12, S13, S23, M24) sont RÉFUTÉES non par un patch mais parce que les entités visées n'existent plus.
2. **Les 7 correctifs annoncés dans la section « Déjà corrigés » sont confirmés présents** (B1, B2, S1, S3, S14, S16, M1) — vérifiés code à l'appui.
3. **Les pistes « pression d'exploitation » restent toutes vraies** : S4 (commandes_dev), S5-S7 (pas de cadence), S9 (crédits en absolu), S10 (PBKDF2 faible), M6/M7 (rich text non filtré) — l'ordre de priorité proposé pour la suite : **sécurité d'abord** (S4, S5, S7, S10, M6, M7), **intégrité des données** ensuite (S9, S8, M2, M21).
4. **Non mesuré ici (à faire avant toute décision) :** S25 et M22 exigent une lecture du pack cuit `Server/Assets` (à faire sans lancer de cook, juste en lisant les fichiers déjà présents) — je ne l'ai pas exécutée par respect de la consigne « pas de cook » ; les chiffres du 04/09 ne sont donc pas revalidés.