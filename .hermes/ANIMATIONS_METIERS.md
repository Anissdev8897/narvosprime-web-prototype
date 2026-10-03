# Animations des métiers de NARVOS — relevé 2026-09-07

**Méthode : énumérer puis classer, jamais filtrer par mot-clé.** Tous les chiffres
viennent de commandes exécutées (sorties collées plus bas). Aucune modification
de fichier de jeu : ce document est un relevé.

## Sources et comptes mesurés

| seau | emplacement | mesure |
|---|---|---|
| **CUIT** | `WebPortal/Server/Assets/narvos/Assets.toml`, section `[assets.animations]` (l. 45317 → 48534) | **3 215 clés uniques, 0 doublon** |
| **ADK** | `WebPortal/Server/adk/Content/Narvos/` | 78 180 `.uasset` |
| **DISQUE** | `WebPortal/public/models/animations/` (+ `public/asset_game/`) | 12 dossiers de packs |

⚠ **Écart annoncé : 3 215 au lieu de 3 169** (le cook du jour a probablement
ajouté des entrées). Les 16 de différence ne sont pas identifiés — comptage
brut de la section telle qu'elle est maintenant.

## Vérité : les pièges qui m'ont été signalés sont réels (et il y en a un 3ᵉ)

1. **`axe` dans `Rel**axe**d`** : 434 faux positifs (`M_Relaxed_*`), **0** vrai `axe_`.
2. **`sit` dans « Tran**sit**ion »** : le mot anglais « Transition » matche — c'est un 3ᵉ piège de la même famille. 100 matches au total, dont seulement **72** vraies animations assises (65 `AS_Sit_*` + 6 `ANIM_*_sit*` + 1 `AS_StandUpright_To_Sit`).
3. **`forge`/`blacksmith` : 0 par mot-clé, mais le pack existe** — il s'appelle `ANIM_IP_*`/`ANIM_RM_*` et son chemin est `Narvos/BlacksmithAnimations/Animations/Forge/`.

---

## 1. Tableau par métier

| Métier | CUIT (noms exacts) | ADK | DISQUE | Statut |
|---|---|---|---|---|
| **Minage** | **0** dédié. Aucun nom `mine`/`ore`/`pioche`/`pickax` dans les 3 215. Seul candidat : `ANIM_IP_hit_loop_Anim`, `ANIM_IP_three_hit_loop_Anim` (coups de marteau — **réemploi** possible, cf. §2) | rien | rien | **ABSENT** (dédié) — 2 réemplois possibles |
| **Forge** | **37** : 20 `ANIM_IP_*` + 17 `ANIM_RM_*` — `hit_loop`, `three_hit_loop`, `standing_polish_loop`, `sharp_loop`, `get_tool(s)`, `put_away_tool(s)`, `standing_put_in_water`, `testing_sword`, `discuss(+accept/denied)`, `customer_idle`, `standing_idle_01/02/03`, `standing_inspect`… (chemin `Narvos/BlacksmithAnimations/Animations/Forge/`) | `BlacksmithAnimations` : **205 uasset** | 44 GLB (`Animations/` 37 + `Demo/` 7) | **CUIT ✓ — attention squelette §3** |
| **Bois (bûcheron)** | **0**. Rien `wood`/`tree`/`chop`/`saw` (seul `Pistol_HandSignal_Choppa_Anim` : un signal main, pas un coup de hache) | rien | rien | **ABSENT** |
| **Couture** | **0** (`sew`/`needle`/`thread`/`knit` : 0) | rien | rien | **ABSENT** |
| **Alchimie** | **0** (`potion`/`brew`/`herb`/`mortar`/`cauldron` : 0) | rien | rien | **ABSENT** (le paquet Fab Excalibur « potion + mortier et pilon » couvre ce trou) |
| **Récolte** | **78** `Loot_*` : `Loot_FloorPickUp_*` **14** (dont `…_Kneel_HarvestItem_Anim` = la SEULE anim « harvest » au sens du mot), `Loot_TableTop_*` **10**, `Anim_Mannequin_PickUp_Anim` ×2 — et 52 de loot meubles (Dresser 10, Generic_Rummage 10, Corpse/UprightCorpse 11, BackPack 7, TreasureChest 4, Trashcan 2, HighShelf 2, Fridge/Locker/MidShelf/LowShelf/Hole/PickPocket/Cabinet/Trunk 1-2) | `Loot_Anim_Set` : **383 uasset** | GLB (pack source) | **CUIT ✓ + squelette OK (§3)** |
| **Fabrication** | **0** dédié (`assemble`/`build`/`craft` : 0). Réemplois : `ANIM_RM_sharp_loop`/`sharp_start`/`sharp_end` (affûtage) + `ANIM_IP_standing_polish_loop` (polissage) + `ANIM_RM_standing_put_in_water` (trempe) | rien | rien | **PARTIEL par la forge** |
| *(bonus)* **Assis / commerce** | **72** assises (65 `AS_Sit_*` + 6 `ANIM_*sit*` + 1 `AS_StandUpright_To_Sit`), pack `Narvos/WW100IdleAnimPack/Animations/UE4/` ; + `ANIM_IP_customer_idle`, `discuss`, `discuss_accept/denied` (client de boutique) | `WW100IdleAnimPack` : **346 uasset** | 111 GLB | **CUIT ✓ + squelette OK** — réemploi artisanat/marchand |

## 2. Réemplois (éviter d'acheter ce qu'on a)

| Animations | Sert à | Note |
|---|---|---|
| `ANIM_IP_head/three_hit_loop` | **minage** (coups) et **forge** (martelage) | même geste de frappe ; le minage d'un rocher n'exige pas une pioche vue, seulement un rythme de coups |
| `Loot_FloorPickUp_Kneel_*` (14) | **récolte** (ramassage au sol) | 14 variations genou/courbé, main gauche/droite |
| `Loot_TableTop_*` (10) | **alchimie / artisanat / cuisine** — pose et prise d'ingrédients sur une table | crée le geste « station » sans achat |
| `ANIM_IP_standing_polish_loop`, `ANIM_RM_sharp_*` | **forge / fabrication** (finitions) | |
| `ANIM_IP_get_tools` / `put_away_tools` | **forge / fabrication** (préparation de station) | |
| `ANIM_RM_standing_put_in_water` | **forge** (trempe) | |
| `AS_Sit_*` (72) + `ANIM_IP_customer_idle` + `discuss*` | **commerce / banque / ateliers RP** (E3, E5) | client assis qui discute — exactement une boutique |

## 3. Squelettes (nanos exige `SKEL_Mannequin`, 68 os — Mannequin UE4)

Mesuré avec `scripts/narvos-skeleton-compat.mjs` (référence `adk/_export/SK_Mannequin.glb`, 68 os) sur **tous** les GLB source des trois packs métiers :

```
=== BlacksmithAnimations ===        === Loot_Anim_Set ===          === WW100IdleAnimPack ===
44 GLB comparés                     124 GLB comparés                111 GLB comparés
   41  INTERCALE                        86  IDENTIQUE                  109  IDENTIQUE
    3  SANS OS (Demo)                   33  ETRANGER (Props)             1  IK SEULS
0 importables SANS retargeting        86 importables                110 importables
```

- **Loot_Anim_Set : 86/86 IDENTIQUE** sur les animations → utilisables sans retargeting.
- **WW100IdleAnimPack : 110/111 IDENTIQUE + IK** → idem.
- **BlacksmithAnimations : 41/44 INTERCALE** (la chaîne d'os divergé : les poids sont perdus tels quels). **Le pack est pourtant CUIT (37)** : le dépôt possède un pipeline de retargeting (`scripts/adk-retarget-anims.py`, et `ADK/Content/Narvos/NARVOS_Retarget/` en contient le résultat). ⚠ **Je ne peux pas certifier hors éditeur que les 37 cuites sont liées à `SKEL_Mannequin` : à confirmer avec `scripts/adk-verify-skeletons.py` (qui tourne dans Unreal).** Si elles ont été retargetées au import, tout va bien ; sinon il faut les re-retargeter avant l'usage en forge.

## 4. Ce qui manque vraiment (liste d'achat)

| Besoin | Preuve (mesure) | Couvert par le Fab ? |
|---|---|---|
| **Minage dédié** (creusage, pioche, ramassage de minerai) | 0 nom dédié sur 3 215 ; 2 réemplois « coups » | `Crafting Animations` (Excalibur) : minage ✓ ; `Crafting Anims` (Explosive) : creusage ✓ |
| **Bois** (coupe d'arbre — pas un signal main) | 0 ; seul `HandSignal_Choppa` (signe de main) | Excalibur : abattage + fendage ✓ |
| **Alchimie** (potion, mortier) | 0 | Excalibur : potion + mortier ✓ |
| **Couture** | 0 | **AUCUN des deux** — toujours un trou réel |
| **Fabrication générique** (montage, assemblage) | 0 | Excalibur : forge/cuisine/poterie/orpaillage ✓ (partiel) |
| `harvest` au sens propre | **1 seule** (`Loot_FloorPickUp_Kneel_HarvestItem`) : un tirage génuflexion suffira pour la récolte, mais aucune variante plante/herbe | Explosive : « ramassage » ✓ |

## Sorties des commandes exécutées (extraits)

```
python anim_scan.py → section animations : lignes 45317 -> 48534 ; total cles : 3215 ; duplicats : 0
                       ANIM_IP : 20 ; Loot : 78 (TableTop 10, FloorPickUp 14, Mannequin_PickUp 2)
grep -E 'SM_(OreMetal|Metal|…)' Assets.toml → 0   (vérifié pour la tâche 2)
node scripts/narvos-skeleton-compat.mjs …        → chiffres du §3, collés ci-dessus
```