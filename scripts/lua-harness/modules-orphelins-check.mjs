import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// modules-orphelins-check.mjs — un module qui n'est câblé NULLE PART n'existe pas.
//
//   node scripts/lua-harness/modules-orphelins-check.mjs
//
// ── LA MOITIÉ QUE `cablage-check` NE VOIT PAS ─────────────────────────────────
// `cablage-check.mjs` confronte chaque `Narvos.X` LU dans le dépôt à son
// assignation dans `Shared/Index.lua`. C'est la bonne moitié de la question, et
// elle a trouvé de vrais défauts.
//
// Mais un module que PERSONNE ne lit ET qui n'est pas câblé passe : il n'apparaît
// d'aucun côté de la comparaison. Il est écrit, il a peut-être un harnais vert,
// et il n'existe pas en jeu.
//
// Mesuré le 2026-09-10, à la main, faute de ce contrôle : **six fichiers** dans
// cet état — `Logic/WorldSim.lua` et `Logic/Audio.lua` (qui ont chacun leur
// harnais), plus `Catalogs/Sons.lua`, `Vegetation.lua`, `Patches.lua`,
// `Map_tower_map.lua`. `MapLoader.PoserPatches` et `PoserVegetation` existent et
// ne sont appelés par personne ; `Audio` consomme `Sons` par un `Configurer` que
// rien n'appelle.
//
// ── POURQUOI EXIGER LE CÂBLAGE, ALORS QU'UN REPLI EXISTE ──────────────────────
// Sept modules emploient `(Narvos and Narvos[nom]) or Package.Require(fichier)`.
// Ce repli FONCTIONNE — et c'est le problème : il crée une **SECONDE TABLE**.
// Deux catalogues distincts pour la même donnée, et une modification de l'un
// invisible depuis l'autre. L'en-tête de `Shared/Index.lua` l'écrit noir sur
// blanc pour `Mondes`. Le repli est un filet pour les harnais, pas une voie de
// chargement.
//
// ── CE QUE CE CONTRÔLE N'EST PAS ──────────────────────────────────────────────
// Il ne dit pas qu'un module est UTILISÉ — seulement qu'il est joignable.
// « Câblé mais jamais appelé » est un autre état, et un état légitime pour un
// module qui attend son exécutant. Voir le skill `narvos-lua` §0.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const RACINE = RACINE_DEPOT + "";
const SHARED = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared`;

// ── Les orphelins qu'on accepte, avec leur raison ─────────────────────────────
//
// Y ajouter une entrée doit coûter une PHRASE qui dit pourquoi ce fichier n'a
// pas à être joignable. Sans raison, c'est le défaut qu'on autorise.
const TOLERES = {
  // Les catalogues de map sont passés en ARGUMENT à `MapLoader.Charger`, résolus
  // par leur nom au moment de l'appel (`Voyage.CatalogueDe`). Les câbler tous
  // chargerait en mémoire des dizaines de milliers de meshes dont un seul monde
  // sert à la fois.
  "Catalogs/Map_Orbital.lua": "catalogue de map, résolu par nom à la demande",
  "Catalogs/Map_tower_map.lua": "catalogue de map, résolu par nom à la demande",
};

const index = fs.readFileSync(`${SHARED}/Index.lua`, "utf8");

let orphelins = 0;
let examines = 0;
const tolerés_vus = new Set();

for (const dossier of ["Logic", "Catalogs"]) {
  const dir = path.join(SHARED, dossier);
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".lua"))) {
    const relatif = `${dossier}/${f}`;
    examines++;

    // Câblé ? On cherche le `Package.Require("<dossier>/<fichier>")` littéral :
    // c'est la seule forme employée dans Index.lua, et une forme calculée y
    // serait elle-même un défaut (on ne saurait plus ce qui est chargé).
    const motif = new RegExp(
      `Package\\.Require\\("${relatif.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\)`
    );
    if (motif.test(index)) continue;

    if (TOLERES[relatif]) {
      tolerés_vus.add(relatif);
      continue;
    }

    orphelins++;
    console.error(`ORPHELIN  ${relatif}`);
    console.error(`          jamais câblé dans Shared/Index.lua — il n'existe pas en jeu.`);
  }
}

// ⚠ Une tolérance périmée est un trou qu'on garde ouvert pour rien : si le
// fichier a disparu ou a fini par être câblé, la ligne doit sortir de la liste.
for (const cle of Object.keys(TOLERES)) {
  if (!tolerés_vus.has(cle)) {
    const existe = fs.existsSync(path.join(SHARED, cle));
    console.error(
      `TOLERANCE PERIMEE  ${cle} — ${existe ? "est desormais cable" : "n'existe plus"}. Retirer de TOLERES.`
    );
    orphelins++;
  }
}

console.log(
  `${examines} fichier(s) examine(s) sous Shared/{Logic,Catalogs}, ` +
    `${Object.keys(TOLERES).length} tolerance(s) declaree(s).`
);

if (orphelins > 0) {
  console.error(`\n${orphelins} orphelin(s) — ecrits, peut-etre testes, INEXISTANTS en jeu.`);
  process.exit(1);
}
console.log("Aucun module orphelin.");