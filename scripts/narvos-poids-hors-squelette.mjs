// ══════════════════════════════════════════════════════════════════════════════
// narvos-poids-hors-squelette.mjs — quelle PART DU POIDS de peau repose sur des
// os absents du squelette cible ?
//
//   node scripts/narvos-poids-hors-squelette.mjs <cible.glb> <candidat.glb> [...]
//
// ── LA QUESTION, ET POURQUOI LE NOM D'OS NE Y RÉPOND PAS ──────────────────────
// `narvos-os-uasset.mjs` dit quels os un mesh NOMME. Un SkeletalMesh nomme tout
// son squelette, y compris les os qui ne le déforment pas : sur la garde-robe
// MetaHuman, 104 vêtements sur 106 « nomment » 255 os. Ça ne prouve rien.
//
// Ce qui décide d'un rebind, c'est le POIDS. Si 0 % du poids repose sur les os
// que la cible n'a pas, les retirer ne déplace aucun sommet — c'est le constat
// qui avait rendu sûr l'import du corps morphable (« 0 % du poids de peau repose
// sur les 21 os supplémentaires »). Si au contraire un haut est pondéré sur
// `spine_04`, le rebinder l'affaisse sur `spine_03`, en silence.
//
// ── PIÈGES DU FORMAT, TOUS DÉJÀ PAYÉS SUR CE PROJET ───────────────────────────
//   · `"BIN\0".trim()` ne retire PAS le `\0` — `trim` ne s'occupe que des
//     espaces. Le test `type === "BIN"` échoue, le chunk binaire reste vide, et
//     la première lecture d'accessor sort des bornes.
//   · Les attributs peuvent être ENTRELACÉS (byteStride) : lire sans le stride
//     ramène les octets des attributs voisins, sans erreur.
//   · `new Uint32Array(buffer, offset, n)` exige un offset aligné, ce qu'un
//     Buffer Node découpé dans son pool ne garantit pas — lire par `DataView`.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const TAILLE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const COMPOSANTES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function lireGlb(fichier) {
  const buf = fs.readFileSync(fichier);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error("pas un GLB");
  let pos = 12;
  let json = null;
  let bin = null;
  while (pos < buf.length) {
    const longueur = buf.readUInt32LE(pos);
    // ⚠ Le type est 4 octets bruts : « JSON » et « BIN\0 ». Comparer la chaîne
    // telle quelle, sans trim (cf. en-tête).
    const type = buf.toString("latin1", pos + 4, pos + 8);
    const debut = pos + 8;
    if (type === "JSON") json = JSON.parse(buf.toString("utf8", debut, debut + longueur));
    else if (type === "BIN\0") bin = buf.subarray(debut, debut + longueur);
    pos = debut + longueur;
  }
  return { json, bin };
}

function lireAccessor(gltf, bin, index) {
  const acc = gltf.accessors[index];
  const vue = gltf.bufferViews[acc.bufferView];
  const octetsParComposante = TAILLE[acc.componentType];
  const nbComposantes = COMPOSANTES[acc.type];
  const base = (vue.byteOffset || 0) + (acc.byteOffset || 0);
  const stride = vue.byteStride || octetsParComposante * nbComposantes;
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const sortie = [];
  for (let i = 0; i < acc.count; i++) {
    const ligne = [];
    for (let c = 0; c < nbComposantes; c++) {
      const o = base + i * stride + c * octetsParComposante;
      switch (acc.componentType) {
        case 5121: ligne.push(dv.getUint8(o)); break;
        case 5123: ligne.push(dv.getUint16(o, true)); break;
        case 5125: ligne.push(dv.getUint32(o, true)); break;
        case 5126: ligne.push(dv.getFloat32(o, true)); break;
        case 5122: ligne.push(dv.getInt16(o, true)); break;
        case 5120: ligne.push(dv.getInt8(o)); break;
        default: throw new Error("componentType " + acc.componentType);
      }
    }
    sortie.push(ligne);
  }
  return { valeurs: sortie, normalise: acc.normalized === true, type: acc.componentType };
}

function osDe(fichier) {
  const { json, bin } = lireGlb(fichier);
  const noms = new Set();
  for (const skin of json.skins || []) {
    for (const j of skin.joints) noms.add(json.nodes[j].name);
  }
  return { json, bin, noms };
}

const [cible, ...candidats] = process.argv.slice(2);
if (!cible) {
  console.error("usage : node scripts/narvos-poids-hors-squelette.mjs <cible.glb> <candidat.glb> [...]");
  process.exit(1);
}

const osCible = osDe(cible).noms;
console.log(`CIBLE  ${path.basename(cible)} — ${osCible.size} os`);

for (const c of candidats) {
  let json, bin;
  try { ({ json, bin } = lireGlb(c)); } catch (e) { console.log(`\n${path.basename(c)} : illisible (${e.message})`); continue; }

  const parOs = new Map();
  let total = 0;
  let sommets = 0;

  for (const maillage of json.meshes || []) {
    for (const prim of maillage.primitives) {
      if (prim.attributes.JOINTS_0 === undefined || prim.attributes.WEIGHTS_0 === undefined) continue;
      // Le skin est porté par le NŒUD, pas par le mesh : on prend le premier,
      // suffisant ici (un vêtement n'a qu'un skin).
      const skin = json.skins && json.skins[0];
      if (!skin) continue;
      const J = lireAccessor(json, bin, prim.attributes.JOINTS_0);
      const W = lireAccessor(json, bin, prim.attributes.WEIGHTS_0);
      sommets += J.valeurs.length;
      for (let i = 0; i < J.valeurs.length; i++) {
        for (let k = 0; k < 4; k++) {
          let poids = W.valeurs[i][k];
          // Les poids peuvent être normalisés en entier : 65535 = 1.0.
          if (W.type === 5123) poids /= 65535;
          else if (W.type === 5121) poids /= 255;
          if (!(poids > 0)) continue;
          const nomOs = json.nodes[skin.joints[J.valeurs[i][k]]].name;
          parOs.set(nomOs, (parOs.get(nomOs) || 0) + poids);
          total += poids;
        }
      }
    }
  }

  if (total === 0) { console.log(`\n${path.basename(c)} : aucun poids de peau trouvé`); continue; }

  const dehors = [...parOs.entries()].filter(([n]) => !osCible.has(n)).sort((a, b) => b[1] - a[1]);
  const poidsDehors = dehors.reduce((s, [, p]) => s + p, 0);
  const pct = (poidsDehors / total) * 100;

  console.log(`\n${path.basename(c)} — ${sommets} sommets, ${parOs.size} os pondérés`);
  console.log(`  POIDS HORS CIBLE : ${pct.toFixed(3)} %  (${dehors.length} os)`);
  for (const [n, p] of dehors.slice(0, 10)) {
    console.log(`    ${((p / total) * 100).toFixed(3).padStart(7)} %  ${n}`);
  }
  if (pct === 0) console.log("  → REBIND SANS PERTE : aucun sommet ne bouge.");
  else if (pct < 0.5) console.log("  → perte négligeable, à confirmer à l'œil sur la pièce.");
  else console.log(`  → REBIND DESTRUCTIF : ${pct.toFixed(1)} % du poids serait perdu ou reporté.`);
}