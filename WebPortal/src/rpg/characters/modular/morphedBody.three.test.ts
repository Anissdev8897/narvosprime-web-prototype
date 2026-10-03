// Rejoue le chemin EXACT du navigateur, en Node.
//
// `morphedBody.integration.test.ts` lit le GLB avec gltf-transform et ne trouve
// aucun NaN — mais le navigateur en signale au sommet canonique 0. La différence
// ne peut donc venir que de ce que TROIS nous rend, pas du calcul.
//
// Ici on utilise le VRAI `GLTFLoader` et le VRAI `SkeletonUtils.clone`, les
// mêmes que `MorphedBody`. Le GLB ne porte aucune texture, donc le chargeur n'a
// besoin d'aucun DOM.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { GLTFLoader, SkeletonUtils } from "three-stdlib";
import {
  parseMorphSet, applyMorphs, scatterToRender, gatherFromRender,
  MAKEHUMAN_TO_METERS, type MorphSet,
} from "./morphSet";
import { CANONICAL_VERTEX_COUNT } from "./morphLoader";
import { macroWeights } from "./macroWeights";
import { selectionToMacro } from "./selectionToMacro";

const RACINE = path.resolve(__dirname, "../../../../public/models/personnages/_body");

function chargerScene(): Promise<THREE.Group> {
  const buf = fs.readFileSync(path.join(RACINE, "base_skinned.glb"));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(ab, "", (g) => resolve(g.scene as THREE.Group), reject);
  });
}

const nonFini = (a: ArrayLike<number>) => {
  for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) return i;
  return -1;
};

/** Le renvoi canonique, lu comme le fait `MorphedBody`. */
function litMorphIndex(geo: THREE.BufferGeometry): Uint32Array | null {
  const attr = (geo.getAttribute("_morph_index") ?? geo.getAttribute("_MORPH_INDEX")) as
    THREE.BufferAttribute | undefined;
  if (!attr) return null;
  const out = new Uint32Array(attr.count);
  for (let i = 0; i < attr.count; i++) out[i] = attr.getX(i);
  return out;
}

/** L'ancienne lecture, conservée pour PROUVER qu'elle casse. */
function litMorphIndexNaif(geo: THREE.BufferGeometry): Uint32Array | null {
  const attr = (geo.getAttribute("_morph_index") ?? geo.getAttribute("_MORPH_INDEX")) as
    THREE.BufferAttribute | undefined;
  if (!attr) return null;
  const a = attr.array;
  return a instanceof Uint32Array ? a : Uint32Array.from(a as ArrayLike<number>);
}

describe("MorphedBody — chemin three.js réel", () => {
  it("three rend des attributs sains, non entrelacés, de la bonne longueur", async () => {
    const racine = SkeletonUtils.clone(await chargerScene()) as THREE.Object3D;

    const releve: Record<string, unknown>[] = [];
    racine.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.geometry) return;
      const geo = m.geometry as THREE.BufferGeometry;
      const mi = litMorphIndex(geo);
      if (!mi) return;
      const pos = geo.getAttribute("position") as THREE.BufferAttribute;
      releve.push({
        materiau: (m.material as THREE.Material)?.name,
        sommets: pos.count,
        longueur: (pos.array as ArrayLike<number>).length,
        type: (pos.array as object).constructor.name,
        entrelacee: !!(pos as { isInterleavedBufferAttribute?: boolean }).isInterleavedBufferAttribute,
        morphIndex: mi.length,
        maxIndex: mi.reduce((a, b) => (b > a ? b : a), 0),
        nanPos: nonFini(pos.array as ArrayLike<number>),
      });
    });

    expect(releve.length, "aucune surface morphable trouvée").toBeGreaterThan(0);

    for (const s of releve) {
      expect(s.morphIndex, `${s.materiau} morphIndex`).toBe(s.sommets);
      expect(s.maxIndex, `${s.materiau} indice max`).toBeLessThan(CANONICAL_VERTEX_COUNT);
    }

    // ⚠ LE FAIT QUI A CAUSÉ LE BUG, consigné pour qu'on ne l'oublie pas.
    // three ENTRELACE : `pos.array` désigne alors le tampon partagé par
    // positions, normales et UV — sa longueur n'est PAS `count * 3`. Le lire
    // comme un tableau compact donne des valeurs mélangées puis des lectures
    // hors bornes, donc du NaN. gltf-transform, lui, rend des accesseurs
    // séparés : le même fichier passait en test et échouait dans le navigateur.
    const entrelacees = releve.filter((s) => s.entrelacee);
    if (entrelacees.length) {
      for (const s of entrelacees) {
        expect(s.longueur, `${s.materiau} : tampon partagé, pas count*3`)
          .not.toBe((s.sommets as number) * 3);
      }
    }
  });

  it("la passe complète ne produit aucun NaN — chargeur three compris", async () => {
    const racine = SkeletonUtils.clone(await chargerScene()) as THREE.Object3D;

    const surfaces: { nom: string; pos: THREE.BufferAttribute; mi: Uint32Array }[] = [];
    racine.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.geometry) return;
      const geo = m.geometry as THREE.BufferGeometry;
      const mi = litMorphIndex(geo);
      if (!mi) return;
      surfaces.push({
        nom: (m.material as THREE.Material)?.name ?? "?",
        pos: geo.getAttribute("position") as THREE.BufferAttribute,
        mi,
      });
    });

    // Aplatissement par `getX/getY/getZ` — la SEULE lecture correcte, qu'il y
    // ait entrelacement ou non. C'est ce que fait `versPlat` dans MorphedBody.
    const plat = (p: THREE.BufferAttribute) => {
      const out = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        out[i * 3] = p.getX(i); out[i * 3 + 1] = p.getY(i); out[i * 3 + 2] = p.getZ(i);
      }
      return out;
    };

    const canonBase = new Float32Array(CANONICAL_VERTEX_COUNT * 3);
    surfaces.forEach((s, i) => {
      gatherFromRender(plat(s.pos), s.mi, canonBase, i === 0);
    });
    expect(nonFini(canonBase), "canonBase").toBe(-1);

    // LA PREUVE DU BUG, figée : la lecture naïve de `_morph_index` renvoie le
    // tampon ENTIER (174 204 au lieu de 14 517) parce qu'il se trouve être un
    // Uint32Array. Rejouer la passe avec elle doit produire du NaN.
    const racine2 = SkeletonUtils.clone(await chargerScene()) as THREE.Object3D;
    const naif: { pos: THREE.BufferAttribute; mi: Uint32Array }[] = [];
    racine2.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.geometry) return;
      const mi = litMorphIndexNaif(m.geometry as THREE.BufferGeometry);
      if (!mi) return;
      naif.push({ pos: (m.geometry as THREE.BufferGeometry).getAttribute("position") as THREE.BufferAttribute, mi });
    });

    const trop = naif.find((s) => s.mi.length !== s.pos.count);
    if (trop) {
      expect(trop.mi.length, "le tampon partagé déborde du compte de sommets")
        .toBeGreaterThan(trop.pos.count);

      const brut = new Float32Array(CANONICAL_VERTEX_COUNT * 3);
      naif.forEach((s, i) => gatherFromRender(plat(s.pos), s.mi, brut, i === 0));
      expect(nonFini(brut), "la lecture naïve DOIT produire du NaN").not.toBe(-1);
    }

    const sets: MorphSet[] = [parseMorphSet(
      fs.readFileSync(path.join(RACINE, "morphs/macrodetails.morphs")).buffer as ArrayBuffer,
    )];
    const canonOut = new Float32Array(CANONICAL_VERTEX_COUNT * 3);

    for (const gender of ["male", "female"] as const) {
      for (const build of ["slim", "athletic", "muscular", "heavy"] as const) {
        const poids = macroWeights(selectionToMacro({ gender, build, archetype: "human" }));
        applyMorphs(canonBase, canonOut, sets, poids, MAKEHUMAN_TO_METERS);
        expect(nonFini(canonOut), `canonOut ${gender}/${build}`).toBe(-1);

        for (const s of surfaces) {
          const rendu = new Float32Array(s.pos.count * 3);
          scatterToRender(canonOut, s.mi, rendu);
          expect(nonFini(rendu), `rendu ${s.nom} ${gender}/${build}`).toBe(-1);
        }
      }
    }
  });
});
