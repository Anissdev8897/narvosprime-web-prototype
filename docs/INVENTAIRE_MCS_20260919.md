# Inventaire du Meta Customization System — tenues, compatibilité, plan

**Date :** 2026-09-19 · **Auteur :** Hermes
**Source :** `WebPortal/public/asset_game/mixte_epoques/Meta Customization System - Unreal Engine`
**Appuis :** `docs/MODULAR_GARDEROBE_CUITE.md` (Kimi), `docs/VERDICT_GARDE_ROBE_2026-09-10.md` (mesures poids/hiérarchie).

---

## 0. Le verdict en une ligne (déjà mesuré, on ne rouvre pas)

La garde-robe MetaCustom/Metawadrobe n'est **pas portable sur un `Character`
nanos** (squelette `SKEL_Mannequin`, 68 os). Ses pièces sont skinnées sur
`Skel_Dummy` / `metahuman_base_skel` (MetaHuman, ~314 os) : **40 à 67 % du poids
de peau** repose sur des os twist/correctifs absents du Mannequin, et la
hiérarchie est INTERCALE (`spine_05`, métacarpiens). Un rebind « perd » ces os
en reportant leur influence → déformation effondrée, sans erreur. `CompatibleSkeletons`
ne change ni poids ni hiérarchie. **Elle est en revanche utilisable aujourd'hui,
sans rien faire, par `CharacterSimple` (PNJ).**

Recommandation retenue : `CharacterSimple` pour les PNJ, ne pas rouvrir le
rebind, garder la garde-robe joueur actuelle (Stylized/Trooper, sur Mannequin).

## 1. Le contenu du pack

| zone | volume |
|---|---|
| Total `.uasset` | **4 431** (+ 13 `.umap`) |
| Dossiers fonctionnels | Demo_Content, Fantasy_RPG_Game, Hair, Material, Meta_Body_Tool, Meta_Face_Tool, Meta_Styler, Metahuman_Face_Customization, Metahuman_Ref, **Metawadrobe**, Premade_Blueprints, Skeletal_Meshes, Textures, Underwear_Remover |

### Tenues par morphologie (meshes `SK_*`)

| dossier | pièces | exemples |
|---|---:|---|
| `Skeletal_Meshes/Metahuman_Tall_Medium_Female` | 14 | SK_Boots, SK_Fantasy_Outfit_F_Tal_Med1, SK_Meta_Female_Base, SK_Pants, SK_Sci_Fi_Armor, SK_Sci_Fi_Jumpsuit |
| `Skeletal_Meshes/Metahuman_Tall_Medium_Male` | 8 | SK_Jacket, SK_Inner_Clothing, SK_Pants, SK_Boots_2, SK_Male_Police_Armor_Army |
| `Metawadrobe/Meshes/F_Tal_Nrm` | 20 | SK_Bikini, SK_Blouse2, SK_Crop_Top, SK_Crop_jacket |
| `F_Tal_Nrm_Fantasy` | 4 | SK_Knight_Armor, SK_Knight_Female, SK_Knight_Helmet |
| `F_Tal_Nrm_Medieval` | 13 | SK_Belt, SK_Dress, SK_Dress_Sim, SK_Helmet1, SK_Horned_helmet |
| `F_Tal_Nrm_Sci_Fi` | 10 | SK_Armor_Top/Bottom/Inside, SK_Explorer_Suit2 |
| `M_Tal_Nrm` | 25 | SK_Bag, SK_Baggy_Pants, SK_Blue_Jeans, SK_Cargo_Pants |
| `M_Tal_Nrm_CyberPunk` | 2 | SK_Cyber_Punk_Pants, SK_Cyberpunk_Shirt_1 |
| `M_Tal_Nrm_Fantasy` | 3 | SK_Knight_ArmorM, Sk_Helmet |
| `M_Tal_Nrm_Medieval` | 12 | SK_Male_Armor_Top/Bottoms, SK_Male_Helmet, SK_Roman_Cape |
| `M_Tal_Nrm_Sci_Fi` | 8 | SK_Armor_Top/Bottom, SK_Inside_clothing_male, SK_Metal_Suit |

≈ **119 meshes de tenues**, chacun avec ses matériaux (`MI_*`, `T_*`) dans
`Material/` et `Textures/` — les variantes par couleur se font par instances de
matériau (MI_), pas par mesh dupliqué.

## 2. La logique existante à RÉUTILISER (rien à recréer)

1. **Catalogue** : `Shared/Catalogs/Modular.lua` (généré par
   `scripts/narvos-modular-to-lua.mjs`, `--apply` destructif — jamais de retouche manuelle).
2. **Habillage** : `Shared/Logic/Character.lua` — `Builder.Habiller` (l.477) →
   `AddSkeletalMeshAttached` (l.550), règle `PorteurCachable` + **morphs** déjà
   branchés (le système de morpho existe : `perso.morphs`, `MetaCustomLogic.Normaliser`).
3. **Création** : `Shared/Logic/CharacterCreation.lua:197-237` (`Modular.Corps`,
   `TenueDefaut`, `ValiderTenue`).
4. **Vestiaire/boutique** : `Shared/Logic/Vestiaire.lua` + `Server/Vestiaire.lua:150`
   (ré-application à la connexion).
5. **PNJ** : `Shared/Logic/Roster.lua:80` — même catalogue.
6. **Contrôle** : `scripts/narvos-verifier-catalogues.mjs:146,207` (harnais).

Pour les **équipements de gameplay** (casque/armure/bottes… en objets
d'inventaire), le chemin est le système `Equipement3D` posé le 19/09 : 12 slots,
meshes **statiques** attachés aux sockets du Mannequin — complémentaire, jamais
en concurrence avec la garde-robe.

## 3. Séparation en objets indépendants (le point du brief)

La plupart des pièces Metawadrobe sont **déjà séparées** par nature :
haut (SK_Shirt, SK_Jacket, SK_Blouse2, SK_Crop_Top), bas (SK_Pants, SK_Blue_Jeans,
SK_Cargo_Pants, SK_Armor_Bottom), chaussures (SK_Boots, SK_Boots2/3),
casque (SK_Helmet1, SK_Horned_helmet, SK_Knight_Helmet), ceinture (SK_Belt),
gants (Gauntlets_T), cape (SK_Roman_Cape), sac (SK_Bag).

Les **tenues combinées à découper** (une seule pièce = plusieurs slots) :

| pièce | contient | découpe nécessaire |
|---|---|---|
| SK_Fantasy_outfit_1 | haut + bas | torse + jambes |
| SK_1_peace / SK_1_peace_* | combinaison entière | torse + jambes (+ gants) |
| SK_Explorer_Suit2 | combinaison | torse + jambes + gants |
| SK_Metal_Suit | armure intégrale | casque + torse + jambes + bottes |
| SK_Inside_clothing / SK_Inner_Clothing | sous-vêtements corps entier | haut + bas |
| SK_Set_1_Crop_Top + SK_Set_1Shorts | ensemble deux pièces | (déjà 2 meshes, à lier au même set) |
| SK_Sci_Fi_Jumpsuit | combinaison | torse + jambes |

La découpe se fait **dans Unreal** (séparer les sections par slot et re-skinner
sur le squelette cible), pas dans nanos — c'est le même prérequis que le rebind.

## 4. Compatibilité et problèmes mesurés

| critère | constat |
|---|---|
| Squelette | `Skel_Dummy` / `metahuman_base_skel` ≠ `SKEL_Mannequin` → `AddSkeletalMeshAttached` refuse |
| Poids de peau | 40,4 % (SK_Belt) à 67,1 % (SK_Dress) sur os absents du Mannequin |
| Hiérarchie | INTERCALE : clavicules via `spine_05`, doigts via métacarpiens — épaules/doigts figés avec anims Mannequin |
| Position/taille | taillées sur corps MetaHuman (proportions différentes du Mannequin nanos) — à mesurer pièce par pièce si un jour on re-skinne |
| Références | `SK_Dress` pointe `metahuman_base_skel` pendant que les autres pointent `Skel_Dummy` (2 squelettes dans le même pack) ; `/Game/Metawadrobe/…` absent de l'ADK (réfs mortes historiques) |
| Cuisson | 653 entrées `Narvos/MetaCustom` dans `Assets.toml` (les 37 meshes clés dont SK_Belt, SK_Dress, SK_Armor_*) ; `Metahuman_Customization_System` dans `DirectoriesToNeverCook` ; l'ADK ne porte que 58 des 988 pièces du pack |

## 5. Plan proposé (ordre de valeur, sans recréer de système)

1. **PNJ civils en `CharacterSimple`** portant ces tenues comme corps autonomes — zéro travail 3D, passe par `Roster`/`Modular` existants (famille MetaCustom à inscrire avec un corps, sinon écartée comme orpheline par le générateur).
2. **Joueur : garde-robe Mannequin actuelle** (Stylized/Trooper) + équipements `Equipement3D` (12 slots, en place).
3. **Si un jour le joueur doit porter ces tenues** : re-skinning complet pièce par pièce (IK Retargeter + transfert de poids 253 correctifs → 61 os Mannequin) — chantier 3D, décision d'Aniss, pas un chantier Lua.
4. La découpe des tenues combinées (tableau §3) se fait au moment du re-skinning, slot par slot, dans Unreal.

## 6. Outils de mesure déjà posés (à réutiliser)

`scripts/narvos-squelettes-uasset.mjs`, `scripts/narvos-os-uasset.mjs`,
`scripts/narvos-poids-hors-squelette.mjs` (celui qui tranche : part du poids hors
squelette cible), `scripts/adk-export-garde-robe.py` (export glTF avec poids de peau).