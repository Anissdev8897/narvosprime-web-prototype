// ══════════════════════════════════════════════════════════════════════════════
// narvos-pnj-physique.mjs — rend un VOLUME aux corps de collision des PNJ.
//
//   node scripts/narvos-pnj-physique.mjs            # relevé, n'écrit rien
//   node scripts/narvos-pnj-physique.mjs --apply    # répare source ET cuit
//   node scripts/narvos-pnj-physique.mjs --verifier # garde : sortie 1 s'il en reste
//
// ── LE DÉFAUT, MESURÉ LE 2026-09-13 ───────────────────────────────────────────
// « Certains PNJ sont transparents et impossibles à tuer » (Hanibes). Les
// PhysicsAssets des PNJ Meshy (pnj/, pnj_monstre/, ~50 fichiers) ne portent que
// des capsules de rayon 0,505 et longueur 0,505 unité d'os — le plancher du
// générateur d'Unreal (`MinPrimSize`). Leur squelette a une racine à l'échelle
// 0,0001 (nœud glTF `Armature` à 0,01, cf. RAPPORT_PNJ_2026-09-13 §2) : les
// sommets tenaient dans quelques centièmes d'unité et chaque volume est tombé au
// plancher. En jeu (os à l'échelle 0,01), une capsule vaut ≈ 0,005 cm : une
// balle traverse le PNJ sans rien toucher.
//
// ── LA RÉPARATION ─────────────────────────────────────────────────────────────
// Le CENTRE et l'ORIENTATION du générateur sont gardés : ils ont été calculés sur
// les sommets et sont justes (capsule de cuisse centrée à mi-os, capsule de
// bassin couchée). Seuls RAYON et LONGUEUR sont recalculés, depuis le squelette,
// en proportion de la TAILLE du personnage (étendue de ses os) — donc sans rien
// supposer de l'unité ni de l'échelle du rig :
//   · tronc (racine → os qui porte cou et bras) : 7,5 % de la taille ;
//   · cou 4 %, tête 6 % ;
//   · membres : 22 % du segment, borné à [1,5 % ; 6 %] de la taille.
// La longueur est celle du segment moins les deux calottes.
//
// ⚠ ÉCRITURE SUR PLACE, SANS CHANGER UNE TAILLE : un float remplace un float.
// Le paquet cuit par l'ADK garde les propriétés ÉTIQUETÉES (vérifié : mêmes 44
// valeurs à 0,505 dans le .uexp cuit et le .uasset source) — la source ET le
// cuit sont réparés, sinon le prochain cook remettrait le défaut.
//
// ⚠ Un PhysicsAsset MIXTE (moins des trois quarts au plancher : RobotGirl 8/76,
// dog 2/21) n'est PAS touché : ses petits os au plancher sont des os de détail,
// pas un corps entier invisible. Dans un asset réparé, seules les capsules AU
// PLANCHER sont réécrites.
//
// Sauvegardes : WebPortal/Server/adk/_sauvegardes/pnj-physique/<source|cuit>/…
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { lireCorps } from "./lib/uasset-physique.mjs";
import { lireSquelette } from "./lib/uasset-squelette.mjs";

const SERVEUR = "E:/narvosprime-web-prototype/WebPortal/Server";
const SOURCE = `${SERVEUR}/adk/Content/Narvos`;
const CUIT = `${SERVEUR}/Assets/narvos/Narvos`;
const DOSSIERS = ["pnj", "pnj_monstre"];
const SAUVEGARDES = `${SERVEUR}/adk/_sauvegardes/pnj-physique`;

const PLANCHER = 0.505;
const TOL = 1e-4;
const SEUIL_DEGENERE = 0.75;
const PART = { tronc: 0.075, cou: 0.04, tete: 0.06, membre: 0.22, mini: 0.015, maxi: 0.06 };

const apply = process.argv.includes("--apply");
const verifier = process.argv.includes("--verifier");
// `--detail <morceau de chemin>` : les dimensions de chaque os, pour relire le plan.
const iDetail = process.argv.indexOf("--detail");
const detail = iDetail > 0 ? process.argv[iDetail + 1] : null;

// ── Géométrie ─────────────────────────────────────────────────────────────────

const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
function qrot(q, v) {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
}
const norme = (v) => Math.hypot(v[0], v[1], v[2]);

/** Positions en espace composant, échelle de la racine IGNORÉE (unités d'os). */
function composantes(os) {
  const pos = [], rot = [];
  os.forEach((o, k) => {
    if (o.parent < 0) { pos[k] = [0, 0, 0]; rot[k] = o.q; return; }
    const d = qrot(rot[o.parent], o.t);
    pos[k] = [pos[o.parent][0] + d[0], pos[o.parent][1] + d[1], pos[o.parent][2] + d[2]];
    rot[k] = qmul(rot[o.parent], o.q);
  });
  return pos;
}

/** Rayon et longueur de la capsule de chaque os, en unités d'os. */
function plan(os) {
  const pos = composantes(os);
  const enfants = os.map(() => []);
  os.forEach((o, k) => { if (o.parent >= 0) enfants[o.parent].push(k); });

  const etendue = [0, 1, 2].map((a) => Math.max(...pos.map((p) => p[a])) - Math.min(...pos.map((p) => p[a])));
  const taille = Math.max(...etendue);

  // Tronc : de la racine au HAUT DU TRONC, l'os (hors racine) qui porte au moins
  // trois enfants ET le plus de descendants — le cou et les deux bras, avec tout
  // ce qui pend. « Le plus profond » prenait une main (cinq doigts) sur les rigs
  // détaillés ; « le plus haut en Z » se trompe dès que le rig n'est pas Z-haut.
  const descendants = os.map(() => 0);
  for (let k = os.length - 1; k >= 0; k--) {
    if (os[k].parent >= 0) descendants[os[k].parent] += 1 + descendants[k];
  }
  let haut = -1;
  os.forEach((o, k) => {
    if (o.parent >= 0 && enfants[k].length >= 3 && (haut < 0 || descendants[k] > descendants[haut])) haut = k;
  });
  const chemin = [];
  for (let k = haut; k >= 0; k = os[k].parent) chemin.unshift(k);
  const tronc = new Set(chemin);

  // L'enfant qui CONTINUE l'os : l'os suivant du chemin pour le tronc, le mieux
  // aligné sur la direction de l'os pour les autres (le cou continue le haut du
  // tronc, les épaules bifurquent).
  const direction = (k) => {
    if (os[k].parent < 0) return [0, 0, 1];
    const p = pos[os[k].parent], d = [pos[k][0] - p[0], pos[k][1] - p[1], pos[k][2] - p[2]];
    const n = norme(d) || 1;
    return [d[0] / n, d[1] / n, d[2] / n];
  };
  const suite = (k) => {
    const e = enfants[k];
    if (e.length === 0) return -1;
    if (e.length === 1) return e[0];
    const rang = chemin.indexOf(k);
    if (rang >= 0 && rang < chemin.length - 1) return chemin[rang + 1];
    const dir = direction(k);
    return e.reduce((m, c) => {
      const dc = [pos[c][0] - pos[k][0], pos[c][1] - pos[k][1], pos[c][2] - pos[k][2]];
      const dm = [pos[m][0] - pos[k][0], pos[m][1] - pos[k][1], pos[m][2] - pos[k][2]];
      const sc = (dc[0] * dir[0] + dc[1] * dir[1] + dc[2] * dir[2]) / (norme(dc) || 1);
      const sm = (dm[0] * dir[0] + dm[1] * dir[1] + dm[2] * dir[2]) / (norme(dm) || 1);
      return sc > sm ? c : m;
    }, e[0]);
  };
  const segment = (k) => {
    const s = suite(k);
    if (s >= 0) return norme(os[s].t);
    const p = os[k].parent;
    return p >= 0 ? 0.5 * segment(p) : 0.1 * taille;
  };

  const cou = haut >= 0 ? suite(haut) : -1;
  const tete = cou >= 0 ? suite(cou) : -1;

  const sortie = new Map();
  os.forEach((o, k) => {
    let r;
    let longueurAxe = segment(k);
    if (o.parent < 0 && enfants[k].length >= 2) {
      // Racine : capsule couchée entre les deux enfants les plus écartés (hanches).
      let ecart = 0;
      for (const a of enfants[k]) for (const c of enfants[k]) {
        ecart = Math.max(ecart, norme([pos[a][0] - pos[c][0], pos[a][1] - pos[c][1], pos[a][2] - pos[c][2]]));
      }
      longueurAxe = ecart;
      r = PART.tronc * taille;
    } else if (tronc.has(k)) r = PART.tronc * taille;
    else if (k === cou) r = PART.cou * taille;
    else if (k === tete) r = PART.tete * taille;
    else r = Math.min(PART.maxi * taille, Math.max(PART.mini * taille, PART.membre * longueurAxe));
    sortie.set(o.nom, { rayon: r, longueur: Math.max(0, longueurAxe - 2 * r) });
  });
  return { taille, sortie };
}

// ── Inventaire ────────────────────────────────────────────────────────────────

function lister(dossier) {
  const out = [];
  if (!fs.existsSync(dossier)) return out;
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) out.push(...lister(p));
    else if (/_PhysicsAsset\.uasset$/.test(e.name)) out.push(p);
  }
  return out;
}

const auPlancher = (v) => v && Math.abs(v.v - PLANCHER) < TOL;

function etat(corps) {
  const capsules = corps.flatMap((c) => c.volumes.filter((v) => v.sorte === "SphylElems"));
  const autres = corps.flatMap((c) => c.volumes.filter((v) => v.sorte !== "SphylElems"));
  if (capsules.length === 0) return "sans-capsule";
  const degenerees = capsules.filter((v) => auPlancher(v.Radius) && auPlancher(v.Length)).length;
  if (degenerees === 0) return "sain";
  // Aux trois quarts au plancher, c'est un corps entier invisible (canopy et
  // mycelium femelles : 21/22 et 19/20, seule la tête a un volume). En dessous,
  // ce sont de petits os d'un rig sain (RobotGirl : 8/76, dog : 2/21).
  if (degenerees / capsules.length >= SEUIL_DEGENERE && autres.length === 0) return "degenere";
  return "mixte";
}

function squelettePour(fichierPhysique, corps) {
  const dossier = path.dirname(fichierPhysique);
  const base = path.basename(fichierPhysique).replace(/_PhysicsAsset\.uasset$/, "");
  const candidats = fs.readdirSync(dossier).filter((f) => /_Skeleton\.uasset$/.test(f));
  // Le même préfixe d'abord, puis tout squelette voisin qui porte TOUS les os.
  candidats.sort((a, b) => (b.startsWith(base) ? 1 : 0) - (a.startsWith(base) ? 1 : 0));
  const besoin = corps.map((c) => c.os);
  for (const f of candidats) {
    try {
      const { os } = lireSquelette(path.join(dossier, f));
      const noms = new Set(os.map((o) => o.nom));
      if (besoin.every((n) => noms.has(n))) return { fichier: f, os };
    } catch { /* squelette illisible : suivant */ }
  }
  return null;
}

// ── Écriture ──────────────────────────────────────────────────────────────────

function sauvegarder(fichier, racine, sorte) {
  const rel = path.relative(racine, fichier);
  const cible = path.join(SAUVEGARDES, sorte, rel);
  if (fs.existsSync(cible)) return; // la PREMIÈRE sauvegarde est l'originale
  fs.mkdirSync(path.dirname(cible), { recursive: true });
  fs.copyFileSync(fichier, cible);
}

function ecrire(corps, dimensions, racine, sorte) {
  const parFichier = new Map();
  for (const c of corps) {
    const d = dimensions.get(c.os);
    if (!d) throw new Error(`os sans dimension : ${c.os}`);
    for (const v of c.volumes) {
      // Seules les capsules AU PLANCHER : un volume réel (la tête de canopy) reste.
      if (v.sorte !== "SphylElems" || !(auPlancher(v.Radius) && auPlancher(v.Length))) continue;
      const liste = parFichier.get(c.fichierDonnees) || [];
      liste.push({ at: v.Radius["@"], val: d.rayon }, { at: v.Length["@"], val: d.longueur });
      parFichier.set(c.fichierDonnees, liste);
    }
  }
  for (const [fichier, ecritures] of parFichier) {
    sauvegarder(fichier, racine, sorte);
    const buf = fs.readFileSync(fichier);
    for (const e of ecritures) {
      if (Math.abs(buf.readFloatLE(e.at) - PLANCHER) > TOL) throw new Error(`${fichier}@${e.at} : valeur inattendue`);
      buf.writeFloatLE(e.val, e.at);
    }
    fs.writeFileSync(fichier, buf);
  }
}

// ── Principal ─────────────────────────────────────────────────────────────────

const fichiers = DOSSIERS.flatMap((d) => lister(path.join(SOURCE, d))).sort();
if (fichiers.length === 0) {
  console.error("Aucun PhysicsAsset trouve sous " + SOURCE + " — rien n'a ete mesure.");
  process.exit(1);
}

let degeneres = 0, repares = 0, mixtes = 0, sains = 0, echecs = 0;
for (const f of fichiers) {
  const rel = path.relative(SOURCE, f).replace(/\\/g, "/");
  let src;
  try { src = lireCorps(f); } catch (e) { console.log(`ILLISIBLE  ${rel} : ${e.message}`); echecs++; continue; }
  const eSrc = etat(src.corps);

  // Le cuit se juge À PART : une passe interrompue (fichier cuit verrouillé par
  // le client en cours) laisse une source réparée et un cuit au plancher — le
  // relevé suivant doit encore le voir.
  const cuitFichier = path.join(CUIT, path.relative(SOURCE, f));
  let cuit = null, eCuit = "absent";
  if (fs.existsSync(cuitFichier)) {
    try { cuit = lireCorps(cuitFichier); } catch { cuit = null; }
    // Le cuit doit être le MÊME asset : mêmes os, mêmes centres (la réparation
    // ne touche pas aux centres).
    const memes = cuit && cuit.corps.length === src.corps.length && cuit.corps.every((c, i) =>
      c.os === src.corps[i].os && c.volumes.length === src.corps[i].volumes.length &&
      c.volumes.every((v, j) => v.sorte !== "SphylElems" ||
        v.Center.v.every((x, a) => Math.abs(x - src.corps[i].volumes[j].Center.v[a]) < 1e-6)));
    if (!memes) { console.log(`ECHEC     ${rel} : le cuit ne correspond pas a la source`); echecs++; continue; }
    eCuit = etat(cuit.corps);
  }

  if (eSrc !== "degenere" && eCuit !== "degenere") {
    if (eSrc === "mixte") { mixtes++; console.log(`mixte     ${rel} (non touche)`); }
    else sains++;
    continue;
  }
  degeneres++;

  const sq = squelettePour(f, src.corps);
  if (!sq) { console.log(`ECHEC     ${rel} : aucun squelette voisin ne porte tous ses os`); echecs++; continue; }
  const { taille, sortie } = plan(sq.os);

  const exemple = ["Hips", "Spine", "LeftUpLeg", "Head"].map((n) => sortie.get(n)).find(Boolean) || [...sortie.values()][0];
  console.log(`degenere  ${rel}  squelette=${sq.fichier}  taille=${taille.toFixed(0)}  ${src.corps.length} corps` +
    `  ex. r=${exemple.rayon.toFixed(0)} L=${exemple.longueur.toFixed(0)}  source=${eSrc}  cuit=${eCuit}`);
  if (detail && rel.includes(detail)) {
    for (const c of src.corps) {
      const d = sortie.get(c.os);
      console.log(`            ${c.os.padEnd(24)} r=${d.rayon.toFixed(0).padStart(5)} (${(100 * d.rayon / taille).toFixed(1)} %)  L=${d.longueur.toFixed(0).padStart(5)}`);
    }
  }

  if (apply) {
    try {
      if (eSrc === "degenere") {
        ecrire(src.corps, sortie, SOURCE, "source");
        // Relecture dans un lecteur NEUF : une écriture qui n'a rien écrit ne dit rien.
        if (etat(lireCorps(f).corps) === "degenere") throw new Error("relecture source : toujours au plancher");
      }
      if (eCuit === "degenere") {
        ecrire(cuit.corps, sortie, CUIT, "cuit");
        if (etat(lireCorps(cuitFichier).corps) === "degenere") throw new Error("relecture cuit : toujours au plancher");
      }
      repares++;
    } catch (err) {
      console.log(`ECHEC     ${rel} : ${err.message}`);
      echecs++;
    }
  }
}

console.log(`\n${fichiers.length} PhysicsAsset(s) : ${sains} sain(s), ${mixtes} mixte(s), ${degeneres} degenere(s)` +
  (apply ? `, ${repares} repare(s)` : "") + `, ${echecs} echec(s).`);
if (!apply && degeneres > 0) console.log("Relance avec --apply pour reparer source et cuit (sauvegardes dans adk/_sauvegardes/pnj-physique).");
if (echecs > 0 || (verifier && degeneres > 0)) process.exit(1);