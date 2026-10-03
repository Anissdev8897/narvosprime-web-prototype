# NARVOS PRIME — récapitulatif complet pour ASTRA (2026-09-14)

Rédigé par Claude (Claude Code) à la demande de Hanibes, à la fin de la session du
14/09. Objectif : que tu puisses reprendre le projet sans rien redécouvrir, installer
nos skills, et savoir où se trouve toute la documentation (la nôtre et celle de nanos).

> Règle du projet : **« écrit » n'est pas « branché », « branché » n'est pas « vu en jeu ».**
> Tout ce qui est marqué *jamais vu* a été prouvé par harnais / journal serveur, pas par une partie.

---

## 1. Le projet en une page

**NARVOS PRIME** — MMORPG 3D futuriste-fantasy, trois factions. Commentaires et docs en **français**.
Utilisateur / directeur : **Hanibes** (compte Windows `aniss`).

Deux runtimes vivants, même univers :

| Runtime | Techno | Où |
|---|---|---|
| **Web** (historique) | React 19 + React Three Fiber 9 + Three.js 0.181 + TypeScript 5.8 + Vite 6 + Electron 39 (MySQL/SQLite) | `E:\narvosprime-web-prototype\WebPortal\src\rpg\` (le reste de la racine est du legacy mort : `Refonte.Dofus/`, `archive/`, `documentation/`, `_legacy_archive/`, `dist*`) |
| **nanos world** (pivot actuel) | client Unreal Engine **5.7.4** *shipping* (aucun C++ chargeable) + packages **Lua 5.4** + pages **WebUI** HTML/JS | `E:\narvosprime-web-prototype\WebPortal\Server\nanos_world\packages\` |

nanos world en une phrase : **Unreal ne sert qu'à fabriquer des assets (cuits en asset packs), le gameplay s'écrit en Lua**. Les Blueprints cuits s'exécutent et se pilotent depuis Lua (`CallBlueprintEvent`), mais aucun plugin C++ tiers.

### Arborescence nanos

```
WebPortal/Server/nanos_world/packages/
  narvos/Shared/            Index.lua = LE SEUL CÂBLAGE (un module absent ici n'existe pas)
    Catalogs/               données GÉNÉRÉES par scripts/narvos-*.mjs (ne jamais éditer à la main)
    Logic/                  logique PURE (n'appelle jamais l'API nanos) — testable sous wasmoon
  narvos-map-proto/
    Server/                 exécutant : entités, base SQLite, événements (Index.lua, Session, Vestiaire, Sorts, Progression…)
    Client/                 relais WebUI, caméra, entrées (Index.lua, MetaCustom, Minimap, Pas…)
    Client/UI/              HUD WebUI (index.html/js, inventaire.js, competences.js, mcs-editeur.js…) + creation/
WebPortal/Server/adk/       NanosWorldADK.uproject — l'éditeur Unreal qui CUIT les assets
WebPortal/Server/Assets/narvos/Assets.toml   manifeste du pack cuit (GÉNÉRÉ, ~70 900 clés, ~88 Go)
D:\steam\steamapps\common\nanos-world-playtest\   client + serveur Steam (jonctions vers le projet)
scripts/                    générateurs narvos-*.mjs, chaîne de cook, harnais lua-harness/*
.hermes/                    rapports de session, audits, handoffs (dont ce fichier)
```

### Lancer le serveur

```bash
cd /d/steam/steamapps/common/nanos-world-playtest/Server
./NanosWorldServer.exe --playtest      # --playtest OBLIGATOIRE, sinon le client expire (5003)
```
Témoins : `Running Playtest App ID!`, `[PROGRESSION] niveaux et talents prets`, `Server started!`.
Journal client : `C:\Users\aniss\AppData\Local\NanosWorld\Saved\Logs\NanosWorldCore.log`.

---

## 2. Systèmes nanos — état au 14/09 soir

| Système | État |
|---|---|
| Comptes, roster, création de personnage (écran WebUI) | en jeu |
| Corps jouables = **MetaHuman** (Meta Customization System acheté) : `BP_NarvosMH_M/F` attachés à un porteur invisible | vu en jeu (aperçu) ; **porteur changé le 14/09** (voir §3) |
| Mondes, voyage, portails (Forge, orbital, capitale, forêt…) | en jeu |
| Inventaire (maquette « Inventaire NARVOS » portée) + équipement persisté + stats | écrit 14/09, jamais vu |
| **Apparence en jeu = onglet APPARENCE de l'inventaire** (I ou F8) | écrit 14/09, jamais vu |
| Progression : niveau, XP, talents, fiche F10 / compétences F5 | écrit 13-14/09, jamais vu |
| Sorts (12, catalogue TS porté) + barre + icônes + **effets 3D du pack** | écrit 14/09, jamais vu |
| Combat mêlée (cône serveur), IA PNJ, peuplement, compagnons (41 espèces) | serveur OK, peu vus |
| Craft, récolte, métiers, établi d'assemblage | écrits, peu vus |
| Radio, téléphone (F7), digicode, points de TP (F6), véhicules (12 voitures cuites) | écrits, jamais vus |
| Minimap Ako | **désactivée** le 14/09 (cercle gris inutile à l'écran) ; radar WebUI H reste |

Batterie : **92 harnais, ~10 600 assertions, 0 rouge** (`node scripts/lua-harness/tout.mjs`).

---

## 3. Session du 14/09 — les 7 anomalies de Hanibes, corrigées à la source

1. **Effets 3D** — les effets pixel-art (billboards 2D du matin) sont retirés ; les images web ne font plus que l'**icône** des sorts. Chaque sort a ses particules 3D choisies parmi les 75 cuites de notre pack (`Sorts.EFFETS_3D`, `Logic/Sorts.lua`). **Cause cachée trouvée** : `Vfx.lua` citait le pack de base par NOM DE FICHIER (`P_ky_fireBall`) alors que la clé nanos est `P_FXVariety_FireBall` (95 particules sur 173 diffèrent) → aucun effet 3D ne chargeait. Générateur et vérificateur lisent désormais `DefaultAssetPack.toml`.
2. **Caméra 1ʳᵉ personne aux pieds + arme au sol** — le porteur des MetaHumans était le `SKM_Manny` de Defender (squelette UE5, sockets `hand_rSocket`…) ; nanos attache l'arme à `hand_r_socket` (absent → origine du mesh = pieds). Porteur → `nanos-world::SK_Mannequin` (squelette nanos, sockets, animations natives de tenue d'arme). En FPS, la tête du MetaHuman local est vidée côté client.
3. **Inventaire existant** — la maquette « Inventaire NARVOS » est réutilisée et branchée au vrai sac ; la maquette « NARVOS HUD System » est analysée (hotbar 6, radial TAB, module arme/munitions, viseurs) — portage à faire.
4. **Menus MetaHuman parasites** — le panneau « pont MetaHuman » (touche U, `/metahumain`, `/mhbp`) est supprimé ; un seul menu d'équipement : l'inventaire (onglet APPARENCE, éditeur MCS de la création réutilisé). Plus de vêtement d'office (Jacket/Pants/Boots), plus de casque de classe posé sur un MetaHuman, plus de MetaHuman orphelin superposé.
5. **Équipements manquants** — le catalogue MetaCustom était périmé : **148/148 options cuites** (54 avant). Coiffures filtrées par genre de liaison.
6. **Caméra de personnalisation** — le serveur ne recadre plus à chaque réglage ; la molette sur un panneau ne zoome plus.
7. **Cercle gris** — retiré.

### À voir en jeu en priorité
- FPS : caméra aux yeux ? arme en main ? MetaHuman animé sur le mannequin nanos ?
- Vêtements MCS : risque de vêtement en T-pose / gris — la fonction Blueprint `NarvosMaillage` ne pose ni `SetLeaderPoseComponent` ni matériaux. Correctif = **éditeur Unreal** (`scripts/adk-mcs-fonctions.mjs`) + cook, pas en Lua.
- Effets 3D : échelles, auras (bouclier `P_powershield_constant` ×0,25).
- Personnages sauvés avant le 14/09 : leurs vêtements d'office sont dans la sauvegarde → à retirer dans APPARENCE.

---

## 4. Chaîne d'assets (Unreal → nanos)

- Import GLB → ADK : `scripts/adk-import-narvos.py` (Interchange, jamais `AssetTools.import_asset_tasks` en commandlet).
- Cook : `scripts/narvos-chaine-cook.sh` (options `--depuis-pack`) → `nanos-build-asset-pack.mjs --apply` → générateurs `REGENERES_PAR_LA_CHAINE`.
- Vérification : `node scripts/narvos-verifier-catalogues.mjs` (références, types, verrou d'identité des clés citées).
- Squelette nanos = **Mannequin UE4 (68 os, SKEL_Mannequin)**, pas Manny UE5.
- `unreal_version` d'Assets.toml = version RÉELLE du moteur (5.7.4).
- Pilotage éditeur : `scripts/ue-remote.py`, MCP Unreal port 13579 (`scripts/ue-mcp.mjs`).

## 5. Pièges payés (les plus chers)

1. `local function` déclarée après son appelant = **global nil**, muet → `portee-check.mjs`.
2. Client→serveur : `Events.CallRemote("X", Reliability.Reliable, …)` ; la fiabilité est positionnelle → `appels-distants-check.mjs`.
3. WebUI → Lua : `ui:Subscribe` (jamais `Events.Subscribe`) ; le pont ne porte pas les objets JS → JSON.
4. SQLite rend `0/1` et **`0` est vrai en Lua**.
5. Ne jamais recopier une liste de clés de catalogue → `listes-recopiees-check.mjs`.
6. Une clé `narvos::X_3` est un RANG d'homonyme, pas un nom → choisir par CHEMIN ; verrou d'identité.
7. **Clé nanos-world = manifeste `DefaultAssetPack.toml`, pas le nom du `.uasset`.**
8. `pcall` dont on ne lit que le booléen avale le refus → `pcall-retour-perdu-check.mjs`.
9. Backticks dans un template literal de générateur ; heredoc bash qui mange les `\`.
10. Un harnais vert prouve que le code est JUSTE, jamais qu'il est BRANCHÉ → `cablage-check` + `modules-orphelins-check`.
11. `Opacity` vaut 0 par défaut sur `M_Default_Translucent_Unlit`.
12. Paramètres de rendu ADK ≠ client (index d'os 16 bits MetaHuman) → `rendu-client-check.mjs`.

---

## 6. NOS SKILLS — où ils sont et comment les ajouter

Un skill = un **dossier** contenant `SKILL.md` (en-tête YAML `name` + `description`, puis le corps). Pour Claude Code : les poser dans `<projet>/.claude/skills/<nom>/SKILL.md` (projet) ou `C:\Users\<toi>\.claude\skills\<nom>\SKILL.md` (utilisateur). Pour un autre agent : lire `SKILL.md` comme instructions système du domaine.

**Archive prête à copier** : `E:\narvosprime-web-prototype\.hermes\ASTRA_skills_NARVOS_2026-09-14.zip` (les 12 skills ci-dessous + les deux `CLAUDE.md`).

### Skills du projet (racine) — `E:\narvosprime-web-prototype\.claude\skills\`
| Skill | Rôle |
|---|---|
| `nanos-world` | **Le moteur** : architecture asset packs + Lua, API vérifiée à la source, autorité, personnages, caméra, formats `Package.toml`/`Assets.toml`, whitelist de plugins, pièges. À lire AVANT tout Lua nanos. |
| `wasm-engine` | Moteur hybride C++/WASM du runtime web (NarvosEngine). |
| `graphify` | Graphe de connaissance du code (`graphify-out/`). |

### Skills du WebPortal — `E:\narvosprime-web-prototype\WebPortal\.claude\skills\`
| Skill | Rôle |
|---|---|
| `narvos-lua` | **Notre code Lua** : ce qui est écrit / câblé / appelé, invariants, gardes, tableau d'état des systèmes. |
| `narvos-project-map` | Carte du projet. |
| `narvos-preflight` | Contrôles avant d'agir. |
| `narvos-measure-first` | Mesurer avant de conclure. |
| `narvos-iteration-guard` | Garde-fou d'itération. |
| `narvos-error-log` | Journal des erreurs déjà commises. |
| `narvos-mesh-pipeline` | Chaîne des meshes. |
| `narvos-level-design` | Métriques de gameplay et level design. |
| `train-hermes` | Boucle d'apprentissage : transformer une correction en règle. |

### Côté utilisateur (Claude Code de Hanibes)
- Règles globales : `C:\Users\aniss\.claude\rules\ecc\` (common, web, typescript…).
- Agents : `C:\Users\aniss\.claude\agents\` ; skills et agents « en veille » (profil `min`) : `C:\Users\aniss\.claude\_off\skills\` (34), `_off\agents\` (85).
- Mémoire persistante du projet : `C:\Users\aniss\.claude\projects\D--mes-projet-narvosprime-web-prototype\memory\` (index `MEMORY.md`, point d'entrée `project_reprise_2026_09_14.md`).

---

## 7. DOCUMENTATION — la nôtre

| Document | Chemin |
|---|---|
| Consignes du dépôt (architecture web + port nanos + pièges) | `E:\narvosprime-web-prototype\CLAUDE.md` et `.claude\CLAUDE.md` |
| Index de TOUS les assets (208 packs, 250 Go) | `WebPortal\public\models\CATALOG.md` (machine : `WebPortal\src\data\asset-catalog.json`) |
| Plugins Unreal portables | `WebPortal\docs\PLUGINS_CPP.md` |
| API nanos compilée (mémo) | `.hermes\API_NANOS_COMPLETE.md`, `.hermes\GUIDE_NANOS_CONCEPTS.md` |
| API des Blueprints MetaCustom | `.hermes\API_BP_METACUSTOM_2026-09-12.md`, `.hermes\mcs\*.json` |
| Rapports de session | `.hermes\RAPPORT_PROJET_2026-09-04 … 2026-09-13.md`, `.hermes\RAPPORT_2026-09-14_anomalies.md` |
| Audits | `.hermes\AUDIT_INTEGRATION_2026-09-11.md`, `AUDIT_SYSTEMES_2026-09-11.md`, `AUDIT_PACKS_2026-09-12.md`, `AUDIT_BRANCHEMENTS_2026-09-12.md`, `INVENTAIRE_MCS_2026-09-13.md`, `INVENTAIRE_ASSET_GAME_2026-09-11.md` |
| Handoff / backlog | `.hermes\HANDOFF_FABLE_2026-09-11.md`, `.hermes\BACKLOG_2026-09-13_soir.md` |
| Maquettes d'interface de Hanibes | `C:\Users\aniss\Downloads\Telegram Desktop\Inventaire NARVOS.dc.html`, `NARVOS HUD System.dc.html` |
| Graphe du code | skill `graphify` (le dossier `graphify-out/` n'est pas généré à ce jour : `/graphify` le produit) |
| Gardes et harnais | `scripts\lua-harness\` (`tout.mjs` = toute la batterie) |

## 8. DOCUMENTATION — nanos world (liens officiels, relevés dans leur doc)

**En ligne**
- Documentation : https://docs.nanos-world.com/ (roadmap : https://docs.nanos-world.com/roadmap)
- Site / store : https://nanos-world.com/ · https://nanos-world.com/store · store des packages : https://store.nanos.world/ (ex. https://store.nanos.world/packages/default-weapons/)
- API web du store : https://api.nanos.world/ · https://api.nanos.world/store/docs
- Discord : https://discord.nanos-world.com · retours / bugs : https://feedback.nanos-world.com · https://issues.nanos-world.com · état des services : https://status.nanos-world.com
- GitHub (organisation) : https://github.com/nanos-world
  - **API (signatures des classes, la vraie source)** : https://github.com/nanos-world/api
  - Docs (sources) : https://github.com/nanos-world/docs
  - Serveur / pack de base (`DefaultAssetPack.toml`) : https://github.com/nanos-world/nanos-world-server
  - Sandbox (exemples de gameplay) : https://github.com/nanos-world/nanos-world-sandbox
  - Armes / véhicules par défaut : https://github.com/nanos-world/default-weapons · https://github.com/nanos-world/default-vehicles · https://github.com/nanos-world/nanos-world-weapons
  - Deathmatch : https://github.com/nanos-world/nanos-world-deathmatch
  - Assets Development Kit (ADK) : https://github.com/nanos-world/assets-development-kit
  - Bibliothèque Lua (types) : https://github.com/nanos-world/nanos-world-lua-lib
  - SDK des modules C : https://github.com/nanos-world/module-sdk · intégration Discord : https://github.com/nanos-world/nanos-world-discord

**Copies locales (hors ligne, versions utilisées par le projet)**
- Docs complètes (Docusaurus) : `WebPortal\Server\nanos_world\docs\docs-master\docs\` — sections `getting-started/`, `core-concepts/` (packages, scripting : authority-concepts, events-guide, entity-values, persistent-data, user-interface…), `scripting-reference/` (classes : character, blueprint, particle, weapon, webui…), `assets-modding/` (creating-assets, default-asset-pack, forge, `whitelisted-ue-plugins.mdx`), `troubleshooting.mdx`. Chaque page en ligne suit la même arborescence.
- **API JSON** (paramètres, autorité, événements) : `WebPortal\Server\nanos_world\libraries\api-main\api-main\Classes\*.json` (+ `Stable\`).
- Manifeste du pack de base : `WebPortal\Server\nanos_world\game-mod\nanos-world-server-main\nanos-world-server-main\DefaultAssetPack.toml`.
- Exemples officiels : `WebPortal\Server\nanos_world\game-mod\` (`sandbox-master`, `deathmatch-main`, `default-characters-main`, `default-weapons-master`, `default-vehicles-main`).
- Bibliothèques : `WebPortal\Server\nanos_world\libraries\native-lua-library-master`, `nanos-world-testing-map-script-master`.
- Contenu installé (assets du pack de base) : `D:\steam\steamapps\common\nanos-world-playtest\NanosWorld\Content\`.

**Unreal Engine** : moteur `D:\Epic Games\UE_5.7\` ; plugins autorisés par nanos : Kawaii Physics v1.19.1, Ultra Dynamic Sky v8.3A + natifs (liste : `whitelisted-ue-plugins.mdx`).

---

## 9. Commandes utiles

```bash
node scripts/lua-harness/tout.mjs                 # toute la batterie
node scripts/lua-harness/syntaxe-check.mjs        # Lua + générateurs
node scripts/lua-harness/portee-check.mjs         # emploi avant déclaration
node scripts/narvos-verifier-catalogues.mjs       # références d'assets
node scripts/narvos-metacustom-options.mjs --apply && node scripts/narvos-metacustom-to-lua.mjs --apply
node scripts/narvos-nanos-base-to-lua.mjs --apply # Vfx.lua / Props.lua depuis le manifeste
node scripts/narvos-modular-to-lua.mjs --apply    # corps et porteurs
cd WebPortal && npm run dev                       # runtime web (port 3005)
```

## 10. Prochaines étapes proposées

1. Test en jeu des 7 corrections (§3), journal client ouvert.
2. Leader pose + matériaux dans `NarvosMaillage` (éditeur + cook) si les vêtements restent en T-pose.
3. Porter la maquette **HUD System** : hotbar 1–6 liée à la roue TAB, module arme (chargeur/réserve), viseurs.
4. Intégrer au catalogue d'équipement ce qui manque encore (rapport assets du 14/09) : familles Zombie UE4 et CyberpunkSamurai, grooms `ExternalAssets` (barbes : liaisons à cuire), iris, curseurs du visage.
5. Défender : matériaux gris `MI_UE4ModularCharacter1..5` à réparer dans l'ADK.