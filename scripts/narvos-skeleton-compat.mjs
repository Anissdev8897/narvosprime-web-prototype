// ══════════════════════════════════════════════════════════════════════════════
// narvos-skeleton-compat.mjs — compare le squelette de chaque GLB à celui que
// nanos exige.
//
//   node scripts/narvos-skeleton-compat.mjs <dossier|fichier> [--detail] [--limite N]
//
// POURQUOI CE SCRIPT EN PLUS DE unreal-audit-glb.mjs : l'audit classe par
// CONVENTION (une heuristique sur quelques os témoins). nanos, lui, exige que le
// mesh partage le squelette `SKEL_Mannequin` — c'est-à-dire les MÊMES NOMS d'os.
// « Convention UE4 » et « compatible » ne sont donc pas la même affirmation, et
// c'est la seconde qui décide si un modèle entre dans le jeu sans retargeting.
//
// La référence est extraite de l'ADK officiel (scripts/adk-export-mannequin.py),
// pas d'un Mannequin trouvé ailleurs : c'est le squelette que le moteur du jeu
// charge réellement.
//
// LECTURE DU VERDICT :
//   IDENTIQUE     les 68 os, aucun en trop        -> import direct
//   SUR-ENSEMBLE  les 68 + des os en plus         -> import direct, le surplus est ignoré
//   IK SEULS      seuls des `ik_*` manquent       -> import direct : ils ne déforment rien
//   INTERCALE     les noms concordent, mais des os s'insèrent dans la chaîne.
//                 MetaHuman : neck_01 pend de spine_05, lui-même sous spine_04
//                 puis spine_03. Le mesh est PONDÉRÉ sur ces os intermédiaires ;
//                 liés à SKEL_Mannequin qui ne les a pas, ces poids sont perdus
//                 et le tronc se déforme faux. INUTILISABLE tel quel.
//   REPARENTE     un os commun pend d'une AUTRE branche. Pire encore : aucun
//                 retargeting simple ne rattrape ça.
//   PARTIEL       de vrais os de déformation      -> retargeting nécessaire
//   ETRANGER      presque rien en commun          -> autre squelette, retargeting complet
//   SANS OS       aucun skin ni canal d'animation -> mesh statique, pas un personnage
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const REFERENCE = "E:/narvosprime-web-prototype/WebPortal/Server/adk/_export/SK_Mannequin.glb";

const cible = process.argv[2];
const DETAIL = process.argv.includes("--detail");
const iLimite = process.argv.indexOf("--limite");
const LIMITE = iLimite >= 0 ? Number(process.argv[iLimite + 1]) : Infinity;

if (!cible || !fs.existsSync(cible)) {
  console.error("Usage : node scripts/narvos-skeleton-compat.mjs <dossier|fichier> [--detail] [--limite N]");
  process.exit(1);
}

/**
 * Lit le chunk JSON d'un GLB sans charger les données binaires.
 *
 * Un GLB fait couramment plusieurs centaines de Mo dont la quasi-totalité est du
 * buffer. Lire l'en-tête puis le seul chunk JSON permet d'auditer des milliers de
 * fichiers ; `readFileSync` sur le lot ferait exploser la mémoire.
 */
const lireJson = (fichier) => {
  const fd = fs.openSync(fichier, "r");
  try {
    const entete = Buffer.alloc(20);
    if (fs.readSync(fd, entete, 0, 20, 0) < 20) return null;
    if (entete.readUInt32LE(0) !== 0x46546c67) return null;      // "glTF"

    const tailleJson = entete.readUInt32LE(12);
    if (entete.readUInt32LE(16) !== 0x4e4f534a) return null;     // "JSON"

    const bloc = Buffer.alloc(tailleJson);
    fs.readSync(fd, bloc, 0, tailleJson, 20);
    return JSON.parse(bloc.toString("utf8"));
  } catch {
    return null;
  } finally {
    fs.closeSync(fd);
  }
};

/** Noms d'os d'un GLB, tous skins confondus. */
/**
 * Parent de chaque os, par son nom. `"(racine)"` pour l'os sans parent.
 *
 * ⚠ C'EST CE QUI MANQUAIT. Deux squelettes peuvent partager tous leurs noms
 * d'os et n'avoir pas le même ARBRE : chez MetaHuman, `neck_01` pend de
 * `spine_05` là où le Mannequin le fait pendre de `spine_03`. Lier un tel mesh
 * à SKEL_Mannequin ne lève rien et déforme faux.
 */
const arbreDe = (json) => {
  if (!json) return null;

  const noms = new Map();
  (json.nodes ?? []).forEach((n, i) => noms.set(i, n.name ?? ""));

  const parent = new Map();
  (json.nodes ?? []).forEach((n, i) => {
    for (const c of n.children ?? []) parent.set(c, i);
  });

  const joints = new Set();
  for (const skin of json.skins ?? []) for (const j of skin.joints ?? []) joints.add(j);

  const arbre = new Map();
  for (const i of joints) {
    const nom = noms.get(i);
    if (!nom) continue;
    const p = parent.get(i);
    arbre.set(nom, p === undefined ? "(racine)" : noms.get(p) ?? "");
  }
  return arbre;
};

const osDe = (json) => {
  if (!json) return null;
  const noms = new Set();
  for (const skin of json.skins ?? []) {
    for (const i of skin.joints ?? []) {
      const n = json.nodes?.[i]?.name;
      if (n) noms.add(n);
    }
  }
  // Un GLB d'animation pure n'a pas de skin : ses os sont les cibles de canaux.
  if (noms.size === 0) {
    for (const anim of json.animations ?? []) {
      for (const canal of anim.channels ?? []) {
        const n = json.nodes?.[canal.target?.node]?.name;
        if (n) noms.add(n);
      }
    }
  }
  return noms;
};

// ─── référence ────────────────────────────────────────────────────────────────

if (!fs.existsSync(REFERENCE)) {
  console.error(`Référence absente : ${REFERENCE}`);
  console.error("La produire avec scripts/adk-export-mannequin.py (voir son en-tête).");
  process.exit(1);
}

const REF = osDe(lireJson(REFERENCE));

/** Arbre de la référence : quel os pend de quel os. Chargé une fois. */
const ARBRE_REF = arbreDe(lireJson(REFERENCE));
if (!REF || REF.size === 0) {
  console.error("La référence ne contient aucun os — export corrompu ?");
  process.exit(1);
}

// ─── parcours ─────────────────────────────────────────────────────────────────

const fichiers = [];
const collecter = (p) => {
  const st = fs.statSync(p);
  if (st.isFile()) {
    if (p.toLowerCase().endsWith(".glb")) fichiers.push(p);
    return;
  }
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    collecter(path.join(p, e.name));
  }
};
collecter(cible);

const verdicts = new Map();
const parPack = new Map();
const exemples = new Map();
// Résultat par fichier — nécessaire au manifeste `--json`. On le garde en
// mémoire plutôt que de relire les GLB une seconde fois : l'analyse coûte un
// open + un parse par fichier, la refaire doublerait le temps sur 1 589 entrées.
const retenus = [];

/**
 * Le GLB utilise-t-il des textures KTX2 ?
 *
 * `KHR_texture_basisu` ne figure PAS dans les 18 extensions que l'Interchange
 * d'Unreal 5.7 sait lire (vérifié dans Engine/Plugins/Interchange). Le mesh et
 * le squelette s'importent quand même — ce sont les TEXTURES qui manquent, en
 * silence. Un personnage gris à l'écran, sans erreur nulle part.
 *
 * Le projet a des paires <pack>/<pack>_original exactement pour ça : le premier
 * est la version web allégée en KTX2, le second garde les textures d'origine.
 * Pour Unreal, c'est `_original` qu'il faut, malgré son poids.
 */
const estKtx2 = (json) => (json?.extensionsUsed ?? []).includes("KHR_texture_basisu");

for (const f of fichiers.slice(0, LIMITE)) {
  const json = lireJson(f);
  const os = osDe(json);
  const arbre = arbreDe(json);

  /**
   * Les os communs pendent-ils du MÊME parent ?
   *
   * ⚠ LE CONTRÔLE QUI MANQUAIT. Un squelette peut porter TOUS les bons noms et
   * n'avoir pas le même arbre : chez MetaHuman `neck_01` pend de `spine_05` là
   * où le Mannequin le fait pendre de `spine_03`. Lier un tel mesh à
   * SKEL_Mannequin ne lève aucune erreur et déforme faux — le défaut ne se voit
   * qu'à l'écran, sur un personnage tordu.
   *
   * On ignore les parents ABSENTS de la référence : un os intercalé
   * (`spine_04`, un twist supplémentaire) est un surplus, pas un reparentage.
   */
  const reparente = [];
  const intercale = [];

  if (arbre && ARBRE_REF) {
    // Premier ancêtre que la référence connaît. On traverse les os inconnus :
    // c'est ce qui distingue un os INTERCALÉ dans la même chaîne d'un membre
    // réellement déplacé ailleurs dans l'arbre.
    const ancetreConnu = (nom) => {
      const vus = new Set();
      let p = arbre.get(nom);
      while (p !== undefined && p !== "(racine)" && !vus.has(p)) {
        if (ARBRE_REF.has(p)) return p;
        vus.add(p);
        p = arbre.get(p);
      }
      return p === "(racine)" ? "(racine)" : undefined;
    };

    for (const [nom, parentRef] of ARBRE_REF) {
      const parentIci = arbre.get(nom);
      if (parentIci === undefined) continue;   // os absent : déjà compté ailleurs
      if (parentIci === parentRef) continue;   // même parent immédiat : rien à dire

      const ancetre = ancetreConnu(nom);
      if (ancetre === parentRef) {
        // Même chaîne, mais des os s'y sont glissés. Le mesh peut être PONDÉRÉ
        // sur eux ; liés à SKEL_Mannequin qui ne les a pas, ces poids
        // disparaissent et la déformation est fausse à cet endroit.
        intercale.push(`${nom} : ${parentRef} -> ${parentIci} -> … -> ${parentRef}`);
      } else {
        // L'os pend d'une AUTRE branche. Aucun retargeting simple ne rattrape ça.
        reparente.push(`${nom} : ${parentRef} -> ${ancetre ?? parentIci}`);
      }
    }
  }
  const ktx2 = estKtx2(json);

  let verdict;
  let manquants = [];

  if (!os || os.size === 0) {
    verdict = "SANS OS";
  } else {
    manquants = [...REF].filter((b) => !os.has(b));
    const communs = REF.size - manquants.length;

    if (manquants.length === 0) {
      verdict = os.size === REF.size ? "IDENTIQUE" : "SUR-ENSEMBLE";
    } else if (manquants.every((b) => b.startsWith("ik_"))) {
      // Les 7 os `ik_*` du Mannequin ne déforment RIEN : ce sont des cibles
      // d'animation procédurale (pose des pieds, main sur l'arme). Un mesh qui
      // ne les porte pas se skinne et s'anime normalement — les confondre avec
      // de vrais os manquants condamnerait des packs entiers au retargeting
      // pour rien. ParagonSteel (192 fichiers) est exactement ce cas.
      verdict = "IK SEULS";
    } else if (communs >= REF.size * 0.5) {
      verdict = "PARTIEL";
    } else {
      verdict = "ETRANGER";
    }

    // ⚠ CES DEUX CAS ANNULENT TOUT VERDICT FAVORABLE, et aucun ne se voit en
    // comparant des noms d'os. Ils ne se voient QU'À L'ÉCRAN, sur un personnage
    // déformé — c'est-à-dire trop tard, après un import et un cook.
    if (verdict !== "ETRANGER" && verdict !== "SANS OS") {
      if (reparente.length > 0) {
        verdict = "REPARENTE";
      } else if (intercale.length > 0) {
        verdict = "INTERCALE";
      }
    }
  }

  verdicts.set(verdict, (verdicts.get(verdict) ?? 0) + 1);
  retenus.push({ fichier: f, verdict, os: os ? os.size : 0, ktx2 });

  // Le « pack » est le premier dossier sous la racine analysée : c'est l'unité
  // qu'on importe ou qu'on laisse de côté, pas le fichier isolé.
  const rel = path.relative(cible, f);
  const pack = rel.split(path.sep)[0] || path.basename(cible);
  if (!parPack.has(pack)) parPack.set(pack, new Map());
  const m = parPack.get(pack);
  m.set(verdict, (m.get(verdict) ?? 0) + 1);

  if (!exemples.has(verdict)) {
    exemples.set(verdict, { fichier: rel, os: os ? os.size : 0, manquants: manquants.slice(0, 12) });
  }
}

// ─── rapport ──────────────────────────────────────────────────────────────────

console.log(`référence : ${path.basename(REFERENCE)} — ${REF.size} os`);
console.log(`${Math.min(fichiers.length, LIMITE)} GLB comparés sous ${cible}`);
console.log("");

const ORDRE = ["IDENTIQUE", "SUR-ENSEMBLE", "IK SEULS", "INTERCALE", "REPARENTE", "PARTIEL", "ETRANGER", "SANS OS"];
console.log("=== compatibilité avec SKEL_Mannequin ===");
for (const v of ORDRE) {
  if (verdicts.has(v)) console.log(`  ${String(verdicts.get(v)).padStart(6)}  ${v}`);
}

const direct = (verdicts.get("IDENTIQUE") ?? 0) + (verdicts.get("SUR-ENSEMBLE") ?? 0)
  + (verdicts.get("IK SEULS") ?? 0);
console.log("");
console.log(`  ${direct} GLB importables SANS retargeting.`);

console.log("");
console.log("=== par pack ===");
const lignes = [...parPack].sort((a, b) => {
  const d = (x) => (x.get("IDENTIQUE") ?? 0) + (x.get("SUR-ENSEMBLE") ?? 0) + (x.get("IK SEULS") ?? 0);
  return d(b[1]) - d(a[1]);
});
for (const [pack, m] of lignes) {
  const parts = ORDRE.filter((v) => m.has(v)).map((v) => `${m.get(v)} ${v}`);
  console.log(`  ${pack.padEnd(30)} ${parts.join(", ")}`);
}

if (DETAIL) {
  console.log("");
  console.log("=== un exemple par verdict ===");
  for (const v of ORDRE) {
    const e = exemples.get(v);
    if (!e) continue;
    console.log(`  ${v} — ${e.fichier} (${e.os} os)`);
    if (e.manquants.length) console.log(`      manquants : ${e.manquants.join(", ")}`);
  }
}

// ─── manifeste ────────────────────────────────────────────────────────────────

// ⚠ `--animations` GARDE les fichiers à textures KTX2.
//
// L'exclusion KTX2 existe pour les PERSONNAGES : Interchange ne lit pas
// `KHR_texture_basisu`, le mesh passe, les textures non, et le personnage sort
// gris sans la moindre erreur. Pour une ANIMATION, ce raisonnement ne tient pas
// — elle n'a aucune texture à porter, seulement des pistes d'os.
//
// Mesuré le 2026-09-03 : le filtre écartait 68 animations parfaitement valides
// du pack WW100IdleAnimPack, dont TOUTES les boucles `AS_Sit_*_Loop*` — celles
// qui servent réellement. Il ne restait que les transitions.
const ANIMATIONS = process.argv.includes("--animations");

const iJson = process.argv.indexOf("--json");
if (iJson >= 0) {
  const destination = process.argv[iJson + 1];
  if (!destination) {
    console.error("--json attend un chemin de fichier");
    process.exit(1);
  }

  // Le manifeste ne liste QUE les fichiers directement liables. Laisser
  // l'import filtrer lui-même reviendrait à dupliquer la règle de compatibilité
  // à deux endroits, dans deux langages — elle finirait par diverger.
  const liables = retenus.filter(
    (r) => r.verdict === "IDENTIQUE" || r.verdict === "SUR-ENSEMBLE" || r.verdict === "IK SEULS",
  );

  // Les KTX2 sont écartés : leur mesh et leur squelette passeraient, leurs
  // textures non — et le défaut ne se verrait qu'en jeu, sur un personnage gris.
  const ecartes_ktx2 = ANIMATIONS ? 0 : liables.filter((r) => r.ktx2).length;

  // ⚠ CHEMINS ABSOLUS, toujours. Le consommateur du manifeste est un commandlet
  // Unreal, dont le répertoire courant est celui du moteur — pas la racine du
  // dépôt. Écrire les chemins tels qu'ils ont été passés en argument (souvent
  // relatifs) donnait 584 imports en échec sans un message exploitable : chaque
  // fichier était simplement introuvable.
  const importables = liables
    .filter((r) => ANIMATIONS || !r.ktx2)
    .map((r) => ({ fichier: path.resolve(r.fichier).replace(/\\/g, "/"), verdict: r.verdict, os: r.os }));

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(
    destination,
    JSON.stringify(
      {
        genere_le: new Date().toISOString(),
        reference: REFERENCE,
        os_reference: REF.size,
        // Absolue comme les fichiers : l'import calcule le dossier de
        // destination par `relpath(fichier, racine)`. Mélanger une racine
        // relative et des fichiers absolus produirait un chemin truffé de `..`.
        racine: path.resolve(cible).replace(/\\/g, "/"),
        total_analyses: Math.min(fichiers.length, LIMITE),
        importables: importables.length,
        ecartes_ktx2,
        fichiers: importables,
      },
      null,
      2,
    ),
  );
  console.log("");
  console.log(`manifeste écrit : ${destination} (${importables.length} fichiers)`);
  if (ANIMATIONS) {
    const gardes = liables.filter((r) => r.ktx2).length;
    if (gardes) {
      console.log(`  ${gardes} fichier(s) à textures KTX2 CONSERVÉ(S) (--animations) : une`);
      console.log("  animation n'a pas de texture, seulement des pistes d'os.");
    }
  }
  if (ecartes_ktx2) {
    console.log(`  ${ecartes_ktx2} écarté(s) : textures KTX2, illisibles par Unreal — utiliser la variante _original`);
  }
}