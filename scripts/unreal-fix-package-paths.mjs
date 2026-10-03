// ══════════════════════════════════════════════════════════════════════════════
// unreal-fix-package-paths.mjs — Remet les packs de contenu au chemin que leurs
// assets déclarent, en s'appuyant sur l'inventaire d'unreal-audit-package-paths.
//
//   node scripts/unreal-fix-package-paths.mjs <inventaire.json> [--apply]
//
// POURQUOI : un `.uasset` porte son chemin de package en dur. Copié dans un
// sous-dossier, il se croit ailleurs et aucune de ses références ne résout. Le
// déplacer là où il se croit répare TOUTES ses références d'un coup, sans
// réécrire un seul octet.
//
// CE QU'IL FAIT : pour chaque pack dont l'audit a trouvé un préfixe en trop
// simple, il déplace le dossier de façon à supprimer ce préfixe.
//
// CE QU'IL NE FAIT PAS, ET POURQUOI :
//   · les packs « non trivial » — l'écart n'est pas un préfixe (renommage en
//     plus du déplacement) : un déplacement ne suffirait pas, et devinerait mal ;
//   · les packs dont une MINORITÉ d'assets est déjà au bon endroit — les
//     déplacer réparerait la majorité en cassant cette minorité. Ceux-là passent
//     par l'éditeur, qui sait réécrire une référence au lieu de bouger un fichier.
//
// ⚠ L'ÉDITEUR DOIT ÊTRE FERMÉ. Déplacer du contenu pendant qu'il tient le projet
// corrompt son registre d'assets.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const inventaire = process.argv[2];
const APPLY = process.argv.includes("--apply");

if (!inventaire || !fs.existsSync(inventaire)) {
  console.error("Usage : node scripts/unreal-fix-package-paths.mjs <inventaire.json> [--apply]");
  process.exit(1);
}

const { racine, resultats } = JSON.parse(fs.readFileSync(inventaire, "utf8"));

// Un pack dont moins de cette part d'assets sondés est cassée a été partiellement
// réimporté sur place : le déplacer ferait plus de mal que de bien.
const SEUIL_CONFIANCE = 0.9;

const plan = [];
const ecartes = [];

for (const r of resultats) {
  if (r.casses === 0) continue;

  if (!r.prefixeEnTrop || r.prefixeEnTrop === "(non trivial)") {
    ecartes.push({ ...r, raison: "écart non réductible à un préfixe (renommage ?)" });
    continue;
  }

  const part = r.casses / (r.casses + r.sains);
  if (part < SEUIL_CONFIANCE) {
    ecartes.push({
      ...r,
      raison: `seulement ${r.casses}/${r.casses + r.sains} sondés cassés — le reste est déjà au bon endroit`,
    });
    continue;
  }

  // `NARVOS\creatures` avec préfixe `NARVOS/creatures` : ce sont les ENFANTS du
  // dossier qui remontent, pas le dossier lui-même — sinon on recréerait le
  // segment qu'on veut supprimer.
  const packSeg = r.pack.split(/[\\/]/);
  const prefSeg = r.prefixeEnTrop.split("/");
  const source = path.join(racine, ...packSeg);
  const remonteEnfants = packSeg.length === prefSeg.length;

  plan.push({
    pack: r.pack,
    assets: r.fichiers,
    prefixe: r.prefixeEnTrop,
    source,
    // Ce qui reste du chemin une fois le préfixe retiré.
    destination: path.join(racine, ...packSeg.slice(prefSeg.length)),
    remonteEnfants,
  });
}

// ─── collisions ───────────────────────────────────────────────────────────────

/** Une destination déjà occupée n'est jamais écrasée : on signale et on saute. */
const collision = (dest) => fs.existsSync(dest);

const aDeplacer = [];
for (const p of plan) {
  if (p.remonteEnfants) {
    // Chaque enfant a sa propre destination : on teste une par une.
    const enfants = fs.existsSync(p.source)
      ? fs.readdirSync(p.source, { withFileTypes: true }).filter((e) => e.isDirectory())
      : [];
    const heurtes = enfants.filter((e) => collision(path.join(racine, e.name)));
    if (heurtes.length) {
      ecartes.push({
        pack: p.pack,
        fichiers: p.assets,
        raison: `collision sur ${heurtes.length} enfant(s) : ${heurtes.slice(0, 3).map((e) => e.name).join(", ")}`,
      });
      continue;
    }
    aDeplacer.push({ ...p, enfants: enfants.map((e) => e.name) });
  } else {
    if (collision(p.destination)) {
      ecartes.push({
        pack: p.pack,
        fichiers: p.assets,
        raison: `destination déjà occupée : ${path.relative(racine, p.destination)}`,
      });
      continue;
    }
    aDeplacer.push(p);
  }
}

// ─── sortie ───────────────────────────────────────────────────────────────────

console.log(APPLY ? "=== APPLIQUÉ ===" : "=== SIMULATION (ajouter --apply) ===");
console.log(`racine : ${racine}`);
console.log("");

const totalAssets = aDeplacer.reduce((s, p) => s + p.assets, 0);
console.log(`  ${aDeplacer.length} pack(s) à déplacer — ${totalAssets.toLocaleString("fr-FR")} assets`);
console.log(`  ${ecartes.length} pack(s) écarté(s)`);
console.log("");

for (const p of aDeplacer.sort((a, b) => b.assets - a.assets)) {
  const de = path.relative(racine, p.source).split(path.sep).join("/");
  const vers = p.remonteEnfants
    ? `(${p.enfants.length} enfants) -> /`
    : path.relative(racine, p.destination).split(path.sep).join("/") + "/";
  console.log(`  ${String(p.assets).padStart(5)}  ${de}  ->  ${vers}`);
}

if (ecartes.length) {
  console.log("");
  console.log("  ÉCARTÉS — à traiter dans l'éditeur :");
  for (const e of ecartes) {
    console.log(`    ${String(e.fichiers).padStart(5)}  ${e.pack}  —  ${e.raison}`);
  }
}

if (!APPLY) {
  console.log("");
  console.log("Rien déplacé. FERMER L'ÉDITEUR avant d'ajouter --apply.");
  process.exit(0);
}

// ─── application ──────────────────────────────────────────────────────────────

let deplaces = 0;
for (const p of aDeplacer) {
  try {
    if (p.remonteEnfants) {
      for (const enfant of p.enfants) {
        fs.renameSync(path.join(p.source, enfant), path.join(racine, enfant));
      }
      // Le dossier parent n'a plus lieu d'être s'il est vide.
      if (fs.readdirSync(p.source).length === 0) fs.rmdirSync(p.source);
    } else {
      fs.mkdirSync(path.dirname(p.destination), { recursive: true });
      fs.renameSync(p.source, p.destination);
    }
    deplaces++;
  } catch (err) {
    console.log(`  ÉCHEC  ${p.pack} — ${err.message}`);
  }
}

console.log("");
console.log(`${deplaces}/${aDeplacer.length} pack(s) déplacé(s).`);
console.log("Relancer l'audit pour confirmer, puis rouvrir l'éditeur.");