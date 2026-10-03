// ══════════════════════════════════════════════════════════════════════════════
// scripts/triage-ennemis.mjs — Trie les candidats ENNEMIS parmi les packs lourds.
//
//   node scripts/triage-ennemis.mjs [--copier]
//
// ── POURQUOI UN TRI, ET PAS UN IMPORT ────────────────────────────────────────
//
// Mesuré : ZombieSoldierPack 42,7 Go · Animals_Warrior 12,1 Go · Animalia
// 7,8 Go · Dragon8 3,7 Go. Soit ~68 Go pour dix packs, quand le runtime entier
// n'en charge que ~4,7 Go. Importer un pack « parce qu'il contient des aliens »
// ferait exploser la VRAM avant d'avoir vu le premier ennemi.
//
// Le tri porte donc sur les FICHIERS, un par un, sur des critères mesurés.
//
// ── LECTURE SANS DÉCODAGE ────────────────────────────────────────────────────
//
// On ne lit que l'en-tête JSON du GLB (12 octets + longueur du 1er chunk). Ni
// géométrie ni texture décodées : des centaines de fichiers en quelques
// secondes, là où un chargement complet prendrait des heures et saturerait la
// mémoire.
//
// ── CE QUI FAIT UN BON ENNEMI ────────────────────────────────────────────────
//
//   riggé          sans squelette, pas d'animation possible
//   os ∩ Manny     nos 668 GLB d'animation sont en nommage UE ; 0 os commun
//                  = inanimable par la bibliothèque, sans erreur levée
//   triangles      un ennemi qu'on croise par dizaines doit rester léger
//   texels         LA cause des « Context Lost » : la VRAM ne dépend PAS du
//                  poids du fichier — un PNG 2048² fait 22 Mo décompressé
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const RACINE = "public/models";
const SORTIE = "export/ennemis";
const COPIER = process.argv.includes("--copier");

/** Packs candidats, relevés dans `asset-catalog.json` sur les tags alien/créature. */
const CANDIDATS = [
  "pnj/mercenaire_alien", "pnj/profhete_alien", "pnj/RobotGirl",
  "creatures/animalis", "creatures/VOL2_Birds", "creatures/AnimalsVol01",
  "creatures/Dragon8", "creatures/Animalia", "creatures/Animals_Warrior_Pack",
  "personnages/ZombieSoldierPack",
];

/** Seuils. Au-delà, l'asset coûte plus qu'il ne rapporte comme ennemi de masse. */
const MAX_TRIS = 60_000;
const MAX_TEXELS_MO = 64;      // estimation RGBA8, cf. narvos-mesh-pipeline

function enTete(f) {
  const fd = fs.openSync(f, "r");
  try {
    const t = Buffer.alloc(20);
    if (fs.readSync(fd, t, 0, 20, 0) < 20) return null;
    if (t.readUInt32LE(0) !== 0x46546c67) return null;
    const n = t.readUInt32LE(12);
    const j = Buffer.alloc(n);
    fs.readSync(fd, j, 0, n, 20);
    return JSON.parse(j.toString("utf8"));
  } catch { return null; } finally { fs.closeSync(fd); }
}

function mannyJoints() {
  const j = enTete(`${RACINE}/personnages/ThirdPerson/Characters/Mannequins/Meshes/SKM_Manny_Simple.glb`);
  return new Set((j?.skins?.[0]?.joints ?? []).map((i) => j.nodes[i]?.name).filter(Boolean));
}

function mesurer(f, manny) {
  const g = enTete(f);
  if (!g) return null;

  // Triangles : somme des `count` d'indices, /3. Sans décoder le binaire.
  let tris = 0;
  for (const m of g.meshes ?? []) {
    for (const p of m.primitives ?? []) {
      const acc = g.accessors?.[p.indices];
      if (acc) tris += acc.count / 3;
    }
  }

  // VRAM estimée : on ne connaît pas les dimensions sans décoder l'image, mais
  // le poids du bufferView donne un ordre de grandeur du contenu texture.
  let octetsTex = 0;
  for (const im of g.images ?? []) {
    const bv = g.bufferViews?.[im.bufferView];
    if (bv) octetsTex += bv.byteLength ?? 0;
  }

  const joints = (g.skins?.[0]?.joints ?? []).map((i) => g.nodes[i]?.name).filter(Boolean);
  const communs = joints.filter((n) => manny.has(n)).length;

  return {
    fichier: f,
    mo: fs.statSync(f).size / 1048576,
    tris: Math.round(tris),
    images: (g.images ?? []).length,
    texMo: octetsTex / 1048576,
    os: joints.length,
    manny: manny.size ? (100 * communs) / manny.size : 0,
    anims: (g.animations ?? []).length,
  };
}

function tousLesGlb(dir, out = []) {
  let entrees;
  try { entrees = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entrees) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) tousLesGlb(p, out);
    else if (e.name.toLowerCase().endsWith(".glb")) out.push(p);
  }
  return out;
}

const manny = mannyJoints();
console.info(`[tri] référence Manny : ${manny.size} os`);

const tous = [];
for (const c of CANDIDATS) {
  const dir = path.join(RACINE, c);
  const fichiers = tousLesGlb(dir);
  if (!fichiers.length) { console.warn(`[tri] ${c} — aucun GLB`); continue; }

  const mesures = fichiers.map((f) => mesurer(f, manny)).filter(Boolean);
  const rigges = mesures.filter((m) => m.os > 0);
  const compat = rigges.filter((m) => m.manny >= 50);
  const legers = compat.filter((m) => m.tris <= MAX_TRIS && m.texMo <= MAX_TEXELS_MO);

  console.info(
    `[tri] ${c.padEnd(34)} ${String(mesures.length).padStart(4)} glb · ` +
    `${String(rigges.length).padStart(4)} riggés · ` +
    `${String(compat.length).padStart(4)} ≥50% Manny · ` +
    `${String(legers.length).padStart(4)} RETENUS`,
  );
  for (const m of legers) tous.push({ ...m, pack: c });
}

tous.sort((a, b) => b.manny - a.manny || a.tris - b.tris);

console.info(`\n[tri] ${tous.length} fichier(s) retenu(s) — 20 premiers :`);
console.info("  " + "fichier".padEnd(52) + "os".padStart(4) + "Manny".padStart(7) + "tris".padStart(8) + "Mo".padStart(7));
for (const m of tous.slice(0, 20)) {
  console.info(
    "  " + path.basename(m.fichier).slice(0, 50).padEnd(52) +
    String(m.os).padStart(4) + (m.manny.toFixed(0) + "%").padStart(7) +
    String(m.tris).padStart(8) + m.mo.toFixed(1).padStart(7),
  );
}

fs.mkdirSync(SORTIE, { recursive: true });
fs.writeFileSync(
  path.join(SORTIE, "triage.json"),
  JSON.stringify({ seuils: { MAX_TRIS, MAX_TEXELS_MO }, retenus: tous }, null, 2),
);
console.info(`\n[tri] ✓ ${SORTIE}/triage.json — ${tous.length} entrées`);

if (COPIER) {
  let n = 0, mo = 0;
  for (const m of tous) {
    const dest = path.join(SORTIE, m.pack.replace(/\//g, "_"), path.basename(m.fichier));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(m.fichier, dest);
    n++; mo += m.mo;
  }
  console.info(`[tri] ✓ ${n} fichier(s) copié(s) — ${mo.toFixed(0)} Mo`);
} else {
  console.info("[tri] rapport seul. Relancer avec --copier pour remplir le dossier.");
}
