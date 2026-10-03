# HANDOFF NARVOS → CLAUDE (côté Unreal / assets)

Date : 2026-09-07 · Auteur : Hermes · Destinataire : Claude.
> Ce rapport est la synthèse de TOUT ce qui a été fait côté **Lua / TypeScript / données**
> (partie Hermes), et de ce qui **reste à faire côté Unreal**.
> Chaque bloq ue est vérifiable (commandes collées).

---

## 0. L'état de la chaîne économique (tout est câblé côté data/serveur)

```
EXPLORE ─┐
RÉCOLTE ─┤  gisements (Recolte.lua + Gisements.lua) → RESSOURCES
RAFFINAGE ┤  refinery (Recettes.lua : 4 refine_*) → 6 MATIÈRES SCI-FI
CRAFT    ─┘  4 stations (Recettes.lua : 9 craft_* + 18 f_/a_/j_*) → OBJETS FINIS
INVENTAIRE   grille par joueur (Inventory.lua), persistée (Roster)
```

## 1. CE QUI EST FAIT (Hermes) — avec preuve

### 1.1 Catalogue d'objets UNIFIÉ — `Items.lua` : **65 objets**
(26 de base + 18 ressources + 18 sorties de craft + 3 outils)
- **Généré depuis `WebPortal/src/rpg/items/itemCatalog.ts`** → `scripts/narvos-catalogs-to-lua.mjs --apply` (Items 32,5 ko).
- ⚠ **Règle d'or** : pour AJOUTER/CORRIGER un item → éditer `itemCatalog.ts` puis régénérer. **Ne JAMAIS hand-éditer `Items.lua`.**
- Preuve : `npx tsc --noEmit` → 0 erreur ; `grep -c` → 65.

### 1.2 Recettes — `Recettes.lua` : **31 recettes**
- `9` `craft_*` (portage TS, `craftingSystem.ts`) → stations forge/workbench/alchemy/refinery.
- `4` `refine_*` (raffinage ressource→matière sci-fi, station `refinery`).
- `18` `f_*`/`a_*`/`j_*` (recettes métier, `professionCatalog.RECIPES`) → forge/alchemy/workbench.
- ⚠ `Recettes.lua` est **écrit à la main** (PAS généré). `Craft.lua` = module pur, intact.
- Preuve : `craft.mjs` → parité TS/Lua **214/214**, comportement **46/46**, `Craft.Verifier` 0 problème.

### 1.3 Craft DANS LE MONDE — `narvos-map-proto/Server/Index.lua`
- `PoserAteliers()` : 4 stations (forge/workbench/alchemy/refinery) — prop + trigger `BeginOverlap`.
- `OuvrirAtelier` (recettes de la station + quantité possédée), `Fabriquer` (grille réelle + `Craft.Fabriquer` + **`EnregistrerSac`**).
- `Events.SubscribeRemote("Narvos:Crafter", …)` — **anti-client-authority** (`atelier_du_joueur`).
- `EndOverlap` ferme le panneau ; `Destroy` nettoie `atelier_du_joueur`.

### 1.4 RÉCOLTE DANS LE MONDE — `narvos-map-proto/Server/Index.lua`
- `PoserGisements()` : un node + trigger par gisement (`Gisements.lua`).
- `Recolte.lua` (pur, RNG en paramètre) : `EstPret`/`Peut`/`Rendement`/`MarquerRecolte`/`Reinitialiser`/`EtatNeuf`/`Verifier`.
- `Narvos:Recolter` handler : outil (`OutilDuJoueur` : `pioche`/`foreuse`/`collecteur`) + palier (`perso.niveau`) → `Rendement` → `AddItemToGrid` → `EnregistrerSac` → `MarquerRecolte`.
- **Client câblé (M1)** : `Client/Index.lua` relais `Narvos:Gisement/Fait/Erreur` → `HUD:CallEvent` ; `Client/UI/index.html` section `#gisement` (titre + état + bouton « Récolter ») ; `ateliers.js` `AfficherGisement` + clic → `Lua("Narvos:Recolter", id)` + messages `Fait`/`Erreur`.
- Horloge serveur : `maintenant_ms` (Timer.SetInterval 1 s, comme `Peuplement`). ⚠ logique, pas temps réel.
- **Exposé** : `narvos/Shared/Index.lua` += `Narvos.Recolte`, `Narvos.Gisements`.
- Preuve : `recolte.mjs` → **37/37** ; `syntaxe-check` → 52/52 ; `node --check ateliers.js` → OK.

### 1.5 Persistance de l'inventaire
- `Roster.lua` : colonne `inventaire`, `EncoderInventaire`/`DecoderInventaire`/`EnregistrerInventaire`.
- `Index.lua` : chargement au spawn (`perso.inventaire`), sauvegarde à la déconnexion (`Destroy`), **au coffre** (`VerserButin`→`EnregistrerSac`), **au voyage** (`Voyage.lua:159`).

#### 1.8 Ports (M4) — quêtes + dialogue (faits, testés)
- **`Logic/Quetes.lua`** (store pur, port de `questStore.ts`) + **`Catalogs/Quetes.lua`** (données, port de `questCatalog.ts`). 9 quêtes, 8 types d'objectifs (kill/reach/collect/talk/survive/escort/use/craft), branches, groupes exclusifs, abandon. Harness `quetes.mjs` → **26/26**.
- **`Logic/Dialogue.lua`** (moteur pur, port de `dialogueRunner.ts`) + **`Catalogs/Dialogues.lua`** (échantillon ; les vrais dialogues vivent en YAML). Registre/session/choix/conditions injectées. Harness `dialogue.mjs` → **13/13**.
- ⚠ `audio` = **Web Audio API (client)** → PAS un port Lua (voir §3).

## 1.9 Sécurité auth
- `Comptes.lua` : **PBKDF2-HMAC-SHA256 + sel**, comparaison temps constant, chemin Steam.
- TS : `hashPassword` (SHA-256 nu, mort) **supprimé** ; `storage.ts` placeholder clair → **PBKDF2**.

### 1.7 Rapports (docs/)
`docs/UNIVERS_OBJETS.md` · `docs/INVENTAIRES_SIX.md` · `docs/PORTAGES_SOURCES.md` ·
`docs/SECURITE_COMPTES_2026-09-07.md` · `docs/CRAFT_MONDE_2026-09-07.md` · `docs/FUSION_C_2026-09-07.md`.

---

## 2. CE QUI RESTE — et QUI le fait

### 🔴 À toi (Claude / Unreal) — les ASSETS & le MOTEUR
| # | tâche | détail |
|---|---|---|
| U1 | **Meshes** des 18 ressources, 6 matières sci-fi, 18 sorties, 3 outils | `itemCatalog.ts` : les `modelPath`/icônes pointent vers du **vide** ; les meshes ne sont pas dans le pack cuit |
| U2 | **Meshes des 3 outils** (`pioche`, `foreuse`, `collecteur`) | requis par `Recolte.Peut` « il te faut une pioche » |
| U3 | **Icônes** des 36 objets Fusion-C + 3 outils | le set UI (523 PNG) n'a PAS d'icône bois/herbe/marteau ; à créer ou réutiliser (`potion01.png`, `sword.png`…) |
| U4 | **Points de récolte visuels** (les gisements sont `SM_Cube` aujourd'hui) | remplacer par de vrais meshes de filons/cristaux/veines |
| U5 | **Meshes des 4 stations d'atelier** (forge/workbench/alchemy/refinery) | `SM_Cube` aujourd'hui |
| U6 | **Test moteur** : ateliers, gisements, WebUI, persist, combat/IA/gizmo | 5 systèmes écrits jamais exécutés (B5 CHANTIERS) |
| U7 | **Assets.toml complet** (8 animations vs 3 216) + locomotion + modulaire Defender | CHANTIERS B1/B7/B8 |
| U8 | **Import animaux + bâtiments** (142 GLB + 183 + 670 FBX) | CHANTIERS B6 |

### 🟡 À moi / prochaine passe (petit, Lua/TS) — déjà cadré
| # | tâche | détail |
|---|---|---|
| ~~M1~~ | ~~Prompt RÉCOLTE client~~ | ✅ FAIT (relais + `#gisement` + bouton → `Narvos:Recolter`) |
| ~~M2~~ | ~~Horloge réelle~~ | ✅ FAIT (`HorlogeMs()` = `os.time()*1000`, repli logique) |
| ~~M3~~ | ~~Mapping ICONES 65 objets~~ | ✅ FAIT (JSON `docs/icones_inventaire_2026-09-07.json`, 60 chemins réels 0 mort) — ⚠ **doc de mapping, PAS le câblage en jeu** : `itemCatalog.ts`/`Items.lua` portent encore `icon="emoji"` ; brancher les PNG = étape UI à faire (Claude) |
| ~~M4~~ | ~~Ports `quetes` + `dialogue`~~ | ✅ FAIT (`Logic/Quetes.lua` 26/26, `Logic/Dialogue.lua` 13/13) ; `audio` = front, pas un port |
| ~~M5~~ | ~~Câbler quetes/dialogue au monde~~ | ✅ FAIT (serveur : snapshot par joueur, hook craft→quetes, récompenses, dialogues start/choose) |

---

## 3. Plan de port (M4) — dialogue / quêtes / audio

| système | fichiers TS | nature | port Lua ? | approche |
|---|---|---|---|---|
| **dialogue** | `dialogueBridge/Loader/Runner/Store.ts` | runner + store de dialogues | ✅ oui | `Logic/Dialogue.lua` (runner pur, testable) + wiring + UI de dialogue client (panneau `#dialogue`) |
| **quetes** | `questStore.ts` (données) + `useQuests.ts` (hook React) | store de quêtes | ✅ données/logique | `Logic/Quetes.lua` (store + progression, pur) ; `useQuests` RESTE un hook client (JS) — pas de port |
| **audio** | `AudioBus/EventManager/Graph/Spatial.ts` | **Web Audio API** (navigateur) | ❌ non | pas portable en Lua serveur ; reste côté client JS. Éventuellement découper les **données** (catalogue sons) en Lua si nécessaire |

> ⚠ `audio` est un système **client** (Web Audio) : le « port » n'a pas de sens en Lua serveur. À traiter comme un chantier **front**, pas un chantier serveur.

---

## 4. CONTRACTS & GOTCHAS (à relire AVANT de toucher au moteur)

- **`Items.lua` est GÉNÉRÉ** depuis `itemCatalog.ts` → édite le TS + `node scripts/narvos-catalogs-to-lua.mjs --apply`. **Ne jamais** hand-éditer.
- **`Recettes.lua` est MAIN-WRITTEN** (pas généré) ; `Logic/Craft.lua` = pur (ne pas modifier).
- **Ne pas modifier `Survey/Shared/Logic/*.lua`** (Recolte, Inventory, Craft…) : ils sont purs ; le **câblage** se fait dans `narvos-map-proto/Server/Index.lua`.
- **Inventaire** : `Inventory.AddItemToGrid(grille, def, qte)` prend la **DÉFINITION** (`GetItemDef`), pas l'id. UID-based (`inst_N`).
- **Persistence** : SQLite via `Roster` ; colonne `personnages.inventaire` ; sauver via `EnregistrerSac(player)` (pas à chaque mutation).
- **Événements** : serveur→client `Events.CallRemote` / client reçoit `SubscribeRemote` → `HUD:CallEvent` ; client→serveur : JS `Events.Call` → Lua `Subscribe` → `Events.CallRemote`.
- **Stations** : `forge`/`workbench`/`alchemy`/`refinery` (4). **Outils récolte** : `pioche`/`foreuse`/`collecteur`.
- **Base SQL** : `comptes`, `personnages`, `commandes`, `raccourcis`. `personnages` porte `nom, class_id, genre, lore_id, corps, niveau, tenue, garde_robe, morphs, credits, couleurs, inventaire`.
- **Gisements** : `Gisements.lua` (ressource, zone_id, quantite_min/max, outil, palier, duree_ms, repousse_ms, bonus_palier).

---

## 4. Résumé des commandes de vérification (à rejouer)

```bash
# depuis E:/narvosprime-web-prototype
node scripts/lua-harness/syntaxe-check.mjs   # 52/52
node scripts/lua-harness/craft.mjs           # 214 parité + 46 comportement
node scripts/lua-harness/recolte.mjs         # 37/37
node scripts/lua-harness/portee-check.mjs    # 367 déclarations
cd WebPortal && npx tsc --noEmit             # 0 erreur
```

---

**Mes 3 fichiers de code** (toute la logique, le reste est du data): `narvos-map-proto/Server/Index.lua`
(ateliers + récolte + persistance), `narvos/Shared/Index.lua` (expose Recolte/Gisements), et le TS
`itemCatalog.ts` (+ sa régénération). **Tout le reste est du contenu** (Catalogues).
