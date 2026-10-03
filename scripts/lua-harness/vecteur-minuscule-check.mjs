import { RACINE_DEPOT } from "./_racine.mjs";
// ============================================================================
// vecteur-minuscule-check.mjs — un champ `.x` `.y` `.z` lu sur un Vector nanos.
//
//   node scripts/lua-harness/vecteur-minuscule-check.mjs
//
// -- LE DEFAUT QU IL FERME ----------------------------------------------------
// Un Vector nanos expose `X` `Y` `Z`, en MAJUSCULES. Lire `.x` rend nil — et en
// Lua, nil ne leve pas a la lecture : il leve a l EMPLOI.
//
//     local jx, jy = pos.x / M, pos.y / M
//     Index.lua:1139: attempt to perform arithmetic on a nil value (field 'x')
//
// Mesure du 2026-09-12 : trois occurrences dans le seul gestionnaire de radar,
// qui levait a CHAQUE rafraichissement (600 ms) et laissait le panneau vide. Le
// fichier avait deja ete corrige une fois — sur `GetLocation`, appele sur le
// Player au lieu du Character — et la seconde faute est restee dessous.
//
// -- POURQUOI IL NE PEUT PAS JUGER SUR LE NOM DE LA VARIABLE ------------------
// `Logic/Teleports.lua` lit `pos.x`, `pos.y`, `pos.z` et c est JUSTE : ses `pos`
// sont des tables a nous, avec un champ `monde` que nul Vector ne porte. C est
// la NATURE de l objet qui decide, pas l habitude.
//
// Le controle ne suit donc que ce qu il peut PROUVER : une variable affectee
// depuis un appel qui rend un Vector nanos (ou depuis `Vector(...)`), puis lue
// en minuscule dans le meme fichier. Il prefere RATER une detection plutot
// qu en inventer une — un garde qui crie a tort finit ignore.
// ============================================================================

import fs from "node:fs";
import path from "node:path";

const RACINE =
  RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages";

const BS = String.fromCharCode(92); // le heredoc mange les barres obliques inverses

/** Les appels dont nanos documente qu ils rendent un Vector. */
const RENDENT_UN_VECTEUR = [
  "GetLocation", "GetRelativeLocation", "GetScale", "GetVelocity",
  "GetForwardVector", "GetRightVector", "GetUpVector", "GetBoneLocation",
];

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

const AFFECTATION = new RegExp("local" + BS + "s+([A-Za-z_][A-Za-z0-9_]*)" + BS + "s*=" + BS + "s*(.+)$");
const COMMENTAIRE = new RegExp("--.*$");

let fautes = 0;
let suivies = 0;

for (const f of fichiers) {
  const lignes = fs.readFileSync(f, "utf8").split(String.fromCharCode(10));

  // Les variables PROUVEES vectorielles. DEUX resserrages, tous deux payes par
  // un faux positif du 2026-09-12 sur `Server/Teleports.lua` :
  //
  //  1. L APPEL DOIT ETRE EN TETE DE LA DROITE. `VersLocal(c:GetLocation())`
  //     CONTIENT `:GetLocation(` mais rend une table a nous — l enveloppe change
  //     la nature. Seule une droite qui COMMENCE par `Vector(` ou par
  //     `<recepteur>:<Appel>(` livre un Vector.
  //
  //  2. UNANIMITE. La meme variable est affectee six fois dans ce fichier :
  //     une fois depuis `character:GetLocation()`, cinq fois depuis `IciDe()`.
  //     Une seule affectation vectorielle ne prouve rien pour les autres lignes.
  //     Si les affectations se contredisent, on ne suit PAS la variable.
  const votes = new Map(); // nom -> { vecteur, autre }
  for (const ligne of lignes) {
    if (ligne.trimStart().startsWith("--")) continue;
    const m = ligne.match(AFFECTATION);
    if (!m) continue;
    const droite = m[2].trimStart();
    const vecteur = droite.startsWith("Vector(")
      || RENDENT_UN_VECTEUR.some((a) => new RegExp(
           "^[A-Za-z_][A-Za-z0-9_.]*:" + a + BS + "(").test(droite));
    if (!votes.has(m[1])) votes.set(m[1], { vecteur: 0, autre: 0 });
    votes.get(m[1])[vecteur ? "vecteur" : "autre"]++;
  }

  const vectorielles = new Set();
  for (const [nom, v] of votes) {
    if (v.vecteur > 0 && v.autre === 0) vectorielles.add(nom);
  }
  if (vectorielles.size === 0) continue;
  suivies += vectorielles.size;

  const motifs = [...vectorielles].map((v) =>
    [v, new RegExp(BS + "b" + v + BS + ".([xyz])" + BS + "b")]);

  lignes.forEach((ligne, i) => {
    if (ligne.trimStart().startsWith("--")) return;
    const nu = ligne.replace(COMMENTAIRE, "");
    for (const [v, motif] of motifs) {
      const m = nu.match(motif);
      if (!m) continue;
      fautes++;
      const relatif = f.split(path.sep).join("/").split("/packages/")[1] || f;
      console.log("    MINUSCULE  " + v + "." + m[1] + "  ->  " + v + "." + m[1].toUpperCase());
      console.log("               " + relatif + ":" + (i + 1));
      console.log("               un Vector nanos n a pas de champ '" + m[1] + "' : nil, puis leve a l emploi");
      console.log("               > " + ligne.trim().slice(0, 110));
    }
  });
}

console.log("");
console.log(fichiers.length + " fichier(s) Lua, " + suivies + " variable(s) prouvee(s) vectorielle(s).");
if (fautes > 0) {
  console.log(fautes + " lecture(s) en minuscule — le jeu levera.");
  process.exit(1);
}
console.log("Aucune lecture de Vector en minuscule.");