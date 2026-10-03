# Quatre tâches — lot 3

Pour l'agent Hermes. Rédigé le 2026-09-06.

Ce lot vient d'une liste de quinze chantiers. **Onze ne te sont pas confiés**, et
pas par méfiance : ils exigent l'éditeur Unreal ouvert, ou d'appeler l'API du
moteur nanos. Tu n'as aucun moyen de vérifier une signature de cette API, et sur
ce projet une signature devinée est le mode d'échec le plus cher — elle
n'échoue pas, elle est ignorée en silence. Les quatre ci-dessous se mesurent
avec des commandes que tu peux lancer et recopier.

**Fais-les dans l'ordre, une à la fois.**

Règles valables pour les quatre :

- écris en **français** ;
- **ne supprime aucun fichier**, jamais, sous aucun prétexte. Plusieurs de ces
  tâches parlent de gigaoctets récupérables : tu **proposes**, tu ne retires pas ;
- **ne modifie aucun `.lua`**, ni rien sous `Shared/Catalogs/` (généré) ;
- **compte, ne devine pas.** Chaque chiffre du rapport vient d'une commande
  recopiable. Un chiffre non mesuré doit être annoncé comme non mesuré.

---

# Tâche 1 — Dégraisser Tiger_M

`WebPortal/public/models/creatures/Tiger_M/` pèse **8,1 Go**, contre 13 Mo pour
les dix autres animaux réunis. Ce n'est pas de la géométrie : ses 127 GLB
d'animation embarquent **chacun la même texture recopiée**. Mesuré :
`Animations/Stand_01.glb` fait **60 340 048 octets** pour un seul clip.

## Ce que tu fais

Un script `scripts/narvos-degraisser-glb.mjs` qui retire les textures embarquées
d'un GLB d'ANIMATION, en gardant tout le reste. Simulation par défaut,
`--apply` pour écrire — c'est la convention de tous les scripts du dépôt.

## Les règles qui décident du résultat

1. **Ne touche qu'aux fichiers d'ANIMATION.** Le mesh de base et le dossier
   `Fur/` portent les vraies textures : les dégraisser rendrait le tigre gris.
   Un GLB d'animation se reconnaît à ce qu'il contient (`animations` non vide),
   pas à son dossier — vérifie, ne suppose pas.
2. **Écris à côté, jamais par-dessus.** Sortie dans un dossier frère, l'original
   intact. On comparera avant de basculer.
3. **Un GLB dégraissé doit rester lisible.** Après écriture, relis-le et vérifie
   que le nombre d'`animations`, de `nodes` et d'`accessors` est **identique** à
   l'original. Un fichier plus petit qui ne charge plus n'est pas un gain.
4. ⚠ **`extensionsRequired` fait refuser le document ENTIER.** Si tu retires des
   images, retire aussi les extensions qui ne servent plus qu'à elles — sinon
   Unreal refuse le fichier en bloc, sans message utile. Ce piège a déjà été payé
   ici.

## Vérifie

Sur **un** fichier d'abord, puis sur le lot :

```bash
cd E:/narvosprime-web-prototype
node scripts/narvos-degraisser-glb.mjs WebPortal/public/models/creatures/Tiger_M
```

Le rapport doit donner : poids avant, poids après, gain, et le contrôle
d'intégrité (animations/nodes/accessors identiques) fichier par fichier ou en
résumé chiffré.

---

# Tâche 2 — Laisser passer le FBX dans le manifeste

Huit des dix packs d'animaux (`Bear`, `Wolf`, `Deer`, `Buffalo`, `Raccoon`,
`Rat`, `Fox`, `Spider`) sont des **packs FBX** : leurs GLB ne portent que le
maillage — 0 image, 0 texture, 0 animation — pendant que 81 à 100 FBX et les PNG
dorment à côté. Les importer par GLB donnerait huit animaux gris et immobiles.

Le verrou est **`scripts/narvos-manifeste-brut.mjs`, fonction `collecter()`,
ligne 127** : elle ne retient que `.glb` et `.gltf`.

⚠ **Le verrou n'est PAS dans `adk-import-narvos.py`.** Vérifié dans le source :
son filtre `.glb` (ligne 100) est dans `collecter()`, que le mode manifeste
n'appelle jamais — ligne 125, il lit `donnees["fichiers"]` **sans aucun filtre
d'extension**. Un manifeste peut donc déjà porter des `.fbx` aujourd'hui. Ne
touche pas au Python.

## Ce que tu fais

Ajouter au générateur une option pour inclure les `.fbx`, **sans changer le
comportement par défaut** (les manifestes existants doivent sortir identiques).

Puis produire `WebPortal/Server/adk/_manifests/animaux-fbx.json` pour les huit
packs, avec la clé `racine` et des chemins **absolus** — deux exigences dont
l'oubli fait échouer l'import en silence.

## Ce que tu écris dans le rapport, et qui compte plus que le script

⚠ **Que l'import FBX fonctionne en commandlet n'est PAS mesuré.** Le piège connu
du dépôt concerne l'**export** FBX d'un SkeletalMesh, qui tue le processus
(`MeshMergeUtilities` exige un `MeshObject` de rendu). L'import est un autre
chemin de code. **Ne présente pas le manifeste comme prêt à l'emploi** : il est
prêt à être *essayé*. Dis-le en ces termes.

## Vérifie

```bash
cd E:/narvosprime-web-prototype
node scripts/lua-harness/syntaxe-check.mjs 2>&1 | tail -3
node -e "
const fs=require('fs');
const j=JSON.parse(fs.readFileSync('WebPortal/Server/adk/_manifests/animaux-fbx.json','utf8'));
const f=j.fichiers||[];
const path=require('path');
console.log('racine:', j.racine, fs.existsSync(j.racine||''));
console.log(f.length+' fichiers, '+f.filter(x=>path.isAbsolute(x.fichier)).length+' absolus, '
  +f.filter(x=>fs.existsSync(x.fichier)).length+' presents');
console.log('annonce coherente :', (j.importables===f.length));
"
```

Les trois compteurs doivent être égaux, et l'annonce cohérente. **Un manifeste
dont l'en-tête annonce un nombre et dont la liste en contient un autre est un
défaut** — c'est arrivé aujourd'hui, sur ce même dossier.

---

# Tâche 3 — Re-trancher l'audit de création

`.hermes/AUDIT_CREATION_2026-09-04.md` (114 Ko, 73 sections) contient **68
pistes** sur le système de création de personnage nanos. Le travail avait été
interrompu, et il faut savoir ce qu'il vaut :

> Sur les 58 verdicts déjà rendus, **31 étaient faux.**

Plus d'une piste sur deux. Ce document n'est donc **pas** une liste de choses à
corriger : c'est une liste de choses à vérifier.

## Ce que tu fais

`.hermes/AUDIT_CREATION_RETRI_2026-09-06.md`, qui reprend chaque piste et la
range dans **une** de trois cases :

- **CONFIRMÉE** — tu as trouvé dans le code ce que la piste décrit. Donne le
  fichier et la ligne.
- **RÉFUTÉE** — le code dit le contraire. Donne le fichier et la ligne qui le
  contredisent.
- **INDÉTERMINÉE** — tu ne peux pas trancher sans lancer le jeu, ou sans l'API
  nanos. Dis ce qu'il faudrait pour trancher.

## La règle qui fait toute la valeur de cette tâche

**Une piste n'est CONFIRMÉE que si tu cites le code qui la prouve.** Pas « ça a
l'air vrai », pas « c'est cohérent avec ». Fichier et ligne, ou c'est
INDÉTERMINÉE. Le taux d'erreur de 53 % vient précisément de verdicts rendus sans
cette preuve — reproduire la méthode reproduirait le résultat.

Une case INDÉTERMINÉE bien argumentée vaut mieux qu'une CONFIRMÉE fausse : la
première coûte une vérification, la seconde coûte une correction inutile sur du
code qui marchait.

Termine par un décompte : combien dans chaque case, sur 68.

---

# Tâche 4 — Ce qu'on peut récupérer sur les 250 Go d'assets

`WebPortal/public/models/` pèse **250 Go**. Un audit du 2026-09-03 avait estimé
**≈ 65 Go récupérables**, et **rien n'a été supprimé** — c'est destructif, et la
décision n'est pas prise.

## Ce que tu fais

`.hermes/RECUPERABLE_2026-09-06.md` : une liste de **décisions à prendre**, pas
un inventaire. Une ligne par lot, avec quatre colonnes :

| lot | poids | pourquoi c'est récupérable | ce qu'on perd si on se trompe |

La dernière colonne est la plus importante. « On ne perd rien » n'est une réponse
acceptable que si tu as vérifié que **rien ne référence** le lot — et le dépôt a
de quoi le vérifier : `src/` porte 87 chemins codés en dur vers
`public/models/`, et il existe déjà `scripts/audit-runtime-assets.mjs` pour
mesurer ce que le runtime charge réellement.

## Pistes de départ, à vérifier et non à recopier

- **doublons exacts** — mêmes octets sous deux noms (hachage) ;
- **paires `<pack>` / `<pack>_original`** — la version KTX2 et l'originale ;
- **variantes de qualité** `.med.glb` / `.low.glb` orphelines ;
- **LOD isolés** — un `*_LOD1.glb` importé seul devient un asset que rien ne
  référence ;
- **packs jamais chargés par le runtime.**

## ⚠ Trois interdits

1. **Ne supprime rien.** Aucune commande destructive, même « pour tester ».
2. **Ne renomme, ne déplace rien** : 87 chemins sont codés en dur dans `src/`, ce
   sont des chaînes de caractères — `tsc` ne verra jamais la rupture, et le
   serveur de dev renvoie du `text/html` en 200 au lieu d'un 404. La casse serait
   silencieuse.
3. **Ne conclus pas qu'un pack est inutilisé parce qu'il n'apparaît pas dans une
   recherche de texte.** Beaucoup de chemins sont construits par concaténation.
   En cas de doute : « à vérifier », pas « supprimable ».

---

# Ce que tu rends, pour les quatre

Les fichiers, la **sortie exacte** des commandes de vérification, et ce que tu
n'as pas pu trancher — dit franchement, pas noyé.