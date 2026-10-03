# Tâche — brancher les 523 icônes de l'interface

Pour l'agent Hermes. Rédigé le 2026-09-06. Tout ce qui suit a été **mesuré sur
le disque**, pas estimé.

---

## 1. Le projet, en cinq lignes

NARVOS PRIME, MMORPG. Dépôt : `D:\mes_projet\narvosprime-web-prototype`.
Le jeu tourne sur le moteur **nanos world** : le gameplay est en **Lua 5.4**
(dossier `WebPortal/Server/nanos_world/packages/`), et l'interface est en
**HTML/CSS/JS ordinaire** — nanos affiche des pages web (`WebUI`), pas de l'UMG.

**Tout le code et tous les commentaires de ce dépôt sont en français.** Écris en
français.

---

## 2. Le constat qui motive la tâche

```
523 fichiers PNG, 11 Mo, dans
  WebPortal/Server/nanos_world/packages/narvos-map-proto/Client/UI/img/gui/

ZÉRO référence dans le code de l'interface.
```

Vérifié par :

```bash
cd WebPortal/Server/nanos_world/packages/narvos-map-proto/Client/UI
find . -iname '*.png' | wc -l                                    # -> 523
grep -rhoE "img/[A-Za-z0-9_/.-]+\.png" --include=*.js --include=*.css --include=*.html . | wc -l   # -> 0
```

Un jeu d'icônes complet a été importé puis jamais câblé. L'interface affiche
aujourd'hui des couleurs à plat et du texte.

### Répartition des 523 fichiers

| dossier | nombre | ce que c'est |
|---|---|---|
| `img/gui/buttons` | 93 | boutons |
| `img/gui/icons/items` | 67 | icônes d'objets |
| `img/gui/icons/silver` | 55 | même jeu, teinte argent |
| `img/gui/icons/gold` | 55 | même jeu, teinte or |
| `img/gui/icons/flat` | 55 | même jeu, à plat |
| `img/gui/icons/brown` | 55 | même jeu, teinte brune |
| `img/gui/icons/item_slots` | 46 | emplacements d'équipement |
| `img/gui/borders` | 26 | cadres |
| `img/gui/quality` | 24 | halos et fonds d'emplacement, **par couleur** |
| `img/gui/masks_gradients` | 15 | masques et dégradés |
| `img/gui/small_decor` | 9 | petits ornements |
| `img/gui/cursors` | 6 | curseurs |
| `img/gui/progressbar` | 5 | barres de progression |
| `img/gui/glass_ball` | 4 | sphères de verre |
| `img/gui` (racine) + `icons` | 8 | divers |

---

## 3. La correspondance la plus évidente — les raretés

Le jeu a **7 raretés**, avec leurs couleurs, dans
`WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/Loot.lua` :

```lua
Loot.RARITY_COLOR = {
    common    = "#aaaaaa",   -- gris
    rare      = "#4a9eff",   -- bleu
    epic      = "#a855f7",   -- violet
    legendary = "#f59e0b",   -- orange
    mythic    = "#ef4444",   -- rouge
    alien     = "#22c55e",   -- vert
    divine    = "#f0f",      -- magenta
}
```

Et `img/gui/quality/` contient exactement 12 couleurs, en **deux variantes** :

```
fg4_slotBlue_result.png     fg4_glowBlue_result.png
fg4_slotCyan_result.png     fg4_glowCyan_result.png
fg4_slotGreen_result.png    fg4_glowGreen_result.png
fg4_slotGreyDark_result.png fg4_glowGreyDark_result.png
fg4_slotGreyLight_result.png fg4_glowGreyLight_result.png
fg4_slotGreyMedium_result.png fg4_glowGreyMedium_result.png
fg4_slotMagenta_result.png  fg4_glowMagenta_result.png
fg4_slotOrange_result.png   fg4_glowOrange_result.png
fg4_slotPink_result.png     fg4_glowPink_result.png
fg4_slotRed_result.png      fg4_glowRed_result.png
fg4_slotViolet_result.png   fg4_glowViolet_result.png
fg4_slotYellow_result.png   fg4_glowYellow_result.png
```

Sept raretés, douze couleurs disponibles : la correspondance est immédiate pour
la plupart. **Choisis-la par la couleur hexadécimale, pas par intuition** — par
exemple `epic = #a855f7` est un violet, donc `Violet`, pas `Magenta` (qui est
réservé à `divine = #f0f`). Écris ton raisonnement pour chaque rareté.

---

## 4. Les objets

`WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/Items.lua`
contient **26 objets**, répartis en 10 types :

| type | nombre |
|---|---|
| `weapon` | 6 |
| `material` | 5 |
| `accessory` | 3 |
| `armor` | 3 |
| `consumable` | 3 |
| `ammo` | 2 |
| `boots` | 1 |
| `helmet` | 1 |
| `quest` | 1 |
| `resource` | 1 |

Chaque objet a un `id`, un `label` français, un `type` et une `rarity`.

67 icônes d'objets disponibles pour 26 objets : il y en a assez, et il en
restera. **C'est normal et ce n'est pas un problème** — dis simplement
lesquelles restent libres, pour les objets à venir.

---

## 5. Ce que tu dois produire

### 5.1 Un rapport

`.hermes/ICONES_UI_2026-09-06.md`, qui répond à quatre questions :

1. **Quelle icône pour quelle rareté**, et pourquoi — la couleur hexadécimale à
   l'appui.
2. **Quelle icône pour quel objet** — les 26, un par un, avec la raison du choix
   (le nom du fichier, le type de l'objet, son libellé).
3. **Quelle icône pour quel emplacement d'équipement** (`img/gui/icons/item_slots`,
   46 fichiers). Les emplacements sont définis dans
   `narvos/Shared/Logic/Inventory.lua` (`EQUIPMENT_SLOTS_ORDERED`) — **lis-les,
   ne les invente pas**.
4. **Ce qui reste sans emploi** : combien d'icônes, dans quels dossiers, et ce
   qu'elles pourraient servir plus tard.

### 5.2 Un fichier de correspondance

`WebPortal/Server/nanos_world/packages/narvos-map-proto/Client/UI/icones.json`

Forme attendue — un objet JSON, chemins **relatifs au dossier `UI/`** :

```json
{
  "raretes": {
    "common": { "slot": "img/gui/quality/fg4_slotGreyMedium_result.png",
                "halo": "img/gui/quality/fg4_glowGreyMedium_result.png" }
  },
  "objets": {
    "arch_sword": "img/gui/icons/items/<le fichier choisi>.png"
  },
  "emplacements": {
    "<slot lu dans Inventory.lua>": "img/gui/icons/item_slots/<fichier>.png"
  },
  "libres": {
    "icons/items": ["<fichiers non employés>"]
  }
}
```

### 5.3 Rien d'autre

**N'écris aucun HTML, CSS ni JS.** Le câblage de l'interface sera fait après, à
partir de ton fichier. Ton travail est la correspondance, pas le rendu.

---

## 6. Règles dures

1. **Vérifie que chaque fichier que tu cites EXISTE.** Un chemin faux ne lèvera
   aucune erreur : l'image ne s'affichera simplement pas, et personne ne saura
   pourquoi. Contrôle chaque entrée de ton JSON par un test d'existence, et dis
   dans le rapport combien tu en as vérifiées.
2. **N'invente aucun identifiant.** Les `id` d'objets, les noms de raretés et
   les emplacements d'équipement se LISENT dans les fichiers Lua cités. Un
   identifiant recopié de mémoire diverge toujours de sa source — c'est une
   erreur qui a déjà coûté cher sur ce projet.
3. **Ne modifie AUCUN fichier `.lua`.** Ni dans `Shared/Catalogs/` (ils sont
   **générés** et seront écrasés au prochain build), ni dans `Shared/Logic/`
   (d'autres travaux y sont en cours en ce moment).
4. **Ne modifie aucun fichier existant** en dehors des deux que tu crées.
5. **Ne renomme et ne déplace aucun PNG.** Ils sont référencés par leur chemin.
6. Si une correspondance est douteuse, **mets-la dans une section « à trancher »
   du rapport** plutôt que de choisir au hasard. Un choix arbitraire présenté
   comme un choix raisonné est pire qu'une question posée.

---

## 7. Comment vérifier ton travail

```bash
cd E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos-map-proto/Client/UI

# le JSON est-il valide ?
node -e "JSON.parse(require('fs').readFileSync('icones.json','utf8')); console.log('JSON valide')"

# tous les chemins cites existent-ils vraiment ?
node -e "
const fs=require('fs'), j=JSON.parse(fs.readFileSync('icones.json','utf8'));
const chemins=[];
const ramasser=o=>{for(const v of Object.values(o)){
  if(typeof v==='string'&&v.endsWith('.png')) chemins.push(v);
  else if(v&&typeof v==='object') ramasser(v);}};
ramasser(j);
const morts=chemins.filter(c=>!fs.existsSync(c));
console.log(chemins.length+' chemin(s), '+morts.length+' MORT(S)');
morts.forEach(c=>console.log('  MANQUE '+c));
"
```

**Les deux commandes doivent passer, et le nombre de chemins morts doit être 0.**
Colle leur sortie exacte dans ton compte rendu.

---

## 8. Ce que tu rends

- les deux fichiers ;
- la sortie exacte des deux commandes de vérification ;
- ce que tu n'as pas pu trancher, dit franchement.

Un « c'est fait » sans la sortie des vérifications ne vaut rien : sur ce projet,
plusieurs opérations se sont déclarées réussies en n'ayant rien écrit.