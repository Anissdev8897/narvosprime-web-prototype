# narvos-measure-first

Discipline de diagnostic pour NARVOS PRIME. **À invoquer avant d'annoncer une cause, de réfuter une hypothèse, ou de déclarer un correctif validé.**

Ce fichier ne contient que des règles nées d'erreurs réellement commises sur ce projet, avec le coût qu'elles ont eu. Chacune s'applique à un moment précis, pas « en général ».

---

## Règle 1 — Une hypothèse ne se réfute pas sur une mesure indirecte

**Ce qui s'est passé.** Hypothèse : « la quantification Draco détruit la géométrie fine ». Test : ré-encoder `chunk_01.glb` à 14 puis 18 bits, comparer. Aucun écart → hypothèse abandonnée.

Le test ne valait rien : `chunk_01.glb` avait DÉJÀ été quantifié à 14 bits, ses sommets étaient déjà sur la grille. Re-quantifier des données quantifiées ne change rien par construction.

**La règle.** Avant de conclure qu'un test réfute une hypothèse, répondre à : *l'entrée du test a-t-elle déjà subi le traitement que je teste ?* Si oui, le test est vide.

---

## Règle 2 — Écrire la définition avant de compter

**Ce qui s'est passé.** « Triangles dégénérés » compté avec le critère « les TROIS sommets confondus » → 10 105. Le vrai critère d'aire nulle est « DEUX sommets confondus » → 48 093. Facteur 5, et une conclusion inversée.

**La règle.** Avant tout comptage, écrire noir sur blanc ce qu'on compte. Pour la géométrie :
- aire nulle ⟺ **deux** sommets coïncidents (pas trois)
- lame ⟺ rapport arête max / arête min élevé **ET** arête max grande dans l'absolu — sans le second critère, on supprime les câbles et les tôles

---

## Règle 3 — Un défaut concentré ne s'échantillonne pas

**Ce qui s'est passé.** Scan de 406 primitives sur 12 987 (3 %) → « 0 triangle d'aire nulle dans la source ». Le scan complet a confirmé 0 — mais côté chunks, une primitive était à 48,8 % pendant que la moyenne était à 4 %. Un échantillon à 3 % pouvait tout aussi bien rater l'inverse.

**La règle.** Si le défaut cherché peut être concentré (un mesh, un matériau, un chunk), scanner **tout**. Sur ce projet, 12 987 primitives se lisent en une minute par accès direct aux offsets binaires du GLB — l'échantillonnage n'achète rien.

---

## Règle 4 — Dater le log avant de le croire

**Ce qui s'est passé.** Conclusion « le clip d'accroupissement charge encore la pose d'escalade » tirée d'un log de 02:08, alors que le fichier avait changé à 02:10. Correction publiée, puis rétractée.

**La règle.**
```bash
ls -la --time-style=long-iso <log> <fichier-incriminé>
```
Si le fichier est plus récent que le log, le log ne dit rien de l'état actuel.

---

## Règle 5 — Un instrument qui n'a jamais rien signalé est suspect

**Ce qui s'est passé.** Le compteur VRAM faisait `w × h × 4 × 1.33` pour toutes les textures — RGBA8 supposé. Sur des chunks 100 % KTX2, il surestimait d'un facteur 4. Personne ne l'a vu pendant des semaines parce que le chiffre était *plausible*.

**La règle.** Avant de raisonner sur un chiffre affiché par le projet, lire la ligne qui le calcule. Un chiffre plausible n'est pas un chiffre juste.

---

## Règle 6 — Distinguer « absent » de « masqué »

**Ce qui s'est passé.** « Il manque des morceaux de map » a exactement la même apparence que « le culling masque un chunk encore visible ». Plusieurs tours perdus à chercher de la géométrie manquante alors que le rayon de culling était sous-estimé jusqu'à 156 %.

**La règle.** Quand quelque chose n'apparaît pas, séparer d'abord *pas là* de *pas rendu* :
- **F7** coupe le culling par chunk
- **F10** affiche `MASQUÉ (hors frustum)` par chunk
- comparer la somme des triangles chunks vs source règle la question « pas là »

---

## Règle 7 — Ne jamais déclarer validé ce qui n'a pas tourné

`tsc` propre et tests verts ne prouvent **rien** sur :
- le GLSL — il ne compile qu'au runtime, et un `.replace()` de chunk Three.js qui ne matche pas échoue **en silence**
- le rendu, les fuites GPU, la mémoire de transcodage
- tout ce qui dépend d'un contexte WebGL

**La règle.** Dire ce qui a été vérifié et **comment**, puis dire explicitement ce qui reste à confirmer en jeu et quelle ligne de console le prouvera. Ne jamais écrire « corrigé » pour « le code compile ».

---

## Règle 8 — Un correctif qui dépend d'un réglage utilisateur n'en est pas un

**Ce qui s'est passé.** Chunks en échec parce que le joueur était en qualité « high ». Première réponse : « passe en medium ». Ce n'était pas un correctif — le jeu ne doit pas se casser parce qu'une option existe.

**La règle.** Si un chemin d'échec dépend d'un choix légitime de l'utilisateur, le rendre auto-réparant. Ici : repli automatique d'un cran de variante sur saturation mémoire (`degradeVariant`), et migration des réglages persistés quand le SENS d'une valeur change.

---

## Règle 9 — Un avertissement qui crie faux coûte le prochain débogage

`pose accroupie PROCÉDURALE — déformations attendues` sortait à chaque partie, au premier palier de publication de clips, pour un état corrigé 200 ms plus tard. Un faux positif permanent envoie la prochaine investigation sur une fausse piste.

**La règle.** Un avertissement ne se déclenche qu'une fois l'état réellement stabilisé. Sinon il est pire que rien.

---

## Règle 10 — Devant « X marche, Y non », énumérer les différences avant de théoriser

**Ce qui s'est passé.** P0 « caméra TPS = écran noir, FPS marche ». Quatre correctifs successifs (clamp de pitch, `near`, collision caméra, spawn) ont été posés sur des hypothèses formulées de tête, dans un runtime de 106 k lignes. Aucun n'a bougé le symptôme.

Une seule commande réduisait l'espace de recherche à quatre endroits :

```bash
grep -rnE 'view === "tps"|view === "fps"|view !== "fps"' src/rpg
```

Résultat : la branche `FpsCamera.apply`, le `g.visible = s.view === "tps"` des 4 composants perso, le zoom molette de `PlayerRig`, le viewmodel FPS de `RpgGameWorld`. Rien d'autre dans tout le runtime ne distingue les deux modes — donc la cause est forcément là.

**La règle.** Un symptôme qui oppose deux modes est un **cadeau** : il borne le diagnostic. La première commande n'est pas une lecture de fichier, c'est le grep qui énumère ce qui sépare les deux modes. Théoriser avant d'avoir cette liste, c'est chercher dans tout le projet ce qui tient dans quatre lignes.

---

## Règle 11 — Un garde-fou anti-division-par-zéro peut fabriquer pire que le zéro

**Ce qui s'est passé.** `OwnAnimPlayerCharacter.tsx:136` normalise la taille du perso :

```ts
const h = Math.max(0.001, box.max.y - box.min.y);
baseScale = (TARGET_HEIGHT / h) * scaleMul;   // TARGET_HEIGHT = 1.8
```

Une `Box3` vide vaut `min = +Infinity`, `max = -Infinity` : la hauteur vaut `-Infinity`, clampée à `0.001` → `baseScale = 1800`. Le personnage passe de 1,8 m à ~2,3 km. Le garde-fou n'a pas évité la catastrophe, il l'a rendue silencieuse. Motif identique dans `FpsWeaponViewmodel`, `FpsUnarmedViewmodel`, `BucheronAxeViewmodel`, `HumanCharacter`.

**La règle.** Clamper un dénominateur ne valide pas la mesure. Tester d'abord la validité (`box.isEmpty()`, `Number.isFinite`), et sur mesure invalide utiliser une valeur **neutre** (échelle 1) en le signalant — jamais diviser par la borne. Corollaire : `Math.max`/`Math.min`/`THREE.MathUtils.clamp` laissent passer `NaN` intact.

## Règle 12 — Comparer des ensembles ne dit rien de la structure

**Ce qui s'est passé.** `scripts/narvos-skeleton-compat.mjs` décide si un modèle
entre dans nanos. Il comparait deux **ensembles de noms d'os** : si tous les noms
de `SKEL_Mannequin` (68) figurent dans le modèle, verdict « importable ».

Sur les MetaHuman il a rendu **IK SEULS** — donc « importable sans retargeting ».
J'ai importé et cuit 14 assets sur cette foi.

Le verdict était faux. Les 68 noms sont bien là, mais l'**arbre** diffère :

```
os          Mannequin    MetaHuman
neck_01     spine_03     spine_05
head        neck_01      neck_02
clavicle_l  spine_03     spine_05
```

MetaHuman **intercale** `spine_04`, `spine_05`, `neck_02` dans la chaîne — 342 os
contre 68 — et le mesh est **pondéré dessus**. Liés à `SKEL_Mannequin` qui ne les
a pas, ces poids sont perdus : le tronc se déforme faux. Aucune erreur nulle
part ; le défaut ne se voit qu'à l'écran, après import et cook.

Vérifier :

```bash
node scripts/narvos-skeleton-compat.mjs \
  WebPortal/public/models/personnages/GameAnimationSample/MetaHumans
# 7 INTERCALE · 0 GLB importables SANS retargeting
```

**La règle.** Un ensemble de noms ne porte aucune information de structure. Dès
qu'on compare deux objets **arborescents** — squelettes, scènes, DOM, dépendances,
arborescence de fichiers — il faut comparer les **relations**, pas les étiquettes.

Corollaire opérationnel : quand un outil maison rend un verdict favorable qui
autorise une opération coûteuse (import, cook, migration), demander **ce que
l'outil ne regarde pas** avant de s'y fier. Ici il ne regardait pas les parents ;
la question aurait coûté trente secondes, l'ignorer a coûté un import et deux
cooks.

Corollaire de conception : quand deux structures partagent la même chaîne mais
avec des nœuds insérés, ce n'est pas un *reparentage* — c'est une
**intercalation**. La distinction compte : le premier est irrécupérable, le second
demande de reconstruire le skinning sur les os cibles. L'outil rend désormais
deux verdicts distincts, `INTERCALE` et `REPARENTE`.

## Règle 13 — Un catalogue se bâtit sur un inventaire, jamais sur une intention

Trois fois sur ce projet, un catalogue a référencé des assets qui n'existaient
pas — et à chaque fois pour la même raison : il avait été construit depuis la
liste de ce qu'on VOULAIT, pas depuis l'inventaire de ce qui EST.

| Catalogue | Références mortes | Ce qu'on avait lu à la place |
|---|---|---|
| `Emotes.lua` | 67 sur 166 | le dossier source |
| `Modular.lua` (trooper) | 76 évitées de justesse | le dossier source |
| `Spawnables` (avant garde-fou) | 55 sur 59 | le catalogue TS des PNJ |

Aucune ne lève. nanos ignore un asset manquant, chacun à sa façon :

| Classe | Ce qui arrive |
|---|---|
| `Character` | affiche la CAPSULE DE COLLISION — un cylindre blanc |
| `CharacterSimple` | idem |
| `Particle` | ne joue rien |
| `Prop`, `StaticMesh` | ne pose rien |

Le joueur en conclut que la touche n'a pas répondu.

**La parade est structurelle, pas disciplinaire.** Un générateur de catalogue lit
`Server/Assets/narvos/Assets.toml` (notre pack) ou le contenu Steam installé
(pack de base), et n'écrit que ce qu'il y trouve. Ce sont deux inventaires
distincts : les confondre laisse passer la moitié des références.

Contrôle après tout cook, tout réimport, et toute mise à jour Steam :

```bash
node scripts/narvos-verifier-catalogues.mjs
# 2 356 references verifiees, 0 morte
```

## Règle 14 — `load()` valide la grammaire, pas la portée

En Lua, `local X` ne crée le local **qu'à partir de sa ligne**. Une fonction
compilée plus haut qui écrit `X` ne capture pas ce local : elle résout le nom
comme une GLOBALE, donc `nil`. Le fichier compile, le package charge, et l'appel
échoue plus tard — au moment où le joueur appuie sur la touche.

`syntaxe-check.mjs` ne le voit pas : il appelle `load()`, qui ne juge que la
grammaire. Il faut un second contrôle, textuel :

```bash
node scripts/lua-harness/portee-check.mjs
```

**Il a payé dès sa première exécution** : `SansBalise` déclarée ligne 554 de
`Server/Index.lua`, appelée lignes 210 et 444. Le choix d'une classe et
l'ouverture d'un coffre levaient tous deux « attempt to call a nil value ».
Cinq bugs de cette famille avaient déjà été trouvés à la main dans la même
session ; celui-ci ne l'avait pas été.

Deux règles d'écriture l'éliminent en amont :
- **les tables indexées par joueur se déclarent ensemble, en tête du fichier** —
  le `Player.Subscribe("Destroy")` qui les purge est presque toujours écrit avant
  le code qui les remplit ;
- **toute fonction appelée plus haut se déclare en avant puis s'assigne** :
  `local X` en tête, `X = function()` plus bas — jamais `local function X`, qui
  recréerait un second local.