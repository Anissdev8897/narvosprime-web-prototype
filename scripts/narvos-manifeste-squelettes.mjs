// ══════════════════════════════════════════════════════════════════════════════
// narvos-manifeste-squelettes.mjs — QUEL squelette porte chaque pièce cuite ?
//
//   node scripts/narvos-manifeste-squelettes.mjs [--apply]
//
// ── LA QUESTION QUI OUVRE OU FERME LA GARDE-ROBE ─────────────────────────────
// `AddSkeletalMeshAttached` exige le MÊME squelette que le mesh du personnage.
// Une pièce liée à un autre squelette n'est pas refusée bruyamment : elle ne
// s'affiche pas, et rien ne le dit. `narvos-modular-to-lua.mjs` attend donc un
// MANIFESTE — la preuve, clé par clé — avant de laisser une famille entrer au
// catalogue de création.
//
// Ce script écrit ce manifeste, et il le fait SANS l'éditeur : la table de noms
// d'un `.uasset` vit près du début et de la fin du fichier (méthode de
// `narvos-squelettes-uasset.mjs`, éprouvée le 2026-09-09).
//
// ── CE QU'IL PROUVE, ET CE QU'IL NE PROUVE PAS ───────────────────────────────
// Il prouve que le mesh RÉFÉRENCE tel squelette. Il ne dit rien de la POSE DE
// LIAISON ni des VOLUMES : deux pièces du même squelette peuvent s'interpénétrer
// (c'est ce que la FAMILLE, côté catalogue, interdit). Feu vert pour
// l'attachement, pas pour le mélange.
//
// ── LA CLÉ, JAMAIS LE NOM DE FICHIER ─────────────────────────────────────────
// Le constructeur de pack suffixe les doublons : la clé `SK_Pants_2` pointe le
// fichier `SK_Pants`. On lit donc Assets.toml (clé -> chemin) et on remonte au
// `.uasset` par le chemin.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const RACINE = "E:/narvosprime-web-prototype";
const TOML = `${RACINE}/WebPortal/Server/Assets/narvos/Assets.toml`;
const CONTENU = `${RACINE}/WebPortal/Server/adk/Content`;
const MANIFESTES = `${RACINE}/WebPortal/Server/adk/_manifests`;

const APPLIQUER = process.argv.includes("--apply");

/** Le squelette du personnage nanos. Tout ce qui s'y rattache est attachable. */
const SQUELETTE_NANOS = "SKEL_Mannequin";

/** Familles surveillées : préfixe(s) de chemin toml -> nom du manifeste écrit.
 *
 *  ⚠ `BodyForms` EST DU TROOPER. Le pack range les corps nus (`SK_*_Form_*`)
 *  dans un dossier voisin de l'armure, pas dedans. Un manifeste qui ne regardait
 *  que `Trooper_Set/` déclarait donc 67 pièces d'armure et AUCUNE peau : le
 *  générateur ne trouvait plus de tenue nue, le corps porteur restait visible
 *  sous l'armure, et j'en ai conclu à tort que ces meshes « n'avaient jamais été
 *  cuits ». Ils sont importés ET déclarés depuis le début — c'est la PORTÉE de
 *  la recherche qui était fausse, pas le pipeline. */
const FAMILLES = [
  {
    prefixes: ["Narvos/Meshes/Trooper_Set/", "Narvos/Meshes/BodyForms/"],
    manifeste: "trooper-squelettes",
  },
  { prefixes: ["Narvos/Defender/Demo/Meshes/ModularMeshes/"], manifeste: "defender-squelettes" },
  { prefixes: ["Narvos/MetaCustom/"], manifeste: "metacustom-squelettes" },
];

// ── Lecture d'Assets.toml : clé -> chemin, section des SkeletalMesh ───────────

if (!fs.existsSync(TOML)) {
  console.error(`ARRÊT : Assets.toml introuvable : ${TOML}`);
  process.exit(1);
}

const cles = [];
{
  let dansSk = false;
  let sectionVue = false;
  for (const ligne of fs.readFileSync(TOML, "utf8").split(/\r?\n/)) {
    const s = ligne.match(/^\s*\[([^\]]+)\]\s*$/);
    if (s) {
      dansSk = s[1] === "assets.skeletal_meshes";
      if (dansSk) sectionVue = true;
      continue;
    }
    if (!dansSk) continue;
    const m = ligne.match(/^\s*(?:"((?:[^"\\]|\\.)*)"|([A-Za-z0-9_-]+))\s*=\s*"([^"]+)"/);
    if (!m) continue;
    const cle = m[1] !== undefined ? JSON.parse(`"${m[1]}"`) : m[2];
    cles.push({ cle, chemin: m[3] });
  }
  if (!sectionVue) {
    console.error("ARRÊT : section [assets.skeletal_meshes] absente d'Assets.toml.");
    process.exit(1);
  }
}

console.log(`${cles.length} SkeletalMesh déclarés dans le pack.`);

// ── Le squelette référencé par un .uasset ────────────────────────────────────

/** 1 Mo à chaque bout : la table de noms y vit, et certains fichiers dépassent
 *  512 Mo — au-delà, V8 refuse de fabriquer la chaîne (ERR_STRING_TOO_LONG). */
function bouts(fichier) {
  const T = 1048576;
  const st = fs.statSync(fichier);
  const fd = fs.openSync(fichier, "r");
  try {
    const a = Buffer.alloc(Math.min(T, st.size));
    fs.readSync(fd, a, 0, a.length, 0);
    const depuis = Math.max(0, st.size - T);
    const b = Buffer.alloc(Math.min(T, st.size - depuis));
    fs.readSync(fd, b, 0, b.length, depuis);
    return a.toString("latin1") + " " + b.toString("latin1");
  } finally {
    fs.closeSync(fd);
  }
}

const MOTIF = /(Skel_Dummy|metahuman_base_skel|SKEL_Mannequin|UE4_Mannequin_Skeleton|[A-Za-z0-9]{3,28}_Skeleton)/g;

function squelettesDe(fichier) {
  let texte;
  try { texte = bouts(fichier); } catch { return null; }
  const vus = new Map();
  for (const m of texte.matchAll(MOTIF)) vus.set(m[1], (vus.get(m[1]) || 0) + 1);
  return vus;
}

// ── Le balayage, famille par famille ─────────────────────────────────────────

let total = 0;
const resume = [];

for (const famille of FAMILLES) {
  const membres = cles.filter((c) => famille.prefixes.some((p) => c.chemin.startsWith(p)));
  const compatibles = [];
  const autres = {};
  const introuvables = [];

  for (const { cle, chemin } of membres) {
    const fichier = path.join(CONTENU, chemin + ".uasset");
    if (!fs.existsSync(fichier)) { introuvables.push(cle); continue; }
    const vus = squelettesDe(fichier);
    if (!vus || vus.size === 0) { introuvables.push(cle); continue; }
    // Le squelette le plus cité l'emporte : un mesh nomme le sien des dizaines
    // de fois (os, courbes), et peut mentionner un autre au passage.
    const [meilleur] = [...vus.entries()].sort((a, b) => b[1] - a[1])[0];
    if (meilleur === SQUELETTE_NANOS) compatibles.push(cle);
    else autres[cle] = meilleur;
  }

  const sortie = {
    genere_par: "scripts/narvos-manifeste-squelettes.mjs",
    squelette_cible: SQUELETTE_NANOS,
    prefixes: famille.prefixes,
    lus: membres.length,
    compatibles,
    autres,
    introuvables,
  };

  const destination = `${MANIFESTES}/${famille.manifeste}.json`;
  const familles_autres = new Set(Object.values(autres));
  // ⚠ UN FILTRE QUI NE TROUVE RIEN NE PASSE PAS EN SILENCE. Le 2026-09-12, le
  // renommage `prefixe` -> `prefixes` a laissé la boucle lire un champ inexistant :
  // zéro clé retenue, et les trois manifestes RÉÉCRITS À VIDE — la preuve
  // effacée, sans une erreur. Le garde ci-dessous refuse d'écrire ce vide.
  if (membres.length === 0) {
    console.error(`ARRÊT : aucune clé sous ${famille.prefixes.join(", ")}.`);
    console.error("  Filtre cassé ou pack amputé : on n'écrase pas un manifeste avec du vide.");
    process.exit(1);
  }

  console.log(
    `\n${famille.prefixes.join(" + ")}\n  ${membres.length} clé(s) · ${compatibles.length} sur ${SQUELETTE_NANOS}` +
    ` · ${Object.keys(autres).length} ailleurs (${[...familles_autres].join(", ") || "—"})` +
    ` · ${introuvables.length} fichier(s) introuvable(s)`
  );

  if (APPLIQUER) {
    fs.mkdirSync(MANIFESTES, { recursive: true });
    fs.writeFileSync(destination, JSON.stringify(sortie, null, 1) + "\n", "utf8");
    console.log(`  écrit : ${destination}`);
  } else {
    console.log(`  (essai — relancer avec --apply pour écrire ${path.basename(destination)})`);
  }

  total += compatibles.length;
  resume.push({ famille: famille.manifeste, compatibles: compatibles.length });
}

console.log(`\n${total} pièce(s) prouvée(s) attachables au squelette nanos.`);
for (const r of resume) console.log(`  ${r.famille.padEnd(24)} ${r.compatibles}`);
if (!APPLIQUER) console.log("\nAucun fichier écrit (essai).");