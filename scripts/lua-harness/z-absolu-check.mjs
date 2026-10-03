import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// z-absolu-check.mjs — un point RELATIF ne garde pas un Z ABSOLU.
//
//   node scripts/lua-harness/z-absolu-check.mjs
//
// ── LA FORME DU DÉFAUT ────────────────────────────────────────────────────────
// Le 2026-09-06, les mondes sont devenus des sous-niveaux séparés dans l'espace :
// l'orbite à l'origine, la Forge à 86 km et 1,46 km d'altitude. Tout le mobilier
// a été réancré sur `ANCRE` (le point d'arrivée de la Forge) via `SurCercle` et
// `PresDe`.
//
// Quatre `Prop` ont suivi à moitié :
//
//     Prop(Vector(position.X, position.Y, 5.0), …)      -- pads de classe
//     Prop(Vector(base.X, base.Y, METRIQUES.taille_joueur / 2), …)
//     Prop(Vector(base.X + jalon.d, base.Y, 25.0), …)   -- repères d'échelle
//
// X et Y viennent d'un point relatif ; Z est resté un LITTÉRAL écrit quand le
// sol valait 0. Mesuré en jeu le 2026-09-10 : les repères enterrés à 1,46 km
// sous le terrain, les déclencheurs, eux, au bon endroit. Des pads de classe
// INVISIBLES, sans erreur, sans avertissement, avec une batterie verte.
//
// ── CE QUE LE GARDE REFUSE ────────────────────────────────────────────────────
// Un `Vector(a.X…, b.Y…, z)` dont le Z ne mentionne NI un `.Z`, NI `ANCRE`, NI
// `SOL_SERVICES`. C'est la définition de la moitié oubliée : prendre X et Y sur un
// point, et pas Z.
//
// Il ne dit PAS qu'un Z relatif est juste — seulement qu'un Z absolu à côté de
// X et Y relatifs est suspect. Une exception légitime se déclare dans TOLERES,
// avec la phrase qui la justifie.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const RACINE = RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages/narvos-map-proto";
const DOSSIERS = ["Server", "Client"];

// Exceptions déclarées : "fichier:extrait" -> raison.
const TOLERES = {
  "Client/Traversee.lua:Vector(depart_haut.X, depart_haut.Y, pieds_z - 40)":
    "pieds_z = position.Z - 90 (Traversee.lua:127) : le Z suit le personnage, ce n'est pas un littéral de sol.",
};

// Vector( <ident>.X <reste>, <ident>.Y <reste>, <Z> )
// Les groupes sont volontairement stricts : un seul niveau de parenthèses dans
// X et Y, ce que le code emploie. Un appel plus complexe échapperait au garde —
// d'où le compte des occurrences EXAMINÉES en sortie, pour voir s'il regarde.
const MOTIF = /Vector\(\s*([A-Za-z_][A-Za-z0-9_]*)\.X([^,()]*),\s*([A-Za-z_][A-Za-z0-9_]*)\.Y([^,()]*),\s*([^()]*?(?:\([^()]*\))?[^()]*?)\)/g;

function zEstRelatif(z) {
  return /\.Z\b/.test(z) || /\bANCRE\b/.test(z) || /\bSOL_SERVICES\b/.test(z);
}

let examines = 0;
let fautes = 0;

for (const dossier of DOSSIERS) {
  const dir = path.join(RACINE, dossier);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".lua"))) {
    const lignes = fs.readFileSync(path.join(dir, f), "utf8").split("\n");
    lignes.forEach((ligne, i) => {
      // Les commentaires citent la forme fautive pour l'expliquer : ne pas les
      // compter, sinon ce fichier se dénoncerait lui-même.
      const code = ligne.replace(/--.*$/, "");
      for (const m of code.matchAll(MOTIF)) {
        examines++;
        const z = m[5].trim();
        if (zEstRelatif(z)) continue;
        const cle = `${dossier}/${f}:${m[0].slice(0, 60)}`;
        if (TOLERES[cle]) continue;
        fautes++;
        console.error(`Z ABSOLU  ${dossier}/${f}:${i + 1}`);
        console.error(`          ${m[0].trim()}`);
        console.error(`          X et Y viennent de « ${m[1]} », Z est « ${z} » — le sol n'est plus a 0.`);
      }
    });
  }
}

console.log(`${examines} construction(s) Vector(p.X, p.Y, z) examinee(s).`);

// ⚠ Zéro examen = le motif ne voit plus rien : le garde serait vert par vacuité.
if (examines === 0) {
  console.error("ROUGE : aucune construction examinee — le motif ne correspond plus au code.");
  process.exit(1);
}
if (fautes > 0) {
  console.error(`\n${fautes} Z absolu(s) a cote de X et Y relatifs.`);
  process.exit(1);
}
console.log("Aucun Z absolu a cote de X et Y relatifs.");