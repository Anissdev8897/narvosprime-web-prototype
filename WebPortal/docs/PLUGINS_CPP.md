# Plugins C++ & systèmes Unreal — ce qui est portable dans NarvosEngine

Analyse des plugins accessibles depuis le projet, et de ce qu'ils apportent
**concrètement** à notre moteur. Chaque recommandation est adossée à un état
mesuré du dépôt, pas à une bonne pratique générale.

> **Cadre légal.** Le code source d'Unreal Engine est sous licence Epic : il ne
> peut pas être recopié dans un moteur tiers. Ce document ne décrit que des
> **architectures et des concepts** — c'est explicitement ce que demande
> `export/bullet/content/readme.txt` (« inspire-toi uniquement de leur
> architecture […] sans jamais en copier le code »). Les plugins Marketplace
> (AutoTexture, ACF…) ont leurs propres licences : leurs *assets* nous
> appartiennent par la licence d'achat, leur *code* non.

---

## 1. Où sont les plugins

`src/rpg/_vendor_sources/scriptC++/` — les sources C++ des plugins Marketplace
payants ont été déplacées hors de `public/` le 02/08/2026 pour éviter leur
exposition publique. Contenu :

| Raccourci | Cible | État |
|---|---|---|
| `Engine_unreal.lnk` | `E:\UE_5.8\Engine` | présent |
| `Plugins_unreal.lnk` | `E:\UE_5.8\Engine\Plugins` | présent — **73 plugins moteur** |
| `Plugins.UE5.7.lnk` | `D:\Epic Games\UE_5.7\Engine\Plugins` | présent — **62 plugins moteur** |

⚠️ Ce sont des `.lnk` : ils ne survivent pas à un clone du dépôt sur une autre
machine, et le contenu visé n'est pas versionné. Les traiter comme une
**documentation de référence locale**, jamais comme une dépendance de build.

Le seul plugin dont le **source C++ est dans le dépôt** est
`public/models/plugins_cpp/AutoTextureMaterialSetup/` (14 `.cpp`, 14 `.h`).

---

## 2. AutoTextureMaterialSetup — le plus directement exploitable

**Ce que fait le plugin.** À l'import, il lit le nom d'un fichier de texture,
en déduit son *rôle* (basecolor, normal, ORM…), crée le matériau correspondant,
et rattache les textures aux bons paramètres. Il sait aussi *empaqueter des
canaux* (mettre roughness dans le vert d'une ORM) et inverser un canal
(glossiness → roughness).

**Les trois idées qui valent d'être portées :**

### 2.1 `GetMainNameAndSuffix` — séparer nom principal et rôle

`T_Rock_Cliff_N` → nom principal `T_Rock_Cliff`, suffixe `N`. Toute la chaîne en
découle. C'est une table `(rôle → liste de suffixes acceptés)`, éditable, pas une
cascade de `if`.

**Notre état :** `scripts/textures-to-ktx2.mjs` fait déjà ça — mais en dur, avec
trois suffixes (`_col`, `_nrm`, `_msk`) issus du seul pack MW. Le jour où on
importe un pack qui écrit `_BaseColor` / `_Normal` / `_ORM` (la convention la plus
répandue), la détection tombe silencieusement dans le cas par défaut et encode une
normal map en sRGB — l'éclairage part de travers sans qu'aucune erreur ne sorte.

**À faire :** extraire la table de rôles dans `scripts/lib/texture-roles.mjs`,
avec les alias courants par rôle, et la partager entre `textures-to-ktx2.mjs` et
`assets-to-ktx2.mjs`. Coût faible, protège tous les imports futurs.

### 2.2 Convention DirectX vs OpenGL des normal maps

Le plugin détecte les suffixes `DX` / `Directx` et `OpenGL` / `opgl` pour savoir
s'il faut **inverser le canal vert**. Les deux conventions coexistent dans la
nature ; se tromper donne un relief inversé — creux et bosses échangés.

**Notre état :** on n'a aucune détection. Le pack MW est en OpenGL (convention
glTF), donc ça marche *par chance*. L'option `Adjust Normalmaps` de l'export
Unreal fait la conversion en amont — mais uniquement pour les assets qui passent
par cet export, pas pour un pack téléchargé.

**À faire :** même table que 2.1, avec un champ `flipGreen`.

### 2.3 Le channel packing

Une texture ORM = occlusion/roughness/metalness dans R/G/B. Trois textures
deviennent une : **3 unités de texture économisées par matériau**, et une seule
lecture GPU au lieu de trois.

**Notre état :** `AutoMaterial.ts` annule explicitement `roughnessMap`,
`metalnessMap` et `aoMap` sur les matériaux de terrain. C'est correct pour le
terrain (le triplanaire ne les utilise pas), mais ça veut dire qu'on n'a
aucune infrastructure ORM ailleurs. À évaluer quand les matériaux PBR des
bâtiments deviendront un sujet — les 6 packs de `batiments/` en apporteront.

---

## 3. Plugins moteur UE — la liste courte qui compte

73 plugins dans UE 5.8. La plupart ne nous concernent pas (Perforce, XGE,
production virtuelle). Voici ceux dont l'architecture répond à un manque **réel
et mesuré** du projet.

### 3.1 Mutable — création de personnage modulaire ★ priorité haute

**Le concept.** Au lieu d'empiler des meshes équipés, Mutable *compile* un
personnage : il fusionne les meshes des pièces, atlase leurs textures, et sort
**un seul mesh, un seul matériau**. Le coût de rendu d'un personnage devient
indépendant du nombre de pièces qu'il porte.

**Pourquoi ça nous concerne.** `readme.txt` demande explicitement un créateur de
personnage complet. On a déjà la moitié basse : `characters/modular/` contient
`ModularCharacter.tsx`, `bodySlots.ts`, `boneRemap.ts`, `partCatalog.ts`,
`rebindSkinnedMesh.ts`. Ce qui manque, c'est l'étape de **fusion** — aujourd'hui
chaque pièce est un `SkinnedMesh` distinct, donc un draw call distinct.

Et le stock vient d'arriver : `assets_character/SciFi_Trooper_Set` = 170 GLB de
pièces modulaires homme/femme.

**Portable ?** Oui, partiellement, et sans WebGPU : `BufferGeometryUtils.mergeGeometries`
de Three.js fusionne des géométries partageant un squelette ; l'atlas de textures
se fait hors-ligne dans un script de build. La compilation *à la volée* (changer
de casque sans reconstruire) est le morceau difficile — à garder pour plus tard.

### 3.2 PCG — placement procédural ★ priorité haute pour P3

**Le concept.** Un graphe de règles produit des points (échantillonnage de
surface, filtrage par pente/altitude/masque, densité, bruit) puis y instancie des
meshes. La règle est une *donnée*, pas du code.

**Pourquoi ça nous concerne.** C'est exactement l'architecture dont l'éditeur
Forge a besoin (P3), et on en a déjà les deux bouts :
- `slopeOf()` et `layerWeights()` dans `autoMaterialConfig.ts` — le filtrage par
  pente existe et il est testé ;
- `nature/natureDecor.ts` + `NatureDecorField.tsx` — le semis instancié existe.

Ce qui manque, c'est le **graphe** qui relie les deux, et une UI pour l'éditer.

**Portable ?** Oui. Ne pas viser le graphe nodal complet d'Unreal : une liste de
règles `{couche, pente min/max, densité, meshes[]}` couvre 90 % du besoin et se
sérialise en JSON dans la définition de map.

### 3.3 Chooser — sélection d'animation pilotée par les données

**Le concept.** Une table de décision remplace une state machine câblée :
`(état, vitesse, arme, posture) → clip`. Ajouter une variante devient une ligne
de données.

**Pourquoi ça nous concerne.** `animation/` est notre sous-système le plus
mature (`AnimationController`, `locomotionBlend`, `boneMask`, `mixamoRetarget`,
`idleVariantController`). Mais `StealthLocomotion` vient d'ajouter **125 clips**
dans `animations/`. Les brancher un par un dans le contrôleur le fera grossir
sans fin — et l'accroupissement, déjà en souffrance, est précisément un cas
`(posture=accroupi, vitesse, direction) → clip`.

**Portable ?** Oui, et c'est peu de code : une table + une fonction de score.
S'insère devant `locomotionBlend`, sans le remplacer.

### 3.4 LightWeightInstances / instancing GPU

**Le concept.** Un objet non interactif n'a pas besoin d'un acteur complet :
juste une transform dans un buffer d'instances, promue en objet réel seulement à
l'approche.

**Notre état :** on a `runtime/perf/distanceBand.ts` et l'instanciation dans
`NatureDecorField`. Le manque se voit dans le HUD F3 : **1 draw call** annoncé
pour la Forge, ce qui indique que le compteur ne mesure pas ce qu'on croit
(cf. *règle 5* de `narvos-measure-first` : un instrument qui n'a jamais rien
signalé est suspect). **À vérifier avant** d'optimiser quoi que ce soit ici.

### 3.5 Interchange — pipeline d'import

**Le concept.** Import en trois temps découplés : *traduction* (fichier → graphe
neutre), *pipelines* (transformations enchaînables), *factories* (création des
assets). Chaque étape est remplaçable.

**Pourquoi ça nous concerne.** Notre pipeline existe mais il est en pièces
détachées : `puzzle-chunks.mjs`, `assets-to-ktx2.mjs`, `textures-to-ktx2.mjs`,
`clean-chunk-slivers.mjs`, `audit-runtime-assets.mjs`. L'ordre correct n'est
écrit que dans `narvos-mesh-pipeline`. Un chaînage déclaratif éviterait les
oublis — le plus coûteux étant *re-générer les chunks après avoir réexporté le
GLB*, déjà signalé comme piège dans `CLAUDE.md`.

### 3.6 Les autres, en une ligne

| Plugin | Concept | Verdict |
|---|---|---|
| **Nanite** | LOD continu par cluster de triangles | Hors de portée en WebGL2. Nos variantes `.med`/`.low` sont la bonne réponse à notre échelle. |
| **Lumen** | GI logicielle par tracing d'écran + distance fields | Remplaçable par SSGI + light probes + reflection probes. Gros chantier, gros gain visuel. |
| **ChaosCloth** | Simulation de tissu | Utile pour capes/tenues. À mettre côté WASM, jamais en JS. |
| **NNE** | Inférence réseau de neurones | Aucun besoin identifié. |
| **TextureGraph** | Textures procédurales | Le triplanaire couvre déjà le cas terrain. |
| **AudioGameplay** | Audio spatialisé par volumes | Les 490 wav de pas de `audio/Footsteps_Sound_Effects_Pro` attendent un mapping surface→son. Le raycast sol renvoie déjà le matériau touché — le pont est court. |
| **MetaHuman** | Personnages photoréalistes | Licence liée à Unreal. À écarter. |
| **Mass / MassInsights** | ECS pour foules massives | On a déjà un ECS en C++ (`wasm/src/`). Concept déjà couvert. |

---

## 4. Ce qui a déjà été fait dans cette passe

- **Bibliothèque de couches de terrain complétée.** Le pack
  `materials/MWLandscapeAutoMaterial` contenait **7 couches** (neige, roche,
  cailloux, herbe, terre, sable clair, sable ocre). Seules **3** avaient été
  converties en KTX2 — « herbe / sable / terre » était donc impossible à proposer
  dans l'éditeur alors que les sources étaient là depuis le début.
  Les 4 manquantes sont converties : 472 Mo de PNG → **42 Mo** sur disque,
  ~56 Mo de VRAM une fois transcodées.
- `TERRAIN_LAYERS` + `buildAutoMaterial()` dans `autoMaterialConfig.ts` :
  l'éditeur choisit des identifiants, plus des chemins de fichiers.
- Test qui vérifie que **chaque `.ktx2` référencé existe réellement sur le
  disque** — indispensable ici, parce que le fallback SPA de Vite renvoie du
  `text/html` en 200 pour un fichier absent au lieu d'un 404 : un chemin faux ne
  lève rien, il produit une texture vide.

**P3 n'attend plus que son UI.** Les données sont complètes et testées.

---

## 4bis. Fait depuis (28/07, seconde passe)

- **Vue FPS débloquée.** `RpgGameWorld` testait `camState.current.view === "fps"`
  pendant le rendu ; `camState` est un `useRef` muté dans `useFrame`, donc React
  n'était jamais notifié et le viewmodel d'arme ne se montait pas. Miroir
  réactif : `src/rpg/camera/cameraViewStore.ts` (publie au CHANGEMENT seulement —
  appelé 60×/s).
- **Arme fusionnée des avatars masquée.** Wraith porte 18 614 tris de canon,
  Murdock 17 044 tris d'armes, en PRIMITIVES distinctes avec leur propre
  matériau — donc des `Mesh` séparés côté Three, masquables.
  `characters/builtinWeaponMask.ts`.
- **132 clips d'animation d'arme récupérés.** 46 fichiers d'animation passaient
  pour des armes équipables et finissaient en boutique. Nouveau type `clip` dans
  le classifieur + `weapons/weaponAnimClips.ts` : tir, rechargement, dégainé,
  rangement, inspection, locomotion, lancer, pour 3 familles de fusils, le
  revolver et la grenade.
- **Landscape Unreal sans matériau** routé vers le triplanaire (536 494 tris,
  26 % de la Forge, qui s'affichaient en plaques grises).

## 5. Ordre recommandé

| # | Chantier | Débloque | Effort |
|---|---|---|---|
| 1 | UI de sélection de couches (éditeur Forge) | **P3** — données déjà prêtes | faible |
| 2 | Table de rôles de texture partagée (§2.1 + §2.2) | tout import futur | faible |
| 3 | Table de décision d'animation (§3.3) | les 125 clips de StealthLocomotion, l'accroupissement | moyen |
| 4 | Vérifier le compteur de draw calls (§3.4) | toute décision d'optimisation du rendu | faible |
| 5 | Règles de placement procédural (§3.2) | peupler la Forge | moyen |
| 6 | Fusion de mesh du personnage modulaire (§3.1) | créateur de perso, coût de rendu | élevé |
| 7 | GI approximative (§3.6, Lumen) | saut visuel | élevé |

Le n° 4 vient avant tout travail de perf : optimiser sur la foi d'un compteur non
vérifié, c'est la *règle 5* de `narvos-measure-first`, et elle a déjà coûté
plusieurs sessions sur le compteur de VRAM.