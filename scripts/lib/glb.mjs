// ══════════════════════════════════════════════════════════════════════════════
// lib/glb.mjs — lecture et écriture de GLB binaires, sans dépendance.
//
// Extrait de `narvos-morphs-vers-glb.mjs`, qui portait ces fonctions en propre.
// Deux scripts les emploient désormais ; une troisième copie aurait garanti que
// l'un des trois garde un défaut corrigé chez les autres.
//
// ── LES DEUX PIÈGES QUE CES FONCTIONS ABSORBENT ──────────────────────────────
//
// 1. `"BIN\0".trim()` NE RETIRE PAS LE `\0` — `trim` ne s'occupe que des
//    espaces. Un test `type === "BIN"` échoue donc, le chunk binaire reste vide,
//    et la première lecture d'accessor sort des bornes avec un message qui ne
//    désigne pas la cause. Une heure perdue le 2026-09-04.
//
// 2. Les attributs peuvent être ENTRELACÉS (`byteStride`). `base_skinned.glb`
//    les met tous dans une bufferView de stride 48. Une lecture qui l'ignore
//    ramène les octets des attributs voisins — sans erreur. Et une vue typée
//    exige un offset aligné, ce qu'un `Buffer` Node découpé dans son pool ne
//    garantit pas : on lit par `DataView`, qui accepte n'importe quel
//    alignement.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

export const TYPES = {
  5120: Int8Array, 5121: Uint8Array, 5122: Int16Array,
  5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array,
};

export const COMPOSANTES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

/** Lit un GLB binaire. Rend `{ json, bin }`. */
export function lireGlb(fichier) {
  const buf = fs.readFileSync(fichier);
  if (buf.toString("utf8", 0, 4) !== "glTF") throw new Error("pas un GLB : " + fichier);

  let offset = 12;
  let json = null;
  let bin = null;

  while (offset < buf.length) {
    const taille = buf.readUInt32LE(offset);
    // Voir le piège 1 en tête de fichier : le `\0` fait partie du type.
    const type = buf.toString("utf8", offset + 4, offset + 8).replace(/\0+$/, "").trim();
    const debut = offset + 8;

    if (type === "JSON") json = JSON.parse(buf.toString("utf8", debut, debut + taille));
    else if (type === "BIN") bin = buf.subarray(debut, debut + taille);

    offset = debut + taille + ((4 - (taille % 4)) % 4);
  }

  if (!json) throw new Error("chunk JSON absent");
  if (!bin || bin.length === 0) {
    throw new Error(`chunk BIN absent ou vide dans ${path.basename(fichier)}`);
  }
  return { json, bin };
}

/** Écrit un GLB depuis `{ json, bin }`. Rend la taille produite. */
export function ecrireGlb(fichier, json, bin) {
  const texte = Buffer.from(JSON.stringify(json), "utf8");
  const bourrageJson = (4 - (texte.length % 4)) % 4;
  const bourrageBin = (4 - (bin.length % 4)) % 4;

  // Le bourrage du chunk JSON se fait avec des ESPACES et celui du binaire avec
  // des zéros : la spec l'exige, et un lecteur strict refuse le fichier sinon.
  const chunkJson = Buffer.concat([texte, Buffer.alloc(bourrageJson, 0x20)]);
  const chunkBin = Buffer.concat([bin, Buffer.alloc(bourrageBin, 0)]);

  const total = 12 + 8 + chunkJson.length + 8 + chunkBin.length;
  const out = Buffer.alloc(total);

  out.write("glTF", 0, "utf8");
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);

  out.writeUInt32LE(chunkJson.length, 12);
  out.write("JSON", 16, "utf8");
  chunkJson.copy(out, 20);

  const posBin = 20 + chunkJson.length;
  out.writeUInt32LE(chunkBin.length, posBin);
  out.write("BIN\0", posBin + 4, "utf8");
  chunkBin.copy(out, posBin + 8);

  fs.writeFileSync(fichier, out);
  return total;
}

/** Lit un accessor en tableau typé, entrelacé ou non. Voir le piège 2. */
export function lireAccessor(json, bin, index) {
  const a = json.accessors[index];
  const Type = TYPES[a.componentType];
  if (!Type) throw new Error("componentType inconnu : " + a.componentType);

  const composantes = COMPOSANTES[a.type];
  const taille = Type.BYTES_PER_ELEMENT;
  const out = new Type(a.count * composantes);

  // Un accessor sans bufferView est légal : il vaut zéro partout. Le lire dans
  // le buffer donnerait des octets pris ailleurs.
  if (a.bufferView === undefined) return out;

  const vue = json.bufferViews[a.bufferView];
  const stride = vue.byteStride ?? taille * composantes;
  const debut = (vue.byteOffset ?? 0) + (a.byteOffset ?? 0);

  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const lire = {
    5120: (o) => dv.getInt8(o),
    5121: (o) => dv.getUint8(o),
    5122: (o) => dv.getInt16(o, true),
    5123: (o) => dv.getUint16(o, true),
    5125: (o) => dv.getUint32(o, true),
    5126: (o) => dv.getFloat32(o, true),
  }[a.componentType];

  for (let i = 0; i < a.count; i++) {
    for (let c = 0; c < composantes; c++) {
      out[i * composantes + c] = lire(debut + i * stride + c * taille);
    }
  }
  return out;
}

/** Accumulateur de buffer : ajoute des tableaux typés et rend leurs accessors. */
export function creerBuffer() {
  const morceaux = [];
  let offset = 0;

  return {
    /** Ajoute un tableau typé, rend l'index du bufferView créé. */
    ajouter(donnees, json) {
      const octets = Buffer.from(donnees.buffer, donnees.byteOffset, donnees.byteLength);

      // glTF exige que l'offset d'un accessor soit un multiple de la taille de
      // son composant. On aligne sur 4, qui couvre tous nos types.
      const bourrage = (4 - (offset % 4)) % 4;
      if (bourrage) {
        morceaux.push(Buffer.alloc(bourrage));
        offset += bourrage;
      }

      json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: octets.length });
      morceaux.push(octets);
      offset += octets.length;

      return json.bufferViews.length - 1;
    },

    resultat() {
      return Buffer.concat(morceaux);
    },
  };
}

/** Bornes d'un tableau de positions VEC3, pour `accessor.min` / `.max`.
 *
 *  ⚠ `Infinity` n'est pas du JSON valide et Interchange refuse le fichier. Un
 *  tableau vide rend donc des bornes NULLES plutôt que des infinis. */
export function bornesVec3(donnees) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (let i = 0; i < donnees.length; i += 3) {
    for (let c = 0; c < 3; c++) {
      const v = donnees[i + c];
      if (v < min[c]) min[c] = v;
      if (v > max[c]) max[c] = v;
    }
  }

  if (donnees.length === 0 || !Number.isFinite(min[0])) {
    return { min: [0, 0, 0], max: [0, 0, 0] };
  }
  return { min, max };
}