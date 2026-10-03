// ══════════════════════════════════════════════════════════════════════════════
// chaine-generateurs-check.mjs — chaque catalogue HORS VERROU est-il régénéré par
// la chaîne de cook générale, APRÈS le pack ?
//
//   node scripts/lua-harness/chaine-generateurs-check.mjs
//
// ── LE DÉFAUT QU'IL FERME (mesuré le 2026-09-13) ──────────────────────────────
// `narvos-verifier-catalogues.mjs` sort NEUF catalogues du verrou d'identité, au
// motif que « la chaîne de cook » les régénère. `scripts/narvos-chaine-cook.sh`
// n'en lançait que CINQ : Spawnables, Animations, ObjetsHyper et Modular restaient
// au pack précédent — des clés `_N` qui sont des RANGS, décalées par la moindre
// promotion. Le verrou les ignorait, la chaîne les oubliait : personne ne les
// gardait. Les scripts de lot les lançaient tous ; la liste avait été recopiée à
// la main dans chaque script, et une copie avait glissé.
//
// ── LA SOURCE DES ATTENTES EST LE VÉRIFICATEUR, PAS UNE COPIE ─────────────────
// Chaque entrée de REGENERES_PAR_LA_CHAINE porte en commentaire le générateur qui
// l'écrit. Une entrée sans générateur nommé est un échec ; un générateur absent de
// la chaîne, ou lancé AVANT le pack (il relirait l'ancien Assets.toml), aussi.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";

const RACINE = "E:/narvosprime-web-prototype";
const VERIFICATEUR = `${RACINE}/scripts/narvos-verifier-catalogues.mjs`;
const CHAINE = `${RACINE}/scripts/narvos-chaine-cook.sh`;

let reussis = 0;
let echecs = 0;
const ok = (condition, nom) => {
  if (condition) reussis++;
  else { echecs++; console.log(`  ECHEC  ${nom}`); }
};
const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const verif = fs.readFileSync(VERIFICATEUR, "utf8");
const bloc = verif.match(/const REGENERES_PAR_LA_CHAINE = new Set\(\[([\s\S]*?)\]\);/);
ok(bloc !== null, "REGENERES_PAR_LA_CHAINE est lisible dans le vérificateur");
const lignes = bloc ? bloc[1].split(/\r?\n/).filter((l) => /"[A-Za-z]+\.lua"/.test(l)) : [];
const entrees = lignes.map((l) => ({
  catalogue: l.match(/"([A-Za-z]+\.lua)"/)[1],
  generateur: (l.match(/\/\/\s*(narvos-[a-z0-9-]+\.mjs)/) || [])[1],
}));
ok(entrees.length >= 9, `au moins neuf catalogues hors verrou (lu : ${entrees.length})`);

// Les commentaires shell ne comptent pas : un appel commenté ne régénère rien.
const chaine = fs.readFileSync(CHAINE, "utf8").split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join("\n");
const posPack = chaine.search(/nanos-build-asset-pack\.mjs"?\s+--apply/);
ok(posPack > -1, "la chaîne reconstruit le pack (nanos-build-asset-pack.mjs --apply)");

for (const { catalogue, generateur } of entrees) {
  ok(Boolean(generateur), `${catalogue} nomme son générateur dans le vérificateur`);
  if (!generateur) continue;
  ok(fs.existsSync(`${RACINE}/scripts/${generateur}`), `${generateur} existe`);
  const pos = chaine.search(new RegExp(`${echapper(generateur)}"?\\s+--apply`));
  ok(pos > -1, `la chaîne générale lance ${generateur} --apply (${catalogue})`);
  ok(pos > posPack, `${generateur} tourne APRÈS le pack (sinon il relit l'ancien Assets.toml)`);
}

console.log("");
console.log(`${reussis} reussis, ${echecs} echec(s)`);
if (echecs > 0) process.exitCode = 1;