// ══════════════════════════════════════════════════════════════════════════════
// schema-check.mjs — toute colonne du CREATE a-t-elle son ALTER de migration ?
//
//   node scripts/lua-harness/schema-check.mjs
//
// ── LE DÉFAUT QU'IL ATTRAPE ───────────────────────────────────────────────────
// `CREATE TABLE IF NOT EXISTS` ne touche PAS une table déjà créée. Une colonne
// ajoutée au CREATE n'existe donc que dans les bases NEUVES ; sur celle d'un
// joueur qui jouait la veille, elle manque.
//
// Vécu le 2026-09-04 : `corps` avait été ajoutée au CREATE et oubliée dans la
// liste des `ALTER`. Résultat, sur la base de développement :
//
//     SQL Error: table personnages has no column named corps
//
// à CHAQUE création de personnage — et côté joueur, un « Enregistrement
// impossible » sans le moindre indice. Le contrôle ci-dessous coûte une seconde
// et rend cet oubli impossible à livrer.
//
// ── CE QU'IL NE VÉRIFIE PAS ───────────────────────────────────────────────────
// Ni le TYPE, ni les contraintes. Une colonne créée `INTEGER NOT NULL` et
// migrée `TEXT` passerait. C'est délibéré : lire les types demanderait de
// parser deux dialectes SQL, et l'oubli qu'on a réellement commis — et qu'on
// recommencera — est l'oubli PUR ET SIMPLE de la ligne.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";

const SOURCE =
  "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared/Logic/Comptes.lua";

const lua = fs.readFileSync(SOURCE, "utf8");

// Colonnes qu'un ALTER ne PEUT pas ajouter après coup : clé primaire, clé
// étrangère, NOT NULL sans défaut sur une table déjà peuplée. Elles font partie
// du socle d'origine et n'ont jamais eu besoin de migration.
const SOCLE = new Set([
  // Clés primaires et étrangères : elles définissent la table, un ALTER ne les
  // ajoute pas.
  "id", "compte_id", "nom", "class_id", "genre", "niveau", "cree_le",
  "touche", "action", "pseudo", "hash", "sel",

  // `UNIQUE` : SQLite REFUSE `ADD COLUMN ... UNIQUE`. Ces colonnes ne peuvent
  // venir que du CREATE, et les réclamer ici serait demander l'impossible.
  "steam_id", "identifiant",

  // `NOT NULL` sans valeur par défaut : refusé sur une table déjà peuplée, la
  // base n'ayant rien à écrire dans les lignes existantes.
  "anim_id", "action_id",
]);

let echecs = 0;

/** Colonnes déclarées dans un bloc CREATE TABLE. */
function colonnesDuCreate(table) {
  const debut = lua.indexOf(`CREATE TABLE IF NOT EXISTS ${table}`);
  if (debut < 0) return null;

  // Le bloc se ferme sur `]]` ou `]==]` selon le niveau de crochets long choisi.
  const fin = Math.min(
    ...["]]", "]==]"].map((f) => {
      const i = lua.indexOf(f, debut);
      return i < 0 ? Infinity : i;
    }),
  );

  const colonnes = [];
  for (const ligne of lua.slice(debut, fin).split(/\r?\n/)) {
    const m = ligne.trim().match(/^([a-z_]+)\s+(TEXT|INTEGER|REAL|BLOB)/);
    if (m) colonnes.push(m[1]);
  }
  return colonnes;
}

// ⚠ LA MIGRATION EST UNE TABLE DE DONNEES, PAS UNE LISTE DE REQUETES.
//
// Elle a cesse d'emettre des `ADD COLUMN` en dur le 2026-09-04 : les emettre
// sur une colonne existante faisait journaliser neuf ERREURS SQL par nanos a
// chaque demarrage, avant meme que le `pcall` Lua puisse les absorber.
//
// On lit donc les DEUX formes. Ne reconnaitre que la premiere aurait rendu ce
// controle rouge sur une migration parfaitement correcte — et un controle qui
// crie a tort finit ignore.
const alters = new Set([
  ...[...lua.matchAll(/ADD COLUMN ([a-z_]+)/g)].map((m) => m[1]),
  ...[...lua.matchAll(/{ "[a-z_]+", "([a-z_]+)", "[A-Z]/g)].map((m) => m[1]),
]);

const TABLES = ["personnages", "comptes", "raccourcis", "commandes"];

for (const table of TABLES) {
  const colonnes = colonnesDuCreate(table);
  if (colonnes === null) {
    console.log(`  ${table.padEnd(14)} pas de CREATE — ignoree`);
    continue;
  }

  const manquantes = colonnes.filter((c) => !alters.has(c) && !SOCLE.has(c));

  if (manquantes.length === 0) {
    console.log(`  ${table.padEnd(14)} ${colonnes.length} colonne(s)  ok`);
  } else {
    echecs += manquantes.length;
    console.log(`  ${table.padEnd(14)} ${manquantes.length} SANS MIGRATION : ${manquantes.join(", ")}`);
  }
}

console.log("");
if (echecs > 0) {
  console.log(`${echecs} colonne(s) du CREATE sans ALTER correspondant.`);
  console.log("Sur une base anterieure elles MANQUERONT, et la requete qui les");
  console.log("nomme echouera — sans autre message que « Enregistrement impossible ».");
  process.exitCode = 1;
} else {
  console.log("Toute colonne du CREATE a son ALTER de migration.");
}