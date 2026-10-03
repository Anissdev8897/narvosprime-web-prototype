import { RACINE_DEPOT } from "./_racine.mjs";
// ============================================================================
// locomotion-check.mjs — un site qui cree un `Character` sans poser NOTRE
// locomotion.
//
//   node scripts/lua-harness/locomotion-check.mjs
//
// -- LE DEFAUT QU IL FERME ----------------------------------------------------
// Mesure du 2026-09-12, confirmee par Hanibes en jeu (« le system d animation
// branche c est celui de nanos ») : `SetAnimationIdleWalkRunStanding` n etait
// appele QUE par la commande d essai `/locomotion`. Nos 3 480 animations cuites
// ne servaient qu aux emotes, au combat et aux PNJ. Le deplacement — ce qu on
// regarde le plus longtemps dans un jeu — venait du moteur.
//
// Rien ne pouvait le voir : poser un blend space est FACULTATIF, son absence ne
// leve pas, et le personnage marche quand meme. Le defaut n a pas de symptome
// technique, seulement un symptome visuel.
//
// -- CE QU IL JUGE ------------------------------------------------------------
// Toute ligne qui construit un `Character(` (le vrai, pas `CharacterSimple` —
// celui-ci n expose pas la methode) doit etre suivie, dans les lignes proches,
// d un appel a `PoserLocomotion`.
//
// Fenetre volontairement LARGE (12 lignes) : la pose suit parfois un `pcall` et
// un test de validite. Un garde etroit sur ce motif crierait a chaque refactor,
// et un garde qui crie a tort finit ignore.
// ============================================================================

import fs from "node:fs";
import path from "node:path";

const RACINE =
  RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages";

/** Fichiers ou un Character sert d autre chose que d acteur du monde. */
const HORS_JEU = new Set([
  // L apercu de creation est un mannequin de vitrine : il joue une boucle
  // d attente en place et ne se deplace jamais. Lui poser un blend space de
  // marche n aurait aucun effet visible.
  "narvos-map-proto/Server/Session.lua",
]);

const fichiers = [];
(function descendre(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) descendre(p);
    else if (e.name.endsWith(".lua")) fichiers.push(p);
  }
})(RACINE);

if (fichiers.length === 0) {
  console.error("AUCUN fichier Lua — chemin faux ?");
  process.exit(1);
}

const FENETRE = 12;
let sites = 0;
let nus = 0;

for (const f of fichiers) {
  const relatif = f.split(path.sep).join("/").split("/packages/")[1] || f;
  if (HORS_JEU.has(relatif)) continue;

  const lignes = fs.readFileSync(f, "utf8").split(String.fromCharCode(10));
  lignes.forEach((ligne, i) => {
    if (ligne.trimStart().startsWith("--")) return;
    const nu = ligne.replace(new RegExp("--.*$"), "");
    // DEUX FORMES, et la premiere version n en voyait qu une — elle a rendu
    // « 1 site » la ou il y en a quatre :
    //   Character(pos, rot, mesh)          appel direct
    //   pcall(Character, pos, rot, mesh)   appel isole, la forme la PLUS
    //                                      frequente ici, et `Character` n y est
    //                                      pas suivi d une parenthese.
    // Ecarte `CharacterSimple` et `GetControlledCharacter` par le caractere qui
    // precede et par celui qui suit.
    const direct = new RegExp("(^|[^A-Za-z0-9_])Character[(]").test(nu);
    const parPcall = new RegExp("pcall[(]\s*Character\s*,").test(nu);
    if (!direct && !parPcall) return;

    sites++;
    const autour = lignes.slice(Math.max(0, i - 2), i + FENETRE).join(" ");
    if (autour.includes("PoserLocomotion")) return;

    nus++;
    console.log("    SANS LOCOMOTION  " + relatif + ":" + (i + 1));
    console.log("                     > " + ligne.trim().slice(0, 100));
    console.log("                     ajouter Builder.PoserLocomotion(<entite>) apres le spawn");
  });
}

console.log("");
console.log(sites + " site(s) de creation de Character examine(s) dans " + fichiers.length + " fichier(s).");
if (nus > 0) {
  console.log(nus + " site(s) SANS notre locomotion — le moteur gardera la sienne, en silence.");
  process.exit(1);
}
console.log("Tous les Character recoivent notre locomotion.");