<!-- [ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : ? ligne(s) attendue(s) ici, 68 connue(s)] -->
# Inventaire `asset_game/` et pistes d'intégration nanos — 2026-09-11

Relevé **read-only** (aucune modification, aucun déplacement, aucune suppression,
aucun serveur, aucun Unreal, aucun script `--apply`, aucun git). Objectif : pour
chaque pack de `WebPortal/public/asset_game/`, dire ce qu'il est, à quel système
NARVOS déjà écrit il correspond, s'il est déjà intégré (avec preuve), et sinon
quel chemin d'intégration suivre. L'intégration elle-même sera faite ensuite par
quelqu'un d'autre à partir de ce rapport.

Méthode : mesure directe (`du`, `find`, `wc -l`, Grep) sur le disque + croisement
avec `Server/Assets/narvos/Assets.toml` (le pack RÉELLEMENT cuit pour nanos),
`Shared/Catalogs/*.lua` (37 catalogues), `Server/adk/Content/Narvos/` (contenu de
l'éditeur Unreal), `narvos-map-proto/Client/UI/` (WebUI), et `public/models/
CATALOG.md` / `src/data/asset-catalog.json` (deuxième vie possible côté jeu web).
6 sous-relevés parallèles ont couvert les 73 packs par groupe de dossier ; ce
document les consolide.

## ⚠ Premier constat : la taille de départ est fausse

La consigne de ce relevé annonçait **~36 Go**. Mesure directe à l'instant
(2026-09-11) : **~220 Go, 73 packs** — 6 fois plus. Le propre `README.md` de
`asset_game/` (écrit la veille, 2026-09-10) annonçait déjà 155 Go / 60 packs : le
dossier a donc encore grossi de +42 % et gagné 13 packs **en une seule journée**.
Aucun chiffre relatif à ce dossier ne doit être considéré stable plus de
quelques heures — ce qui suit est daté du 2026-09-11, mesuré directement, pas
recopié du README.

Second écart factuel trouvé : le README de `asset_game/` cite 5 documents
d'audit (`docs/AUDIT_SOURCES_DCC_VEHICULES.md`, `AUDIT_PACK_DRIVABLE_CARS_BASIC.md`,
`AUDIT_A_TRIER_LOT1.md`, `AUDIT_A_TRIER_LOT2.md`, `AUDIT_PACKS_FAB_20260909.md`).
**Aucun n'existe** — recherché sous `WebPortal/docs/`, `.hermes/` et dans
`asset_game/` lui-même, sans résultat. Soit supprimés, soit jamais écrits : ne
pas s'y fier, ne pas les chercher à nouveau.

## 1. Structure mesurée (2026-09-11)

| Dossier | Taille mesurée | Packs | Taille README (09-10) | Dérive en 1 jour |
|---|--:|--:|--:|--:|
| `mixte_epoques/` | **89 Go** | 8 | 79,88 Go | +11 % |
| `asset_futuriste/` | **35 Go** | 10 | 19,66 Go | +78 % |
| `asset_epoque_moderne/` | **28 Go** | 13 | 11,68 Go | +140 % |
| `asset_medieval/` | **22 Go** | 8 | 5,29 Go | **+316 %** |
| `systemes_sans_epoque/` | **15 Go** | 14 | 12,16 Go | +23 % |
| `sources_dcc/` | **12 Go** | 5 | 11,42 Go | +5 % |
| `nature_et_tech/` | **11 Go** | 3 | 10,28 Go | +7 % |
| `moteur_unity/` | **7,0 Go** | 7 | 3,18 Go | +120 % |
| `animations_neutres/` | **624 Mo** | 3 | 0,61 Go | stable |
| `a_trier/` | **87 Mo** | 2 | 0,88 Go | en baisse (contenu dégraissé) |
| **Total** | **≈ 220 Go** | **73** | 155 Go / 60 packs | **+42 % de volume, +13 packs** |

Pour comparaison, le catalogue **web** déjà pleinement intégré
(`public/models/`, lisible par le navigateur, généré par `scripts/asset-catalog.mjs`)
pèse **264,2 Go pour 247 packs** dans 27 catégories — `asset_game/` n'est donc
pas un cas isolé, c'est le second réservoir du même ordre de grandeur que le
premier, mais quasiment pas encore transformé.

Le pack **réellement cuit et livré aux joueurs nanos** (`Server/Assets/narvos/
Assets.toml`, généré par `scripts/nanos-build-asset-pack.mjs`) contient
**68 306 clés d'assets** au 2026-09-11 18h48 — c'est le seul fichier qui fait foi
pour dire « déjà intégré », pas la présence d'un dossier dans l'ADK (qui peut
contenir du contenu importé mais pas encore cuit) ni un nom qui « sonne pareil ».

Rappel de convention (`asset_game/README.md`) : le rangement se fait par
**nature du format dominant**, pas par le nom du dossier parent — un pack rangé
dans `asset_futuriste/` peut être un unique `.blend` sans rapport avec le
futurisme si c'est son seul fichier de substance. Chaque agent l'a vérifié pack
par pack ci-dessous.

### Comment lire les fiches

- **État** : DÉJÀ INTÉGRÉ (preuve citée : clé `Assets.toml`, ligne d'un catalogue
  Lua, ou dossier ADK) / PARTIEL (une partie de la chaîne existe mais casse
  quelque part — squelette mort, matériau qui ne compile pas, pont non cuit) /
  ABSENT (aucune preuve trouvée dans le pack cuit ni les catalogues).
- **Effort** — S : copie directe (WebUI) ou déjà quasi prêt, quelques clés à
  ajouter à un catalogue existant. M : import Unreal + cook direct, pas de
  conversion lourde ni de nouveau générateur. L : conversion DCC, retarget de
  squelette, ou générateur Lua à créer.
- **Priorité** — Haute : un système déjà écrit et câblé attend exactement cet
  asset (visible en jeu dès le cook). Moyenne : le système existe mais n'est
  lui-même pas encore branché, ou l'asset est secondaire. Basse : décor
  cosmétique, risque de doublon, ou système hors-sujet pour NARVOS.
- Les générateurs Lua cités (`narvos-*-to-lua.mjs`) vivent tous à la racine du
  dépôt, dans `scripts/`, **pas** sous `WebPortal/scripts/` — piège de
  navigation vérifié pendant ce relevé (les deux dossiers `scripts/` existent
  et ne contiennent pas les mêmes fichiers).

<!-- [ANCIENNE VERSION ↑] -->