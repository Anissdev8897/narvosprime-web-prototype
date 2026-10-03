// ══════════════════════════════════════════════════════════════════════════════
// narvos-organize-models.mjs — Remet `public/models` dans la taxonomie du projet.
//
//   node scripts/narvos-organize-models.mjs [--apply]
//
// POURQUOI : le rapatriement depuis Unreal a laissé deux désordres distincts.
//   1. les catégories d'origine (personnages, pnj, spells…) se sont retrouvées
//      SOUS un dossier `NARVOS/`, d'un niveau trop bas ;
//   2. une cinquantaine de packs Unreal ont atterri à la racine, à plat.
//
// La taxonomie existe déjà et ne se réinvente pas : `scripts/lib/asset-taxonomy.mjs`
// définit les catégories physiques. La règle du projet est « un pack vit dans UN
// dossier, choisi sur son type dominant, et porte plusieurs tags au catalogue ».
//
// ⚠ NE JAMAIS RENOMMER une catégorie de premier niveau : 87 chemins sont codés en
// dur dans `src/` (`/models/vehicule/` ×29, `/models/Maps/` ×15…). Ce sont des
// chaînes : tsc ne verra jamais la rupture. Ce script ne fait que DÉPLACER vers
// des catégories existantes, jamais en créer ni en renommer.
//
// ORDRE D'EXÉCUTION : lancer `narvos-clean-unreal-artifacts.mjs` AVANT. La
// plupart des packs arrivés n'ont que des .uasset ; une fois nettoyés ils sont
// vides et disparaissent, ce qui réduit d'autant le travail de classement.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { CATEGORIES } from "../WebPortal/scripts/lib/asset-taxonomy.mjs";

const MODELS = "E:/narvosprime-web-prototype/WebPortal/public/models";
const APPLY = process.argv.includes("--apply");

const CATS = new Set(Object.keys(CATEGORIES));

/**
 * Classement des packs arrivés d'Unreal.
 *
 * Établi en lisant leur contenu, pas en devinant sur le nom. Chaque entrée porte
 * sa raison quand le choix n'est pas évident — c'est ce qui évite qu'on le
 * « corrige » plus tard sans savoir pourquoi il était comme ça.
 */
const CLASSEMENT = {
  // ── Créatures : bestiaire animal, tous riches en GLB ────────────────────────
  Animals_Warrior_Pack: "creatures",
  Animalia: "creatures",
  AnimalsVol01: "creatures",
  AnimalVarietyPack: "creatures",
  GoatWithGroom: "creatures",
  Dragon8: "creatures",
  VOL2_Birds: "creatures",
  animalis: "creatures",

  // ── Personnages ────────────────────────────────────────────────────────────
  ParagonGideon: "personnages",
  QuantumCharacter: "personnages",
  Survival_Character: "personnages",
  MilitaryCharSilver: "personnages",
  Synty: "personnages",
  Pirate: "personnages",
  ZombieGameMain: "pnj_monstre",

  // ── Armes ──────────────────────────────────────────────────────────────────
  MilitaryWeapDark: "armes",
  MilitaryWeapSilver: "armes",
  SciFiWeapLight: "armes",
  Weapons: "armes",
  Weapons_Free: "armes",
  HS_WeaponPack_03: "armes",
  CG_ShotgunPack: "armes",
  Action_Crossbow: "armes",
  arme_aniss: "armes",
  revolver: "armes",
  shotgun: "armes",
  shoulderstock: "armes",
  weapon: "armes",
  "serpents-gem-scepter": "armes",

  // ── Effets ─────────────────────────────────────────────────────────────────
  MegaMagicVFXBundle: "vfx",
  Realistic_Starter_VFX_Pack_Vol2: "vfx",

  // ── Bâtiments : kits modulaires et intérieurs habillés ─────────────────────
  Construction_VOL1: "batiments",
  EasyBuildingSystem: "batiments",
  EF_TwinsRoom: "batiments",
  EF_FirstFloor: "batiments",
  EF_Grounds: "environnements",

  // ── Personnages « EF_ » : ce sont des humains nommés, pas des décors ────────
  EF_Barbra: "personnages",
  EF_Gus: "personnages",
  EF_Lewis: "personnages",
  EF_MollyGreg: "personnages",
  EF_Edie: "personnages",
  EF_Edith: "personnages",
  EF_Sam: "personnages",

  // ── Décors et props ────────────────────────────────────────────────────────
  InfinityBladeGrassLands: "nature",
  IndustryPropsPack6: "divers",
  Cargo: "divers",
  LevelPrototyping: "divers",
  Sci_fi: "divers",
  halo: "environnements",

  // ── Interface, audio, matériaux ────────────────────────────────────────────
  CraftResourcesIcons: "interface",
  A_Surface_Footstep: "audio",
  AutoFootsteps: "audio",
  SmallSoundKit: "audio",
  MWLandscapeAutoMaterial: "materials",
  MSPresets: "materials",
  Megascans: "textures",

  // ── Sources de plugins : à porter, jamais chargées au runtime ───────────────
  FGearPlugin: "plugins_cpp",
  NPCEyesSightPRO: "plugins_cpp",
  uAim: "plugins_cpp",
  Nanimation: "plugins_cpp",

  // ── Contenu de moteur / gabarits : sortie brute, pas du runtime ────────────
  NanosWorld: "export",
  StarterContent: "export",
  FirstPerson: "export",
  ThirdPerson: "export",
  Variant_Horror: "export",
  Variant_Shooter: "export",
  Fab: "export",
  Core: "export",
  Blueprints: "export",
  Collections: "export",
  Developers: "export",
  Characters: "export",
};

// ─── utilitaires ──────────────────────────────────────────────────────────────

const compter = (dir) => {
  let n = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name));
      else n++;
    }
  };
  try {
    walk(dir);
  } catch {
    /* dossier disparu entre-temps */
  }
  return n;
};

/** Déplace `de` vers `vers`, en fusionnant si la destination existe déjà. */
const deplacer = (de, vers) => {
  if (!APPLY) return;
  if (!fs.existsSync(vers)) {
    fs.mkdirSync(path.dirname(vers), { recursive: true });
    fs.renameSync(de, vers);
    return;
  }
  // Fusion fichier par fichier : renameSync échoue sur une destination occupée.
  for (const e of fs.readdirSync(de, { withFileTypes: true })) {
    const src = path.join(de, e.name);
    const dst = path.join(vers, e.name);
    if (e.isDirectory()) deplacer(src, dst);
    else if (!fs.existsSync(dst)) fs.renameSync(src, dst);
  }
  try {
    if (fs.readdirSync(de).length === 0) fs.rmdirSync(de);
  } catch {
    /* laissé en place s'il reste des collisions */
  }
};

// ─── phase 1 : remonter les catégories piégées sous NARVOS/ ────────────────────

const plan = [];
const inconnus = [];

const dossierNarvos = path.join(MODELS, "NARVOS");
if (fs.existsSync(dossierNarvos)) {
  for (const e of fs.readdirSync(dossierNarvos, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const cible = CATS.has(e.name) ? e.name : CLASSEMENT[e.name];
    if (cible) {
      plan.push({
        phase: "remonte",
        de: path.join("NARVOS", e.name),
        vers: cible,
        fichiers: compter(path.join(dossierNarvos, e.name)),
      });
    } else {
      inconnus.push(path.join("NARVOS", e.name));
    }
  }
}

// ─── phase 2 : classer les packs restés à la racine ────────────────────────────

for (const e of fs.readdirSync(MODELS, { withFileTypes: true })) {
  if (!e.isDirectory() || e.name === "NARVOS" || CATS.has(e.name)) continue;
  const cible = CLASSEMENT[e.name];
  if (cible) {
    plan.push({ phase: "classe", de: e.name, vers: cible, fichiers: compter(path.join(MODELS, e.name)) });
  } else {
    inconnus.push(e.name);
  }
}

// ─── rapport ──────────────────────────────────────────────────────────────────

console.log(APPLY ? "=== APPLIQUÉ ===" : "=== SIMULATION (ajouter --apply) ===");
console.log(`racine : ${MODELS}`);
console.log("");

const vides = plan.filter((p) => p.fichiers === 0);
const actifs = plan.filter((p) => p.fichiers > 0);

const parCible = new Map();
for (const p of actifs) {
  const e = parCible.get(p.vers) || { n: 0, fichiers: 0, sources: [] };
  parCible.set(p.vers, { n: e.n + 1, fichiers: e.fichiers + p.fichiers, sources: [...e.sources, p.de] });
}

console.log(`  ${actifs.length} dossier(s) à déplacer, ${vides.length} vide(s) ignoré(s)`);
console.log("");
for (const [cible, e] of [...parCible].sort((a, b) => b[1].fichiers - a[1].fichiers)) {
  console.log(`  ${cible.padEnd(18)} ${String(e.fichiers).padStart(6)} fichiers  <-  ${e.sources.join(", ")}`);
}

if (inconnus.length) {
  console.log("");
  console.log(`  NON CLASSÉS (${inconnus.length}) — à ajouter dans CLASSEMENT :`);
  for (const n of inconnus) console.log(`    ${n}  (${compter(path.join(MODELS, n))} fichiers)`);
}

if (!APPLY) {
  console.log("");
  console.log("Rien déplacé.");
  process.exit(0);
}

// ─── application ──────────────────────────────────────────────────────────────

let faits = 0;
for (const p of actifs) {
  try {
    deplacer(path.join(MODELS, p.de), path.join(MODELS, p.vers));
    faits++;
  } catch (err) {
    console.log(`  ÉCHEC  ${p.de} — ${err.message}`);
  }
}

// NARVOS/ n'a plus lieu d'être une fois ses catégories remontées.
try {
  if (fs.existsSync(dossierNarvos) && fs.readdirSync(dossierNarvos).length === 0) {
    fs.rmdirSync(dossierNarvos);
  }
} catch {
  /* reste s'il contient encore des dossiers non classés */
}

console.log("");
console.log(`${faits}/${actifs.length} dossier(s) déplacé(s).`);
console.log("Régénérer le catalogue : npm run assets:catalog");