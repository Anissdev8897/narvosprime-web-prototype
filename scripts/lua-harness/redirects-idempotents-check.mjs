// ══════════════════════════════════════════════════════════════════════════════
// redirects-idempotents-check.mjs — un redirect par SOUS-CHAINE peut-il se
// réappliquer à son propre résultat ?
//
//   node scripts/lua-harness/redirects-idempotents-check.mjs
//
// ── LE DÉFAUT QU'IL FERME (mesuré le 2026-09-13) ──────────────────────────────
//   +PackageRedirects=(OldName="/InterchangeAssets/",
//                      NewName="/Game/Narvos/InterchangeAssets/",MatchSubstring=true)
// La cible CONTENAIT la source. Le cooker a réappliqué le redirect à son résultat :
// 13 304 instances de la Forge ont dépendu de
// `/Game/Narvos/Game/Narvos/InterchangeAssets/...`, un paquet qui n'existe pas —
// 50 999 lignes « has a dependency on package ... which does not exist » dans un
// cook qui continuait sans une erreur fatale. Il aurait livré une Forge cassée.
//
// ── LA RÈGLE, SUR LA FORME ─────────────────────────────────────────────────────
// Pour tout redirect ACTIF en MatchSubstring (Package, Class, Object…) :
// NewName ne contient jamais OldName. Et une cible sous /Game/Narvos/ doit exister
// sur le disque — un redirect vers un dossier absent résout vers le vide.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";

const RACINE = "E:/narvosprime-web-prototype";
const INI = `${RACINE}/WebPortal/Server/adk/Config/DefaultEngine.ini`;
const CONTENT = `${RACINE}/WebPortal/Server/adk/Content`;
// Le fichier à contrôler peut être imposé (essai sur une copie mutante).
const CIBLE = process.argv[2] || INI;

let reussis = 0;
let echecs = 0;
const ok = (condition, nom) => {
  if (condition) reussis++;
  else { echecs++; console.log(`  ECHEC  ${nom}`); }
};

const lignes = fs.readFileSync(CIBLE, "utf8").split(/\r?\n/);
const actifs = lignes
  .map((l, i) => ({ l: l.trim(), n: i + 1 }))
  .filter(({ l }) => /^\+\w+Redirects=\(/.test(l));
ok(actifs.length > 0, "des redirects actifs sont lus dans DefaultEngine.ini");

const champ = (l, nom) => (l.match(new RegExp(`${nom}="([^"]*)"`)) || [])[1];
let parSousChaine = 0;
for (const { l, n } of actifs) {
  if (!/MatchSubstring=true/i.test(l)) continue;
  parSousChaine++;
  const ancien = champ(l, "OldName");
  const nouveau = champ(l, "NewName");
  ok(Boolean(ancien) && Boolean(nouveau), `ligne ${n} : OldName et NewName lisibles`);
  if (!ancien || !nouveau) continue;
  ok(!nouveau.includes(ancien),
    `ligne ${n} : la cible « ${nouveau} » CONTIENT la source « ${ancien} » — le redirect se réapplique à son résultat`);
  const sousNarvos = nouveau.match(/^\/Game\/(Narvos\/.+?)\/?$/);
  if (sousNarvos && /PackageRedirects/.test(l)) {
    ok(fs.existsSync(`${CONTENT}/${sousNarvos[1]}`), `ligne ${n} : la cible ${nouveau} existe sous Content/`);
  }
}
ok(parSousChaine > 0, "au moins un redirect par sous-chaîne contrôlé");

console.log("");
console.log(`${reussis} reussis, ${echecs} echec(s)`);
if (echecs > 0) process.exitCode = 1;