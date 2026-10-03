# Trois tâches — lot 2

Pour l'agent Hermes. Rédigé le 2026-09-06, après vérification du lot 1.

**Le lot 1 est validé.** Contrôlé indépendamment : 139 chemins et 0 mort, 7
raretés sur 7 et 26 objets sur 26 sans un seul identifiant inventé, périmètre
tenu (seul `icones.json` écrit, 523 PNG intacts). Les deux découvertes sont
exactes — j'ai même mesuré plus strict que toi sur la monochromie : **chroma
maximum 4/255** sur les 67 icônes, c'est-à-dire du bruit.

Une correction sur ton rapport, et elle compte pour la suite :

> Tu proposes de corriger `void_saber` dans `Catalogs/Items.lua`. **Ce fichier
> est GÉNÉRÉ** (son en-tête le dit : « Généré depuis items/itemCatalog.ts »). Il
> sera écrasé au prochain build. La source est en TypeScript. C'est l'objet de
> la tâche 2.

---

**Fais ces trois tâches DANS L'ORDRE, une à la fois.** Elles sont indépendantes,
mais la 1 s'appuie sur ton `icones.json`.

Règles valables pour les trois :

- écris en **français**, comme tout le dépôt ;
- **ne modifie aucun fichier `.lua`** — d'autres travaux y sont en cours ;
- **ne modifie aucun fichier sous `Shared/Catalogs/`** : ils sont générés ;
- **vérifie ce que tu affirmes.** Un chiffre non mesuré, dis-le comme tel. Sur ce
  projet, plusieurs opérations se sont déclarées réussies sans rien avoir écrit.

---

# Tâche 1 — Afficher les icônes, et les teinter

Ton `icones.json` existe mais rien ne le lit. L'interface est dans
`WebPortal/Server/nanos_world/packages/narvos-map-proto/Client/UI/`
(`index.html`, `index.js`, `style.css`, `hud.css`). C'est du HTML/CSS/JS
ordinaire : nanos affiche des pages web, il n'y a pas d'UMG.

## ⚠ La technique est imposée, et c'est ta propre découverte qui l'impose

Les 67 icônes d'objets sont **monochromes**. Conséquence directe : si tu les
poses en `<img>` ou en `background-image`, **tout l'inventaire sera gris**.

- **N'emploie pas `filter: hue-rotate()`.** Sur une source sans chroma, une
  rotation de teinte ne produit rien — on ne fait pas tourner une couleur qui
  n'existe pas.
- **Emploie `mask-image`** (avec `-webkit-mask-image` en doublon) et pose la
  couleur en `background-color`. L'icône devient un pochoir, la couleur vient de
  la rareté. C'est la seule technique qui donne une couleur arbitraire à partir
  d'une source monochrome.

```css
.icone {
  -webkit-mask-image: var(--icone);
          mask-image: var(--icone);
  -webkit-mask-size: contain;  mask-size: contain;
  -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
  -webkit-mask-position: center;  mask-position: center;
  background-color: var(--teinte);
}
```

## Ce que tu écris

1. Une feuille `icones.css` — les classes, la mécanique de pochoir, une variable
   par rareté prise dans `Loot.RARITY_COLOR`.
2. Un module `icones.js` — charge `icones.json`, expose une fonction qui rend
   l'élément d'une icône à partir d'un `id` d'objet, et rien de plus.
3. Le branchement minimal dans l'interface existante pour qu'on VOIE le
   résultat : une grille d'inventaire de démonstration suffit.

## Ce que tu ne fais pas

- Pas de refonte de l'interface. Tu ajoutes, tu ne réécris pas.
- Pas d'ornement décoratif. Sur ce projet, un filet qui ne sépare rien et ne va
  pas au bord est ce qui fait « généré par une machine ». Un cadre doit border
  quelque chose ou ne pas exister.
- `arch_gun` est à `null` : le code doit **prévoir l'absence d'icône** et rendre
  quelque chose de lisible, pas une case vide ni une erreur.

## Vérifie

```bash
cd E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos-map-proto/Client/UI
node -e "new (require('vm').Script)(require('fs').readFileSync('icones.js','utf8')); console.log('icones.js parse')"
node -e "
const fs=require('fs');
const css=fs.readFileSync('icones.css','utf8');
console.log('mask-image present :', /(-webkit-)?mask-image/.test(css));
console.log('hue-rotate absent  :', !/hue-rotate/.test(css));
"
```

Les trois lignes doivent être vraies. Colle leur sortie.

---

# Tâche 2 — Réparer `void_saber` à la source

`void_saber` porte `color: "#c084fc"` (violet) alors que sa rareté `legendary`
vaut `#f59e0b` (orange) dans `Loot.RARITY_COLOR`. J'ai mesuré : **c'est le seul
objet des 26 dans ce cas.**

La source est **`WebPortal/src/rpg/items/itemCatalog.ts`, ligne 46**.

## Avant de corriger, tranche la bonne question

Deux lectures possibles, et elles ne mènent pas au même correctif :

- soit la **couleur** est fausse et doit suivre la rareté → `#f59e0b` ;
- soit la **rareté** est fausse : `#c084fc` est exactement la couleur `epic` du
  catalogue, ce qui ferait de `void_saber` un objet épique déclaré légendaire par
  erreur.

Regarde ce qui départage : son niveau, ses statistiques, sa valeur, sa place dans
`src/rpg/items/lootTables.ts` (il y a un poids de tirage, ligne 110), et ce que
font les 25 autres objets. **Écris ton raisonnement**, puis corrige. Si les
indices se contredisent, ne tranche pas : dis-le.

## Puis vérifie que le champ `color` sert à quelque chose

Cherche qui le lit, côté TS et côté Lua. S'il n'est lu **nulle part**, dis-le :
un champ mort qu'on « garde au cas où » n'est pas neutre sur ce projet — une
valeur inutilisée a déjà pris la place d'un vrai choix le jour où on l'a branchée.

## Vérifie

```bash
cd E:/narvosprime-web-prototype/WebPortal
npx vitest run src/rpg/items/ 2>&1 | tail -20
```

Les tests d'items doivent passer. Colle la sortie.

⚠ **Ne régénère pas `Catalogs/Items.lua`.** La régénération se fait par
`scripts/narvos-catalogs-to-lua.mjs --apply`, elle touche d'autres catalogues, et
elle sera lancée dans la chaîne complète. Ta correction est en TypeScript, point.

---

# Tâche 3 — Quelles animations sont réellement atteignables ?

Le catalogue `Shared/Catalogs/Animations.lua` porte **3 141 noms** issus du pack
cuit. Le jeu n'en joue qu'une poignée. Personne ne sait laquelle.

## Ce que tu produis

`.hermes/ANIMATIONS_ATTEIGNABLES_2026-09-06.md`, qui répond à trois questions :

1. **Combien de ces 3 141 noms sont atteignables depuis le Lua ?** Les fichiers
   qui les emploient sont `Shared/Logic/Animations.lua`,
   `Shared/Logic/Combat.lua`, `Shared/Catalogs/Emotes.lua` et
   `narvos-map-proto/Server/Index.lua`. Attention : les noms sont rarement écrits
   en clair — `Logic/Animations.lua` les REGROUPE par convention (prises,
   modes `IP`/`RM`, suffixe `_Anim`). **Lis cette convention avant de compter**,
   sinon tu compteras des chaînes littérales et tu conclu­ras « presque rien ».
2. **Quels grands lots sont entièrement orphelins ?** Groupe par préfixe
   (`ACB_`, `AS_`, `AM_`, `BS_`…) et donne, par lot, le nombre de noms et
   s'il est référencé ou non.
3. **Que faudrait-il écrire pour en atteindre un lot de plus ?** Une phrase par
   lot, pas un plan.

## Règles

- **Compte, ne devine pas.** Chaque chiffre du rapport doit venir d'une commande
  que tu peux recopier dans le rapport.
- **Ne conclus pas qu'un nom est orphelin parce qu'il n'apparaît pas
  littéralement.** C'est le piège de cette tâche : la moitié du catalogue est
  atteinte par construction de chaîne. Si tu ne sais pas trancher pour un lot,
  classe-le « indéterminé » — c'est une réponse utile, « orphelin » à tort ne
  l'est pas.
- N'écris **aucun** code Lua. C'est un rapport de mesure.

---

# Ce que tu rends, pour les trois

Les fichiers, la sortie **exacte** des commandes de vérification, et ce que tu
n'as pas pu trancher, dit franchement.