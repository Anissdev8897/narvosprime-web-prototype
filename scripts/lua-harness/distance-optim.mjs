// ══════════════════════════════════════════════════════════════════════════════
// distance-optim.mjs — la coupure de synchro tombe-t-elle où on le croit ?
//
//   node scripts/lua-harness/distance-optim.mjs
//
// ── CE QUI EST VÉRIFIÉ ────────────────────────────────────────────────────────
// `Spawner.MultiplicateurPour(d)` inverse la formule de pertinence de nanos :
//
//     pertinence = clamp(100 - ((distance / 1000) - 1) * niveau * mult, 0, 100)
//
// On refait le chemin dans l'autre sens : on calcule le multiplicateur pour une
// coupure voulue, puis on REJOUE la formule de nanos avec ce multiplicateur et
// on regarde si la pertinence tombe bien à 0 à la distance demandée.
//
// ⚠ POURQUOI CE CONTRÔLE EXISTE. Le multiplicateur n'a aucun retour visible :
// une valeur trop forte fait saccader des PNJ que le joueur voit, une trop
// faible dépense de la bande passante — et dans les deux cas, rien ne le dit.
// Le seul témoin serait un joueur qui trouve « que ça rame », six mois plus
// tard, sans savoir pourquoi.
//
// Le tableau de référence du guide nanos est reproduit ici et confronté : si
// notre lecture de la formule était fausse, elle ne rendrait pas ces valeurs.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";

const SPAWNER =
  "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos-map-proto/Server/Spawner.lua";
const IA =
  "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos-map-proto/Server/Ia.lua";

// ⚠ LES CONSTANTES SONT LUES DANS LE LUA, PAS RECOPIÉES ICI. Un test qui porte
// sa propre copie des valeurs teste sa copie, pas le code.
const lire = (fichier, nom) => {
  const code = fs.readFileSync(fichier, "utf8").replace(/^\s*--.*$/gm, "");
  const m = code.match(new RegExp(`^\\s*${nom.replace(/\./g, "\\.")}\\s*=\\s*(-?[\\d.]+)`, "m"));
  if (!m) { console.error(`ARRET : ${nom} introuvable dans ${fichier}`); process.exit(1); }
  return Number(m[1]);
};

const NIVEAU = lire(SPAWNER, "Spawner.NIVEAU_OPTIMISATION");
const MARGE = lire(SPAWNER, "Spawner.MARGE_PORTEE");
const MARGE_TEST = lire(SPAWNER, "Spawner.MARGE_PORTEE_TEST");
const PORTEE = lire(IA, "IaServeur.PORTEE_MONDE");

// Les deux fonctions du Spawner, réécrites à l'identique. Elles sont assez
// courtes pour que la transcription soit sûre, et le tableau de référence
// ci-dessous prouve qu'elles disent la même chose que nanos.
const multiplicateurPour = (d) => {
  const pas = d / 1000 - 1;
  return pas <= 0 ? 0 : 100 / (pas * NIVEAU);
};
const coupureParDefaut = () => 1000 * (100 / NIVEAU + 1);
const pertinence = (d, niveau, mult) =>
  Math.max(0, Math.min(100, 100 - (d / 1000 - 1) * niveau * mult));

let echecs = 0;
const eq = (obtenu, attendu, quoi, tol = 0.5) => {
  const ok = Math.abs(obtenu - attendu) <= tol;
  console.log(`  ${ok ? "OK      " : "ECHEC   "} ${quoi}${ok ? "" : `  (obtenu ${obtenu.toFixed(2)}, attendu ${attendu})`}`);
  if (!ok) echecs += 1;
};

console.log(`niveau=${NIVEAU}  PORTEE_MONDE=${PORTEE}  marge=${MARGE}  marge test=${MARGE_TEST}\n`);

// ── 1. Notre lecture de la formule est-elle la bonne ? ───────────────────────
//
// Tableau du guide nanos, multiplicateur à 1. S'il ne sort pas, tout le reste
// est faux.
console.log("[la formule, confrontée au tableau du guide nanos]");
for (const [d, attendus] of [
  [5000, { 1: 96, 4: 84, 9: 64 }],
  [10000, { 1: 91, 4: 64, 9: 19 }],
  [20000, { 1: 81, 4: 24, 9: 0 }],
  [40000, { 1: 61, 4: 0, 9: 0 }],
]) {
  for (const [niv, att] of Object.entries(attendus)) {
    eq(pertinence(d, Number(niv), 1), att, `${d} unités, niveau ${niv} → ${att} %`);
  }
}

// Distances de coupure du guide, multiplicateur à 1.
//
// ⚠ LE GUIDE ARRONDIT AU MILLIER SUPÉRIEUR, la formule non. Vérifié sur les
// NEUF niveaux : niveau 3 → formule 34 333, guide 35 000 ; niveau 9 → 12 111
// contre 13 000. Les niveaux 1, 2, 4 et 5 tombent juste parce que 100/n y est
// entier. La formule continue est donc la bonne, et la coupure annoncée est le
// premier palier de 1 000 unités où la pertinence atteint 0.
//
// Ce détail vaut d'être écrit : sans lui, ce contrôle échoue sur deux niveaux
// sur neuf et on croit la formule fausse. Elle ne l'est pas.
console.log("\n[coupure du guide, multiplicateur à 1 — arrondie au millier supérieur]");
const GUIDE = { 1: 101000, 2: 51000, 3: 35000, 4: 26000, 5: 21000, 6: 18000, 7: 16000, 8: 14000, 9: 13000 };
for (const [niv, att] of Object.entries(GUIDE)) {
  const d = Math.ceil((1000 * (100 / Number(niv) + 1)) / 1000) * 1000;
  eq(d, att, `niveau ${niv} → coupure ${att} unités`, 1);
}

// ── 2. L'inversion rend-elle la coupure demandée ? ──────────────────────────
console.log("\n[l'inversion]");
for (const d of [9000, 18000, 26000, 50000]) {
  const m = multiplicateurPour(d);
  eq(pertinence(d, NIVEAU, m), 0, `coupure voulue ${d} → pertinence 0 (mult ${m.toFixed(3)})`);
  // Juste avant la coupure, l'acteur doit être ENCORE synchronisé — sinon on
  // coupe plus tôt qu'annoncé.
  const avant = pertinence(d * 0.95, NIVEAU, m);
  eq(avant > 0 ? 1 : 0, 1, `à 95 % de ${d}, encore synchronisé (${avant.toFixed(1)} %)`);
}

// ── 3. Les cas réels du Spawner ─────────────────────────────────────────────
console.log("\n[les PNJ, tels qu'ils seront réglés]");
// `agit` dit si ce PNJ peut prendre un joueur pour cible. Les mannequins de
// test ne le peuvent pas : ils servent à vérifier une échelle ou un matériau,
// devant le joueur. Leur imposer la même pertinence à 60 m serait payer pour un
// mouvement qu'ils n'ont pas.
const cas = [
  ["PNJ ordinaire (échelle 100)", PORTEE * MARGE * 1, true],
  ["mannequin de test", PORTEE * MARGE_TEST * 1, false],
  ["crabe Aquarys (échelle 40000)", PORTEE * MARGE * 400, true],
];
console.log(`  ${"CAS".padEnd(32)}${"COUPURE".padStart(10)}${"BORNÉE À".padStart(10)}${"MULT".padStart(8)}   vs défaut ${coupureParDefaut()}`);
for (const [nom, brute] of cas) {
  const bornee = Math.min(brute, coupureParDefaut());
  const m = multiplicateurPour(bornee);
  console.log(`  ${nom.padEnd(32)}${String(Math.round(brute)).padStart(10)}${String(Math.round(bornee)).padStart(10)}${m.toFixed(3).padStart(8)}`);
  // ⚠ LA RÈGLE : on coupe plus tôt que le défaut, JAMAIS plus tard. Un
  // multiplicateur sous 1 étendrait la synchro au-delà du réglage serveur —
  // dépenser de la bande passante en croyant en économiser.
  eq(m >= 1 ? 1 : 0, 1, `${nom} : multiplicateur ≥ 1 (jamais plus permissif que le défaut)`);
}

// Un PNJ doit être LARGEMENT synchronisé quand il devient capable d'agir,
// c'est-à-dire à `PORTEE_MONDE`. C'est toute la raison d'être de la marge : si
// la pertinence y était déjà basse, un ennemi qui entre en portée saccaderait
// au moment précis où le joueur le regarde.
//
// ⚠ Les mannequins de test sont EXCLUS de cette exigence, et c'est une décision.
// Ils ne prennent jamais de cible et ne bougent pas : à 60 m ils tombent à 38 %,
// ce qui ne coûte rien puisqu'il n'y a aucun mouvement à transmettre. Les tenir
// au même niveau que les combattants serait payer pour du vide.
console.log("\n[à la portée où le PNJ peut agir]");
for (const [nom, brute, agit] of cas) {
  const m = multiplicateurPour(Math.min(brute, coupureParDefaut()));
  const p = pertinence(PORTEE, NIVEAU, m);
  if (!agit) {
    console.log(`  DISPENSÉ ${nom} : ${p.toFixed(0)} % — ne prend jamais de cible, ne bouge pas`);
    continue;
  }
  eq(p >= 50 ? 1 : 0, 1, `${nom} : ${p.toFixed(0)} % de pertinence à ${PORTEE} unités`);
}

console.log("");
if (echecs > 0) {
  console.error(`${echecs} vérification(s) en échec.`);
  process.exitCode = 1;
} else {
  console.log("Coupure de synchro : formule et réglages vérifiés.");
}