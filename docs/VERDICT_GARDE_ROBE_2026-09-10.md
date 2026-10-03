# Garde-robe MetaCustom / MetaWardrobe — les trois points, tranchés

Mesuré le 2026-09-10 sur les assets réels de l'ADK, export glTF à l'appui.
Répond aux trois inconnues laissées ouvertes par
[HANDOFF_CLAUDE_2026-09-10.md](HANDOFF_CLAUDE_2026-09-10.md) §5.3 et par mon
propre relevé d'os de la veille.

---

## Verdict en une ligne

**La garde-robe n'est pas portable par un `Character` nanos.** Ni par rebind, ni
par `CompatibleSkeletons`. Elle l'est en revanche **aujourd'hui, sans rien
faire**, par `CharacterSimple` — pour des PNJ.

---

## Ce qui avait fait croire le contraire

Le relevé des NOMS d'os était encourageant, et c'est un piège que ce dépôt
connaît déjà :

```
SK_Mannequin_Skeleton (nanos)  68 os
Skel_Metahuman                314 os
  os DÉFORMANTS communs : 61/61 (100,0 %)
  manquants : 7 ik_* seulement — et les ik_* ne déforment rien
```

Cent pour cent des os déformants du Mannequin existent chez MetaHuman. Sur ce
seul critère, le rebind semblait plausible. **Il ne l'est pas**, et il a fallu
mesurer autre chose pour le voir.

⚠ Au passage : mon premier script rendait « INCOMPATIBLE, retargeting
obligatoire » pour ces mêmes squelettes — 61/68 = 89,7 %, sous un seuil de 90 %.
Faux verdict, par artefact de seuil, parce qu'il comptait les `ik_*` comme des os
manquants. Corrigé dans `scripts/narvos-os-uasset.mjs` : les `ik_*` sont
comptés à part. **Un seuil qui tombe à 0,3 point de sa borne ne tranche rien.**

## Point 1 — les POIDS : rebind destructif

`node scripts/narvos-poids-hors-squelette.mjs <cible.glb> <candidat.glb>`

| pièce | sommets | os pondérés | poids sur des os ABSENTS du Mannequin |
|---|---:|---:|---:|
| `SK_Dress` | 15 066 | 74 | **67,1 %** |
| `SK_Fantasy_outfit_1` | 45 488 | 105 | **55,4 %** |
| `SK_Belt` | 7 988 | 20 | **40,4 %** |

Les os qui portent ce poids sont des correctifs MetaHuman : `thigh_twistCor_01/02_l/r`,
`thigh_fwd/bck/out_*`, `calf_knee*`, `calf_twist_02_*`, `lowerarm_twist_02_*`, et
**`spine_04` à lui seul porte 9,9 % de la robe**.

Rebinder sur SKEL_Mannequin ne « perdrait » pas ces os : il reporterait leur
influence sur le parent le plus proche. Entre 40 et 67 % de la déformation
d'une pièce s'effondrerait — et **sans erreur**, comme toujours.

⚠ **La liste d'os d'un mesh ne répond PAS à cette question.** 104 vêtements sur
106 « nomment » 255 os : un SkeletalMesh nomme tout son squelette, y compris ce
qui ne le déforme pas. Seul le poids décide. C'est la même distinction qui avait
rendu sûr l'import du corps morphable (« 0 % du poids sur les 21 os
supplémentaires ») — ici la réponse est l'inverse, et il fallait la mesurer.

## Point 2 — la HIÉRARCHIE : INTERCALE

`node scripts/narvos-hierarchie-os.mjs SK_Mannequin.glb SK_Dress.glb`

```
VERDICT : INTERCALE — 12 os s'insèrent dans la chaîne
  clavicle_l  passe désormais par spine_05
  clavicle_r  passe désormais par spine_05
  index_01_l  passe désormais par index_metacarpal_l
  … (les 4 doigts × 2 mains, par leurs métacarpiens)
281 os en plus chez le candidat, dont 271 hors chaîne
```

Une animation faite pour le Mannequin ne pilote NI `spine_05` NI les
métacarpiens. Épaules et doigts resteraient figés pendant que le reste bouge.

## Point 3 — `CompatibleSkeletons` : sans objet

C'était le joker envisagé. Il ne s'applique pas : `CompatibleSkeletons` règle une
question d'**identité d'asset** — faire accepter un squelette là où un autre est
attendu. Il ne change ni les poids ni la hiérarchie. Même déclarés compatibles,
ces vêtements arriveraient avec 40 à 67 % de leur déformation pilotée par des os
que le corps n'a pas, et des clavicules branchées sur un `spine_05` inexistant.

Il n'y a donc rien à tester en éditeur sur ce point : la question tombe avec les
deux précédentes.

---

## Ce qui reste possible

| voie | coût | ce qu'on obtient |
|---|---|---|
| **`CharacterSimple`** | **zéro** | Les PNJ portent ces tenues comme **corps autonomes** — la classe accepte n'importe quel mesh, sans contrainte de squelette. C'est ce que conclut `narvos-hierarchie-os.mjs` lui-même : « utilisable comme corps AUTONOME avec ses propres animations, jamais comme pièce attachée ». |
| **Re-skinning complet** | chantier 3D | IK Retargeter + transfert de poids des 253 correctifs vers les 61 os du Mannequin, par pièce. Ce n'est pas un rebind, c'est refaire le skinning. |
| **Renoncer pour le joueur** | zéro | La garde-robe modulaire du joueur reste celle qui EST sur SKEL_Mannequin (Stylized, Trooper). |

**Recommandation : `CharacterSimple` pour les PNJ, et ne pas rouvrir le rebind.**
988 pièces × un re-skinning chacune n'a pas de rapport de valeur avec une
garde-robe joueur déjà fonctionnelle sur un autre squelette.

## État du pack dans l'ADK, mesuré au passage

| emplacement | `.uasset` | dont `Metawadrobe` |
|---|---:|---:|
| `Content/Metahuman_Customization_System/` | 2 193 | 58 |
| `Content/Narvos/MetaCustom/` | 526 | 58 |
| `Content/MetaCustom/` | 34 | 0 |
| `Content/Metawadrobe/` | **absent** | — |

Les meshes référencent `/Game/Metawadrobe/…`, chemin qui n'existe **nulle part**
dans l'ADK : c'est la cause des références mortes signalées par Kimi. Et l'ADK ne
porte que **58 des 988** pièces — un fragment d'avant l'achat du pack payant.
`Metahuman_Customization_System` est de toute façon dans
`DirectoriesToNeverCook` (`DefaultGame.ini:44`).

Rien de tout cela n'a besoin d'être réparé si l'on retient `CharacterSimple` :
les tenues seront importées comme corps de PNJ, à leur propre chemin, le jour où
on en peuplera le monde.

## Outils posés par cette enquête

| script | ce qu'il répond |
|---|---|
| `scripts/narvos-squelettes-uasset.mjs` | quels squelettes un dossier de `.uasset` vise, et en quelle version d'UE |
| `scripts/narvos-os-uasset.mjs` | les noms d'os d'un squelette, comparés à une référence, `ik_*` comptés à part |
| `scripts/narvos-poids-hors-squelette.mjs` | **la part du POIDS de peau qui repose sur des os absents de la cible** — celui qui tranche |
| `scripts/adk-export-garde-robe.py` | sort les pièces de l'ADK en glTF (`export_vertex_skin_weights`) |

Les deux premiers lisent 1 Mo à chaque bout d'un `.uasset` — la table de noms y
vit, et l'un de ces fichiers dépasse 512 Mo, au-delà de quoi V8 refuse de
fabriquer la chaîne (`ERR_STRING_TOO_LONG`).