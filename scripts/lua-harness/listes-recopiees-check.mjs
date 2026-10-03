import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// listes-recopiees-check.mjs — une liste de clés recopiée diverge toujours de sa
// source.
//
//   node scripts/lua-harness/listes-recopiees-check.mjs
//
// ── LE DÉFAUT, ET SA FORME ────────────────────────────────────────────────────
// `Server/Index.lua` déclarait les mondes chargés au démarrage ainsi :
//
//     for _, id in ipairs({ "orbital", "tower", "alien" }) do
//
// Écrit quand il y avait quatre mondes. La capitale et la forêt sont arrivées le
// 2026-09-09 ; cette ligne ne les a jamais connues. Mesuré au premier lancement,
// le 2026-09-10 : **7 portails posés sur 10**. Manquaient le Spatioport
// d'Akarlys et les deux bouts de la Route de la Sylve — exactement les liaisons
// dont le monde de départ était l'un des deux nouveaux.
//
// Et RIEN ne l'a dit : `MondePraticable` n'avait refusé personne, le diagnostic
// de démarrage annonçait les quatre passages « ouvert », zéro erreur Lua. La
// boucle n'était simplement pas atteinte.
//
// C'est la cinquième fois que le dépôt paie cette forme (cf. l'en-tête de
// `constantes-check.mjs`, et `Roster.EncoderCouleurs` dans CLAUDE.md). D'où un
// garde qui filtre sur la FORME et non sur le lieu du dernier incident :
//
//     un littéral de chaînes dont TOUS les éléments sont des clés d'un
//     catalogue EST une copie de ce catalogue.
//
// ── CE QUE CE CONTRÔLE N'EST PAS ──────────────────────────────────────────────
// Il ne juge pas si la copie est complète — une copie complète aujourd'hui est
// une copie périmée demain, et c'est précisément le mode d'échec. Il refuse la
// copie elle-même. Le remplacement est toujours le même : itérer le catalogue et
// filtrer sur une PROPRIÉTÉ (`m.decor_persistant`, `m.niveau`…), jamais sur un
// nom.
//
// ⚠ ON LIT LE TEXTE, PAS UNE VM — même raison que `constantes-check.mjs` :
// charger les modules tirerait catalogues et assets pour comparer des chaînes.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const PACKAGES =
  RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages";

// ── Les catalogues surveillés ────────────────────────────────────────────────
// Chacun donne : où lire les clés, et comment les reconnaître. Ajouter un
// catalogue ici coûte trois lignes et couvre tout le dépôt d'un coup.
const CATALOGUES = [
  {
    nom: "Mondes.MONDES",
    fichier: `${PACKAGES}/narvos/Shared/Catalogs/Mondes.lua`,
    // `id = "forge",` — la clé d'un monde est son champ `id`.
    motif: /^\s*id = "([^"]+)"/gm,
  },
  {
    // Ajouté le 2026-09-13 : `OutilDuJoueur` (Server/Index.lua) itérait
    // `{ "pioche", "foreuse", "collecteur" }` écrit en dur — et ne rendait que le
    // PREMIER outil trouvé. La source est le champ `outil` des gisements
    // (`Recolte.OutilsRequis`), jamais une copie.
    nom: "Gisements.outil",
    fichier: `${PACKAGES}/narvos/Shared/Catalogs/Gisements.lua`,
    motif: /^\s*outil = "([^"]+)"/gm,
  },
];

// ── Les copies qu'on accepte, avec leur raison ───────────────────────────────
// Vide aujourd'hui. Y ajouter une entrée doit coûter une phrase qui explique
// pourquoi la copie ne peut PAS diverger — sinon c'est le défaut qu'on autorise.
const TOLEREES = [
  // { fichier: "…/X.lua", ligne: 42, raison: "…" },
];

function luaSousArbre(racine) {
  const sortie = [];
  (function descendre(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) descendre(p);
      else if (e.name.endsWith(".lua")) sortie.push(p);
    }
  })(racine);
  return sortie;
}

const clesPar = new Map();
for (const c of CATALOGUES) {
  const texte = fs.readFileSync(c.fichier, "utf8");
  const cles = new Set([...texte.matchAll(c.motif)].map((m) => m[1]));
  if (cles.size === 0) {
    // Un garde qui ne trouve rien à vérifier compte pour vert. Refuser.
    console.error(`ROUGE  catalogue '${c.nom}' : 0 clé extraite — le motif est périmé.`);
    process.exit(1);
  }
  clesPar.set(c.nom, cles);
}

// Un littéral de chaînes : { "a", "b" } — au moins deux éléments, rien d'autre
// que des chaînes entre les accolades.
const LITTERAL = /\{\s*("(?:[^"\\]|\\.)*"\s*,\s*)+"(?:[^"\\]|\\.)*"\s*,?\s*\}/g;

let rouges = 0;
let examines = 0;

for (const fichier of luaSousArbre(PACKAGES)) {
  const texte = fs.readFileSync(fichier, "utf8");
  const lignes = texte.split("\n");

  for (const [i, ligneTexte] of lignes.entries()) {
    // Un commentaire cite souvent le défaut pour l'expliquer — c'est le cas de
    // celui que ce contrôle documente. Le citer ne le commet pas.
    if (/^\s*--/.test(ligneTexte)) continue;

    for (const m of ligneTexte.matchAll(LITTERAL)) {
      examines++;
      const elements = [...m[0].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1]);

      for (const [nom, cles] of clesPar) {
        if (!elements.every((e) => cles.has(e))) continue;
        const tolere = TOLEREES.some(
          (t) => fichier.endsWith(t.fichier) && t.ligne === i + 1
        );
        if (tolere) continue;

        rouges++;
        console.error(
          `ROUGE  ${path.relative(PACKAGES, fichier)}:${i + 1}\n` +
            `       ${ligneTexte.trim()}\n` +
            `       les ${elements.length} éléments sont TOUS des clés de ${nom} ` +
            `— c'est une copie du catalogue.\n` +
            `       Itérer ${nom} et filtrer sur une propriété.`
        );
      }
    }
  }
}

console.log(
  `${examines} littéral(aux) de chaînes examiné(s) contre ` +
    `${[...clesPar].map(([n, c]) => `${n} (${c.size} clés)`).join(", ")}.`
);

if (rouges > 0) {
  console.error(`\n${rouges} liste(s) recopiée(s).`);
  process.exit(1);
}
console.log("Aucune liste recopiée.");