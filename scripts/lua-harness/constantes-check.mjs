// ══════════════════════════════════════════════════════════════════════════════
// constantes-check.mjs — deux constantes qui décrivent le même fait doivent
// dire la même chose.
//
//   node scripts/lua-harness/constantes-check.mjs
//
// ── POURQUOI CE CONTRÔLE EXISTE ───────────────────────────────────────────────
// Certaines valeurs sont écrites à DEUX endroits parce qu'elles servent deux
// rôles et que les fusionner créerait une dépendance qu'on ne veut pas. Elles ne
// peuvent donc pas avoir une source unique — mais rien n'empêche l'une de bouger
// sans l'autre, et l'écart ne fait AUCUN bruit.
//
// Le dépôt a déjà payé cette forme quatre fois :
//   · `Roster.EncoderCouleurs` itérait des clés recopiées — chaîne vide, couleurs
//     effacées en base, zéro signal.
//   · `SOUS_MENUS` (JS) et `SOUS_MENUS_PAUSE` (Lua) — Échap se comportait
//     différemment selon qui avait le focus. (Contrôlé par `ui-liens.mjs`.)
//   · `RAYON_RADAR_M` côté page vs les unités du serveur — facteur 100.
//   · `200` recopié dans `tests.lua` face à `DEFAULT_CREDITS = 500` — quatre
//     assertions fausses et une suite laissée rouge.
//
// Ce fichier est la liste explicite des paires qu'on accepte de garder doubles.
// Y ajouter une paire coûte trois lignes ; ne pas l'ajouter coûte une soirée.
//
// ⚠ ON LIT LE TEXTE, PAS UNE VM. Charger les modules tirerait leurs dépendances
// (`Package.Require`, catalogues, assets) pour comparer un nombre.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";

const LOGIC =
  "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared/Logic";

// Certaines constantes ne vivent pas dans `Shared/Logic`. On donne alors le
// chemin complet plutôt que d'ajouter une deuxième racine : deux racines
// finiraient par diverger, comme tout le reste.
const AILLEURS = {
  "Server/Spawner.lua":
    "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos-map-proto/Server/Spawner.lua",
  "Config.toml": "E:/narvosprime-web-prototype/WebPortal/Server/Config.toml",
};

/** Lit `<Module>.<NOM> = <nombre>` dans un fichier Lua. */
function nombre(fichier, expression) {
  const chemin = AILLEURS[fichier] || `${LOGIC}/${fichier}`;
  const source = fs.readFileSync(chemin, "utf8");
  // On retire les commentaires de ligne : l'en-tête d'`Inventory.lua` CITE
  // « Roster.lua:54  CREDITS_DEPART = 500 » dans sa documentation. Sans ce
  // filtre, le contrôle lirait le commentaire au lieu du code — et resterait
  // vert le jour où le code seul change.
  // `#` couvre le TOML : `Config.toml` documente lui aussi ses réglages en
  // commentaire, et un commentaire lu pour du code laisserait le contrôle vert.
  const code = source.replace(/^\s*(--|#).*$/gm, "");
  const m = code.match(
    new RegExp(`^\\s*${expression.replace(/\./g, "\\.")}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`, "m"),
  );
  return m ? { valeur: Number(m[1]), fichier } : null;
}

// ── Les paires ───────────────────────────────────────────────────────────────
//
// `pourquoi` explique ce que l'écart PRODUIT chez le joueur. Un contrôle qui
// dit seulement « A ≠ B » n'aide personne à décider laquelle corriger.
const PAIRES = [
  {
    titre: "solde de départ",
    a: ["Roster.lua", "Roster.CREDITS_DEPART"],
    b: ["Inventory.lua", "Inventory.DEFAULT_CREDITS"],
    fait_foi: "Roster.CREDITS_DEPART",
    pourquoi:
      "un joueur n'aurait pas le même solde selon qu'on le lit depuis sa fiche " +
      "ou depuis sa grille — visible seulement après un achat.",
  },
  {
    titre: "niveau d'optimisation par distance",
    a: ["Config.toml", "distance_optimization"],
    b: ["Server/Spawner.lua", "Spawner.NIVEAU_OPTIMISATION"],
    fait_foi: "Config.toml — c'est le serveur qui applique la formule",
    pourquoi:
      "le Spawner calcule un multiplicateur à partir de ce niveau. S'il se " +
      "trompe de niveau, la coupure de synchro tombe ailleurs que voulu — les " +
      "PNJ saccadent trop tôt, ou consomment de la bande passante pour rien. " +
      "L'API nanos n'expose pas ce réglage au Lua : la copie est inévitable.",
  },
  {
    // 2026-09-13 : `Logic/Progression.lua` (PV, mana et vitesse du personnage)
    // et `Logic/Combat.lua` (puissance, défense des coups) portent tous deux le
    // +8 %/niveau de `createStats`. Les fusionner ferait dépendre la fiche de
    // personnage du module de mêlée.
    titre: "bonus par niveau",
    a: ["Progression.lua", "Progression.BONUS_PAR_NIVEAU"],
    b: ["Combat.lua", "Combat.BONUS_NIVEAU"],
    fait_foi: "stats/PlayerStats.ts createStats (lvlBonus = (level - 1) * 0.08)",
    pourquoi:
      "la fiche annoncerait des PV et une puissance qui ne sont pas ceux que les " +
      "coups appliquent : un personnage de niveau 20 lirait une valeur et en " +
      "encaisserait une autre.",
  },
];

let echecs = 0;

for (const p of PAIRES) {
  const a = nombre(p.a[0], p.a[1]);
  const b = nombre(p.b[0], p.b[1]);

  if (!a || !b) {
    const manquant = !a ? p.a : p.b;
    console.log(`  INTROUVABLE  ${manquant[1]} dans ${manquant[0]}`);
    console.log(`               La constante a été renommée ou déplacée : le contrôle`);
    console.log(`               ne surveille plus rien. Mettre la paire à jour.`);
    echecs += 1;
    continue;
  }

  if (a.valeur === b.valeur) {
    console.log(`  OK        ${p.titre.padEnd(20)} ${p.a[1]} = ${p.b[1]} = ${a.valeur}`);
    continue;
  }

  console.log(`  ÉCART     ${p.titre}`);
  console.log(`            ${p.a[1]} = ${a.valeur}   (${p.a[0]})`);
  console.log(`            ${p.b[1]} = ${b.valeur}   (${p.b[0]})`);
  console.log(`            fait foi : ${p.fait_foi}`);
  console.log(`            ${p.pourquoi}`);
  echecs += 1;
}

console.log("");
if (echecs > 0) {
  console.error(`${echecs} constante(s) en écart.`);
  process.exitCode = 1;
} else {
  console.log(`Les ${PAIRES.length} paire(s) de constantes concordent.`);
}