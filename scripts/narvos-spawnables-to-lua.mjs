// ══════════════════════════════════════════════════════════════════════════════
// narvos-spawnables-to-lua.mjs — catalogue des PNJ et monstres invocables.
//
//   node scripts/narvos-spawnables-to-lua.mjs [--apply]
//
// Produit `Shared/Catalogs/Spawnables.lua` : ce que le menu de spawn peut
// réellement faire apparaître, avec son rôle (allié / ennemi / monstre / …).
//
// ── LA RÈGLE QUI GOUVERNE CE FICHIER ──────────────────────────────────────────
// Une entrée n'existe QUE si son asset est dans le pack cuit. On lit donc
// `Server/Assets/narvos/Assets.toml`, pas un dossier source.
//
// Mesuré le 2026-09-03 : sur les 59 PNJ de `Npc.lua`, **4 seulement** ont leur
// mesh dans le pack. Générer le menu depuis le catalogue de contenu aurait donné
// 55 entrées qui, une fois cliquées, auraient fait apparaître la CAPSULE DE
// COLLISION — un cylindre blanc. nanos ne lève pas sur un asset manquant.
//
// C'est la troisième fois que ce défaut se présente sur ce projet (67 animations
// mortes, 76 pièces trooper). La parade est toujours la même : lire l'inventaire
// de ce qui EST, jamais la liste de ce qu'on voudrait.
//
// ── POURQUOI DEUX SOURCES ─────────────────────────────────────────────────────
//   1. `Npc.lua` — les PNJ écrits par le jeu : nom, faction, classe, rôle.
//      Riches en sens, pauvres en assets tant que `public/models/pnj/` n'est pas
//      importé.
//   2. Les corps présents dans le pack — pauvres en sens, mais réels. On les
//      classe par convention de nom, et ils garnissent le menu dès aujourd'hui.
//
// Les deux se rejoignent : quand un PNJ de `Npc.lua` trouve son asset, il prend
// la place de l'entrée générique.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { diagnostiquerMaillage } from "./lib/uasset-materiaux.mjs";

const APPLY = process.argv.includes("--apply");


const RACINE = "E:/narvosprime-web-prototype";
const TOML = `${RACINE}/WebPortal/Server/Assets/narvos/Assets.toml`;
const CATALOGS = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs`;

// ── UNITÉS : le prototype web compte en MÈTRES, Unreal en CENTIMÈTRES ─────────
//
// `modelScaleMult` vient des catalogues TS, où un humain mesure 1,70. Repris tel
// quel, le PNJ fait 1,7 cm dans nanos : il est là, devant le joueur, et
// invisible à l'œil. Mesuré le 2026-09-05 sur les 72 meshes du menu — 31 sont
// dans ce cas.
//
// ⚠ LA CONVERSION N'EST PAS GÉNÉRALE. 41 des 72 viennent de packs Unreal et sont
// DÉJÀ en centimètres (mannequins à 182,6 u, modulaires à 186,6 u). Les
// multiplier par 100 en ferait des géants de 180 mètres. D'où la mesure par
// asset plutôt qu'une règle globale.
//
// Le facteur artistique du catalogue est CONSERVÉ et multiplié, pas remplacé :
// le crabe Aquarys fait 0,004 u et porte déjà un ×400 ; sans le ×100 il
// atteindrait 1,6 cm, toujours invisible. 0,004 × 400 × 100 = 160 cm.
const BOUNDS = `${RACINE}/WebPortal/Server/adk/_pnj-bounds.json`;

/** Hauteur mesurée par asset, ou `{}` si la mesure n'a jamais été faite. */
const hauteurs = (() => {
  if (!fs.existsSync(BOUNDS)) {
    console.error(`  ⚠ ${BOUNDS} absent — aucune conversion d'unité appliquée.`);
    console.error("    Relancer scripts/ue-remote.py avec dump_bounds.py, editeur ADK ouvert.");
    return {};
  }
  return JSON.parse(fs.readFileSync(BOUNDS, "utf8"));
})();

/** Seuil sous lequel un mesh est réputé authoré en mètres. */
const SEUIL_METRES = 5;

// ── L'ECHELLE PORTEE PAR L'ANIMATION DE REPOS ────────────────────────────────
//
// Mesure du 2026-09-13 (`scripts/narvos-pnj-facteur-anim.mjs`) : l'animation
// jouee par `Spawner.ANIM_REPOS` porte sur l'os racine une echelle 100 fois
// celle du squelette (GLB Meshy, noeud `Armature` a 0,01). L'echelle du
// catalogue, mesuree AU REPOS, rendait donc des PNJ de 150 a 175 m des qu'ils
// s'animaient. `echelle_animee` = echelle / facteur : celle a poser quand
// l'animation joue. Manifeste absent = aucun champ, le comportement d'avant.
const FACTEURS_ANIM = path.join(RACINE, "WebPortal", "Server", "adk", "_manifests", "pnj-facteur-anim.json");
const facteursAnim = (() => {
  if (!fs.existsSync(FACTEURS_ANIM)) {
    console.error(`  ⚠ ${FACTEURS_ANIM} absent — pas d'echelle animee (node scripts/narvos-pnj-facteur-anim.mjs --apply).`);
    return {};
  }
  return JSON.parse(fs.readFileSync(FACTEURS_ANIM, "utf8")).entrees ?? {};
})();

// ── LA TAILLE GLOBALE DES PNJ, EN CENTIMETRES ────────────────────────────────
//
// Demandee par Hanibes le 2026-09-12 : « tu as oublie de definir une taille au
// pnj global ce qui peux regler le bug des pnj tres grands ».
//
// Elle n'existait NULLE PART. Le facteur d'echelle etait recopie du catalogue
// web — ou il avait ete calibre pour Three.js, sur des GLB en metres — puis
// multiplie par 100. Rien ne regardait le RESULTAT. Le crabe Aquarys porte
// ainsi `echelle = 40000` : juste, parce que son mesh fait 0,004 unite ; mais
// la meme formule sur un mesh deja en centimetres donnerait 400 metres.
//
// On raisonne donc en TAILLE FINALE, pas en facteur :
//     hauteur_cm = hauteur_du_mesh x echelle
// puis on ramene l'echelle dans les bornes si la taille en sort.
//
// ⚠ DEUX JEUX DE BORNES, ET LA DISTINCTION EST REELLE. Un humanoide qui sort de
// 150-210 cm est un defaut ; une creature peut legitimement etre naine ou
// gigantesque — un boss a le droit de faire quatre metres. Une borne unique
// aurait soit laisse passer les geants, soit rabote les monstres.
const TAILLE_CM = {
  humanoide: { min: 150, max: 210 },
  creature:  { min: 40,  max: 400 },
};

/** Les familles peuplees d'humains. Tout le reste est une creature. */
const FAMILLES_HUMANOIDES = new Set([
  "PNJ", "Mannequins", "Modulaires", "Troopers", "Cyber",
]);

const bornesDe = (famille) =>
  FAMILLES_HUMANOIDES.has(famille) ? TAILLE_CM.humanoide : TAILLE_CM.creature;

/** Ce que le generateur a corrige, pour le dire en fin de course. */
const plafonnes = [];

/** Échelle à écrire dans le catalogue : unité convertie ET taille bornée. */
function echelleFinale(entree) {
  const base = entree.echelle || 1;
  const mesure = hauteurs[entree.asset];

  // Sans mesure, on ne peut RIEN borner : borner a l'aveugle rabattrait un mesh
  // deja correct. Ces entrees sont comptees et nommees en fin de generation —
  // c'est le travail restant, pas un silence.
  if (!mesure || !(mesure.hauteur > 0)) return base;

  const echelle = mesure.hauteur < SEUIL_METRES ? base * 100 : base;

  const bornes = bornesDe(entree.famille);
  const cm = mesure.hauteur * echelle;
  if (cm >= bornes.min && cm <= bornes.max) return echelle;

  // On corrige l'ECHELLE pour atteindre la borne, on ne touche pas au mesh.
  const cible = cm > bornes.max ? bornes.max : bornes.min;
  const corrigee = cible / mesure.hauteur;
  plafonnes.push({ id: entree.id, avant: cm, apres: cible, famille: entree.famille });
  // Arrondi a 4 decimales : une echelle a quinze chiffres rend le catalogue
  // illisible et le diff bruyant, pour un ecart sous le dixieme de millimetre.
  return Math.round(corrigee * 10000) / 10000;
}

// ── Inventaire du pack ────────────────────────────────────────────────────────

if (!fs.existsSync(TOML)) {
  console.error(`Assets.toml introuvable : ${TOML}`);
  console.error("Lancer d'abord scripts/nanos-build-asset-pack.mjs --apply");
  process.exit(1);
}

/** { skeletal_meshes: {nom: chemin}, static_meshes: {...}, … } */
const pack = {};
{
  let section = null;
  for (const ligne of fs.readFileSync(TOML, "utf8").split("\n")) {
    const s = ligne.match(/^\s*\[assets\.(\w+)\]/);
    if (s) { section = s[1]; pack[section] ??= {}; continue; }
    const a = ligne.match(/^\s*([^\s=[]+)\s*=\s*"(.*?)"/);
    if (a && section) pack[section][a[1]] = a[2];
  }
}
const SK = pack.skeletal_meshes ?? {};
const SM = pack.static_meshes ?? {};

// ── Corps génériques présents dans le pack ────────────────────────────────────

/** Règles de classement des corps, par ordre de priorité.
 *
 *  ⚠ ON CLASSE PAR NOM D'ASSET, ce qui est une convention et non une garantie.
 *  Chaque règle porte donc le pack dont elle vient : si le pack change de
 *  convention, la règle cesse de correspondre et l'entrée disparaît du menu —
 *  ce qui est le bon échec. L'inverse (classer par défaut en « ennemi ») ferait
 *  apparaître un mannequin de test dans la liste des monstres. */
// ── ⚠ LES MANNEQUINS SONT JUGÉS SUR LEUR CHEMIN, JAMAIS SUR LEUR SUFFIXE ────
//
// Mesure du 2026-09-13. Ces règles lisaient `SK_Mannequin_1[0-5]` et
// `SK_Mannequin_Female_[4-7]` comme « les zombies du ZombieSoldierPack ». Or le
// suffixe n'est pas un nom : c'est le RANG d'homonyme que le constructeur du pack
// donne dans l'ordre des dossiers. La promotion de Farming And Mining (le 13/09)
// a inséré `Narvos/Farming_And_Mining/.../SK_Mannequin` avant les zombies :
//   · `SK_Mannequin_Female_4` = le mannequin de WW100IdleAnimPack, publié
//     « Infectée 4 » dans le menu des MONSTRES ;
//   · `SK_Mannequin_15` et `SK_Mannequin_Female_8` = deux zombies absents du
//     catalogue ;
//   · et l'identifiant `«redacted:sk_…»` changeait de corps à chaque promotion.
// Le chemin, lui, ne bouge pas. L'identifiant est tiré du chemin aussi.
const ZOMBIES = "Narvos/ZombieSoldierPack_original/";
const EST_MANNEQUIN = /^SK_Mannequin(_Female)?(_\d+)?$/;
/** `.../Characters/SovietZombie1/...` -> `sovietzombie1` */
const personnageZombie = (chemin) => (chemin.slice(ZOMBIES.length).split("/")[1] || "inconnu").toLowerCase();
/** Le dossier de pack sous `Narvos/` : `Narvos/FPP_combat_fists/...` -> `fpp_combat_fists` */
const dossierPack = (chemin) => (chemin.split("/")[1] || "inconnu").toLowerCase();

// ── LES INFECTÉS SONT LES CORPS DE ZOMBIES, PAS LES MANNEQUINS DE LEUR DÉMO ──
//
// Mesure du 2026-09-13 (RAPPORT_PNJ §4) : la règle prenait `SK_Mannequin` sous
// ZombieSoldierPack_original — c'est-à-dire `Characters/<X>/Demo/Mannequin*/…`,
// les mannequins GRIS de la démo du pack. Dix « Infectés » gris dans le menu des
// monstres, dont `zombiesoldier4` sans aucune texture. Les vrais corps sont à
// `Characters/<X>/(Mesh|Base_mesh|BaseMesh)/UE4/SM_*` : sur SKEL_Mannequin nanos,
// matériaux compilés et skinnés, 4-5 textures par slot (zombies-materiaux.txt).
// `_Body_UE4` est écarté : c'est un torse sans tête ni vêtements (Sailer), pas un
// personnage. Les identifiants restent `infecte_<personnage>` : même clé, corps juste.
const CORPS_ZOMBIE = /\/Characters\/[^/]+\/(Mesh|Base_mesh|BaseMesh)\/UE4\/SM_[^/]+$/;

const REGLES = [
  [(nom, chemin) => chemin.startsWith(ZOMBIES) && CORPS_ZOMBIE.test(chemin) && !/_Body_UE4$/.test(nom), {
    role: "monstre", famille: "Infectes",
    id: (nom, chemin) => `infecte_${personnageZombie(chemin)}`,
    label: (nom, chemin) => `Infecte ${personnageZombie(chemin)}`,
  }],

  // Personnages complets d'autres packs.
  [/^SK_CyberpunkSamurai_With(out)?Helmet$/, { role: "neutre", famille: "Cyber", label: (n) => n.includes("without") || n.includes("Without") ? "Samourai cyber (sans casque)" : "Samourai cyber (casque)" }],
  [/^SK_Valkiria$/, { role: "neutre", famille: "Cyber", label: () => "Valkiria" }],

  // SciFi Trooper, corps ENTIERS armures (tete nue ou casque). Mesure du
  // 2026-09-11, pas une supposition : squelette SKEL_Mannequin de nanos (lu dans
  // leurs .uasset), materiau M_Trooper_* a 3 textures (BaseColor 1,4 Mo) qui
  // resolvent toutes sur disque. Le « gris » vu le 2026-09-04 venait des pieces
  // NUES (MTL_BodyForms : zero texture), pas de ces armures.
  // Les variantes SANS tete sont des bases modulaires : un PNJ decapite n'est pas
  // un PNJ, la regle ne les prend pas.
  [/^SK_(M|F|PF)_Trooper_standalone_(armor_)?(multi_mats_with_head|single_mat_with_head_and_helmet)$/, {
    role: "allie", famille: "Troopers",
    label: (n) => "Trooper " + ({ M: "homme", F: "femme", PF: "femme menue" })[n.split("_")[1]]
      + (n.includes("helmet") ? " (casque)" : " (tete nue)"),
  }],

  // Mannequins de référence : utiles pour tester, pas pour peupler le monde.
  // Tous ceux qui ne sont PAS des zombies, identifiés par leur pack.
  //
  // ⚠ HORS DU MENU PAR DÉFAUT depuis le 2026-09-13 : « d'autres PNJ apparaissent
  // sans textures » (Hanibes). Ces 15 mannequins sont gris PAR CONCEPTION, et le
  // menu les présentait à côté des vrais PNJ. `NARVOS_MANNEQUINS_TEST=1` les
  // republie pour un essai de squelette.
  [(nom, chemin) => process.env.NARVOS_MANNEQUINS_TEST === "1"
      && !chemin.startsWith(ZOMBIES) && EST_MANNEQUIN.test(nom), {
    role: "test", famille: "Mannequins",
    id: (nom, chemin) => `mannequin_${/Female/.test(nom) ? "f_" : ""}${dossierPack(chemin)}`,
    label: (nom, chemin) => `Mannequin ${/Female/.test(nom) ? "feminin " : ""}(${dossierPack(chemin)})`,
  }],
];

/** Une règle est une expression sur le NOM, ou une fonction (nom, chemin). */
const correspond = (regle, nom, chemin) =>
  (typeof regle === "function" ? regle(nom, chemin) : regle.test(nom));

const generiques = [];
const idsGeneriques = new Set();
for (const nom of Object.keys(SK).sort()) {
  const chemin = SK[nom];
  const regle = REGLES.find(([r]) => correspond(r, nom, chemin));
  if (!regle) continue;
  const [, def] = regle;
  let id = def.id ? def.id(nom, chemin) : nom.toLowerCase();
  // Deux mannequins d'un même pack : le second garde un identifiant distinct,
  // tiré du nom d'asset — jamais d'un rang d'homonyme du TOML.
  if (idsGeneriques.has(id)) id = `${id}_${nom.toLowerCase()}`;
  idsGeneriques.add(id);
  generiques.push({
    id,
    asset: nom,
    role: def.role,
    famille: def.famille,
    label: def.label(nom, chemin),
    source: "pack",
  });
}

// ── Personnages Defender : jugés sur leur NATURE, pas sur leur nom ───────────
//
// Les SkeletalMesh de `Defender/Demo/Characters` ont été cuits le 2026-09-11 avec
// `skeleton = None` : leur squelette pointait `/Game/Defender/...`, disparu à la
// promotion. `scripts/adk-reparer-squelettes-promus.py` les rebranche et les pose
// sur SKEL_Mannequin. On n'en publie un QUE si son `.uasset` pointe réellement le
// squelette nanos — lu sur disque, pas supposé. Sinon il reste « en attente » et
// le compte le dit : un personnage sans squelette serait une capsule blanche.
//
// Sélection par CHEMIN (dossier Characters), pas par nom de clé : la
// déduplication d'Assets.toml renomme les homonymes (SKM_Manny -> SKM_Manny_3).
const DEFENDER_CHARACTERS = "Narvos/Defender/Demo/Characters/";
const SKEL_NANOS = "/Game/NanosWorld/Characters/Common/SKEL_Mannequin";
const CONTENT_ADK = `${RACINE}/WebPortal/Server/adk/Content`;

/** Vrai si le .uasset du chemin de pack nomme le squelette nanos (table de noms :
 *  1 Mo en tête et en fin, comme narvos-squelettes-uasset.mjs). */
function surSqueletteNanos(cheminPack) {
  const f = `${CONTENT_ADK}/${cheminPack.replace(/^Narvos\//, "Narvos/")}.uasset`;
  if (!fs.existsSync(f)) return false;
  const taille = fs.statSync(f).size;
  const fd = fs.openSync(f, "r");
  try {
    const n = Math.min(taille, 1048576);
    const tete = Buffer.alloc(n);
    fs.readSync(fd, tete, 0, n, 0);
    if (tete.includes(SKEL_NANOS)) return true;
    const queue = Buffer.alloc(n);
    fs.readSync(fd, queue, 0, n, Math.max(0, taille - n));
    return queue.includes(SKEL_NANOS);
  } finally {
    fs.closeSync(fd);
  }
}

const LIBELLES_DEFENDER = {
  Hero: "Héros", Trooper: "Trooper", Murdock: "Murdock",
  MurdockWasteland: "Murdock des terres brûlées", MurdockExecutionerV2: "Murdock l'exécuteur",
  ShadowOps: "Opérateur de l'ombre", WraithLunarOps: "Wraith lunaire",
  TrainingSoldiers: "Soldat d'entraînement",
};
// Rôle par personnage : les FORCES du pack (Murdock, opérateurs, Wraith) sont des
// adversaires — ce sont eux qui remplacent les Meshy ×100 du peuplement (décision
// de Hanibes, 2026-09-11). Héros, Trooper et soldats d'entraînement restent alliés.
// Un rôle décide du profil d'IA (`Ia.ProfilPourRole`) : ennemi = patrouilleur.
const ROLES_DEFENDER = {
  Murdock: "ennemi", MurdockWasteland: "ennemi", MurdockExecutionerV2: "ennemi",
  ShadowOps: "ennemi", WraithLunarOps: "ennemi",
};
const defender = [];
const defenderEnAttente = [];
for (const [nom, chemin] of Object.entries(SK).sort()) {
  if (!chemin.startsWith(DEFENDER_CHARACTERS)) continue;
  const dossier = chemin.slice(DEFENDER_CHARACTERS.length).split("/")[0];
  if (!(dossier in LIBELLES_DEFENDER)) continue;          // Gruntling, Spider, Manny : autres squelettes
  if (!surSqueletteNanos(chemin)) { defenderEnAttente.push(nom); continue; }
  const variante = nom.replace(/^SK_/, "").replace(/_/g, " ");
  defender.push({
    id: nom.toLowerCase(),
    asset: nom,
    role: ROLES_DEFENDER[dossier] ?? "allie",
    famille: "Defender",
    label: dossier === "TrainingSoldiers"
      ? `${LIBELLES_DEFENDER[dossier]} (${variante})`
      : LIBELLES_DEFENDER[dossier],
    source: "pack",
  });
}

// ── PNJ écrits, gated sur la présence de leur mesh ────────────────────────────

/** Racines de pack dont les meshes portent leur PROPRE squelette.
 *
 *  ⚠ CE N'EST PAS UNE SUPPOSITION, C'EST UNE MESURE. `adk-verify-skeletons.py`,
 *  lancé le 2026-09-04, rend pour ces deux racines :
 *
 *      60 SkeletalMesh liés à 37 squelettes fraîchement créés
 *      0 lié à SKEL_Mannequin
 *
 *  Conséquence : ils ne peuvent PAS passer par `Character`, qui impose le
 *  Mannequin — ils y afficheraient la capsule de collision, un cylindre blanc,
 *  sans la moindre erreur. `CharacterSimple`, lui, « accepte n'importe quel
 *  mesh, sans contrainte de squelette ».
 *
 *  ⚠ APRÈS TOUT NOUVEL IMPORT, RELANCER LA MESURE :
 *      UnrealEditor-Cmd … -script=scripts/adk-verify-skeletons.py
 *  Un pack importé sans squelette imposé et absent de cette liste donnerait des
 *  cylindres blancs, silencieusement. */
const RACINES_SQUELETTE_PROPRE = ["/pnj/", "/pnj_monstre/"];

/** Ce mesh doit-il passer par `CharacterSimple` ? */
function exigeSimple(cheminPack) {
  const c = cheminPack.toLowerCase();
  return RACINES_SQUELETTE_PROPRE.some((r) => c.includes(r));
}

/** Le mesh d'un PNJ, s'il est dans le pack.
 *
 *  Le catalogue TS désigne un DOSSIER (`soldat_humain`) ; l'import a produit des
 *  assets dont le chemin de pack contient ce dossier. On cherche donc dans les
 *  CHEMINS, pas dans les noms — le nom d'asset ne porte pas le dossier.
 *
 *  ── POURQUOI LA RECHERCHE EST BORNÉE À LA RACINE DU PNJ ──────────────────────
 *  Chercher `/echo/` dans TOUT le pack rendait `SKM_Echo_Hair` — une chevelure.
 *  `/manny/` rendait `Manny_calf_l_anim`, un mollet. `/quinn/` rendait `MF_Idle`,
 *  une animation. Trois PNJ auraient fait apparaître un cheveu, un mollet et une
 *  pose de liaison.
 *
 *  La cause est documentée dans le skill nanos-world : « importer un GLB
 *  d'ANIMATION crée aussi un SkeletalMesh (la pose de liaison embarquée) ». Le
 *  pack en contient donc des milliers qui ne sont pas des corps.
 *
 *  `assetRoot` du catalogue TS dit d'où vient le PNJ (`/models/pnj_monstre`, ou
 *  `/models/pnj` par défaut). On s'y tient : hors de cette racine, l'entrée est
 *  déclarée absente plutôt que remplie au hasard.
 *
 *  @param dossier   nom du dossier du PNJ
 *  @param racine    segment de chemin de pack où chercher, ex. `/pnj_monstre/`
 */
function meshDuDossier(dossier, racine) {
  const cle = `/${dossier.toLowerCase()}/`;
  const dansLaRacine = (chemin) => {
    const c = chemin.toLowerCase();
    return c.includes(cle) && c.includes(racine);
  };

  for (const [nom, chemin] of Object.entries(SK)) {
    if (dansLaRacine(chemin)) {
      return { nom, type: "skeletal", simple: exigeSimple(chemin) };
    }
  }
  for (const [nom, chemin] of Object.entries(SM)) {
    // Un static mesh n'a par définition aucun squelette : `Character` le
    // refuserait de toute façon.
    if (dansLaRacine(chemin)) {
      return { nom, type: "static", simple: true };
    }
  }
  return null;
}

/** Rôle du catalogue TS -> rôle du menu. */
const ROLES = { ally: "allie", enemy: "ennemi", merchant: "marchand", quest: "quete" };

const npcLua = fs.readFileSync(path.join(CATALOGS, "Npc.lua"), "utf8");
const ecrits = [];
const absents = [];
{
  // ⚠ ON DECOUPE EN BLOCS PUIS ON LIT CHAQUE CHAMP SEPAREMENT.
  // Une seule expression qui enchaine `folder`…`factionId` suppose un ORDRE et
  // une PRESENCE que le catalogue ne garantit pas : 25 des 59 entrees n'ont pas
  // de `factionId`, et une expression rigide en avait silencieusement perdu 25.
  const blocs = npcLua.split(/\n\s*\{\s*(?=folder = )/).slice(1);
  const champ = (b, nom) => (b.match(new RegExp(nom + ' = "(.*?)"')) ?? [])[1];
  const nombre = (b, nom) => {
    const v = (b.match(new RegExp(nom + " = ([0-9.]+)")) ?? [])[1];
    return v === undefined ? undefined : Number(v);
  };

  for (const b of blocs) {
    const dossier = champ(b, "folder");
    if (!dossier) continue;
    const role = champ(b, "role") ?? "";
    // `assetRoot` distingue les monstres des PNJ humanoides : le catalogue TS
    // range les premiers sous /models/pnj_monstre. C'est plus fiable que le nom,
    // et c'est AUSSI ce qui borne la recherche du mesh (voir meshDuDossier).
    const monstre = (champ(b, "assetRoot") ?? "").includes("pnj_monstre");
    const racine = monstre ? "/pnj_monstre/" : "/pnj/";

    const mesh = meshDuDossier(dossier, racine);
    if (!mesh) { absents.push(dossier); continue; }
    ecrits.push({
      id: dossier.toLowerCase(),
      asset: mesh.nom,
      type: mesh.type,
      simple: mesh.simple,
      role: monstre && role === "enemy" ? "monstre" : (ROLES[role] ?? "neutre"),
      famille: monstre ? "Creatures" : "PNJ",
      label: champ(b, "label") ?? dossier,
      class_id: champ(b, "classId"),
      faction: champ(b, "factionId"),
      // Certaines creatures sont exportees a une echelle absurde : le crabe
      // Aquarys demande x40. Sans ce champ, il apparait de la taille d'un pouce.
      echelle: nombre(b, "modelScaleMult"),
      source: "npc",
    });
  }
}

// ── Corps modulaires : ils font des PNJ crédibles, habillables ────────────────

const modularLua = fs.readFileSync(path.join(CATALOGS, "Modular.lua"), "utf8");
const corpsModulaires = [];
{
  // `Modular.CORPS` est une table INDEXEE PAR CLE (`id = { … }`), pas un
  // tableau d'objets portant un champ `id`. Les deux formes se ressemblent en
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
    const [, id, asset, genre, famille, label] = m;
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
      famille: "Modulaires",
      label: `${label} (${genre})`,
      modular_famille: famille,
      source: "modular",
    });
  }
}

// ── CIVILS METACUSTOM (PNJ SIMPLE, 2026-09-19) ────────────────────────────────
// Les corps MetaCustom sortis `pnj_simple = true` par narvos-modular-to-lua.mjs
// sont réservés aux CharacterSimple : squelette Skel_Dummy, JAMAIS un Character.
// La regex des modulaires ci-dessus ne les voit pas (le champ pnj_simple casse
// son motif) — c'est voulu : ils entrent ici comme civils NEUTRES, habillés au
// spawn par Peuplement (tenue = "metacustom").
const civilsMetaCustom = [];
{
  const debut = modularLua.indexOf("Modular.CORPS = {");
  const bloc = debut < 0 ? "" : modularLua.slice(debut, modularLua.indexOf("\n}", debut));
  const ligne = /^\s*(\w+) = \{ asset = "narvos::(.*?)", genre = "(.*?)", famille = "(.*?)", label = "(.*?)", pnj_simple = true \}/gm;
  let m;
  while ((m = ligne.exec(bloc)) !== null) {
    const [, id, asset, genre, famille, label] = m;
// [DERNIÈRE VERSION ↓ — ligne(s) sûre(s) du fichier final, lue(s) dans le tronçon ci-dessus mais non replacée(s) : il a changé de longueur. Leur n° final est entre crochets]
// [SÛRE n°509]     if (!SK[asset]) continue;
// [SÛRE n°510]     civilsMetaCustom.push({
// [SÛRE n°511]       id: `civil_${id}`,
// [SÛRE n°512]       asset,
// [SÛRE n°513]       role: "neutre",
// [SÛRE n°514]       famille: "MetaCustom",
// [SÛRE n°515]       label: `Civile ${label}`,
// [SÛRE n°516]       source: "metacustom",
// [SÛRE n°517]       simple: true,
// [SÛRE n°518]       tenue: "metacustom",
// [SÛRE n°519]     });
// [SÛRE n°520]   }
// [SÛRE n°521] }
// [DERNIÈRE VERSION ↑]
// [ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : 1 ligne(s) attendue(s) ici, 13 connue(s)]
    if (!SK[asset]) continue; // gate : jamais une reference que le pack n'a pas
    corpsModulaires.push({
      id: `modulaire_${id}`,
      asset,
      role: "allie",
      famille: "Modulaires",
      label: `${label} (${genre})`,
      modular_famille: famille,
      source: "modular",
    });
  }
}

// [ANCIENNE VERSION ↑]
// ── EN ATTENTE : véhicules City_Traffic_Pro ───────────────────────────────────
//
// Stagés dans `adk/Content/City_Traffic_Pro/` (587 `.uasset`, 12 voitures SK +
// PhysicsAssets) mais comptés 0 fois dans `Assets.toml` au 10/09 — non cuits.
//
// Et même cuits, ils N'ENTRENT PAS dans ce catalogue : il alimente
// `Character`/`CharacterSimple`, et `Car_Skeleton` n'est pas `SKEL_Mannequin` —
// un véhicule spawné ici serait un cylindre blanc, sans erreur. Leur
// compatibilité `VehicleWheeled` ne se tranchera qu'en faisant tourner le cook
// (MISSION_KIMI_BRANCHEMENT_2026-09-10 §5), et les conventions d'os divergent
// d'un pack à l'autre (`Wheel_FL/FR/RL/RR` ici, `Front_Left_Wheel…` sur les
// motos Digital Dive) : le mapping vivra dans une table de données côté Logic.
//
// Ici on les COMPTE seulement : « cuit mais invisible partout » est le mode
// d'échec que ce fichier existe pour empêcher.
const vehiculesEnAttente = Object.entries(SK)
  .filter(([, chemin]) => chemin.includes("/City_Traffic_Pro/"))
  .map(([nom]) => nom)
  .sort();

// ── Assemblage ────────────────────────────────────────────────────────────────

// Ordre = priorite. Un PNJ ecrit l'emporte sur un corps modulaire, qui
// l'emporte sur l'entree generique du meme asset : a chaque etage le nom
// affiche est plus parlant que celui de l'etage suivant.
const toutes = [...ecrits, ...corpsModulaires, ...generiques, ...defender, ...civilsMetaCustom];
// Le compte rendu dit combien de personnages Defender entrent et combien
// attendent encore leur squelette : un zéro silencieux ressemblerait à un
// pack absent, pas à une réparation qui n'a pas pris.
console.log(`  Defender : ${defender.length} personnage(s) sur SKEL_Mannequin, `
  + `${defenderEnAttente.length} en attente (squelette non nanos)`
  + (defenderEnAttente.length ? ` : ${defenderEnAttente.slice(0, 6).join(", ")}` : ""));
// Dédoublonnage : un PNJ écrit l'emporte sur l'entrée générique du même asset.
const vus = new Set();
const entrees = [];
for (const e of toutes) {
  const cle = e.asset.toLowerCase();
  if (vus.has(cle)) continue;
  vus.add(cle);
  entrees.push(e);
}

// Diagnostic texture de chaque maillage publié, calculé une fois.
const diagnostiquesTexture = new Map();
for (const e of entrees) {
  const chemin = SK[e.asset];
  if (chemin && !diagnostiquesTexture.has(e.asset)) diagnostiquesTexture.set(e.asset, diagnostiquerMaillage(chemin));
}
{
  const erreurs = [...diagnostiquesTexture.values()].filter((d) => !d.ok).length;
  const translucides = [...diagnostiquesTexture.values()].filter((d) => d.translucide).length;
  console.log(`  Textures : ${diagnostiquesTexture.size - erreurs} maillage(s) OK, ${erreurs} en ERREUR, ${translucides} translucide(s)`);
}

const ROLES_MENU = [
  ["allie", "PNJ allies"],
  ["ennemi", "PNJ ennemis"],
  ["monstre", "Monstres"],
  ["marchand", "Marchands"],
  ["quete", "PNJ de quete"],
  ["neutre", "Autres PNJ"],
  ["test", "Mannequins de test"],
];

// ── Rendu ─────────────────────────────────────────────────────────────────────

const q = (s) => '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';

const presents = ROLES_MENU.filter(([r]) => entrees.some((e) => e.role === r));

const lua = [
  "-- Genere par scripts/narvos-spawnables-to-lua.mjs — ne pas editer a la main.",
  "--",
  `-- ${entrees.length} entrees invocables, verifiees presentes dans le pack cuit.`,
  "--",
  "-- ⚠ CE FICHIER NE CONTIENT QUE DES ASSETS REELS. Un mesh absent du pack ne",
  "-- leve pas dans nanos : il affiche la capsule de collision, un cylindre blanc.",
  "-- Le generateur croise donc chaque entree avec `Assets.toml` avant de l'ecrire.",
  `-- Au moment de la generation, ${absents.length} PNJ de Npc.lua n'avaient pas`,
  "-- d'asset et ont ete ECARTES ; ils reviendront apres import de public/models/pnj.",
  "",
  "local Spawnables = {}",
  "",
  "Spawnables.PACK = " + q("narvos"),
  "",
  "--- Roles, dans l'ordre d'affichage du menu.",
  "Spawnables.ROLES = {",
  ...presents.map(([id, label]) => `    { id = ${q(id)}, label = ${q(label)} },`),
  "}",
  "",
  "Spawnables.ENTREES = {",
  ...entrees.map((e) => {
    const champs = [
      `id = ${q(e.id)}`,
      `asset = ${q(e.asset)}`,
      `role = ${q(e.role)}`,
      `famille = ${q(e.famille)}`,
      `label = ${q(e.label)}`,
      `source = ${q(e.source)}`,
    ];
    if (e.class_id) champs.push(`class_id = ${q(e.class_id)}`);
    if (e.faction) champs.push(`faction = ${q(e.faction)}`);
    if (e.simple) champs.push("simple = true");
    // `tenue` : déclenche l'habillage au spawn (Peuplement) — corps MetaCustom
    // nus + pièces pnj_simple du même genre, par AddSkeletalMeshAttached.
    if (e.tenue) champs.push(`tenue = ${q(e.tenue)}`);
    const echelle = echelleFinale(e);
    if (echelle && echelle !== 1) champs.push(`echelle = ${echelle}`);
    const facteur = facteursAnim[e.id]?.facteur;
    if (e.simple && facteur && facteur !== 1) {
      champs.push(`echelle_animee = ${Math.round(((echelle || 1) / facteur) * 10000) / 10000}`);
    }
    // La taille ATTENDUE en jeu, en centimetres. Elle voyage avec l'entree pour
    // que le diagnostic compare le rendu a une valeur issue de la MEME mesure,
    // et pour que les tests puissent opposer le catalogue a ses propres bornes.
    const mesure = hauteurs[e.asset];
    if (mesure && mesure.hauteur > 0) {
      champs.push(`taille_cm = ${Math.round(mesure.hauteur * (echelle || 1))}`);
    }
    // DIAGNOSTIC TEXTURE, lu dans le pack CUIT (lib/uasset-materiaux.mjs) : un
    // matériau absent, un parent hors pack ou un matériau non compilé pour le skin
    // donnent un PNJ gris. Le menu et /editionpnj l'affichent au lieu de le taire.
    const diag = diagnostiquesTexture.get(e.asset);
    if (diag) {
      champs.push(`texture = ${q(diag.ok ? "ok" : "erreur")}`);
      if (!diag.ok) champs.push(`texture_raison = ${q(diag.erreurs.join(" ; "))}`);
      if (diag.translucide) champs.push("translucide = true");
    }
    return `    { ${champs.join(", ")} },`;
  }),
  "}",
  "",
  "local par_id = {}",
  "for _, e in ipairs(Spawnables.ENTREES) do par_id[e.id] = e end",
  "",
  "---@param id any",
  "---@return table|nil",
  "function Spawnables.Trouver(id)",
  '    if (type(id) ~= "string") then return nil end',
  "    return par_id[id]",
  "end",
  "",
  "--- Chemin complet pour `Character`/`CharacterSimple`/`StaticMesh`.",
  "---@param id string",
  "---@return string|nil",
  "function Spawnables.Asset(id)",
  "    local e = Spawnables.Trouver(id)",
  "    if (not e) then return nil end",
  "    return Spawnables.PACK .. " + q("::") + " .. e.asset",
  "end",
  "",
  "--- Entrees d'un role.",
  "---@param role string",
  "---@return table",
  "function Spawnables.ParRole(role)",
  "    local sortie = {}",
  "    for _, e in ipairs(Spawnables.ENTREES) do",
  "        if (e.role == role) then sortie[#sortie + 1] = e end",
  "    end",
  "    return sortie",
  "end",
  "",
  "--- Recherche par sous-chaine, insensible a la casse.",
  "---@param texte string",
  "---@param maximum? integer",
  "---@return table",
  "function Spawnables.Chercher(texte, maximum)",
  "    local sortie = {}",
  '    if (type(texte) ~= "string" or texte == "") then return sortie end',
  "    local recherche = texte:lower()",
  "    local n = maximum or 60",
  "    for _, e in ipairs(Spawnables.ENTREES) do",
  "        if (e.label:lower():find(recherche, 1, true) or e.id:lower():find(recherche, 1, true)) then",
  "            sortie[#sortie + 1] = e",
  "            if (#sortie >= n) then break end",
  "        end",
  "    end",
  "    return sortie",
  "end",
  "",
  "--- Un PNJ hostile doit-il attaquer ? Le menu de spawn le lit pour proposer",
  "--- une case a cocher, et Server/Spawner.lua pour armer l'IA.",
  "---@param id string",
  "---@return boolean",
  "function Spawnables.EstHostile(id)",
  "    local e = Spawnables.Trouver(id)",
  '    return e ~= nil and (e.role == "ennemi" or e.role == "monstre")',
  "end",
  "",
  "return Spawnables",
].join("\n") + "\n";

// ── Sortie ────────────────────────────────────────────────────────────────────

console.log(APPLY ? "=== APPLIQUE ===" : "=== SIMULATION (ajouter --apply) ===");
console.log(`  pack     : ${Object.keys(SK).length} skeletal, ${Object.keys(SM).length} static`);
console.log(`  PNJ ecrits    : ${ecrits.length} avec asset, ${absents.length} ECARTES (sans asset)`);
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
  console.log(`\n  EN ATTENTE — ${vehiculesEnAttente.length} vehicule(s) City_Traffic_Pro dans le pack,`);
  console.log("  volontairement HORS de ce catalogue (compatibilite VehicleWheeled non tranchee) :");
  for (const v of vehiculesEnAttente) console.log(`      ${v}`);
} else {
  console.log("\n  vehicules City_Traffic_Pro : 0 dans le pack (non cuits — normal a cette date).");
}

// -- CE QUE LA BORNE A CORRIGE -----------------------------------------------
// Le dire, meme quand c'est zero : un plafond silencieux ne se distingue pas
// d'un plafond absent, et c'est exactement l'etat d'ou l'on vient.
if (plafonnes.length === 0) {
  console.log(`
  taille   : aucune entree hors bornes `
    + `(humanoide ${TAILLE_CM.humanoide.min}-${TAILLE_CM.humanoide.max} cm, `
    + `creature ${TAILLE_CM.creature.min}-${TAILLE_CM.creature.max} cm)`);
} else {
  console.log(`
  taille   : ${plafonnes.length} entree(s) RAMENEE(S) dans les bornes`);
  for (const p of plafonnes) {
    console.log(`      ${p.id.padEnd(30)} ${p.avant.toFixed(0)} cm -> ${p.apres} cm  (${p.famille})`);
// [ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : 17 ligne(s) attendue(s) ici, 17 connue(s)]
  }
}
{
  const sans = entrees.filter((e) => !hauteurs[e.asset] || !(hauteurs[e.asset].hauteur > 0));
  if (sans.length > 0) {
    console.log(`  ⚠ ${sans.length} entree(s) SANS mesure : aucune borne applicable.`);
    console.log(`    ${sans.map((e) => e.asset).join(", ")}`);
    console.log("    Les mesurer : scripts/adk-mesurer-personnages.py, editeur ADK.");
  }
}

if (APPLY) {
  fs.writeFileSync(path.join(CATALOGS, "Spawnables.lua"), lua, "utf8");
  console.log("\n  ecrit : Spawnables.lua");
} else {
  console.log("\nRien ecrit.");
}
// [TROU — ligne jamais lue dans les transcriptions]
// [ANCIENNE VERSION ↑]