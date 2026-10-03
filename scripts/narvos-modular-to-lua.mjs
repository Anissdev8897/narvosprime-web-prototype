// ══════════════════════════════════════════════════════════════════════════════
// narvos-modular-to-lua.mjs — catalogue Lua des pièces modulaires importées.
//
//   node scripts/narvos-modular-to-lua.mjs [--apply]
//
// POURQUOI PAS narvos-catalogs-to-lua.mjs : celui-là transpile des catalogues
// TypeScript existants. Ces pièces-ci n'existent dans aucun TS — elles viennent
// d'un pack Unreal, et leur seule source de vérité est la liste des assets
// réellement importés. On lit donc le dossier d'export, ce qui garantit que le
// catalogue ne peut pas référencer une pièce absente du pack cuit.
//
// Exception assumée : les vêtements MetaCustom n'ont pas de GLB d'origine
// (`.uasset` copiés dans l'ADK). Ils sont lus depuis `Assets.toml` — la clé
// dédupliquée que le client résout — et filtrés par une garde de squelette :
// voir « QUATRIÈME SOURCE » plus bas.
//
// ── LE PIÈGE DU NOMMAGE ───────────────────────────────────────────────────────
// Le pack mélange trois motifs, dont deux qui se ressemblent au point qu'un
// simple `split("_")` les confond :
//
//     Body_Chest              corps homme, torse
//     Female_Body_Chest       corps femme, torse
//     BodyFace_African        TÊTE homme, variante africaine
//     FemaleBody_AfricanFace  TÊTE femme, variante africaine
//
// « FemaleBody_ » est la famille TÊTE ; « Female_Body_ » est la famille CORPS.
// Un caractère les sépare. On les traite donc par cas nommés, avant tout
// découpage générique — et on refuse ce qu'on ne sait pas classer plutôt que de
// le ranger au hasard.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const EXPORT = "E:/narvosprime-web-prototype/WebPortal/Server/adk/_export/stylized_modular";

// ── DEUXIÈME FAMILLE : MetaHuman ─────────────────────────────────────────────
//
// ⚠ POURQUOI UNE « FAMILLE » ET PAS UN SIMPLE AJOUT AU MÊME SAC.
// Les vêtements MetaHuman sont skinnés aux PROPORTIONS MetaHuman. Leurs noms
// d'os concordent avec SKEL_Mannequin (verdict IK SEULS, vérifié) — donc
// `AddSkeletalMeshAttached` les accepte — mais leurs VOLUMES ne concordent pas
// avec ceux du pack Stylized. Un hoodie MetaHuman posé sur un torse Stylized
// s'interpénètre : le joueur voit un défaut sans comprendre d'où il vient, et
// rien ne l'aura prévenu.
//
// La famille est donc une contrainte de COMPOSITION, pas une étiquette : le
// catalogue refuse de mélanger, et l'écran de création ne propose que ce qui
// va ensemble avec le corps choisi.
// ⚠ DÉSACTIVÉ — LES METAHUMAN NE SONT PAS UTILISABLES EN L'ÉTAT.
//
// Mesuré le 2026-09-03, après un import et un cook faits à tort sur la foi d'un
// verdict d'outil erroné :
//
//     os          Mannequin    MetaHuman
//     neck_01     spine_03     spine_05
//     head        neck_01      neck_02
//     clavicle_l  spine_03     spine_05
//
// Les NOMS d'os concordent — d'où le « IK SEULS » que rendait alors
// narvos-skeleton-compat.mjs, qui ne comparait que des ensembles de noms. Mais
// MetaHuman INTERCALE des os dans la chaîne (spine_04, spine_05, neck_02) et le
// mesh est PONDÉRÉ dessus : 342 os contre 68. Liés à SKEL_Mannequin qui ne les
// a pas, ces poids sont perdus et le tronc se déforme faux — sans la moindre
// erreur, le défaut ne se voit qu'à l'écran.
//
// L'outil sait maintenant le détecter (verdict INTERCALE). Relancer :
//   node scripts/narvos-skeleton-compat.mjs <dossier MetaHumans>
//
// Le code de lecture reste ici, inerte. Le jour où un vrai retargeting existe —
// reconstruire le skinning sur 68 os, pas renommer — il suffit de repasser
// METAHUMAN_ACTIF à true.
const METAHUMAN_ACTIF = false;

const METAHUMAN = [
  "E:/narvosprime-web-prototype/WebPortal/public/models/personnages/GameAnimationSample/MetaHumans",
  "E:/narvosprime-web-prototype/WebPortal/public/models/systemes/RPGEngineUltimateMultip/RPG_Engine/MetaHumans",
];

/** Corps MetaHuman : ce sont des MESH DE BASE, pas des attachements.
 *  Ils vont dans `Character(...)`, là où `SK_CyberpunkSamurai` va aujourd'hui. */
const CORPS_MH = {
  m_med_nrw_body:         { genre: "M", label: "Homme — carrure moyenne" },
  m_med_nrw_body_mocap:   { genre: "M", label: "Homme — carrure moyenne (mocap)" },
  f_med_nrw_body_preview: { genre: "F", label: "Femme — carrure moyenne" },
  f_med_ovw_body_mocap:   { genre: "F", label: "Femme — carrure forte" },
};

/** Vêtements MetaHuman : slot et libellé, par nom de fichier exact.
 *  Écrits à la main : quatorze entrées dont le nommage n'a aucune régularité
 *  exploitable (`SK_Yogaful_1` contre `m_med_nrw_btm_cargopants_High`). Une
 *  heuristique s'y casserait, et un mauvais classement met une pièce dans un
 *  slot où le joueur ne la retrouvera jamais. */
const PIECES_MH = {
  m_med_nrw_top_hoodie_nrm_High:   { slot: "torse",  label: "Sweat à capuche", registre: "civil" },
  SK_Crewneckt_1:                  { slot: "torse",  label: "Col rond",        registre: "civil" },
  SK_Sweater_1:                    { slot: "torse",  label: "Pull",            registre: "civil" },
  m_med_nrw_btm_cargopants_High:   { slot: "jambes", label: "Pantalon cargo",  registre: "civil" },
  SK_Cargopants_1:                 { slot: "jambes", label: "Cargo",           registre: "civil" },
  SK_Jeans_nrw_1:                  { slot: "jambes", label: "Jean",            registre: "civil" },
  SK_Yogaful_1:                    { slot: "jambes", label: "Legging",         registre: "civil" },
  m_med_nrw_shs_runningshoes_High: { slot: "pieds",  label: "Baskets",         registre: "civil" },
  SK_RunningShoes_nrw1:            { slot: "pieds",  label: "Baskets",         registre: "civil" },
  SK_Flats_1:                      { slot: "pieds",  label: "Ballerines",      registre: "civil" },
};

// ── QUATRIÈME SOURCE : les vêtements MetaCustom du pack cuit ─────────────────
//
// Ces pièces n'ont AUCUN GLB d'origine : ce sont des `.uasset` copiés dans
// l'ADK puis cuits (mesuré dans docs/MODULAR_GARDEROBE_CUITE.md §3). Leur seule
// source de vérité est donc `Assets.toml` — régénéré à chaque cook, il porte
// les CLÉS dédupliquées que le client résout.
//
// ⚠ LA CLÉ toml N'EST PAS LE NOM DU FICHIER : `SK_Pants_2` pointe sur
// `.../Metahuman_Tall_Medium_Male/SK_Pants` (le constructeur de pack suffixe
// les doublons plutôt que d'écraser). On lit la CLÉ, jamais le basename du
// chemin — sinon références mortes.
//
// ── LA GARDE : SQUELETTE NON PROUVÉ = NE SORT PAS ────────────────────────────
// Mesuré le 2026-09-09 par extraction de chaînes dans les `.uasset` : ces
// pièces sont liées à `Skel_Dummy` (et `metahuman_base_skel` pour SK_Dress),
// des squelettes de type MetaHuman à plusieurs centaines d'os — PAS aux 68 de
// SKEL_Mannequin. `AddSkeletalMeshAttached` exige le même squelette : elles
// seraient refusées à l'attachement, sans la moindre erreur.
//
// La preuve de compatibilité est un MANIFESTE, pas un drapeau : écrit par
// l'audit de squelettes après rebind + cook, il liste les clés toml vérifiées.
// Tant qu'il n'existe pas, TOUTES les pièces sortent en EXCLUSES motivées —
// comptées et listées, jamais ignorées en silence. Le jour où le manifeste
// paraît, les pièces prouvées entrent au catalogue sans retouche de ce fichier.
const ASSETS_TOML =
  "E:/narvosprime-web-prototype/WebPortal/Server/Assets/narvos/Assets.toml";

const MANIFESTE_METACUSTOM =
  "E:/narvosprime-web-prototype/WebPortal/Server/adk/_manifests/metacustom-squelettes.json";

/** Corps de base MetaCustom. Classés « corps » par proximité avec les textures
 *  `Body_Skin_*` du dossier femme — la nature exacte de SK_MetaP/SK_MetaP1
 *  n'est PAS prouvée (docs/MODULAR_GARDEROBE_CUITE.md §7). */
const CORPS_METACUSTOM = {
  SK_Meta_Female_Base: { genre: "F", label: "Corps femme MetaCustom" },
  SK_MetaP:            { genre: "F", label: "Corps femme MetaCustom (P)" },
  SK_MetaP1:           { genre: "F", label: "Corps femme MetaCustom (P1)" },
};

/** Les 37 vêtements MetaCustom : slot, libellé, registre, genre.
 *
 *  Écrits à la main, comme PIECES_MH : le nommage n'a aucune régularité
 *  exploitable (`SK_Set_3_Work_Skirt` contre `Sk_UpperArmor1`), et un mauvais
 *  classement met une pièce dans un slot où le joueur ne la retrouvera jamais.
 *
 *  Genre : déduit du CHEMIN toml (`..._Female/`, `F_Tal...` → F ; `..._Male/`,
 *  `M_Tal...` → M) et recoupé avec cette table à la lecture — un désaccord est
 *  signalé. Genre "*" = le chemin ne tranche pas (dossiers Underwear_Remover
 *  et Meta_Body_Tool) ; à confirmer à l'import.
 *
 *  Une pièce « tout-en-un » (robe, combinaison, ensemble une pièce) est rangée
 *  au slot DOMINANT `torse` : elle recouvre les jambes, et le mélange des
 *  volumes est de toute façon refusé par ValiderTenue au niveau famille.
 *
 *  `taille` est un slot NOUVEAU (ceintures, bretelles) : il n'est écrit dans
 *  `Modular.SLOTS` que si une pièce VIVANTE l'occupe — aujourd'hui aucune, la
 *  garde exclut tout. */
const PIECES_METACUSTOM = {
  // — Civil, femme (Metahuman_Tall_Medium_Female et F_Tal_Nrm_*) —
  SK_1_peace:                  { slot: "torse",  label: "Ensemble une pièce",        registre: "civil", genre: "F" },
  SK_Belt:                     { slot: "taille", label: "Ceinture",                  registre: "civil", genre: "F" },
  SK_Boots:                    { slot: "pieds",  label: "Bottes",                    registre: "civil", genre: "F" },
  SK_Dress:                    { slot: "torse",  label: "Robe",                      registre: "civil", genre: "F" },
  SK_Dress_Sim:                { slot: "torse",  label: "Robe (physique simulée)",   registre: "civil", genre: "F" },
  SK_Pants:                    { slot: "jambes", label: "Pantalon",                  registre: "civil", genre: "F" },
  SK_Sci_Fi_Jumpsuit:          { slot: "torse",  label: "Combinaison sci-fi",        registre: "civil", genre: "F" },
  SK_Set_1Shorts:              { slot: "jambes", label: "Short",                     registre: "civil", genre: "F" },
  SK_Set_1_Crop_Top:           { slot: "torse",  label: "Crop top",                  registre: "civil", genre: "F" },
  SK_Set_2_Pants:              { slot: "jambes", label: "Pantalon",                  registre: "civil", genre: "F" },
  SK_Set_3_Work_Skirt:         { slot: "jambes", label: "Jupe de travail",           registre: "civil", genre: "F" },
  SK_Set_3_Work_Top:           { slot: "torse",  label: "Haut de travail",           registre: "civil", genre: "F" },
  SK_Socks:                    { slot: "pieds",  label: "Chaussettes",               registre: "base",  genre: "F" },
  // — Civil, homme (Metahuman_Tall_Medium_Male et M_Tal_Nrm_*) —
  SK_Boots_2:                  { slot: "pieds",  label: "Bottes",                    registre: "civil", genre: "M" },
  SK_Inner_Clothing:           { slot: "torse",  label: "Sous-vêtements",            registre: "base",  genre: "M" },
  SK_Jacket:                   { slot: "torse",  label: "Veste",                     registre: "civil", genre: "M" },
  SK_Pants3:                   { slot: "jambes", label: "Pantalon",                  registre: "civil", genre: "M" },
  // ⚠ La clé est SK_Pants_2, le FICHIER est SK_Pants : la clé fait foi.
  SK_Pants_2:                  { slot: "jambes", label: "Pantalon",                  registre: "civil", genre: "M" },
  SK_Shirt:                    { slot: "torse",  label: "Chemise",                   registre: "civil", genre: "M" },
  SK_Shirt2:                   { slot: "torse",  label: "Chemise médiévale",         registre: "civil", genre: "M" },
  SK_SocksM:                   { slot: "pieds",  label: "Chaussettes",               registre: "base",  genre: "M" },
  SK_Suspenders:               { slot: "taille", label: "Bretelles",                 registre: "civil", genre: "M" },
  // — Guerre / uniforme —
  SK_Barbarian_Male:           { slot: "torse",  label: "Tenue de barbare",          registre: "guerre",   genre: "M" },
  SK_Fantasy_Outfit_F_Tal_Med1:{ slot: "torse",  label: "Tenue fantasy",             registre: "guerre",   genre: "F" },
  SK_Fantasy_outfit_1:         { slot: "torse",  label: "Tenue fantasy",             registre: "guerre",   genre: "F" },
  SK_Helmet1:                  { slot: "tete",   label: "Heaume",                    registre: "guerre",   genre: "F" },
  SK_LowerArmor1:              { slot: "jambes", label: "Jambières d'armure",        registre: "guerre",   genre: "F" },
  SK_Male_Armor_Bottoms:       { slot: "jambes", label: "Bas d'armure",              registre: "guerre",   genre: "M" },
  SK_Male_Armor_Top:           { slot: "torse",  label: "Plastron",                  registre: "guerre",   genre: "M" },
  SK_Male_Helmet:              { slot: "tete",   label: "Heaume",                    registre: "guerre",   genre: "M" },
  SK_Male_Police_Armor_Army:   { slot: "torse",  label: "Gilet pare-balles",         registre: "uniforme", genre: "M" },
  SK_Sci_Fi_Armor:             { slot: "torse",  label: "Armure sci-fi",             registre: "guerre",   genre: "F" },
  Sk_UpperArmor1:              { slot: "torse",  label: "Plastron",                  registre: "guerre",   genre: "F" },
  // — Chemin muet sur le genre : "*" à confirmer à l'import —
  SK_1_Piece:                  { slot: "torse",  label: "Ensemble une pièce",        registre: "civil", genre: "*" },
  SK_Boots_3:                  { slot: "pieds",  label: "Bottes",                    registre: "civil", genre: "*" },
  SK_Hat:                      { slot: "tete",   label: "Chapeau",                   registre: "civil", genre: "*" },
  SK_Waist_Shorts:             { slot: "jambes", label: "Short",                     registre: "base",  genre: "*" },
};

/** Entrées MetaCustom qui ne sont PAS des vêtements : rigs, mannequins
 *  d'atelier, outils du Meta Face/Body Tool. Elles sont EXCLUES avec motif,
 *  pour que la garde rende compte de chacune des clés lues. */
const HORS_GARDEROBE_METACUSTOM = {
  Barbarian_Remover:     "rig de retrait, pas un vêtement",
  Rogue_Rig:             "rig, pas un vêtement",
  SK_CyborgHeadArms:     "outil du Meta Body Tool, pas un vêtement",
  SK_CyborgHeadArms_2:   "outil du Meta Face Tool, pas un vêtement",
  SK_Dummy_F_Tal_Med:    "mannequin d'atelier du Meta Body Tool",
  SK_Dummy_F_Tal_Med_2:  "mannequin d'atelier du Meta Face Tool",
  SK_Dummy_Live_Retarget:"cible de retargeting d'atelier",
  SK_Goggles:            "accessoire du Meta Face Tool — pas un slot dédié",
  SK_Horns:              "accessoire du Meta Face Tool — pas un slot dédié",
  SK_M:                  "outil du Meta Face Tool",
  SK_Mask:               "accessoire du Meta Face Tool — pas un slot dédié",
  SK_Mask_R:             "accessoire du Meta Face Tool — pas un slot dédié",
  SK_Orc:                "tête d'outil du Meta Face Tool",
  SK_Pierc:              "accessoire du Meta Face Tool — pas un slot dédié",
  SK_head2:              "tête d'outil du Meta Face Tool",
  Sk_head:               "tête d'outil du Meta Face Tool",
  Sk_Staff:              "un bâton, pas un vêtement",
};
// ── TROISIÈME SOURCE : SciFi_Trooper_Set ─────────────────────────────────────
//
// 94 pièces d'armure militaire futuriste, vérifiées IDENTIQUE (68 os, hiérarchie
// comprise) le 2026-09-03. Trente-huit d'entre elles ont demandé un renommage de
// l'os racine — `Root` au lieu de `root`, une seule majuscule — via
// scripts/narvos-renommer-os.mjs ; d'où les DEUX dossiers ci-dessous.
//
// ⚠ TROIS MORPHOLOGIES, DONC TROIS FAMILLES. Le pack livre M, F et PF (petite
// female), chacune avec son armure taillée : `SK_PF_Trooper_Chest` ne va pas sur
// un corps M. Les mêler donnerait une interpénétration visible et
// incompréhensible — c'est précisément ce que la famille interdit.
/** Manifeste de SQUELETTE du pack Trooper — la preuve, clé par clé.
 *
 *  ⚠ LA SOURCE A CHANGÉ LE 2026-09-12, ET C'EST LA CORRECTION D'UN SILENCE.
 *  Ce bloc lisait deux dossiers de GLB filtrés par les manifestes d'IMPORT. Il
 *  produisait 94 pièces dont AUCUNE n'atteignait le catalogue : les familles
 *  `trooper_*` n'avaient aucun corps retenu, et la règle « famille sans corps =
 *  pièces orphelines » les écartait toutes, en une ligne de console que
 *  personne ne relisait. Retour de jeu de Hanibes, 2026-09-12 : « il n'y a pas
 *  l'intégralité des corps et vêtements dans la création ». Il avait raison :
 *  le pack en cuit 67, l'écran en proposait zéro.
 *
 *  On lit désormais `Assets.toml` — la seule liste de ce qui est RÉELLEMENT
 *  livré au client — filtrée par le manifeste de squelette écrit par
 *  `scripts/narvos-manifeste-squelettes.mjs`. Il prouve, clé par clé, que le
 *  mesh est lié à SKEL_Mannequin : `AddSkeletalMeshAttached` exige le même
 *  squelette que le corps, et une pièce d'un autre squelette ne lève RIEN, elle
 *  ne s'affiche pas. Mesuré : 67 clés Trooper, 67 sur SKEL_Mannequin.
 *
 *  Les clés du pack et les noms de fichiers GLB coïncident pour ce pack (67/67
 *  vérifiées) : les motifs de nommage plus bas restent valables tels quels. */
const MANIFESTE_TROOPER =
  "E:/narvosprime-web-prototype/WebPortal/Server/adk/_manifests/trooper-squelettes.json";

/** Manifeste de squelette du modulaire Defender (têtes, bustes, jambes). */
const MANIFESTE_DEFENDER =
  "E:/narvosprime-web-prototype/WebPortal/Server/adk/_manifests/defender-squelettes.json";

/** Clés prouvées attachables, lues dans un manifeste de squelette.
 *  Absent ou vide : rien ne sort de cette famille, et on le DIT — un catalogue
 *  silencieusement amputé est exactement le défaut qu'on vient de payer. */
function clesProuvees(manifeste, quoi) {
  if (!fs.existsSync(manifeste)) {
    console.error(`ATTENTION manifeste de squelette absent : ${manifeste}`);
    console.error(`  ${quoi} n'entrera pas au catalogue. Le produire :`);
    console.error("  node scripts/narvos-manifeste-squelettes.mjs --apply");
    return [];
  }
  const lu = JSON.parse(fs.readFileSync(manifeste, "utf8"));
  const cles = lu.compatibles ?? [];
  const ailleurs = Object.keys(lu.autres ?? {}).length;
  console.log(`  ${quoi} : ${cles.length} clé(s) prouvée(s) sur ${lu.squelette_cible}`
    + (ailleurs ? `, ${ailleurs} écartée(s) (autre squelette)` : ""));
  return cles;
}

const NOMS_TROOPER = clesProuvees(MANIFESTE_TROOPER, "Trooper");
const NOMS_DEFENDER = clesProuvees(MANIFESTE_DEFENDER, "Defender modulaire");

/** Préfixe de morphologie -> (famille, genre affiché). */
const MORPHO_TROOPER = {
  Male:            { famille: "trooper_m",  genre: "M" },
  M:               { famille: "trooper_m",  genre: "M" },
  Female:          { famille: "trooper_f",  genre: "F" },
  F:               { famille: "trooper_f",  genre: "F" },
  Petite_Female:   { famille: "trooper_pf", genre: "F" },
  PF:              { famille: "trooper_pf", genre: "F" },
};

/** Motif de nom -> slot. Le PREMIER qui correspond gagne : l'ordre compte, car
 *  `Upper_with_Shoulders_A` doit tomber dans « torse » et pas dans « epaules ». */
const SLOTS_TROOPER = [
  // ⚠ AVANT `^Head` : l'ordre de ce tableau decide, et une regle plus large
  // ajoutee plus tard capterait tout.
  //
  // Les cheveux vont au slot `tete`, LE MEME que les casques. Physiquement une
  // seule chose tient sur un crane, et la garde-robe recouvre l'apparence :
  // coiffer un casque chasse la coiffure, l'oter la rend. Deux slots separes
  // laisseraient les cheveux traverser le heaume.
  //
  // La barbe a son slot : elle coexiste avec n'importe quelle coiffure et
  // n'importe quel casque.
  [/^Hair/i,            "tete"],
  [/^Beard|^Mustache/i, "barbe"],
  [/^Head/i,            "tete"],
  [/^Shoulders/i,       "epaules"],
  [/^Upper|^Chest/i,    "torse"],
  [/^Arms/i,            "bras"],
  [/^Hands/i,           "mains"],
  [/^Shoes|^Lower_shoes/i, "pieds"],
  [/^Feet/i,            "pieds"],
  [/^Legs|^Lower/i,     "jambes"],
];

/** Libellés lisibles, pour l'écran de création. */
const LABELS_TROOPER = {
  Head_A: "Casque A", Head_B: "Casque B",
  Shoulders_A: "Épaulières A", Shoulders_B: "Épaulières B", Shoulders_C: "Épaulières C",
  Chest: "Plastron", Upper_noarms: "Buste sans bras",
  Upper_with_Hands: "Buste et mains", Upper_without_hands: "Buste sans mains",
  Upper_with_Shoulders_A: "Buste et épaulières",
  Arms_with_Hands: "Bras et mains", Arms_without_Hands: "Bras seuls",
  Hands: "Gants", Legs: "Jambières", Lower_with_Feet: "Bas et bottes",
  Lower_legs_only: "Jambières seules", Lower_shoes_only: "Bottes seules",
  Shoes: "Bottes", Head: "Tête", Feet: "Pieds", Upper: "Buste",
  Lower: "Bas", Upper_with_hands: "Buste et mains", Lower_with_feet: "Bas et pieds",
  // Coiffures et barbes. Les noms du pack decrivent la coupe, pas le slot :
  // les traduire evite « Hair Medium top only » dans l'ecran de creation.
  Hair_70s: "Coupe 70s", Hair_long: "Cheveux longs", Hair_Long: "Cheveux longs",
  Hair_Short: "Cheveux courts", Hair_Buns: "Chignons",
  Hair_Buns_top_only: "Chignons (dessus)",
  Hair_Medium_top_only: "Mi-longs (dessus)",
  Hair_Medium_with_sides: "Mi-longs avec cotes",
  Hair_Thin_top_only: "Fins (dessus)",
  Hair_Thin_with_sides: "Fins avec cotes",
  Hair_Old_man: "Cheveux clairsemes",
  Hair_Bandana_knot: "Bandana noue", Hair_Bandana_strap: "Bandana",
  Hair_long_with_bandana_strap: "Cheveux longs et bandana",
  Hair_Long_with_bandana_strap: "Cheveux longs et bandana",
  Hair_Short_with_bandana_strap: "Cheveux courts et bandana",
  Beard: "Barbe", Beard_Thin: "Barbe fine",
};

const CIBLE = "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/Modular.lua";
const PACK = "narvos";

const APPLY = process.argv.includes("--apply");

/** Slot d'équipement. `gloves` et `helm`/`balaclava` sont des synonymes du pack. */
const SLOTS = {
  Face: "visage",
  Chest: "torse",
  Legs: "jambes",
  Hands: "mains",
  Gloves: "mains",
  Helm: "tete",
  Balaclava: "tete",
};

/** Variantes traduites. Les noms du pack sont anglais et techniques : sur
 *  l'ecran de creation, « Visage — Default » et « Corps nu — Chest » sont des
 *  etiquettes de fichier, pas des choix qu'on presente a un joueur. */
const VARIANTES_FR = {
  African: "Africain",
  Asian: "Asiatique",
  Default: "Europeen",
  Face: "Neutre",
  Chest: "Buste",
  Hands: "Mains",
  Legs: "Jambes",
  Head: "Tete",
  Feet: "Pieds",
};

/** Libellés français des ensembles, pour l'écran de création. */
const ENSEMBLES = {
  Body: { label: "Corps nu", registre: "base" },
  BodyFace: { label: "Visage", registre: "base" },
  Aviator: { label: "Aviateur", registre: "civil" },
  Casual: { label: "Civil", registre: "civil" },
  Smoking: { label: "Smoking", registre: "civil" },
  Cop: { label: "Police", registre: "uniforme" },
  Soldier: { label: "Soldat", registre: "guerre" },
  SpaceSuit: { label: "Combinaison spatiale", registre: "guerre" },
};

/**
 * Décompose un nom de pièce en (genre, ensemble, slot, variante).
 * Rend `null` sur ce qu'on ne sait pas classer — jamais un rangement par défaut.
 */
const decomposer = (nom) => {
  // ── Cas nommés d'abord : voir « LE PIÈGE DU NOMMAGE » en tête de fichier.
  //    Ces quatre formes DOIVENT être reconnues avant tout découpage générique.

  // FemaleBody_AfricanFace / FemaleBody_Face  -> tête femme
  let m = nom.match(/^FemaleBody_(.*?)Face$/);
  if (m) {
    return { genre: "F", ensemble: "BodyFace", slot: "visage", variante: m[1] || "Default" };
  }

  // BodyFace_African  -> tête homme
  m = nom.match(/^BodyFace_(.+)$/);
  if (m) {
    return { genre: "M", ensemble: "BodyFace", slot: "visage", variante: m[1] };
  }

  // Female_Balaclava  -> pièce femme sans ensemble explicite
  m = nom.match(/^Female_(Balaclava|Helm|Gloves)$/);
  if (m) {
    return { genre: "F", ensemble: "Soldier", slot: SLOTS[m[1]], variante: m[1] };
  }

  // ── Formes régulières : [Female_]<Ensemble>_<Slot>
  const feminin = nom.startsWith("Female_");
  const reste = feminin ? nom.slice("Female_".length) : nom;

  const i = reste.lastIndexOf("_");
  if (i < 0) return null;

  const ensemble = reste.slice(0, i);
  const brut = reste.slice(i + 1);
  const slot = SLOTS[brut];

  if (!slot || !ENSEMBLES[ensemble]) return null;

  return { genre: feminin ? "F" : "M", ensemble, slot, variante: brut };
};

/** Identifiant stable : minuscules, sans accent, unique par pièce. */
const identifiant = (d) =>
  [d.ensemble, d.variante, d.genre].join("_").toLowerCase().replace(/[^a-z0-9_]/g, "");

// ── Lecture ───────────────────────────────────────────────────────────────────

if (!fs.existsSync(EXPORT)) {
  console.error(`Dossier d'export introuvable : ${EXPORT}`);
  console.error("Lancer d'abord adk-export-echantillon.py sur le pack Stylized Modular.");
  process.exit(1);
}

const fichiers = fs
  .readdirSync(EXPORT)
  .filter((f) => f.toLowerCase().endsWith(".glb"))
  .sort();

let pieces = [];
const refuses = [];

for (const f of fichiers) {
  // `smc__SK_Soldier_Chest.glb` -> asset `smc__SK_Soldier_Chest`, nom `Soldier_Chest`
  const asset = f.replace(/\.glb$/i, "");
  const nom = asset.replace(/^smc__SK_/, "");

  const d = decomposer(nom);
  if (!d) {
    refuses.push(nom);
    continue;
  }

  pieces.push({
    id: identifiant(d),
    asset: `${PACK}::${asset}`,
    ...d,
    // ── LE LIBELLE EST CE QUE LE JOUEUR LIT ───────────────────────────────
    //
    // `Visage — African` devient `Africain` : dans l'ecran, la variante suffit,
    // le slot est deja le titre du bloc. Repeter « Visage » sur chaque carte
    // d'un bloc intitule VISAGE n'ajoute rien et allonge la lecture.
    //
    // Les ensembles de VETEMENTS gardent leur prefixe : « Aviateur — Chest » et
    // « Police — Chest » sont deux tenues differentes au meme slot, et sans le
    // prefixe la boutique afficherait deux fois « Buste ».
    label: (() => {
      const variante = VARIANTES_FR[d.variante] ?? d.variante.replace(/_/g, " ");
      const ensemble = ENSEMBLES[d.ensemble];
      return ensemble.registre === "base" ? variante : `${ensemble.label} — ${variante}`;
    })(),
    registre: ENSEMBLES[d.ensemble].registre,
  });
}

// Une collision d'identifiant écraserait silencieusement une pièce : le
// catalogue annoncerait 40 entrées et n'en porterait que 38.
const vus = new Map();
for (const p of pieces) {
  if (vus.has(p.id)) {
    console.error(`COLLISION d'identifiant « ${p.id} » : ${vus.get(p.id)} et ${p.asset}`);
    process.exit(1);
  }
  vus.set(p.id, p.asset);
}

// ── Deuxième famille : lecture des MetaHuman ─────────────────────────────────
//
// On lit les dossiers SOURCE et non un export : ces GLB sont importés tels
// quels, et leur nom de fichier EST le nom d'asset dans le pack cuit.

let corps = [];

for (const racine of METAHUMAN_ACTIF ? METAHUMAN : []) {
  if (!fs.existsSync(racine)) {
    console.error(`ATTENTION source MetaHuman absente : ${racine}`);
    continue;
  }

  const parcourir = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const chemin = path.join(d, e.name);
      if (e.isDirectory()) { parcourir(chemin); continue; }
      if (!e.name.toLowerCase().endsWith(".glb")) continue;

      const nom = e.name.replace(/\.glb$/i, "");

      const c = CORPS_MH[nom];
      if (c) {
        corps.push({
          id: nom.toLowerCase(),
          asset: `${PACK}::${nom}`,
          genre: c.genre,
          famille: "metahuman",
          label: c.label,
        });
        continue;
      }

      const v = PIECES_MH[nom];
      if (v) {
        // Genre "*" : ces vêtements MetaHuman sont skinnés sur une base commune,
        // un seul mesh sert aux deux corps. Le pack Stylized, lui, livre chaque
        // pièce en version homme ET femme.
        pieces.push({
          id: nom.toLowerCase(),
          asset: `${PACK}::${nom}`,
          genre: "*",
          famille: "metahuman",
          ensemble: "MetaHuman",
          slot: v.slot,
          variante: nom,
          label: v.label,
          registre: v.registre,
        });
      }
    }
  };
  parcourir(racine);
}

// ── Lecture des MetaCustom depuis Assets.toml ────────────────────────────────
//
// La garde compte ici : chaque clé lue finit exactement UNE fois — pièce ou
// corps émis, EXCLU avec motif, ou REFUSÉ non classé. Rien ne se perd en
// silence, et une garde qui ne trouve rien à vérifier ARRÊTE le générateur
// plutôt que de se taire.

const excluesMetaCustom = [];      // { cle, motif } — jamais émises
let emisesMetaCustom = 0;          // pièces + corps réellement poussés

/** Genre déduit du chemin toml, ou null si le chemin ne tranche pas. */
const genreParChemin = (c) =>
  /Female|F_Tal/i.test(c) ? "F" : /Male|M_Tal/i.test(c) ? "M" : null;

const metaCles = [];               // { cle, chemin }
const blueprintsCuits = new Set();  // les cles de [assets.blueprints]

// ── LE PORTEUR, RETROUVE PAR SON CHEMIN ──────────────────────────────────────
// Jusqu'au 2026-09-13 ce fichier ecrivait `SKM_Manny_3` en dur, a trois
// endroits. Or ce suffixe n'est PAS un nom : c'est le rang que le constructeur
// du pack donne aux homonymes (`nanos-build-asset-pack.mjs`, dedoublonnage par
// ordre de dossier). Aujourd'hui `SKM_Manny` = BaconCombatGraphU, `_2` =
// BlacksmithAnimations, `_3` = Defender. Le premier pack promu dont le dossier
// trie avant `Defender` et qui livre un `SKM_Manny` — AIBehaviorSystem en a un —
// decalerait tout d'un cran : `SKM_Manny_3` designerait le Manny de Blacksmith,
// la cle existerait toujours, et aucun controle d'existence ne verrait que le
// porteur de TOUS les corps MetaHuman a change de squelette.
// On lit donc la cle dont le CHEMIN est celui du Manny de Defender.
const CHEMIN_PORTEUR = "Narvos/Defender/Demo/Characters/Manny/SKM_Manny";
// Le porteur des corps MetaHuman (voir plus bas) : contenu du pack de BASE nanos,
// present chez chaque client, controle par le verificateur (« nanos-world:: »).
const PORTEUR_METAHUMAIN = "nanos-world::SK_Mannequin";
let clePorteur = null;
const CLE_TOML = new RegExp('^\\s*(?:"((?:[^"\\\\]|\\\\.)*)"|([A-Za-z0-9_-]+))\\s*=\\s*"([^"]+)"');
{
  if (!fs.existsSync(ASSETS_TOML)) {
    console.error(`ARRÊT : Assets.toml introuvable : ${ASSETS_TOML}`);
    console.error("  Construire d'abord le pack : node scripts/nanos-build-asset-pack.mjs --apply");
    process.exit(1);
  }
  const toml = fs.readFileSync(ASSETS_TOML, "utf8");
  let sectionVue = false;
  let dansSk = false;
  for (const ligne of toml.split(/\r?\n/)) {
    const s = ligne.match(/^\s*\[([^\]]+)\]\s*$/);
    if (s) {
      dansSk = s[1] === "assets.skeletal_meshes";
      if (dansSk) sectionVue = true;
      continue;
    }
    if (!dansSk) continue;
    // Deux formes de clé : nue, ou quotée quand elle porte un caractère non
    // légal en clé TOML nue. Lire les DEUX (voir narvos-anims-to-lua.mjs).
    const m = ligne.match(/^\s*(?:"((?:[^"\\]|\\.)*)"|([A-Za-z0-9_-]+))\s*=\s*"([^"]+)"/);
    if (!m) continue;
    const cle = m[1] !== undefined ? JSON.parse(`"${m[1]}"`) : m[2];
    if (m[3].startsWith("Narvos/MetaCustom/")) metaCles.push({ cle, chemin: m[3] });
    if (m[3] === CHEMIN_PORTEUR) clePorteur = cle;
  }
  if (!sectionVue) {
    console.error("ARRÊT : section [assets.skeletal_meshes] absente d'Assets.toml.");
    process.exit(1);
  }
  if (clePorteur === null) {
    console.error(`ARRÊT : le porteur ${CHEMIN_PORTEUR} n'est pas dans [assets.skeletal_meshes].`);
    console.error("  Sans lui, les familles Defender et MetaHuman n'ont plus de squelette a animer.");
    process.exit(1);
  }

  // ── LES BLUEPRINTS REELLEMENT CUITS ────────────────────────────────────────
  // Un corps MetaHuman est un Blueprint : il ne sort du cook que si sa CLASSE
  // PARENTE en sort aussi. `BP_MH_Male_Playable` derive de
  // `BP_ThirdPersonCharacter`, jamais promu sous Narvos/ — il n'est donc pas
  // cuit, et le declarer produirait une reference morte que seul le
  // verificateur attraperait. Mesure du 2026-09-12 : 5 des 7 sont dans ce cas.
  let dansBp = false;
  for (const ligne of toml.split(new RegExp('\\r?\\n'))) {
    const sec = ligne.match(new RegExp('^\\s*\\[([^\\]]+)\\]\\s*$'));
    if (sec) { dansBp = sec[1] === "assets.blueprints"; continue; }
    if (!dansBp) continue;
    const m = ligne.match(CLE_TOML);
    if (!m) continue;
    blueprintsCuits.add(m[1] !== undefined ? JSON.parse(`"${m[1]}"`) : m[2]);
  }
  // UNE GARDE QUI NE TROUVE RIEN NE SE TAIT PAS : la famille MetaCustom est
  // cuite dans le pack depuis le 09/09. Zéro clé lue = filtre cassé ou pack
  // amputé — dans les deux cas on s'arrête plutôt que de générer sans elle.
  if (metaCles.length === 0) {
    console.error("ARRÊT : aucune entrée Narvos/MetaCustom/ dans [assets.skeletal_meshes].");
    console.error("  La garde n'a rien à vérifier : le pack a perdu la famille, ou le filtre est cassé.");
    process.exit(1);
  }
}

// La preuve de compatibilité squelette, clé par clé. Absent ou vide : rien ne
// passe, et c'est le bon échec — aujourd'hui TOUT est lié à Skel_Dummy.
const prouvesMetaCustom = new Set(
  fs.existsSync(MANIFESTE_METACUSTOM)
    ? (JSON.parse(fs.readFileSync(MANIFESTE_METACUSTOM, "utf8")).compatibles ?? [])
    : [],
);

// ── SORTIE PNJ SIMPLE (2026-09-19) ─────────────────────────────────────────────
// Le manifeste liste `autres` : pièce -> squelette RÉEL. Une pièce sur
// `Skel_Dummy` est refusée à un `Character` (Mannequin) mais ATTACHABLE à un
// `CharacterSimple` dont le corps est aussi `Skel_Dummy` — `AddSkeletalMeshAttached`
// exige le MÊME squelette, pas le Mannequin en soi. C'est le chemin des PNJ
// civils MetaCustom : ces pièces sortent avec `pnj_simple = true`, jamais
// proposées au joueur (ValiderTenue + JOUABLES ne les voient pas).
const squelettesMetaCustom = fs.existsSync(MANIFESTE_METACUSTOM)
  ? (JSON.parse(fs.readFileSync(MANIFESTE_METACUSTOM, "utf8")).autres ?? {})
  : {};
const prouvesMetaCustomPnj = new Set(
  Object.entries(squelettesMetaCustom)
    .filter(([, squelette]) => squelette === "Skel_Dummy")
    .map(([cle]) => cle),
);
for (const cle of prouvesMetaCustom) {
  if (!metaCles.some((m) => m.cle === cle)) {
    console.error(`ATTENTION ${MANIFESTE_METACUSTOM} prouve « ${cle} », absente d'Assets.toml — référence morte à l'envers.`);
  }
}

for (const { cle, chemin } of metaCles) {
  const hors = HORS_GARDEROBE_METACUSTOM[cle];
  if (hors) {
    excluesMetaCustom.push({ cle, motif: `hors garde-robe : ${hors}` });
    continue;
  }

  const c = CORPS_METACUSTOM[cle];
  const v = PIECES_METACUSTOM[cle];
  if (!c && !v) {
    // Ni pièce, ni corps, ni hors garde-robe connu : REFUSÉ, jamais rangé au
    // hasard — la même règle que pour le pack Stylized.
    refuses.push(`MetaCustom/${cle}`);
    continue;
  }

  // Recoupement genre table <-> chemin : la table est écrite à la main, le
  // chemin est mesuré. Un désaccord dit que l'un des deux ment.
  const gc = genreParChemin(chemin);
  const g = (c ?? v).genre;
  if (gc && g !== "*" && gc !== g) {
    console.error(`ATTENTION ${cle} : genre « ${g} » dans la table, « ${gc} » d'après le chemin ${chemin}`);
  }

  // ── LA GARDE ──
  // 1. Prouvé Mannequin (manifeste.compatibles) : sortie JOUEUR.
  // 2. Sinon, squelette Skel_Dummy (manifeste.autres) : sortie PNJ SIMPLE —
  //    attachable à un CharacterSimple au corps Skel_Dummy, jamais au joueur.
  // 3. Sinon : exclue, avec le squelette réel dans le motif.
  let pnj_simple = false;
  if (!prouvesMetaCustom.has(cle)) {
    if (prouvesMetaCustomPnj.has(cle)) {
      pnj_simple = true;
    } else {
      excluesMetaCustom.push({
        cle,
        nature: c ? "corps" : "pièce",
        motif: "squelette « " + (squelettesMetaCustom[cle] ?? "introuvable") + " » — ni Mannequin (joueur), ni Skel_Dummy (PNJ simple)",
      });
      continue;
    }
  }

  if (c) {
    corps.push(Object.assign({
      id: cle.toLowerCase(), asset: `${PACK}::${cle}`,
      genre: c.genre, famille: "metacustom", label: c.label,
    }, pnj_simple ? { pnj_simple: true } : {}));
    emisesMetaCustom++;
    continue;
  }

  const id = cle.toLowerCase();
  if (vus.has(id)) {
    console.error(`COLLISION d'identifiant « ${id} » : ${vus.get(id)} et ${PACK}::${cle}`);
    process.exit(1);
  }
  vus.set(id, `${PACK}::${cle}`);
  pieces.push(Object.assign({
    id, asset: `${PACK}::${cle}`, genre: v.genre, famille: "metacustom",
    ensemble: "MetaCustom", slot: v.slot, variante: cle,
    label: v.label, registre: v.registre,
  }, pnj_simple ? { pnj_simple: true } : {}));
  emisesMetaCustom++;
}

// Invariant relationnel : rien de lu ne se perd. Pas de nombre en dur — on
// affirme que la somme des issues égale le nombre de clés lues.
{
  const refuseesMC = refuses.filter((r) => r.startsWith("MetaCustom/")).length;
  if (emisesMetaCustom + excluesMetaCustom.length + refuseesMC !== metaCles.length) {
    console.error(
      `INVARIANT CASSÉ : ${metaCles.length} clés MetaCustom lues, `
      + `${emisesMetaCustom} émises, ${excluesMetaCustom.length} exclues, ${refuseesMC} refusées.`,
    );
    process.exit(1);
  }
}

// ── Lecture de SciFi_Trooper_Set ─────────────────────────────────────────────
//
// Un nom peut apparaître dans les DEUX dossiers (l'original et le renommé) : on
// garde le renommé, seul importable. D'où le dédoublonnage par identifiant.

const vusTrooper = new Set();

for (const nom of NOMS_TROOPER) {
    {
      // Formes de corps nues : `SK_<Morpho>_Form_<Partie>`
      let m = nom.match(/^SK_(Petite_Female|Male|Female)_Form_(.+)$/);
      if (m) {
        const mo = MORPHO_TROOPER[m[1]];
        const partie = m[2];

        // `Standalone` est un CORPS complet ; `_template` est une référence
        // d'atelier, sans intérêt en jeu.
        if (/_template$/i.test(partie)) continue;

        if (/^Standalone$/i.test(partie)) {
          const id = nom.toLowerCase();
          if (vusTrooper.has(id)) continue;
          vusTrooper.add(id);
          corps.push({
            id, asset: `${PACK}::${nom}`, genre: mo.genre, famille: mo.famille,
            label: `Trooper — ${m[1].replace(/_/g, " ")}`,
          });
          continue;
        }

        const regle = SLOTS_TROOPER.find(([r]) => r.test(partie));
        if (!regle) { refuses.push(nom); continue; }

        const id = nom.toLowerCase();
        if (vusTrooper.has(id)) continue;
        vusTrooper.add(id);
        pieces.push({
          id, asset: `${PACK}::${nom}`, genre: mo.genre, famille: mo.famille,
          ensemble: "Corps nu", slot: regle[1], variante: partie,
          label: `Corps nu — ${LABELS_TROOPER[partie] ?? partie.replace(/_/g, " ")}`,
          registre: "base",
        });
        continue;
      }

      // Armure : `SK_<M|F|PF>_Trooper_<Piece>`
      m = nom.match(/^SK_(PF|M|F)_Trooper_(.+)$/);
      if (m) {
        const mo = MORPHO_TROOPER[m[1]];
        let piece = m[2];

        // Les `standalone_*` sont des corps entiers deja armures.
        if (/^standalone/i.test(piece)) {
          const id = nom.toLowerCase();
          if (vusTrooper.has(id)) continue;
          vusTrooper.add(id);
          corps.push({
            id, asset: `${PACK}::${nom}`, genre: mo.genre, famille: mo.famille,
            label: `Trooper armuré — ${piece.replace(/_/g, " ")}`,
          });
          continue;
        }

        // `_thin` est une coupe alternative, pas un slot different.
        const fin = /_thin$/i.test(piece);
        if (fin) piece = piece.replace(/_thin$/i, "");

        const regle = SLOTS_TROOPER.find(([r]) => r.test(piece));
        if (!regle) { refuses.push(nom); continue; }

        const id = nom.toLowerCase();
        if (vusTrooper.has(id)) continue;
        vusTrooper.add(id);

        // ── CHEVEUX ET BARBES : NI DE L'ARMURE, NI DU SKINNING ───────────────
        //
        // Mesure du 2026-09-04 sur les 127 GLB du pack : les coiffures portent
        // 2 os (`root_heaD`, `head_acc`), les pieces d'armure 68
        // (`root, pelvis, spine_01…`). Aucun recouvrement.
        //
        // `AddSkeletalMeshAttached` exige le meme squelette que le corps : une
        // coiffure y serait refusee. On l'attache au socket `head` — present
        // dans les 68 os — en StaticMesh, ce qui suffit pour un accessoire
        // rigide qui suit la tete.
        //
        // Et elles relevent de l'IDENTITE, pas de la boutique : une coupe de
        // cheveux se choisit a la creation et ne s'achete pas.
        const POIL = /^(Hair|Beard|Mustache)/i.test(piece);

        pieces.push({
          id, asset: `${PACK}::${nom}`, genre: mo.genre, famille: mo.famille,
          ensemble: POIL ? "Coiffure" : "Trooper", slot: regle[1], variante: piece,
          label: (LABELS_TROOPER[piece] ?? piece.replace(/_/g, " ")) + (fin ? " (fin)" : ""),
          registre: POIL ? "base" : "guerre",
          ...(POIL ? { attache: "static", socket: "head" } : {}),
        });
      }
    }
}

// ── Modulaire DEFENDER : têtes, bustes, jambes ───────────────────────────────
//
// Le pack Defender livre un personnage modulaire UE4 : cinq têtes, cinq bustes,
// cinq bas de corps, plus les trois pièces de BASE dont ils sont des variantes.
// Squelette prouvé : 18 clés, 18 sur SKEL_Mannequin (manifeste du 2026-09-12).
//
// ⚠ GENRE ET FAMILLE. Ce sont les pièces du mannequin UE4 masculin : un seul
// jeu, une seule morphologie. Sa famille est donc à lui — un buste UE4 sur un
// corps Stylized ou Trooper s'interpénétrerait, et `ValiderTenue` refuse déjà le
// mélange. Le genre est "*" : rien dans ces meshes ne distingue M de F, et
// l'écran de création les propose aux deux plutôt que d'en priver la moitié des
// joueurs sur une supposition.
const SLOTS_DEFENDER = [
  [/^Head/i,  "tete"],
  [/^Torso/i, "torse"],
  [/^Legs/i,  "jambes"],
];

for (const nom of NOMS_DEFENDER) {
  const sansPrefixe = nom.replace(/^SK_/, "");
  const regle = SLOTS_DEFENDER.find(([r]) => r.test(sansPrefixe));
  if (!regle) { refuses.push(`Defender/${nom}`); continue; }

  // `SK_HeadBase` est la pièce NUE, `SK_Head3` une variante habillée : le
  // registre décide ce qu'un personnage neuf porte avant tout choix.
  const base = /Base$/i.test(sansPrefixe);
  const numero = (sansPrefixe.match(/(\d+)$/) || [])[1];

  const id = `defender_${sansPrefixe.toLowerCase()}`;
  if (vus.has(id)) {
    console.error(`COLLISION d'identifiant « ${id} » : ${vus.get(id)} et ${PACK}::${nom}`);
    process.exit(1);
  }
  vus.set(id, `${PACK}::${nom}`);

  const LIBELLE_SLOT = { tete: "Tête", torse: "Buste", jambes: "Jambes" };
  pieces.push({
    id,
    asset: `${PACK}::${nom}`,
    genre: "*",
    famille: "defender",
    ensemble: base ? "Corps nu" : "Defender",
    slot: regle[1],
    variante: sansPrefixe,
    label: base
      ? `${LIBELLE_SLOT[regle[1]]} nue`
      : `${LIBELLE_SLOT[regle[1]]} ${numero ?? sansPrefixe}`,
    registre: base ? "base" : "civil",
  });
}

// Le corps de la famille Defender : le mannequin UE4 du pack, celui dont ces
// pièces sont les variantes. Son mesh sera caché comme tous les autres — il
// n'est là que pour PORTER la famille, sans quoi ses pièces seraient écartées
// comme orphelines.
//
// ⚠ DEUX ENTRÉES, UNE PAR GENRE. `Modular.CorpsParGenre` compare `c.genre` à
// "M" ou "F" : un corps au genre "*" ne serait proposé à personne. Les PIÈCES,
// elles, acceptent "*" (ParSlot le gère) — la dissymétrie est dans le catalogue,
// pas dans une supposition.
for (const genre of ["M", "F"]) {
  corps.push({
    id: `defender_mannequin_${genre.toLowerCase()}`,
    asset: `${PACK}::${clePorteur}`,
    genre,
    famille: "defender",
    label: "Mannequin modulaire UE4",
  });
}

// ── Coiffures du pack Stylized ────────────────────────────────────────────────
//
// ⚠ ÉCRITES À LA MAIN, contrairement au reste. Ces 24 assets sont des `.uasset`
// Unreal 4.26 copiés directement dans l'ADK, pas des GLB : le parcours de
// `_export/` qui alimente les autres pièces ne les voit pas.
//
// Ce sont des STATIC MESH, attachés au socket `head`. Le pack les livre non
// skinnés — une coiffure est rigide et suit l'os de la tête, elle n'a pas
// besoin d'être pondérée. Voir `Builder.Habiller`, qui choisit la méthode
// d'attachement d'après le champ `attache`.
//
// Les 7 SOURCILS du pack sont volontairement ÉCARTÉS : ils demanderaient un
// slot `sourcils` dédié, et un sourcil posé au slot `visage` chasserait le
// visage lui-même. À reprendre le jour où le slot existera.
// ⚠ DESACTIVEES LE 2026-09-04, APRES LES AVOIR VUES EN JEU.
//
// Attachees au socket `head` sans transform relative, elles se posent a la
// position ou le pack les a modelisees, pas sur la tete : la coiffure feminine
// flotte derriere le crane, la barbe masculine fait deux masses au niveau du
// cou. Vu sur capture.
//
// Ce n'est PAS le socket qui manque — `head` existe bien dans les 68 os. C'est
// que `AddStaticMeshAttached(id, mesh, socket)` pose le mesh a l'identite, et
// que ces meshes portent l'offset de leur scene d'origine.
//
// Deux voies pour les rallumer, aucune faite :
//   1. mesurer l'offset de chaque mesh et le passer en `rel_loc`/`rel_rot` —
//      quatre parametres de plus sur AddStaticMeshAttached ;
//   2. les reexporter depuis Blender, origine sur l'os de tete.
//
// Tant que ce n'est pas fait, mieux vaut RIEN que faux : une coiffure a cote de
// la tete se lit comme un bug du jeu.
const COIFFURES_ACTIVES = false;

const COIFFURES_STYLIZED = [
  // Coiffures masculines
  { nom: "SM_Hair_01", slot: "tete", genre: "M", label: "Coupe courte" },
  { nom: "SM_Hair_02", slot: "tete", genre: "M", label: "Coupe mi-longue" },
  { nom: "SM_Hair_03", slot: "tete", genre: "M", label: "Coupe plaquée" },
  { nom: "SM_Hair_04", slot: "tete", genre: "M", label: "Coupe ébouriffée" },
  { nom: "SM_Hair_05", slot: "tete", genre: "M", label: "Coupe rasée sur les côtés" },

  // Coiffures féminines
  { nom: "SM_FemaleHair_01", slot: "tete", genre: "F", label: "Cheveux longs" },
  { nom: "SM_FemaleHair_02", slot: "tete", genre: "F", label: "Queue de cheval" },
  { nom: "SM_FemaleHair_03", slot: "tete", genre: "F", label: "Carré court" },

  // Barbes — leur propre slot, pour coexister avec toute coiffure et tout casque
  { nom: "SM_Beard_01", slot: "barbe", genre: "M", label: "Barbe courte" },
  { nom: "SM_Beard_02", slot: "barbe", genre: "M", label: "Bouc" },
  { nom: "SM_Beard_03", slot: "barbe", genre: "M", label: "Barbe pleine" },
  { nom: "SM_Beard_04", slot: "barbe", genre: "M", label: "Barbe de trois jours" },

  // Couvre-chefs : ce sont des VÊTEMENTS, donc vendus. Ils occupent le slot
  // `tete`, comme les coiffures — coiffer un chapeau chasse les cheveux.
  { nom: "SM_Aviator_Hat", slot: "tete", genre: "M", label: "Casquette d'aviateur",
    registre: "civil", ensemble: "Aviator" },
  { nom: "SM_Female_Aviator_Hat", slot: "tete", genre: "F", label: "Casquette d'aviateur",
    registre: "civil", ensemble: "Aviator" },
  { nom: "SM_Cop_Hat", slot: "tete", genre: "M", label: "Képi",
    registre: "uniforme", ensemble: "Cop" },
  { nom: "SM_Female_Cop_Hat", slot: "tete", genre: "F", label: "Képi",
    registre: "uniforme", ensemble: "Cop" },
  { nom: "SM_Female_Soldier_Helmet", slot: "tete", genre: "F", label: "Casque de combat",
    registre: "guerre", ensemble: "Soldier" },
];

for (const c of COIFFURES_ACTIVES ? COIFFURES_STYLIZED : []) {
  pieces.push({
    id: c.nom.toLowerCase(),
    asset: `${PACK}::${c.nom}`,
    genre: c.genre,
    famille: "stylized",
    ensemble: c.ensemble ?? (c.slot === "barbe" ? "Barbe" : "Coiffure"),
    slot: c.slot,
    variante: c.nom,
    label: c.label,
    registre: c.registre ?? "base",
    attache: "static",
    socket: "head",
  });
}

// Les pièces du pack Stylized appartiennent toutes à la famille `stylized`.
for (const p of pieces) if (!p.famille) p.famille = "stylized";

// ── GARDE : UNE PIÈCE GRISE N'ENTRE PAS AU CATALOGUE ─────────────────────────
//
// Mesuré dans l'éditeur le 2026-09-12 (`scripts/adk-mesurer-personnages.py`) :
// une pièce dont AUCUNE texture ne vient du PROJET s'affiche grise en jeu. Le
// total ne suffit pas à le voir — un matériau vide référence toujours trois ou
// quatre textures du MOTEUR (T_White_srgb, T_Generic_N…) comme valeurs de repli,
// et c'est ce qui avait rendu un rapport vert sur des monstres gris le 05/09.
//
// Quinze pièces Defender sont dans ce cas : leurs instances
// `MI_UE4ModularCharacter1..5` ont gardé leur parent mais ZÉRO surcharge de
// texture, là où les trois pièces de base portent le matériau maître et sortent
// texturées. La réparation est une séance d'éditeur, pas un cook.
//
// Les proposer quand même serait offrir un choix qui déçoit — « asset présent
// ≠ système branché ». Elles sortent donc AVEC MOTIF, et elles rentreront
// SEULES le jour de la réparation : la preuve est un fichier de mesure, pas un
// drapeau qu'il faudrait penser à lever.
const MESURES_PERSONNAGES =
  "E:/narvosprime-web-prototype/WebPortal/Server/adk/_personnages-mesures.json";

const grises = new Set();
if (fs.existsSync(MESURES_PERSONNAGES)) {
  const mesures = JSON.parse(fs.readFileSync(MESURES_PERSONNAGES, "utf8")).mesures ?? {};
  for (const [cle, m] of Object.entries(mesures)) {
    if ((m.materiaux ?? 0) > 0 && (m.textures_projet ?? 0) === 0) grises.add(cle);
  }
} else {
  console.error(`ATTENTION mesure des personnages absente : ${MESURES_PERSONNAGES}`);
  console.error("  Aucune pièce ne sera écartée pour grisaille. La produire :");
  console.error("  python scripts/ue-remote.py --fichier scripts/adk-mesurer-personnages.py");
}

const cleDe = (p) => p.asset.split("::")[1];
const piecesGrises = pieces.filter((p) => grises.has(cleDe(p)));
pieces = pieces.filter((p) => !grises.has(cleDe(p)));

let blocGrises = "";
if (piecesGrises.length > 0) {
  const parFamille = {};
  for (const p of piecesGrises) (parFamille[p.famille] ??= []).push(cleDe(p));
  console.log(`  pieces : ${piecesGrises.length} ecartee(s) — aucune texture du projet (grises en jeu)`);
  for (const [f, l] of Object.entries(parFamille)) console.log(`      ${f} : ${l.join(", ")}`);
  blocGrises = `
-- ── ÉCARTÉES PARCE QUE GRISES ────────────────────────────────────────────────
-- ${piecesGrises.length} pièce(s) cuites, au bon squelette, mais dont aucune texture ne vient du
-- PROJET : elles s'afficheraient grises. Mesure : adk/_personnages-mesures.json.
-- Réparer leurs matériaux les fait rentrer sans toucher à ce générateur.
${Object.entries(parFamille)
  .map(([f, l]) => `--   [${f}] ${l.join(", ")}`)
  .join("\n")}
`;
}

// Le pack Stylized ne livre PAS de corps de base — seulement des morceaux. On
// expose donc les corps NARVOS déjà cuits, ceux que Logic/Character.lua emploie
// et dont on sait qu'ils fonctionnent en jeu.
// ── Vetements du corps morphable ──────────────────────────────────────────────
//
// Tailles DANS le corps par `scripts/narvos-vetements-morphables.mjs` : meme
// topologie, memes poids de skinning, memes morph targets, decales de 3 mm vers
// l'exterieur.
//
// C'est ce qui les rend JUSTES quoi qu'on regle. Un vetement modelise a part
// aurait sa propre silhouette et s'interpenetrerait des que le joueur touche un
// curseur de corpulence — c'est exactement ce qui interdit d'employer ici les
// pieces Stylized ou Trooper.
//
// ⚠ FAMILLE `mpfb` UNIQUEMENT. Ces pieces epousent la topologie du corps
// morphable ; sur un corps Stylized elles seraient a la fois trop grandes et mal
// placees. `ValiderTenue` refuse deja le melange de familles, ce commentaire
// dit pourquoi la regle existe.
//
// Registre `base` : le corps morphable n'a pas de peau decoupee, donc rien ne
// l'habille par defaut. Ces quatre pieces SONT sa tenue de depart, et elles
// doivent etre gratuites — un joueur ne peut pas naitre nu faute de credits.
const VETEMENTS_MPFB = [
  { nom: "mpfb_combinaison", slot: "torse", label: "Combinaison" },
  { nom: "mpfb_pantalon", slot: "jambes", label: "Pantalon" },
  { nom: "mpfb_gants", slot: "mains", label: "Gants" },
  { nom: "mpfb_bottes", slot: "pieds", label: "Bottes" },
];

for (const v of VETEMENTS_MPFB) {
  // Un seul mesh pour les deux genres : la piece suit les morphs, et c'est le
  // curseur `@gender` qui fait la difference — pas deux modeles distincts.
  for (const genre of ["M", "F"]) {
    pieces.push({
      id: `${v.nom}_${genre.toLowerCase()}`,
      asset: `${PACK}::${v.nom}`,
      genre,
      famille: "mpfb",
      ensemble: "Tenue de base",
      slot: v.slot,
      variante: v.nom,
      label: v.label,
      registre: "base",
    });
  }
}

// ── Le corps MORPHABLE ────────────────────────────────────────────────────────
//
// Seul corps du jeu qui porte des morph targets : 290, cuits par
// `narvos-morphs-vers-glb.mjs` depuis les packs MakeHuman du prototype web.
// C'est lui, et lui seul, qui permet de regler un nez ou un menton.
//
// ⚠ SA FAMILLE EST A PART, ET DOIT LE RESTER. Sa topologie n'est pas celle du
// pack Stylized : un vetement Stylized pose dessus s'interpenetrerait. Tant
// qu'aucune piece `mpfb` n'existe, il sort NU — c'est assume, la personnalisation
// du visage est ce qu'on livre ici.
//
// Il n'a pas non plus de peau decoupee par slot, donc `PorteurCachable` rendra
// faux et le mesh restera VISIBLE. C'est le comportement voulu : ce corps EST la
// peau.
//
// Un seul mesh pour les deux genres — le dimorphisme MakeHuman vit dans
// `macrodetails`, volontairement exclu du GLB (340 morphs, 41 Mo).
// ⚠ NOM SANS PREFIXE `SK_`. Interchange nomme le SkeletalMesh d'apres le
// FICHIER glTF, pas d'apres une convention : `base_morphable.glb` donne
// `base_morphable`. Verifie sur le disque apres import — l'inventer aurait
// donne une reference morte que seul le verificateur aurait attrapee.
const CORPS_MORPHABLE = "base_morphable";

corps.push(
  { id: "narvos_morphable_m", asset: `${PACK}::${CORPS_MORPHABLE}`,
    genre: "M", famille: "mpfb", label: "Corps morphable" },
  { id: "narvos_morphable_f", asset: `${PACK}::${CORPS_MORPHABLE}`,
    genre: "F", famille: "mpfb", label: "Corps morphable" },
);

corps.push(
  { id: "narvos_operateur_m", asset: `${PACK}::SK_CyberpunkSamurai_WithoutHelmet`,
    genre: "M", famille: "stylized", label: "Opérateur NARVOS" },
  { id: "narvos_valkiria_f", asset: `${PACK}::SK_Valkiria`,
    genre: "F", famille: "stylized", label: "Valkiria NARVOS" },
);

// ── LES CORPS DU META CUSTOMIZATION SYSTEM ───────────────────────────────────
//
// Le systeme achete sur Fab (Meta Customization System) ne livre pas des pieces
// a attacher : il livre des BLUEPRINTS qui portent leur propre logique — corps,
// visage, cheveux, peau, tatouages, vetements — pilotable par evenement depuis
// Lua (`Blueprint:CallBlueprintEvent`, autorite BOTH).
//
// ── POURQUOI DEUX CHAMPS, `asset` ET `blueprint` ─────────────────────────────
// nanos ne laisse posseder qu un `Character`, et un Character veut un
// SkeletalMesh. Le Blueprint ne peut donc pas REMPLACER le corps : il s y
// ATTACHE, et le mesh dessous est masque (`SetMeshSettings(..., false)`).
//
//   `asset`      le PORTEUR — squelette, animations, capsule de collision.
//                Invisible. Voir « LE PORTEUR DES METAHUMANS » juste dessous.
//   `blueprint`  ce qui SE VOIT, et qui s habille tout seul.
//
// ── LE PORTEUR DES METAHUMANS : LE MANNEQUIN NANOS (2026-09-14) ──────────────
// Jusqu au 14/09, les corps MetaHuman prenaient le porteur de Defender
// (`CHEMIN_PORTEUR`, SKM_Manny). Mesure dans le paquet cuit : son squelette est
// `SK_MannequinMainUE5M` — hierarchie UE5 (spine_05, neck_02), PAS SKEL_Mannequin.
// Ses sockets s appellent `hand_rSocket`, `foot_l_Socket`… : ni `hand_r_socket`
// ni `head_socket`. Retour de jeu de Hanibes : camera 1re personne AUX PIEDS et
// arme posee au sol. Une arme ramassee s attache a `hand_r_socket`
// (BasePickable.json, weapons-meshes.mdx) ; un socket absent vaut l origine du
// mesh, donc les pieds.
// Le pont (`adk-pont-metahuman.py`, voie a) a ete CONSTRUIT pour le mannequin
// nanos : `IK_NanosMannequin` pointe `/Game/NanosWorld/Characters/Mannequin/SK_Mannequin`.
// Le porteur est donc ce mesh-la, livre par Steam a chaque joueur : sockets
// nanos, animations natives de tenue d arme, locomotion SKEL_Mannequin.
// La famille Defender GARDE SKM_Manny : ses pieces sont sur son squelette.
//
// ── D OU VIENNENT CES DEUX CLES ──────────────────────────────────────────────
// De `WebPortal/Server/Assets/narvos/Assets.toml`, relu le 2026-09-12 :
//     BP_MH_Male_Playable    = "Narvos/MetaCustom/Premade_Blueprints/BP_MH_Male_Playable"
//     BP_MH_Playable_Female1 = "Narvos/MetaCustom/Premade_Blueprints/BP_MH_Playable_Female1"
// Elles etaient cuites depuis des semaines et JAMAIS declarees : le
// constructeur de pack taisait les Blueprints inventories apres leur classe
// `_C` — 257 d un coup, corrige le 2026-09-11.
//
// ── LA FAMILLE `metahuman` N A, ET N AURA, AUCUNE PIECE ──────────────────────
// C est voulu : `ValiderTenue({}, genre, "metahuman")` passe (la boucle ne
// tourne pas), `TenueDefaut` rend une table vide, et `Builder.Habiller` saute
// la pose de pieces des qu il voit `corps.blueprint`. Le Blueprint habille.
//
// -- LE PACK LIVRE SEPT BLUEPRINTS. DEUX SEULEMENT SE CHARGENT. ---------------
//
// Mesure du 2026-09-12, apres avoir VU le resultat en jeu : un bloc rouge, et
// dans le journal CLIENT (pas serveur — le serveur ne charge rien) :
//
//     Failed to load Unreal Asset: 'narvos::BP_MH_Male_Playable'
//     (.../BP_MH_Male_Playable.BP_MH_Male_Playable_C)!
//     Asset File not found or is from a different type.
//     Required type 'BlueprintGeneratedClass'.
//
// `scripts/narvos-imports-casses.mjs` a lu la table de noms des sept paquets
// cuits. Leurs imports pointent encore `/Game/Metahuman_Customization_System/`,
// l emplacement d AVANT la promotion sous `Narvos/` — et le cook ne prend que
// `Narvos/`. La difference qui decide :
//
//   BP_MH_Male / BP_MH_Female        parent NATIF (/Script/Engine).
//                                    Leurs imports absents sont des AnimBP et
//                                    des widgets : des PROPRIETES. Nulles, la
//                                    classe existe quand meme.
//   BP_*_Playable / BP_Playable_MH   parent = BP_ThirdPersonCharacter, sous
//                                    `Demo_Content/`, JAMAIS promu ni cuit.
//   BP_RPG_MH_*                      parent = CBP_SandboxCharacter, idem.
//
// Un Blueprint sans classe parente ne rate pas a moitie : il n existe pas.
//
// Les cinq autres restent DANS le catalogue mais HORS `JOUABLES` : ils
// reviendront le jour ou `BP_ThirdPersonCharacter` et `CBP_SandboxCharacter`
// seront promus sous `Narvos/MetaCustom/` et recuits. Les effacer ferait
// oublier qu ils sont payes, cuits, et a deux assets pres de fonctionner.
//
// -- 2026-09-13 : BP_MH_Male / BP_MH_Female SONT INVISIBLES --------------------
//
// Vu en jeu : l'apercu de creation vide. Leur copie ADK a ete resauvee pendant que
// `Metahuman_Ref` etait absent : les 30 references corps/visage/grooms sont NULLES
// dans le fichier (source : 30, ADK : 0 — rapport Fable du 13/09). Les VRAIS
// MetaHumans sont les duplicata des Blueprints STANDARDS du pack, `BP_NarvosMH_M`
// (BP_MCSGavin) et `BP_NarvosMH_F` (BP_Hana), ecrits par
// `scripts/adk-pont-metahuman.py` etape_voie_a.
//
// `blueprints` est une liste de PREFERENCE : le premier CUIT gagne. Tant que les
// duplicata ne sont pas dans le pack, rien ne change ; des qu'ils y sont, `mh_homme`
// et `mh_femme` passent aux vrais MetaHumans — et les personnages deja sauves avec
// ces ids suivent, sans migration.
const CORPS_METAHUMAIN = [
  // -- CHARGEABLES : parent natif -------------------------------------------
  { id: "mh_homme", blueprints: [`${PACK}::BP_NarvosMH_M`, `${PACK}::BP_MH_Male`],
    genre: "M", label: "MetaHuman — Homme", jouable: true },
  { id: "mh_femme", blueprints: [`${PACK}::BP_NarvosMH_F`, `${PACK}::BP_MH_Female`],
    genre: "F", label: "MetaHuman — Femme", jouable: true },

  // -- EN ATTENTE DE LEUR CLASSE PARENTE ------------------------------------
  { id: "mh_homme_jouable", blueprint: `${PACK}::BP_MH_Male_Playable`,
    genre: "M", label: "MetaHuman — Homme (jouable)" },
  { id: "mh_femme_jouable", blueprint: `${PACK}::BP_MH_Playable_Female1`,
    genre: "F", label: "MetaHuman — Femme (jouable)" },
  { id: "mh_mixte", blueprint: `${PACK}::BP_Playable_MH`,
    genre: "M", label: "MetaHuman — démonstration" },
  { id: "mh_rpg_homme", blueprint: `${PACK}::BP_RPG_MH_Male`,
    genre: "M", label: "MetaHuman — RPG Homme" },
  { id: "mh_rpg_femme", blueprint: `${PACK}::BP_RPG_MH_Female`,
    genre: "F", label: "MetaHuman — RPG Femme" },
];

// ⚠ ON N EMET QUE CE QUI EST REELLEMENT CUIT. Un Blueprint ne sort du cook que
// si sa CLASSE PARENTE en sort aussi : les cinq `_Playable` et `_RPG` derivent
// de `BP_ThirdPersonCharacter` et `CBP_SandboxCharacter`, jamais promus sous
// Narvos/. Les declarer quand meme laissait cinq references mortes que seul le
// verificateur attrapait — mesure du 2026-09-12, apres le cook.
//
// Le jour ou ces deux parents seront promus et cuits, ces corps reviendront
// SEULS, sans toucher a ce fichier.
const metahumainEcartes = [];
/** Le premier Blueprint CUIT de la liste de preference, ou null. */
const blueprintCuitDe = (c) =>
  (c.blueprints ?? [c.blueprint]).find((b) => blueprintsCuits.has(b.split("::").pop())) ?? null;
for (const c of CORPS_METAHUMAIN) {
  const choisi = blueprintCuitDe(c);
  if (!choisi) {
    metahumainEcartes.push(`${c.id} (${(c.blueprints ?? [c.blueprint]).map((b) => b.split("::").pop()).join(" | ")})`);
    continue;
  }
  if (c.blueprints) console.log(`  metahuman : ${c.id} -> ${choisi}`);
  corps.push({
    id: c.id,
    // Le porteur, invisible. Voir « LE PORTEUR DES METAHUMANS » ci-dessus.
    asset: PORTEUR_METAHUMAIN,
    blueprint: choisi,
    genre: c.genre,
    famille: "metahuman",
    label: c.label,
  });
}

// `q` sert au bloc de tenue nue ci-dessous AUTANT quaux lignes de sortie :
// declaree plus bas, elle serait dans sa zone morte et leverait a lexecution.
const q = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

// ── DEUX CORPS PAR GENRE, PAS DIX-SEPT ───────────────────────────────────────
//
// Depuis que le porteur est CACHE (`SetMeshSettings`), le mesh passe a
// `Character(...)` ne sert plus qu'au squelette, a l'animation et a la capsule.
// Rien de lui ne se voit.
//
// Les douze « Trooper armure - standalone armor ... » n'ont donc plus aucun
// sens comme corps : leur armure est cuite dans le mesh, et on ne la verra
// jamais. Les proposer, c'etait offrir douze fois le meme resultat sous douze
// libelles differents.
//
// On garde DEUX corps par genre : le stylise NARVOS et la forme Trooper nue.
// Ce ne sont pas deux apparences, ce sont deux MORPHOLOGIES — elles decident
// quelles pieces s'ajustent, et c'est la seule chose que le corps decide encore.
//
// Tout le reste — visage, tete, torse, membres — se choisit ensuite, piece par
// piece. C'est ce que « modulaire » veut dire.
// ⚠ DEUX CORPS. PAS TROIS, PAS DIX-SEPT.
//
// Constate en jeu le 2026-09-04, captures a l'appui :
//
//   Operateur / Valkiria (stylized)  textures, debout, corrects
//   Trooper Male / Female            GRIS, sans texture
//   Corps morphable (mpfb)           GRIS et COUCHE a plat
//
// Proposer un modele casse n'est pas proposer un choix. Les deux corps
// stylises sont les seuls qui rendent correctement, et ce sont eux que le
// joueur voit dans l'ecran de creation.
//
// ⚠ CE QUE CELA COUTE, ET IL FAUT LE SAVOIR : les corps stylises n'ont AUCUN
// morph target. Les 522 morphs cuits dans `base_morphable` — nez, bouche,
// menton, corpulence — ne s'appliquent pas a eux. Regler leur silhouette
// passera par la MISE A L'ECHELLE D'OS, qui est un autre mecanisme.
//
// Les assets ecartes restent cuits dans le pack : les rallumer ne demande que
// de reinscrire leur identifiant ici.
const CORPS_RETENUS = new Set([
  // ── LE SYSTEME ACHETE, ET LUI SEUL, EST JOUABLE (2026-09-12) ───────────────
  // Voir `JOUABLES` plus bas : ces deux-la sont les seuls proposes a la
  // creation. Les autres restent dans `CORPS` — ils portent les 119 pieces
  // modulaires et servent aux PNJ — mais le joueur ne les incarne plus.
  // Les SEPT corps MetaHuman entrent au catalogue ; `JOUABLES` dit lesquels
  // sont proposes. Voir CORPS_METAHUMAIN pour la difference.

  "narvos_operateur_m",
  "narvos_valkiria_f",

  // ── LES CORPS QUI OUVRENT LES FAMILLES MODULAIRES (2026-09-12) ──────────────
  //
  // Sans UN corps retenu, toutes les pièces d'une famille sont écartées comme
  // orphelines. C'est ce qui a tenu 67 pièces Trooper hors du jeu sans un mot,
  // et ce que Hanibes a vu à l'écran : « il n'y a pas l'intégralité des corps et
  // vêtements dans la création ».
  //
  // Le mesh d'un corps est CACHÉ (SetMeshSettings) : il ne sert plus qu'au
  // squelette, à l'animation et à la capsule — tout ce qui se voit vient des
  // slots. Un corps par MORPHOLOGIE suffit donc ; en retenir douze offrirait
  // douze fois le même résultat.
  // ⚠ LES CORPS NUS, PAS LES ARMURÉS. `SK_*_Form_Standalone` est le corps de
  // peau du pack — mesuré le 2026-09-12 : 182 cm (M), 180 (F), 173 (PF), un
  // matériau chacun (MI_Male / MI_Tall_Female / MI_Petite_Female) et DEUX
  // textures de projet. Ils étaient importés et déclarés depuis le début ; mon
  // manifeste ne regardait que le dossier `Trooper_Set/` et les ignorait, d'où
  // le faux diagnostic « ces meshes n'ont jamais été cuits ».
  //
  // C'est la chaîne que Hanibes demande : corps de base -> peau -> pièces
  // modulaires -> armure. Retenir l'armuré à la place laisserait une armure
  // cuite sous l'armure portée.
  "«redacted:sk_…»",
  "«redacted:sk_…»",
  "«redacted:sk_…»",
  "defender_mannequin_m",
  "defender_mannequin_f",

  // Le corps morphable, REMIS le 2026-09-04 apres diagnostic de ses deux defauts :
  //
  //   COUCHE  il etait CACHE — les quatre vetements avaient rendu la famille
  //           « cachable », et les pieces attachees perdaient sa pose.
  //           `PorteurCachable` exige desormais une piece de tete.
  //   GRIS    ses materiaux `skin` et `Eyes` n'avaient ni texture ni couleur
  //           (`images: 0` dans le GLB). Ils portent maintenant un
  //           `baseColorFactor`.
  //
  // C'est le SEUL corps morphable possible : `SetMorphTarget(name, value)` n'a
  // pas d'`attachable_id` et ne touche que le mesh de BASE. Cuire des morphs sur
  // les pieces Stylized, qui sont des attachements, produirait des morphs que
  // rien ne peut activer.
  //
  // ⚠ REMIS le 2026-09-04. Les deux corps stylises permettent d'ECHANGER des
  // pieces, jamais de MODIFIER une tete ou une silhouette : ils n'ont aucun
  // morph target, et `SetMorphTarget` ne touche de toute facon que le mesh de
  // base — cache chez eux.
  //
  // Ce corps-ci est le seul reglable : 522 morphs, dont 290 de visage (nez,
  // bouche, menton, joues) et 232 d'ancres corporelles (corpulence, ventre,
  // taille, carrure).
  //
  // ⚠ RETIRE le 2026-09-05. Le correctif du 04 N'A PAS TENU : revu en jeu,
  // capture a l'appui, le corps morphable est TOUJOURS gris et TOUJOURS couche
  // a plat sur le sol. Les deux causes diagnostiquees la veille — famille
  // cachable, materiaux sans couleur — ne suffisaient donc pas, ou la correction
  // n'a pas atteint l'asset cuit.
  //
  // Ce qu'il en coute, et il faut le dire : c'etait le SEUL corps portant des
  // morph targets. Ses 522 morphs — 290 de visage, 232 d'ancres corporelles —
  // partent avec lui, et avec eux l'etape « Visage » a curseurs, qui ne
  // s'affichait que pour la famille `mpfb`. Les deux corps stylises n'ont aucun
  // morph target et `SetMorphTarget` ne touche que le mesh de BASE, cache chez
  // eux : rien ne peut les remplacer par ce chemin.
  //
  // Ce qui reste pour eux : les trois curseurs de silhouette (`SetScale`), le
  // choix de visage piece par piece, et les couleurs.
  //
  // Ne pas le remettre sans avoir VU en jeu qu'il se tient debout et texture.
  // Il a deja ete remis une fois sur la foi d'un diagnostic, pas d'une capture.
  //   "narvos_morphable_m",
  //   "narvos_morphable_f",
]);

// Les corps MetaCustom sont retenus d'office DÈS QU'ILS PASSENT LA GARDE : sans
// corps retenu, la règle « famille sans corps = famille morte » écarterait leurs
// pièces comme orphelines. Aujourd'hui ce tour de boucle n'ajoute rien — la
// garde a tout exclu — et c'est exactement pour ça qu'il doit être là le jour
// du rebind : les pièces apparaîtront sans qu'on retouche ce fichier.
for (const c of corps) if (c.famille === "metacustom") CORPS_RETENUS.add(c.id);
// ⚠ SEULS LES EMIS. Retenir un corps qu on vient d ecarter faisait crier la
// garde « corps retenu ABSENT du pack » cinq fois — un avertissement JUSTE sur
// un fait qu on connaissait deja, donc du bruit qui masquerait le prochain vrai.
for (const c of CORPS_METAHUMAIN) {
  if (blueprintCuitDe(c)) CORPS_RETENUS.add(c.id);
}
if (metahumainEcartes.length > 0) {
  console.log(`  metahuman : ${metahumainEcartes.length} corps ECARTE(S) — Blueprint absent du pack cuit`);
  console.log(`      ${metahumainEcartes.join(", ")}`);
  console.log("      (leur classe parente n'est pas promue sous Narvos/ : ils ne sont pas cuits)");
}

const corpsEcartes = corps.filter((c) => !CORPS_RETENUS.has(c.id));
corps = corps.filter((c) => CORPS_RETENUS.has(c.id));

// Un identifiant retenu mais absent du pack laisserait un genre SANS corps, et
// l'ecran de creation n'aurait rien a proposer. On le dit plutot que de livrer
// une liste vide.
for (const attendu of CORPS_RETENUS) {
  if (!corps.some((c) => c.id === attendu)) {
    console.error(`ATTENTION corps retenu ABSENT du pack : ${attendu}`);
  }
}

console.log(`  corps : ${corps.length} retenu(s), ${corpsEcartes.length} ecarte(s)`);

// Une famille sans corps est une famille MORTE : aucun joueur ne peut incarner
// sa morphologie, donc aucune de ses pieces n'est atteignable. Les garder
// gonflerait le catalogue de references qu'on cuirait et verifierait pour rien.
//
// Regle generale, et non retrait nomme : ecarter « trooper_pf » a la main
// laisserait le prochain corps supprime trainer ses pieces derriere lui.
const famillesVivantes = new Set(corps.map((c) => c.famille));
const piecesOrphelines = pieces.filter((p) => !famillesVivantes.has(p.famille));
pieces = pieces.filter((p) => famillesVivantes.has(p.famille));

if (piecesOrphelines.length > 0) {
  const parFamille = {};
  for (const p of piecesOrphelines) parFamille[p.famille] = (parFamille[p.famille] ?? 0) + 1;
  console.log(`  pieces : ${piecesOrphelines.length} ecartee(s) — famille sans corps : `
    + Object.entries(parFamille).map(([f, n]) => `${f} (${n})`).join(", "));
}

// ── Tenue nue : ce que porte un corps AVANT tout vêtement ────────────────────
//
// Le mesh passé à `Character(...)` est désormais CACHÉ (`SetMeshSettings`).
// Sans cette table, un personnage neuf serait donc invisible. Chaque pièce
// visible vient d'un slot, y compris la peau — c'est ce qui permet à une armure
// de REMPLACER la partie nue au lieu de se poser dessus.
//
// Les deux packs livrent ce corps nu découpé : `body_chest_m`… côté Stylized,
// `sk_male_form_upper`… côté Trooper. Il n'y a rien à modéliser.

const SANS_FEET = /_with_feet$|_with_hands$/;

/** Entre plusieurs candidates pour un slot, la plus neutre.
 *
 *  · une pièce `_with_feet` / `_with_hands` fusionne deux slots : elle
 *    recouvrirait le slot voisin et le rendrait immodifiable — écartée ;
 *  · `default` l'emporte sur une variante ethnique, qui est un CHOIX du joueur
 *    et non un état par défaut ;
 *  · à égalité, l'ordre alphabétique, pour que la sortie soit reproductible.
 */
const plusNeutre = (a, b) => {
  const fusion = (p) => (SANS_FEET.test(p.id) ? 1 : 0);
  if (fusion(a) !== fusion(b)) return fusion(a) - fusion(b);
  const def = (p) => (/default/.test(p.id) ? 0 : 1);
  if (def(a) !== def(b)) return def(a) - def(b);
  return a.id.localeCompare(b.id);
};

const tenueBase = {};
for (const p of pieces) {
  if (p.registre !== "base") continue;
  for (const genre of p.genre === "*" ? ["M", "F"] : [p.genre]) {
    const cle = `${p.famille}|${genre}`;
    const t = (tenueBase[cle] ||= {});
    if (!t[p.slot] || plusNeutre(p, t[p.slot]) < 0) t[p.slot] = p;
  }
}

// ── QUAND UNE FAMILLE N'A PAS DE PEAU NUE ────────────────────────────────────
//
// Mesuré le 2026-09-12 : le pack cuit livre 67 pièces Trooper, mais AUCUN des
// meshes `SK_<Morpho>_Form_<Partie>` — les corps nus découpés. Ils existaient
// en GLB, ils n'ont jamais été cuits.
//
// Sans peau nue, `PorteurCachable` rend faux : le corps porteur reste VISIBLE
// sous les pièces attachées, et deux couches d'armure se disputent la même
// place. C'est le genre de défaut qu'un joueur voit tout de suite et qu'aucun
// test ne voit jamais.
//
// La couverture minimale est donc DÉSIGNÉE parmi les pièces de la famille
// elle-même : une tête, un buste, un bas. Ce n'est pas de la peau, c'est un
// équipement complet — le personnage naît habillé plutôt qu'écorché, et chaque
// slot reste changeable ensuite.
//
// ⚠ PRÉFÉRENCES, PAS NOMS EN DUR : on cite des motifs de variante, et on retombe
// sur la première pièce du slot si aucun ne correspond. Une liste de noms
// recopiée diverge du pack au premier renommage.
const COUVERTURE_MINIMALE = [
  ["tete", [/^Head_A$/i, /^Head/i]],
  ["torse", [/^Upper_with_Hands$/i, /^Upper_with_Shoulders/i, /^Upper/i, /^Chest/i]],
  ["jambes", [/^Lower_with_Feet$/i, /^Lower/i, /^Legs/i]],
];

for (const c of corps) {
  const cle = `${c.famille}|${c.genre}`;
  if (tenueBase[cle] && Object.keys(tenueBase[cle]).length > 0) continue;

  const candidates = pieces.filter(
    (p) => p.famille === c.famille && (p.genre === c.genre || p.genre === "*"),
  );
  if (candidates.length === 0) continue;

  const t = (tenueBase[cle] ||= {});
  for (const [slot, motifs] of COUVERTURE_MINIMALE) {
    const duSlot = candidates.filter((p) => p.slot === slot);
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
  if (c.blueprint) continue;
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// une pièce vivante l'occupe (ceintures/bretelles MetaCustom, le jour du
// [TROU — ligne jamais lue dans les transcriptions]
// utilisé mais absent de la liste serait invisible — d'où le garde-fou dessous.
const SLOTS_SORTIE = ["visage", "barbe", "tete", "torse", "epaules", "bras", "mains", "jambes", "pieds"];
if (pieces.some((p) => p.slot === "taille") && !SLOTS_SORTIE.includes("taille")) {
  SLOTS_SORTIE.splice(SLOTS_SORTIE.indexOf("jambes"), 0, "taille");
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
  if (!SLOTS_SORTIE.includes(p.slot)) {
    console.error(`ARRÊT : la pièce ${p.id} est au slot « ${p.slot} », absent de Modular.SLOTS.`);
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]

const parSlot = {};
for (const p of pieces) (parSlot[p.slot] ||= []).push(p);

const parFamille = {};
for (const p of pieces) (parFamille[p.famille] ||= []).push(p);

const lignesPieces = pieces
  .slice()
  .sort((a, b) => a.id.localeCompare(b.id))
  .map(
    (p) =>
      `    ${p.id} = { asset = ${q(p.asset)}, slot = ${q(p.slot)}, genre = ${q(p.genre)}, ` +
      `famille = ${q(p.famille)}, ensemble = ${q(p.ensemble)}, registre = ${q(p.registre)}, ` +
      // `pnj_simple` : pièce réservée aux CharacterSimple (squelette étranger) —
      // jamais proposée au joueur. Absent = pièce joueur classique.
      (p.pnj_simple ? `pnj_simple = true, ` : "") +
      // `attache` n'est ecrit QUE pour les pieces statiques : l'absence vaut
      // « skeletal », qui est le cas de 116 pieces sur 143. L'ecrire partout
      // alourdirait le catalogue sans rien apprendre.
      (p.attache === "static"
        ? `attache = "static", socket = ${q(p.socket || "head")}, `
        : "") +
      `label = ${q(p.label)} },`,
  )
  .join("\n");

// ── CE QUE LE JOUEUR PEUT INCARNER ───────────────────────────────────────────
// Voir le commentaire de `Modular.JOUABLES` dans la sortie. Ordre d'affichage.
const JOUABLES = CORPS_METAHUMAIN.filter((c) => c.jouable).map((c) => c.id);

// Une entree jouable absente de CORPS laisserait l'ecran de creation VIDE pour
// son genre, sans un mot. Le dire ici, pas en jeu.
for (const id of JOUABLES) {
  if (!corps.some((c) => c.id === id)) {
    console.error(`ATTENTION corps JOUABLE absent de CORPS : ${id}`);
  }
}
for (const genre of ["M", "F"]) {
  if (!JOUABLES.some((id) => corps.find((c) => c.id === id)?.genre === genre)) {
    console.error(`ATTENTION aucun corps jouable pour le genre ${genre}`);
  }
}

const lignesCorps = corps
  .slice()
  .sort((a, b) => a.id.localeCompare(b.id))
  .map(
    (c) =>
      `    ${c.id} = { asset = ${q(c.asset)}, genre = ${q(c.genre)}, ` +
      `famille = ${q(c.famille)}, label = ${q(c.label)}` +
      // Corps PNJ simple : n'entre pas dans les corps jouables.
      (c.pnj_simple ? `, pnj_simple = true` : "") +
      // Un corps SANS blueprint ne doit pas porter la cle a nil : `Habiller`
      // teste `corps.blueprint`, et une cle absente vaut nil de toute facon.
      // L emettre vide inviterait a l ecrire un jour "" — ce qui serait VRAI
      // en Lua et poserait un Blueprint au chemin vide.
      (c.blueprint ? `, blueprint = ${q(c.blueprint)}` : "") +
      ` },`,
  )
// [ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : 131 ligne(s) attendue(s) ici, 62 connue(s)]
  .join("\n");

const lua = `-- ══════════════════════════════════════════════════════════════════════════════
-- Modular.lua — corps et pièces modulaires.
--
-- FICHIER GÉNÉRÉ par scripts/narvos-modular-to-lua.mjs — ne pas éditer à la main.
-- Il est reconstruit depuis les GLB réellement importés, ce qui garantit
-- qu'aucune entrée ne référence une pièce absente du pack cuit.
--
-- ${corps.length} corps, ${pieces.length} pièces, ${Object.keys(parFamille).length} familles.
--
-- ── LA FAMILLE EST UNE CONTRAINTE, PAS UNE ÉTIQUETTE ──────────────────────────
-- Deux familles cohabitent. Les DEUX passent AddSkeletalMeshAttached : leurs
-- noms d'os concordent avec SKEL_Mannequin, vérifié. Mais elles ne partagent PAS
-- les mêmes VOLUMES — un vêtement MetaHuman posé sur un corps Stylized
-- s'interpénètre.
--
-- ValiderTenue refuse donc tout mélange. Ce n'est pas une précaution théorique :
-- rien d'autre ne l'empêcherait, et le défaut serait visible sans être
-- compréhensible pour le joueur.
--
-- ── GENRE ETOILE ──────────────────────────────────────────────────────────────
-- Les vêtements MetaHuman sont skinnés sur une base commune : un seul mesh sert
-- aux deux corps. Leur genre vaut donc "*", et ParSlot les rend pour M comme
-- pour F.
-- ══════════════════════════════════════════════════════════════════════════════
// [SÛRE dans une version intermédiaire, non replacée] const NOTES_FAMILLES = {
// [SÛRE dans une version intermédiaire, non replacée]     "--               AddSkeletalMeshAttached tant que le skinning n'est pas",
// [SÛRE dans une version intermédiaire, non replacée]     "--               reconstruit sur les 68 os de SKEL_Mannequin.",
// [SÛRE dans une version intermédiaire, non replacée]   ],
// [SÛRE dans une version intermédiaire, non replacée]   defender: [
// [SÛRE dans une version intermédiaire, non replacée]     "--   [defender]  Personnage modulaire UE4 du pack Defender : têtes, bustes et",
// [SÛRE dans une version intermédiaire, non replacée]     "--               jambes, lus depuis Assets.toml et filtrés par le manifeste",
// [SÛRE dans une version intermédiaire, non replacée]     "--               adk/_manifests/defender-squelettes.json (18 clés, 18 sur",
// [SÛRE dans une version intermédiaire, non replacée]     "--               SKEL_Mannequin, mesuré 2026-09-12). Genre « * » : rien dans",
// [SÛRE dans une version intermédiaire, non replacée]     "--               ces meshes ne distingue M de F.",
// [SÛRE dans une version intermédiaire, non replacée]   ],
// [SÛRE dans une version intermédiaire, non replacée]   metacustom: [
// [SÛRE dans une version intermédiaire, non replacée]     "--   [metacustom] Vêtements du pack Meta Customization, lus depuis Assets.toml",
// [SÛRE dans une version intermédiaire, non replacée]     "--               (clés dédupliquées). N'entrent que si leur squelette est",
// [SÛRE dans une version intermédiaire, non replacée]     const note = NOTES_FAMILLES[f];
// [SÛRE dans une version intermédiaire, non replacée]       console.error(`ATTENTION famille « ${f} » émise sans note d'en-tête (NOTES_FAMILLES).`);
// [SÛRE dans une version intermédiaire, non replacée]       return [`--   [${f}]  (note manquante dans NOTES_FAMILLES — à rédiger)`];
// [SÛRE dans une version intermédiaire, non replacée] -- morphologie posé sur le corps d'une autre s'interpénètre, et le joueur
// [SÛRE dans une version intermédiaire, non replacée] -- verrait un défaut sans que rien ne l'ait prévenu. ValiderTenue refuse donc
// [SÛRE dans une version intermédiaire, non replacée] -- tout mélange de familles.
// [SÛRE dans une version intermédiaire, non replacée] ${blocGenreEtoile}${blocExclusions}${blocGrises}-- ══════════════════════════════════════════════════════════════════════════════

local Modular = {}

--- Slots d'habillage, dans l'ordre d'empilement à l'écran de création.
--- 'pieds' vient des MetaHuman : le pack Stylized n'a pas de chaussures.
--- Ordre d'empilement a l'ecran de creation, du plus interne au plus externe.
--- 'epaules' et 'bras' viennent de SciFi_Trooper_Set : un buste sans bras plus
--- des bras separes plus des epaulieres interchangeables multiplie les
--- silhouettes au lieu de les additionner.
Modular.SLOTS = { "visage", "barbe", "tete", "torse", "epaules", "bras", "mains", "jambes", "pieds" }

--- Registres, pour filtrer l'écran de création.
Modular.REGISTRES = { "base", "civil", "uniforme", "guerre" }

--- Familles de morphologie. Voir l'avertissement en tête de fichier.
// [ANCIENNE VERSION ↑]
// [DERNIÈRE VERSION ↓ — ligne(s) sûre(s) du fichier final, lue(s) dans le tronçon ci-dessus mais non replacée(s) : il a changé de longueur. Leur n° final est entre crochets]
// [SÛRE n°1660] // DEUX passent AddSkeletalMeshAttached : leurs noms d'os concordent avec
// [SÛRE n°1669] const famillesPresentes = [
// [SÛRE n°1674] const NOTES_FAMILLES = {
// [SÛRE n°1676]     "--   [stylized]  Pack StylizedModularChar, reconstruit depuis les GLB",
// [SÛRE n°1691]   mpfb: [
// [SÛRE n°1692]     "--   [mpfb]      Vêtements taillés DANS le corps morphable : même topologie,",
// [SÛRE n°1702]     "--               donne squelette, animations et capsule ; `blueprint` est ce",
// [SÛRE n°1724] const notesFamilles = famillesPresentes
// [SÛRE n°1726]     const note = NOTES_FAMILLES[f];
// [SÛRE n°1730]       console.error(`ATTENTION famille « ${f} » émise sans note d'en-tête (NOTES_FAMILLES).`);
// [SÛRE n°1731]       return [`--   [${f}]  (note manquante dans NOTES_FAMILLES — à rédiger)`];
// [SÛRE n°1757] -- ── EXCLUSES À LA GÉNÉRATION ─────────────────────────────────────────────────
// [SÛRE n°1772] -- ce qui garantit qu'aucune entrée ne référence une pièce absente du pack cuit.
// [SÛRE n°1777] -- Familles présentes dans CETTE génération : ${famillesPresentes.join(", ")}.
// [SÛRE n°1794] --- 'taille' (ceintures, bretelles) n'est écrit que si une pièce vivante
// [SÛRE n°1795] --- l'occupe — voir SLOTS_SORTIE dans le générateur.
// [SÛRE n°1796] Modular.SLOTS = { ${SLOTS_SORTIE.map(q).join(", ")} }
// [DERNIÈRE VERSION ↑]
Modular.FAMILLES = { ${
      [...new Set([...pieces.map((p) => p.famille), ...corps.map((c) => c.famille)])]
        .sort()
        .map(q)
        .join(", ")
    } }

--- Corps de base : les mesh passés à Character(...), PAS des attachements.
--- Ils PORTENT les pièces, ils ne s'y ajoutent pas.
Modular.CORPS = {
${lignesCorps}
}

--- Tenue nue — ce qu'un corps porte AVANT tout vêtement, par « famille|genre ».
---
--- ── POURQUOI ELLE EXISTE ──────────────────────────────────────────────────────
--- Le mesh donné à Character(...) est désormais CACHÉ, via SetMeshSettings. Il ne
--- sert plus qu'à porter le squelette, l'animation et les dimensions de la
--- capsule. Tout ce qui se voit — peau comprise — vient d'un slot.
---
--- C'est ce qui rend une armure REMPLAÇANTE : elle occupe le slot torse, et la
--- pièce de peau qui s'y trouvait en sort. Avant, le corps habillé du mesh de
--- base restait dessous et transparaissait aux jointures.
---
--- Corollaire : toutes les parties deviennent modifiables, visage inclus,
--- puisque plus aucune n'est cuite dans le mesh de base.
Modular.TENUE_BASE = {
${lignesTenueBase}
}

--- Tenue nue d'une famille et d'un genre. Rend une table NEUVE : l'appelant la
--- complète avec les choix du joueur, et deux joueurs ne doivent pas partager
--- la même table.
---@param famille string
---@param genre string
---@return table
function Modular.TenueBase(famille, genre)
    local source = Modular.TENUE_BASE[tostring(famille) .. "|" .. tostring(genre)]
    local sortie = {}
    if (source) then
        for slot, id in pairs(source) do sortie[slot] = id end
    end
    return sortie
end

--- Tenue nue complétée par les choix du joueur.
---
--- Un slot demandé à false est RETIRÉ, même s'il figure dans la tenue nue :
--- c'est ainsi qu'on enlève un gant sans enlever la main. Un slot absent de
--- choix garde sa pièce nue.
---@param famille string
---@param genre string
---@param choix table|nil
---@return table
function Modular.TenueComplete(famille, genre, choix)
    local sortie = Modular.TenueBase(famille, genre)
    if (type(choix) ~= "table") then return sortie end
    for slot, id in pairs(choix) do
        if (id == false) then
            sortie[slot] = nil
        elseif (type(id) == "string" and id ~= "") then
            sortie[slot] = id
        end
    end
    return sortie
end

--- Vrai si le mesh de base peut être caché sans amputer le personnage.
---
--- Deux conditions, et la seconde a failli coûter cher :
---
---  1. la famille livre une peau découpée — sinon le mesh de base EST la seule
---     peau, et le cacher rendrait le joueur invisible ;
---  2. cette peau couvre la TÊTE, par un slot visage ou tete.
---
--- ⚠ SANS LA SECONDE, LE PERSONNAGE EST DÉCAPITÉ. La famille mpfb a reçu le
--- 2026-09-04 quatre vêtements taillés dans son corps — torse, jambes, mains,
--- pieds. Ils suffisaient à la déclarer « cachable », le porteur disparaissait,
--- et il ne restait plus de tête : aucune pièce ne la remplaçait.
---
--- Les familles Stylized (slot visage) et Trooper (slot tete) passent, elles.
---@param famille string
---@param genre string
---@return boolean
function Modular.PorteurCachable(famille, genre)
    local t = Modular.TENUE_BASE[tostring(famille) .. "|" .. tostring(genre)]
    if (t == nil or next(t) == nil) then return false end
    return t.visage ~= nil or t.tete ~= nil
end

--- Toutes les pièces, indexées par identifiant.
Modular.PIECES = {
// [ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : 60 ligne(s) attendue(s) ici, 40 connue(s)]
${lignesPieces}
}

--- Corps disponibles pour un genre, ordre stable.
---@param genre string
---@return table[]
function Modular.CorpsParGenre(genre)
    local ids = {}
    for id, c in pairs(Modular.CORPS) do
        if (c.genre == genre) then ids[#ids + 1] = id end
    end
    table.sort(ids)

    local sortie = {}
    for i = 1, #ids do
        local c = Modular.CORPS[ids[i]]
        sortie[i] = { id = ids[i], asset = c.asset, label = c.label, famille = c.famille }
    end
    return sortie
end

--- Un corps par son identifiant, ou nil.
--- Rend nil plutôt qu'un défaut : l'appelant décide, et un corps inconnu venant
--- du client ne doit surtout pas en spawner un autre.
---@param id string
---@return table|nil
function Modular.Corps(id)
    if (type(id) ~= "string") then return nil end
    return Modular.CORPS[id]
end

--- Pièces d'un slot, pour un genre ET une famille donnés.
---
--- Rend une LISTE (ordre stable) et non une table indexée : l'interface la
--- parcourt telle quelle, et pairs n'a aucun ordre garanti en Lua.
---
--- 'famille' est OBLIGATOIRE. Sans elle, l'écran proposerait des vêtements
--- MetaHuman sur un corps Stylized et le joueur composerait une tenue cassée.
---@param slot string
---@param genre string    "M" ou "F"
// [ANCIENNE VERSION ↑]
// [DERNIÈRE VERSION ↓ — ligne(s) sûre(s) du fichier final, lue(s) dans le tronçon ci-dessus mais non replacée(s) : il a changé de longueur. Leur n° final est entre crochets]
// [SÛRE n°1901] --- sans eux les 119 pieces modulaires seraient ecartees comme orphelines. Les
// [SÛRE n°1912] --- une DECISION. La generer par filtre (« ceux qui ont un blueprint ») ferait
// [SÛRE n°1931]                 famille = c.famille, blueprint = c.blueprint,
// [DERNIÈRE VERSION ↑]
---@param famille string  voir Modular.FAMILLES
---@return table
function Modular.ParSlot(slot, genre, famille)
    local ids = {}
    for id, p in pairs(Modular.PIECES) do
        -- Genre "*" : pièce mixte, portée par les deux corps.
        local bon_genre = (p.genre == genre) or (p.genre == "*")
        if (p.slot == slot and bon_genre and p.famille == famille) then
            ids[#ids + 1] = id
        end
    end
    table.sort(ids)

    local sortie = {}
    for i = 1, #ids do
        local p = Modular.PIECES[ids[i]]
        sortie[i] = {
            id = ids[i], asset = p.asset, label = p.label,
            ensemble = p.ensemble, registre = p.registre, famille = p.famille,
        }
    end
    return sortie
end

--- Ordre de préférence pour la tenue par défaut.
---
--- CIVIL d'abord : un personnage neuf doit arriver HABILLÉ, pas nu. Les pièces
--- de corps nu restent choisissables — elles sont la base du système modulaire —
--- mais elles ne sont plus ce qu'on porte au départ.
---
--- 'base' en repli, parce que le slot visage n'a AUCUNE pièce civile : tous les
--- visages sont classés base. Sans ce repli, un personnage naîtrait sans tête.
local PREFERENCE_DEFAUT = { "civil", "base" }

--- Slots qui relèvent de l'IDENTITÉ : ils ne prennent que du base.
---
--- ⚠ SANS EUX, UN PERSONNAGE NEUF NAÎT COIFFÉ D'UN CHAPEAU. Depuis que les
--- couvre-chefs du pack Stylized sont au catalogue, le slot tete contient des
--- pièces civil — et PREFERENCE_DEFAUT les prend AVANT les coiffures, qui
--- sont en base. Le joueur héritait d'une casquette d'aviateur qu'il n'avait
--- pas choisie.
---
--- Un chapeau se choisit ; des cheveux, un visage et une barbe se reçoivent.
local SLOTS_IDENTITE = { visage = true, barbe = true, tete = true }

--- Tenue par défaut d'un genre et d'une famille.
---
--- Un slot sans pièce du registre voulu reste VIDE. C'est délibéré : coiffer
--- d'office quelqu'un d'un casque de combat, ou même d'une casquette, serait un
--- choix qu'il n'a pas fait.
---@param genre string
---@param famille string
---@return table
function Modular.TenueDefaut(genre, famille)
    local tenue = {}

    for _, slot in ipairs(Modular.SLOTS) do
        local liste = Modular.ParSlot(slot, genre, famille)

        local preference = SLOTS_IDENTITE[slot] and { "base" } or PREFERENCE_DEFAUT
        for _, registre in ipairs(preference) do
            for i = 1, #liste do
                if (liste[i].registre == registre) then
                    tenue[slot] = liste[i].id
                    break
                end
            end
            if (tenue[slot]) then break end
        end
    end

    return tenue
end

--- Une tenue est-elle cohérente ? Rend (ok, raison).
--- Une tenue invalide est un cas de jeu normal (fiche ancienne, pack modifié),
--- pas une exception.
---@param tenue table
---@param genre string
---@param famille string|nil
---@return boolean, string|nil
function Modular.ValiderTenue(tenue, genre, famille)
    if (type(tenue) ~= "table") then return false, "Tenue absente" end

    for slot, id in pairs(tenue) do
        local p = Modular.PIECES[id]
        if (not p) then
            return false, "Piece inconnue : " .. tostring(id)
        end
        if (p.slot ~= slot) then
            return false, string.format("La piece %s est un %s, pas un %s", id, p.slot, slot)
        end
        if (p.genre ~= "*" and p.genre ~= genre) then
            return false, string.format("La piece %s est %s, le personnage est %s", id, p.genre, genre)
        end
        -- LE MELANGE DE FAMILLES EST REFUSE. Voir l'en-tete : les os concordent,
        -- les volumes non, et l'interpenetration serait visible sans etre
        -- comprehensible.
        if (famille and p.famille ~= famille) then
            return false, string.format(
                "La piece %s est de morphologie %s, le corps est %s", id, p.famille, famille)
        end
    end
    return true, nil
end

return Modular
`;

// ── Sortie ────────────────────────────────────────────────────────────────────

console.log(APPLY ? "=== APPLIQUÉ ===" : "=== SIMULATION (ajouter --apply) ===");
// [ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : 49 ligne(s) attendue(s) ici, 22 connue(s)]
console.log(`  ${fichiers.length} GLB lus, ${pieces.length} pièce(s) classée(s)`);

const parGenre = { M: 0, F: 0, "*": 0 };
for (const p of pieces) parGenre[p.genre]++;
console.log(`  genre    : ${parGenre.M} homme, ${parGenre.F} femme, ${parGenre["*"]} mixte`);

console.log(`  corps    : ${corps.length}`);
for (const c of corps) console.log(`      ${c.genre}  ${c.famille.padEnd(10)} ${c.label}`);

console.log("  familles :");
for (const f of Object.keys(parFamille).sort()) {
  console.log(`      ${f.padEnd(10)} ${parFamille[f].length} piece(s)`);
}

for (const slot of Object.keys(parSlot).sort()) {
  console.log(`  ${slot.padEnd(8)} : ${parSlot[slot].length}`);
}

if (refuses.length) {
  // Non classé = non exposé au joueur. Le dire fort : ce sont des pièces payées
  // et importées qui n'arriveraient jamais à l'écran.
  console.log("");
// [ANCIENNE VERSION ↑]
  console.log(`  ⚠ ${refuses.length} NON CLASSÉE(S) — absentes du catalogue :`);
// [ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : 12 ligne(s) attendue(s) ici, 13 connue(s)]
  for (const r of refuses) console.log(`      ${r}`);
}

if (APPLY) {
  fs.mkdirSync(path.dirname(CIBLE), { recursive: true });
  fs.writeFileSync(CIBLE, lua, "utf8");
  console.log("");
  console.log(`  écrit : ${CIBLE}`);
} else {
  console.log("");
  console.log("Rien écrit.");
}
// [SÛRE dans une version intermédiaire, non replacée]     console.log(`  Vêtements exclus en attente du rebind + cook (manifeste metacustom-squelettes.json) :`);
// [ANCIENNE VERSION ↑]
// [MODIFICATIONS NON REPLACÉES — 2 modification(s) faite(s) à ce fichier n'ont pas pu y être reportées (texte d'origine introuvable ou ambigu) : voir EDITS_NON_APPLIQUES]