// ══════════════════════════════════════════════════════════════════════════════
// scripts/audit-anim-bones.mjs — Quel squelette nos ANIMATIONS pilotent-elles ?
//
//   node scripts/audit-anim-bones.mjs [--rig <rig.*.json>]
//
// La question décide du rig cible du corps morphable : un corps riggé sur des os
// que les clips ne nomment pas ne s'animera jamais, sans qu'aucune erreur ne soit
// levée (three lie les pistes aux nœuds PAR LEUR NOM — un nom absent est
// silencieusement ignoré).
//
// On ne lit QUE l'en-tête JSON du GLB : 12 octets d'en-tête + la longueur du
// premier chunk. Pas de décodage de géométrie, donc des centaines de fichiers en
// quelques secondes.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const RACINE = "public/models/animations";
const RIG_DEFAUT =
  "C:/Users/aniss/OneDrive/Bureau/Nouveau dossier/mpfb2-master/src/mpfb/data/rigs/standard";

/** Lit le chunk JSON d'un GLB sans toucher au binaire. */
function enTeteGlb(fichier) {
  const fd = fs.openSync(fichier, "r");
  try {
    const tete = Buffer.alloc(20);
    fs.readSync(fd, tete, 0, 20, 0);
    if (tete.readUInt32LE(0) !== 0x46546c67) return null;   // « glTF »
    const longueur = tete.readUInt32LE(12);
    const json = Buffer.alloc(longueur);
    fs.readSync(fd, json, 0, longueur, 20);
    return JSON.parse(json.toString("utf8"));
  } catch { return null; } finally { fs.closeSync(fd); }
}

/** Noms des nœuds réellement CIBLÉS par des pistes d'animation. */
function osAnimes(gltf) {
  const noms = new Set();
  for (const anim of gltf.animations ?? []) {
    for (const canal of anim.channels ?? []) {
      const n = gltf.nodes?.[canal.target?.node]?.name;
      if (n) noms.add(n);
    }
  }
  return noms;
}

function tousLesGlb(dir, sortie = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) tousLesGlb(p, sortie);
    else if (e.name.toLowerCase().endsWith(".glb")) sortie.push(p);
  }
  return sortie;
}

const fichiers = tousLesGlb(RACINE);
console.info(`[anim] ${fichiers.length} GLB sous ${RACINE}`);

const frequence = new Map();      // nom d'os → nb de fichiers qui l'animent
let avecAnim = 0;
for (const f of fichiers) {
  const g = enTeteGlb(f);
  if (!g?.animations?.length) continue;
  avecAnim++;
  for (const n of osAnimes(g)) frequence.set(n, (frequence.get(n) ?? 0) + 1);
}
console.info(`[anim] ${avecAnim} fichiers portent au moins une animation`);
console.info(`[anim] ${frequence.size} noms d'os distincts animés`);

// Préfixes : révèle d'un coup d'œil la convention de nommage dominante.
const prefixes = new Map();
for (const n of frequence.keys()) {
  const p = n.includes(":") ? n.split(":")[0] + ":" : "(sans préfixe)";
  prefixes.set(p, (prefixes.get(p) ?? 0) + 1);
}
console.info("[anim] conventions de nommage :");
for (const [p, c] of [...prefixes].sort((a, b) => b[1] - a[1])) {
  console.info(`         ${String(c).padStart(4)} os  ${p}`);
}

// ── Confrontation avec chaque rig MPFB ─────────────────────────────────────
// La question n'est PAS « combien d'os le rig a-t-il » mais « combien des os que
// nos clips animent, ce rig les porte-t-il ». Un rig plus riche qui ne partage
// aucun nom vaut zéro.
const argRig = process.argv.indexOf("--rig");
const dossierRig = argRig > 0 ? process.argv[argRig + 1] : RIG_DEFAUT;

if (fs.existsSync(dossierRig)) {
  console.info(`\n[anim] confrontation avec ${dossierRig}`);
  const animes = new Set(frequence.keys());
  for (const f of fs.readdirSync(dossierRig).filter((n) => n.startsWith("rig."))) {
    const r = JSON.parse(fs.readFileSync(path.join(dossierRig, f), "utf8"));
    const os = new Set(Object.keys(r.bones ?? r));
    const communs = [...os].filter((n) => animes.has(n));
    const couverture = animes.size ? (100 * communs.length) / animes.size : 0;
    console.info(
      `         ${f.padEnd(30)} ${String(os.size).padStart(4)} os · ` +
      `${String(communs.length).padStart(4)} communs · ` +
      `couvre ${couverture.toFixed(1)} % des os animés`,
    );
  }
} else {
  console.warn(`[anim] dossier de rigs introuvable : ${dossierRig}`);
}

console.info("\n[anim] 15 os les plus fréquemment animés :");
for (const [n, c] of [...frequence].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.info(`         ${String(c).padStart(4)} fichiers  ${n}`);
}
