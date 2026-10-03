# Rapport de session — 2026-09-13 (nuit)

Demande : « branche les trois fonctions et ajoute la minimap » (talkie-walkie,
smartphone, digicode, Ako Minimap System), puis « continue les packs pendant que
je dors ». **Rien n'a tourné en jeu** : tout ce qui suit est prouvé par harnais,
fichiers cuits et contrôles, pas par une partie.

## Branché

| Système | Entrée joueur | Fichiers |
|---|---|---|
| Talkie-walkie | `/radio`, `/radio canal <1-99>`, `/radio <message>` | `Server/Communications.lua`, `Logic/Radio.lua`, `Logic/TexteChat.lua` |
| Smartphone | touche F7 (`menu_telephone`) : Carte, Messages, Contacts | `Server/Communications.lua`, `Logic/Telephone.lua`, `Client/UI/communications.js/.css` |
| Digicode | `/digicode poser`, `code`, `retirer` ; touche Interagir devant la porte | `Server/Digicode.lua`, `Logic/Digicode.lua`, table `digicodes` |
| Minimap Ako | automatique ; `/minimap off\|on\|auto\|<mètres>` | `Client/Minimap.lua`, `Catalogs/Minimap.lua` (généré) |
| InventorySystemPro | 53 objets, 12 recettes dans nos catalogues | `Catalogs/ObjetsIsp.lua` (généré), `Logic/ObjetsHyper.IntegrerPack` |
| Gestes des infectés | attaques G/D, réaction selon le côté du coup | `Catalogs/Gestes.lua` (généré), `Server/Ia.lua`, `Server/Combat.lua` |

Règles tenues : le code du digicode ne passe jamais par le chat et n'est stocké
qu'en empreinte salée ; la garde de pose est LA garde des props
(`PeutEditerIci` → `Zones.PeutEditer`) ; essais comptés par compte (une
reconnexion ne débloque pas) ; radio et téléphone limités à un message par
seconde ; le radar WebUI (H) reste la carte tant que la minimap n'est pas prête.

## Lot 3 — cuit et prouvé (05:08 → 05:53)

- Session éditeur (4 min) : 3 proxies Blueprint (racine de scène vérifiée),
  3 GLB importés (un StaticMesh par dossier), 41 animations AI Behavior
  retargetées, export des Data Assets ISP.
- Cook : 88 863 paquets, 0 assertion. Pack : 70 350 clés.
- **Minimap sans modifier un asset acheté** : éditer le DataAsset en Python a tué
  le commandlet. Les 5 classes de démo qu'il cite sont redirigées
  (`ClassRedirects` + `ObjectRedirects`, deux chemins) vers nos proxies. Preuve :
  le DataAsset CUIT cite `Narvos/Minimap/BP_NarvosCarte{Joueur,Repere,Vide}` et
  plus aucune classe de démo.
- Animation de zombie CUITE liée à `SKEL_Mannequin`.
- Imports propres sur les 5 dossiers du lot (motos, AIBS, ISP, Ako, Minimap).
- Props : 1 930 (catégorie ISP rétablie, +3 objets GLB en « Divers »).

## Corrigé en route

- Digicode : la pose consommait l'objet AVANT l'écriture en base (erreur SQL =
  objet perdu) ; un admin posant sans objet puis retirant gagnait un digicode.
- Vérificateur : 28 états périmés de `Widgets.lua` annoncés « références
  mortes » ; séparés, et l'identité des widgets jugée par CHEMIN — ce qui a
  révélé la fiche « visage » portant la clé du widget « corps ».
- `Widgets.lua` : 30 déclarés, 0 périmé, `Widget_Customization_2` pour le visage.

## Contrôles

Batterie 81 harnais · 8 382 assertions · 0 rouge. Vérificateur : 638 citations,
identité 3 865 clés, aucune référence morte. Nouveaux : `communications-cablage-check`
(77), `minimap-cablage-check` (72, attentes lues dans l'export T3D mesuré),
`objets-isp` (18). Neuf catalogues régénérés hors verrou d'identité.

## À vérifier en jeu (non prouvé)

1. Minimap : `Widget("narvos::ui_minimap_showup")` résout-il ? le proxy est-il
   trouvé (sinon le widget affiche « You haven't assigned an player actor ») ?
   zoom : régler avec `/minimap <mètres>`.
2. Porte : orientation (+90° supposé), levée de 230 cm, pivot au sol, clavier à
   côté du cadre.
3. F7 et Q : aucune preuve qu'aucune touche native de nanos ne les occupe.
4. Objets en main (`hand_l`, échelle des GLB).
5. Gestes des zombies (FullBody).

## Limites dites

- ISP : montants de soin/mana/faim/soif non exportés → consommables inertes ;
  recettes de cuisson/fonte et collections non exportées ; stations choisies
  (potions → alchimie, reste → établi).
- Messages du téléphone : de session (non persistés).
- CITY_PACK : 675 props sans catégorie (déjà au lot 2).
- Test web ROUGE pré-existant : 6 armes `stackable: true, maxStack: 1`
  (`itemCatalog.test.ts`), non corrigé.

---

# Matin du 13/09 — le test de Hanibes, et ce qui en sort

Test à 06:22 : « le MetaHuman n'est pas branché, la map forêt n'a pas de texture ».
Puis : « utilise uniquement les modèles de MetaHuman ». Trois causes, trois mesures.

## 1. Forge au damier — contenu de PLUGIN hors pack

- 15 500 paquets cuits citaient `/InterchangeAssets/gltf/...` (instances de matériau
  de l'import glTF). Le client nanos a SA copie d'origine du plugin ; notre
  `M_Default` moteur a été modifié le 05/09 (usages skeletal + Nanite, 784 Ko cuit
  contre 347 Ko chez le client). Meshes Forge Nanite → base du client sans usage
  Nanite → matériau par défaut.
- Correctif : copie octet pour octet du plugin sous `Content/Narvos/Interchange`
  (203 fichiers, 8,4 Mo) + `PackageRedirects /InterchangeAssets/ → /Game/Narvos/Interchange/`.
- ⚠ Premier essai (cible `/Game/Narvos/InterchangeAssets/`) : la cible CONTENAIT la
  source, le redirect s'est réappliqué → 50 999 lignes « dependency on package
  /Game/Narvos/Game/Narvos/InterchangeAssets/... which does not exist ». Cook arrêté à
  36 447/88 861, **pack non réécrit**. Garde : `lua-harness/redirects-idempotents-check.mjs`
  (41 assertions, rouge prouvé sur l'ancienne config). Garde moteur :
  `narvos-dependances-moteur.mjs`.

## 2. PNJ gris — drapeau d'usage absent

- Matériaux glTF sans `bUsedWithSkeletalMesh` (pnj 70/71, pnj_monstre 31,
  ZombieSoldierPack_original 545, CyberpunkSamurai 30) ; shader maps cuites :
  `FLocalVertexFactory` seul, aucun `FGPUSkinVertexFactory`. L'éditeur pose le drapeau
  à l'affichage ; le cook, jamais.
- `scripts/adk-usage-skeletal.py` (éditeur complet, liens durs sautés, sauvegarde par
  matériau, registre attendu) ; preuve `scripts/narvos-preuve-metahuman.mjs session|cuit`
  + garde « matériau fondu ».

## 3. MetaHuman invisible — références NULLES

- `BP_MH_Male/Female` de l'ADK resauvés sans `Metahuman_Ref` : 30 réfs source, 0 dans
  l'ADK. `Metahuman_Ref` jamais cuit.
- Voie (a) (rapport Fable) : `adk-copier-hyper.mjs` généralisé (`--source --cible
  --seulement`, `$` exact, conflits jamais écrasés) → 338 paquets / 619 Mo liés, ZÉRO
  AnimSequence ; `adk-pont-metahuman.py etape_voie_a` → `BP_NarvosMH_M` (BP_MCSGavin),
  `BP_NarvosMH_F` (BP_Hana), Body racine + retarget depuis le parent, post-process coupé.
- Générateur modulaire : `blueprints` = préférence (premier cuit) — essai A (pack actuel)
  code identique, essai B (BP cuits) bascule.
- Lua : `Builder.MasquerPorteur/RendrePorteur` (une seule méthode, porteur rendu sous
  Mat_Invisible) ; `MetaHumainBP.Retirer` laissait le personnage INVISIBLE (échelle
<!-- [ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : ? ligne(s) attendue(s) ici, 15 connue(s)] -->
  passée comme position + `false`) ; retour d'`AttachTo` journalisé. Harnais
  `porteur-masque` (19) et `metahumain-bp` (30), mutants attrapés.

## 4. Défaut trouvé en passant — la chaîne de cook générale

`scripts/narvos-chaine-cook.sh` ne lançait que 5 des 9 générateurs hors verrou.
Corrigé ; garde `lua-harness/chaine-generateurs-check.mjs` (liste lue dans le
vérificateur, rouge prouvé : 8 échecs sur l'ancienne chaîne). La chaîne attend aussi
la fermeture de nanos avant de réécrire le pack.

## Exécution

`.hermes/session-metahuman.sh` lancé à 08:10 : UN cook pour les trois correctifs.
Batterie avant : 84 harnais · 8 499 assertions · 0 rouge. Bilan :
`.hermes/bilan_metahuman_2026-09-13.log`. Hanibes dort — PC à éteindre à la fin.
<!-- [ANCIENNE VERSION ↑] -->
<!-- [DERNIÈRE VERSION ↓ — ligne(s) sûre(s) du fichier final, lue(s) dans le tronçon ci-dessus mais non replacée(s) : il a changé de longueur. Leur n° final est entre crochets] -->
<!-- [SÛRE n°151] Ouverts : 2 matériaux GameAnimationSample sans shader map en ligne (démos) ; les -->
<!-- [SÛRE n°155] (retarget depuis le porteur `SKM_Manny_3` : non tranché) ; cheveux ; la « lame » de -->
<!-- [DERNIÈRE VERSION ↑] -->