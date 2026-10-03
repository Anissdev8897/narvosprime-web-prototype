// ══════════════════════════════════════════════════════════════════════════════
// narvos-animaux-to-lua.mjs — le catalogue des compagnons, lu sur le disque.
//
//   node scripts/narvos-animaux-to-lua.mjs           # simulation
//   node scripts/narvos-animaux-to-lua.mjs --apply   # ecrit le catalogue
//
// ── D'OU VIENT LA DONNEE ──────────────────────────────────────────────────────
// Du pack J.Suko Animals, extrait de son .unitypackage par
// `scripts/unity-extraire-package.py` : 331 FBX (modeles ET animations) ranges
// par taxon — Invertebrate/Vertebrata, puis classe, ordre, espece.
//
// L'arborescence EST la donnee. Une liste d'especes ecrite a la main divergerait
// du disque au premier ajout, et ce depot a paye cinq fois « une liste recopiee
// diverge toujours de sa source ».
//
// ── LE FLAG `cuit` : LA MOITIE QUI MANQUE ─────────────────────────────────────
// Un FBX sur le disque n'est PAS un asset jouable. Il faut l'importer dans
// l'ADK, le cuire, et le voir apparaitre dans `Assets.toml`. Tant que ce n'est
// pas fait, `Spawner`/`CharacterSimple` recevrait une reference morte — et une
// reference morte ne leve RIEN : la creature n'apparait simplement pas.
//
// Le generateur resout donc chaque espece contre `Assets.toml` et pose
// `cuit = true/false`. L'executant refuse une espece non cuite EN LA NOMMANT,
// au lieu d'invoquer dans le vide. Le jour ou l'import est fait, une seule
// re-execution bascule les drapeaux.
//
// ── POURQUOI UN LIBELLE FRANCAIS OBLIGATOIRE ─────────────────────────────────
// Le depot est en francais et le joueur lit ces noms. Une espece sans libelle
// est EXCLUE avec sa raison, jamais emise sous son nom de dossier anglais :
// « BowerBird » dans une liste d'adoption est un defaut visible, pas un detail.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const RACINE = "E:/narvosprime-web-prototype";
const SOURCE =
  RACINE +
  "/WebPortal/public/asset_game/moteur_unity/jsuko_extrait/Assets/JSAllAnimals";
const TOML = RACINE + "/WebPortal/Server/Assets/narvos/Assets.toml";
const SORTIE =
  RACINE + "/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/Animaux.lua";
const APPLIQUER = process.argv.includes("--apply");

// ── Les libelles ──────────────────────────────────────────────────────────────
// Ecrits a la main, et c'est leur place : traduire n'est pas une donnee que le
// disque porte. Une espece absente de cette table est EXCLUE, pas devinee.
const LABELS = {
  Ammonite: ["Ammonite", "invertebre"],
  Anomalocaris: ["Anomalocaris", "invertebre"],
  Ceratocanthus: ["Scarabee ceratocanthus", "insecte"],
  Shrimp: ["Crevette", "invertebre"],
  SnowCrab: ["Crabe des neiges", "invertebre"],
  FrogAndSkeleton: ["Grenouille", "amphibien"],
  PoisonDartFrog: ["Grenouille venimeuse", "amphibien"],
  Archaeopteryx: ["Archeopteryx", "oiseau"],
  BaldEagle: ["Pygargue a tete blanche", "oiseau"],
  BarnOwl: ["Chouette effraie", "oiseau"],
  BowerBird: ["Oiseau jardinier", "oiseau"],
  Cassowary: ["Casoar", "oiseau"],
  HarpyEagle: ["Harpie feroce", "oiseau"],
  Hummingbird: ["Colibri", "oiseau"],
  Ostrich: ["Autruche", "oiseau"],
  Penguin: ["Manchot", "oiseau"],
  Pigeon: ["Pigeon", "oiseau"],
  RedCrownedCrane: ["Grue du Japon", "oiseau"],
  Secretarybird: ["Messager sagittaire", "oiseau"],
  Swan: ["Cygne", "oiseau"],
  Dunkleosteus: ["Dunkleosteus", "poisson"],
  Angelfish: ["Poisson-ange", "poisson"],
  Arowana: ["Arowana", "poisson"],
  Pirarucu: ["Pirarucu", "poisson"],
  Sardine: ["Sardine", "poisson"],
  Seahorse: ["Hippocampe", "poisson"],
  Capybara: ["Capybara", "mammifere"],
  ManedWolf: ["Loup a criniere", "mammifere"],
  Orca: ["Orque", "mammifere"],
  AllosaurusAndSkeleton: ["Allosaure", "reptile"],
  Gallimimus: ["Gallimimus", "reptile"],
  Gecko: ["Gecko", "reptile"],
  Iguana: ["Iguane", "reptile"],
  Komododragon: ["Dragon de Komodo", "reptile"],
  Mosasaurus: ["Mosasaure", "reptile"],
  AlligatorSnappingTurtle: ["Tortue alligator", "reptile"],
  BoxTurtle: ["Tortue-boite", "reptile"],
  GiantTortoise: ["Tortue geante", "reptile"],
  RedFootedTortoise: ["Tortue charbonniere", "reptile"],
  SeaTurtle: ["Tortue marine", "reptile"],
  Tortoise: ["Tortue terrestre", "reptile"],
};

// ── Lecture du disque ─────────────────────────────────────────────────────────
if (!fs.existsSync(SOURCE)) {
  console.error("ARRET : " + SOURCE + " est absent.");
  console.error("        Extraire d'abord : python scripts/unity-extraire-package.py <paquet> --appliquer");
  process.exit(1);
}

/** Tous les dossiers portant un sous-dossier `Models`. */
function especes(racine) {
  const out = [];
  (function descendre(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const p = path.join(d, e.name);
      if (e.name === "Models") {
        out.push(path.dirname(p));
      } else {
        descendre(p);
      }
    }
  })(racine);
  return out;
}

function fbxDe(dossier) {
  if (!fs.existsSync(dossier)) return [];
  return fs
    .readdirSync(dossier)
    .filter((f) => /\.fbx$/i.test(f))
    .sort();
}

/** Les clés d'une section d'`Assets.toml`, avec leur chemin. */
function sectionToml(lignes, nom) {
  const out = new Map();
  const debut = lignes.findIndex((l) => l.trim() === nom);
  if (debut < 0) return out;
  for (let i = debut + 1; i < lignes.length; i++) {
    if (/^\s*\[/.test(lignes[i])) break;
    const m = /^\s*([A-Za-z0-9_\-]+)\s*=\s*"([^"]+)"/.exec(lignes[i]);
    if (m) out.set(m[1], m[2]);
  }
  return out;
}

const lignesToml = fs.existsSync(TOML) ? fs.readFileSync(TOML, "utf8").split("\n") : [];
const declares = new Set(sectionToml(lignesToml, "[assets.skeletal_meshes]").keys());

// ⚠ LES ANIMATIONS SE LISENT, ELLES NE SE DEVINENT PAS.
//
// Un FBX peut porter PLUSIEURS prises, et Unreal nomme alors chaque AnimSequence
// a sa facon. Fabriquer les noms depuis les noms de fichier produirait des
// references mortes muettes : `PlayAnimation` sur une cle inconnue ne leve rien,
// la bete reste figee et personne n'apprend pourquoi.
//
// On lit donc `[assets.animations]` du pack CUIT et on range par espece d'apres
// le CHEMIN. La verite est celle du pack, pas celle du disque source.
const animationsParEspece = new Map();
for (const [cle, chemin] of sectionToml(lignesToml, "[assets.animations]")) {
  const m = /^Narvos\/JSAnimals\/([^/]+)\/Anims\//.exec(chemin);
  if (!m) continue;
  const espece = m[1];
  if (!animationsParEspece.has(espece)) animationsParEspece.set(espece, []);
  animationsParEspece.get(espece).push(cle);
}

/**
 * L'animation de repos d'une espèce, ou nil.
 *
 * Ordre de préférence, du plus sûr au plus flou. ⚠ Les variantes `OnPlace`
 * viennent en TÊTE : le compagnon est déplacé par `MoveTo`, et une animation à
 * root motion translaterait l'entité en plus — les deux se battraient. Le pack
 * fournit ces variantes exprès, c'est leur emploi.
 */
// ⚠ DEUX ORTHOGRAPHES POUR LA MÊME CHOSE. Le pack écrit `OnPlace` la plupart du
// temps et `InPlace` pour la tortue géante (`AnimationsWalkInPlace`). Un motif
// qui n'en connaît qu'une laisse l'espèce figée — c'était le cas.
const SUR_PLACE = "(?:on|in)place";

// Ce qu'on ne joue JAMAIS en boucle au repos. Une bête qui attaque, meurt ou se
// défend en permanence est un défaut visible tout de suite ; l'immobilité, non.
const JAMAIS_AU_REPOS = /attack|hit|death|defense|defence|steal|jump|bite|fall|rebirth/i;

/**
 * L'animation de repos d'une espèce, ou nil.
 *
 * ⚠ Le dernier étage n'est PAS « la première de la liste ». C'est la convention
 * de NOM du pack : les clips de base s'appellent `<Espece>Animations1`,
 * `Animations2`… — vérifié sur les espèces qui n'ont qu'un seul clip (ammonite,
 * orque, cygne, sardine s'appellent toutes `Animations1`). Un numéro est une
 * intention de l'auteur, pas un hasard d'ordre alphabétique.
 *
 * Une espèce dont TOUS les clips sont des gestes d'action reste sans repos, et
 * le générateur le dit. Le pigeon n'a qu'un `AttackHitTurnAnim` : il vaut mieux
 * un pigeon immobile qu'un pigeon qui attaque le vide en boucle.
 */
function reposDe(cles) {
  // ⚠ On ne cherche QUE parmi les clips paisibles, y compris pour « idle ».
  //
  // Le pack combine parfois plusieurs gestes dans un seul clip :
  // `AnimationsIdleFall` (grenouille), `AnimationKichHitIdleFall` (autruche).
  // Le mot « idle » y est, mais boucler dessus ferait tomber la bete en
  // permanence. Un clip dont le nom annonce une action n'est pas un repos,
  // meme s'il annonce aussi un repos.
  const paisibles = cles.filter((c) => !JAMAIS_AU_REPOS.test(c));

  const ordre = [
    // Repos explicite, sur place : le meilleur cas.
    new RegExp(`idle.*${SUR_PLACE}`, "i"),
    new RegExp(`stand.*${SUR_PLACE}`, "i"),
    new RegExp(`basic.*${SUR_PLACE}`, "i"),
    // Repos explicite.
    /idle/i,
    /stand/i,
    /basic/i,
    // Sur place, quel que soit le geste : il ne translatera pas l'entite.
    new RegExp(SUR_PLACE, "i"),
    // ⚠ LA LOCOMOTION EST LE REPOS DE BEAUCOUP D'ESPECES. Un poisson au repos
    // NAGE ; un poisson immobile est casse. Trois especes (poisson-ange,
    // arowana, pirarucu) n'ont que `Eat`, `HitDeathRebirth` et `Swim` : le
    // repos, c'est `Swim`, et aucun motif « idle » ne l'aurait trouve.
    // Le compagnon suit le joueur de toute facon — une boucle de nage ou de
    // marche est juste, pas un pis-aller.
    /swim/i,
    /fly|hover/i,
    /walk/i,
    // Le clip de base, par convention de nom du pack (`<Espece>Animations1`) —
    // verifie sur les especes qui n'ont qu'un seul clip.
    /animations?1$/i,
    /animations?\d+$/i,
  ];

  for (const motif of ordre) {
    const trouve = paisibles.find((c) => motif.test(c));
    if (trouve) return trouve;
  }
  return null;
}

const retenues = [];
const exclus = [];
const trop_longs = [];

for (const dossier of especes(SOURCE).sort()) {
  const relatif = path.relative(SOURCE, dossier).replace(/\\/g, "/");
  const nom = path.basename(dossier);

  // ⚠ Le pack garde ses anciennes versions sous `Old/`. Les emettre donnerait
  // deux entrees pour la meme bete, dont une perimee — et rien ne dirait
  // laquelle est laquelle dans la liste d'adoption.
  if (/(^|\/)Old(\/|$)/.test(relatif)) {
    exclus.push([relatif, "version ancienne rangee sous Old/"]);
    continue;
  }

  // ⚠ Le sous-dossier COMPTE. Certaines especes rangent leur corps sous
  // `Models/Bodies/` (l'ammonite y separe corps et coquilles). Un premier jet
  // lisait bien `Bodies/` mais ecrivait le chemin `Models/<fichier>` : le
  // catalogue citait un fichier qui n'existe pas, et rien ne l'aurait dit avant
  // l'import ADK. On garde le sous-dossier avec le nom.
  let sousDossier = "Models";
  let modelesRacine = fbxDe(path.join(dossier, "Models"));
  if (modelesRacine.length === 0) {
    modelesRacine = fbxDe(path.join(dossier, "Models", "Bodies"));
    sousDossier = "Models/Bodies";
  }
  if (modelesRacine.length === 0) {
    exclus.push([relatif, "aucun FBX sous Models/ ni Models/Bodies/"]);
    continue;
  }

  const label = LABELS[nom];
  if (!label) {
    exclus.push([relatif, "aucun libelle francais dans LABELS — a traduire"]);
    continue;
  }

  // Le modele principal : on prefere une version a LOD (celle que le pack
  // destine au jeu) puis le premier par ordre alphabetique. Jamais un fichier
  // dont le nom annonce une variante ("Ver1.0", "Skeleton").
  const propres = modelesRacine.filter((f) => !/ver\d|skeleton/i.test(f));
  const candidats = propres.length ? propres : modelesRacine;
  let principal = candidats.find((f) => /twolods/i.test(f)) || candidats[0];

  // ⚠ MAX_PATH. Windows refuse un chemin de plus de 260 caracteres aux API
  // classiques, et la taxonomie du pack (regne/classe/ordre/espece/Models/…)
  // s'en approche. Mesure du 2026-09-10 : le modele a LOD de la tortue
  // alligator fait 265 caracteres — `os.path.exists` rend False dessus, et
  // l'importeur ADK a annonce « FBX absent » sur un fichier bien present.
  //
  // Le prefixe `\\?\` leve la limite pour Python, mais rien ne garantit que
  // l'importeur FBX d'Unreal l'accepte. On preserve donc un chemin NORMAL :
  // quand le candidat prefere depasse, on prend le plus court qui tienne, et
  // on le DIT — un LOD perdu en silence serait pire que la limite elle-meme.
  const LIMITE = 255;
  // ⚠ Mesurer le VRAI chemin. Un premier jet ecrivait
  // `path.resolve(dossier, sousDossier.replace(/^Models$/, "."), f)`, ce qui
  // remplace `Models` par `.` et perd donc SEPT caracteres : il annoncait 258
  // la ou le disque en compte 265. La garde a mordu quand meme, par chance —
  // un fichier a 262 caracteres reels aurait ete mesure a 255 et serait passe.
  // Une garde qui se trompe de sept caracteres ne garde rien.
  const absolu = (f) => path.resolve(path.join(dossier, sousDossier, f)).length;
  if (absolu(principal) > LIMITE) {
    const tenables = candidats
      .filter((f) => absolu(f) <= LIMITE)
      .sort((a, b) => absolu(a) - absolu(b));
    if (tenables.length === 0) {
      exclus.push([relatif,
        "tous les modeles depassent " + LIMITE + " caracteres de chemin (MAX_PATH)"]);
      continue;
    }
    trop_longs.push(
      relatif + " : " + principal + " (" + absolu(principal) + " car.) -> " + tenables[0]);
    principal = tenables[0];
  }

  // Les FBX d'animation sur le DISQUE (indication), et les AnimSequence
  // reellement CUITES (verite). Les deux comptes different quand un import a
  // echoue : les afficher tous les deux rend l'ecart visible au lieu de le
  // laisser croire a une espece pauvre en animations.
  const animations = fbxDe(path.join(dossier, "Animations"));
  const cuitesAnim = (animationsParEspece.get(nom) || []).slice().sort();
  const repos = reposDe(cuitesAnim);

  // Le nom qu'aura l'asset une fois importe et cuit. Convention du depot :
  // un SkeletalMesh porte le prefixe `SK_`.
  const mesh = "SK_" + nom;

  retenues.push({
    id: nom.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase(),
    label: label[0],
    famille: label[1],
    taxon: relatif,
    mesh,
    cuit: declares.has(mesh),
    fbx: relatif + "/" + sousDossier + "/" + principal,
    animations: animations.length,
    anims: cuitesAnim,
    repos,
  });
}

// ⚠ Zero cible = ROUGE. Un catalogue vide qui s'ecrit sans rien dire rendrait
// le harnais vert par vacuite.
if (retenues.length === 0) {
  console.error("ARRET : aucune espece retenue — rien a ecrire.");
  for (const [r, pourquoi] of exclus) console.error("  exclu  " + r + " : " + pourquoi);
  process.exit(1);
}

const cuites = retenues.filter((r) => r.cuit).length;

console.log(
  retenues.length + " espece(s) retenue(s), " + exclus.length + " exclue(s). " +
    cuites + " deja cuite(s) dans Assets.toml."
);
for (const [r, pourquoi] of exclus) console.log("  exclu  " + r + " : " + pourquoi);
for (const t of trop_longs) console.log("  MAX_PATH  " + t);

// ── L'état des animations, dit à voix haute ──────────────────────────────────
// Une espèce cuite sans animation reste une statue qui glisse. Une espèce
// animée sans repos identifié jouera… rien. Les deux sont des états légitimes
// à un instant donné, et aucun ne doit être découvert en jeu.
const totalAnims = retenues.reduce((n, r) => n + r.anims.length, 0);
const sansAnim = retenues.filter((r) => r.anims.length === 0);
const sansRepos = retenues.filter((r) => r.anims.length > 0 && !r.repos);
const surDisque = retenues.reduce((n, r) => n + r.animations, 0);

console.log("");
console.log("  " + totalAnims + " AnimSequence cuite(s) reparties sur "
  + (retenues.length - sansAnim.length) + " espece(s).");
if (totalAnims > 0 && surDisque > totalAnims) {
  // ⚠ L'ecart entre le disque et le pack est le signal d'un import rate. Il
  // s'est produit : 102 clips sur 227 refuses pour cadence non alignee, sans
  // autre trace qu'une ligne au milieu de 40 000.
  console.log("  ⚠ " + surDisque + " FBX d'animation sur le disque pour "
    + totalAnims + " cuite(s) — " + (surDisque - totalAnims) + " manquante(s).");
}
if (sansAnim.length) {
  console.log("  sans aucune animation (" + sansAnim.length + ") : "
    + sansAnim.map((r) => r.id).join(", "));
}
if (sansRepos.length) {
  console.log("  ⚠ animees mais SANS repos identifie (" + sansRepos.length + ") : "
    + sansRepos.map((r) => r.id).join(", "));
  console.log("     Elles resteront FIGEES : aucun de leurs clips n'est paisible");
  console.log("     (idle / stand / basic / sur place / nage / vol / marche), ou");
  console.log("     tous annoncent une action. A trancher a la main.");
}
if (cuites === 0) {
  console.log("");
  console.log("  ⚠ AUCUNE espece n'est cuite : le catalogue est complet et");
  console.log("    AUCUN compagnon ne peut apparaitre. L'executant refusera en");
  console.log("    nommant l'espece. Import ADK + cook a faire.");
}

// ── Rendu ─────────────────────────────────────────────────────────────────────
const lignes = retenues.map((r) => {
  const listeAnims = r.anims.length
    ? "{ " + r.anims.map((a) => '"' + a + '"').join(", ") + " }"
    : "{}";
  return (
    "    { id = \"" + r.id + "\", label = \"" + r.label + "\"," +
    " famille = \"" + r.famille + "\",\n" +
    "      mesh = \"" + r.mesh + "\", cuit = " + (r.cuit ? "true" : "false") + "," +
    " fbx_animation = " + r.animations + ",\n" +
    "      repos = " + (r.repos ? '"' + r.repos + '"' : "nil") + ",\n" +
    "      anims = " + listeAnims + ",\n" +
    "      source = \"" + r.fbx + "\" },"
  );
});

const parFamille = {};
for (const r of retenues) parFamille[r.famille] = (parFamille[r.famille] || 0) + 1;
const repartition = Object.keys(parFamille)
  .sort()
  .map((f) => "--   " + f.padEnd(12) + String(parFamille[f]).padStart(3))
  .join("\n");

const contenu = [
  "-- " + "=".repeat(77),
  "-- Shared/Catalogs/Animaux.lua — FICHIER GENERE par",
  "-- scripts/narvos-animaux-to-lua.mjs. Toute edition a la main sera ecrasee.",
  "--",
  "-- Source : le pack J.Suko Animals extrait de son .unitypackage. L'ARBORESCENCE",
  "-- du pack est la donnee : une liste d'especes ecrite a la main divergerait du",
  "-- disque au premier ajout.",
  "--",
  "-- " + retenues.length + " espece(s) :",
  repartition,
  "--",
  "-- ⚠ `cuit` dit si le mesh est DECLARE dans Assets.toml. Un FBX sur le disque",
  "-- n'est pas un asset jouable : il faut l'importer dans l'ADK et le cuire.",
  "-- `Sound`/`CharacterSimple` sur une reference morte ne levent RIEN — la bete",
  "-- n'apparait simplement pas. L'executant DOIT lire ce drapeau.",
  "-- Etat a la generation : " + cuites + " / " + retenues.length + " cuite(s).",
  "-- " + "=".repeat(77),
  "",
  "local Animaux = {}",
  "",
  "Animaux.ESPECES = {",
  lignes.join("\n"),
  "}",
  "",
  "--- Une espece par son id, ou nil.",
  "function Animaux.Trouver(id)",
  "    if (type(id) ~= \"string\") then return nil end",
  "    for _, e in ipairs(Animaux.ESPECES) do",
  "        if (e.id == id) then return e end",
  "    end",
  "    return nil",
  "end",
  "",
  "--- Les especes reellement invocables (mesh cuit). Peut etre VIDE, et c'est",
  "--- une reponse : l'appelant doit le dire, pas invoquer dans le vide.",
  "function Animaux.Cuites()",
  "    local out = {}",
  "    for _, e in ipairs(Animaux.ESPECES) do",
  "        if (e.cuit) then out[#out + 1] = e end",
  "    end",
  "    return out",
  "end",
  "",
  "return Animaux",
  "",
].join("\n");

if (!APPLIQUER) {
  console.log("\n(simulation — relancer avec --apply pour ecrire " + SORTIE + ")");
  process.exit(0);
}

fs.writeFileSync(SORTIE, contenu, "utf8");
console.log("\nECRIT : " + SORTIE + " (" + (contenu.length / 1024).toFixed(1) + " ko)");

// ⚠ Le generateur N'ECRIT PAS dans Shared/Index.lua — il VERIFIE.
const index = RACINE + "/WebPortal/Server/nanos_world/packages/narvos/Shared/Index.lua";
if (fs.readFileSync(index, "utf8").includes('Package.Require("Catalogs/Animaux.lua")')) {
  console.log("Shared/Index.lua : Narvos.AnimauxCatalogue est cable.");
} else {
  console.error("\nATTENTION : le catalogue n'est PAS cable dans Shared/Index.lua.");
  console.error("Ajouter a la main :");
  console.error('    Narvos.AnimauxCatalogue = Package.Require("Catalogs/Animaux.lua")');
  process.exit(1);
}