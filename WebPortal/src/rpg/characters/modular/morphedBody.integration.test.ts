// Reproduit HORS React la chaîne exacte de `MorphedBody`, sur les vrais
// fichiers, pour attraper les NaN que le navigateur ne signale qu'en aval :
//
//   THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values.
//
// Three ne dit ni QUELLE surface ni À QUELLE étape. Ici, si, et sans GPU.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import {
  parseMorphSet, applyMorphs, scatterToRender, gatherFromRender,
  MAKEHUMAN_TO_METERS, type MorphSet,
} from "./morphSet";
import { CANONICAL_VERTEX_COUNT } from "./morphLoader";
import { macroWeights } from "./macroWeights";
import { selectionToMacro } from "./selectionToMacro";

const RACINE = path.resolve(__dirname, "../../../../public/models/personnages/_body");
const GLB = path.join(RACINE, "base_skinned.glb");

interface SurfaceReelle {
  nom: string;
  positions: Float32Array;
  morphIndex: Uint32Array;
}

async function lireSurfaces(): Promise<SurfaceReelle[]> {
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "draco3d.decoder": await draco3d.createDecoderModule() });
  const doc = await io.read(GLB);
  return doc.getRoot().listMeshes()[0].listPrimitives().map((p) => ({
    nom: p.getMaterial()?.getName() ?? "?",
    positions: Float32Array.from(p.getAttribute("POSITION")!.getArray()!),
    morphIndex: Uint32Array.from(p.getAttribute("_MORPH_INDEX")!.getArray()!),
  }));
}

const compteNaN = (a: ArrayLike<number>) => {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) n++;
  return n;
};

describe("MorphedBody — chaîne complète sur les vrais fichiers", () => {
  it("le GLB lui-même est sain", async () => {
    const surfaces = await lireSurfaces();
    expect(surfaces.map((s) => s.nom)).toEqual(["skin", "Eyes"]);
    for (const s of surfaces) {
      expect(compteNaN(s.positions), `positions ${s.nom}`).toBe(0);
      // Un indice hors de l'espace canonique ferait lire `undefined` dans
      // `scatterToRender` — et `undefined` écrit dans un Float32Array vaut NaN.
      const max = Math.max(...s.morphIndex);
      expect(max, `morphIndex max ${s.nom}`).toBeLessThan(CANONICAL_VERTEX_COUNT);
    }
  });

  it("les poids issus du créateur ne contiennent aucun NaN", () => {
    const poids = macroWeights(selectionToMacro({
      gender: "male", build: "athletic", archetype: "human",
    }));
    const valeurs = Object.values(poids);
    expect(valeurs.length).toBeGreaterThan(0);
    expect(compteNaN(valeurs)).toBe(0);
  });

  it("le pack macrodetails se lit sans NaN et reste dans l'espace canonique", () => {
    const set = parseMorphSet(
      fs.readFileSync(path.join(RACINE, "morphs/macrodetails.morphs")).buffer as ArrayBuffer,
    );
    // Un `expect` PAR INDICE coûtait 46 s sur ce pack : des millions d'appels
    // pour une seule information. On balaie, on garde le premier fautif, et on
    // n'assertit qu'une fois — le message porte quand même le coupable exact.
    const fautifs: string[] = [];
    for (const [nom, m] of set.morphs) {
      if (compteNaN(m.deltas) > 0) fautifs.push(`${nom}: deltas NaN`);
      if (!Number.isFinite(m.scale)) fautifs.push(`${nom}: scale ${m.scale}`);
      for (let k = 0; k < m.count; k++) {
        if (m.indices[k] >= CANONICAL_VERTEX_COUNT) {
          fautifs.push(`${nom}: indice ${m.indices[k]} ≥ ${CANONICAL_VERTEX_COUNT} (rang ${k})`);
          break;
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it("AUCUNE combinaison du créateur ne produit de NaN", async () => {
    // Le premier jet ne testait que male/athletic — et le NaN est apparu en
    // female/maigre. Une seule combinaison ne prouve rien : on les balaie TOUTES
    // (2 genres × 4 morphologies × 4 archétypes).
    const surfaces = await lireSurfaces();
    const sets: MorphSet[] = [parseMorphSet(
      fs.readFileSync(path.join(RACINE, "morphs/macrodetails.morphs")).buffer as ArrayBuffer,
    )];

    const canonBase = new Float32Array(CANONICAL_VERTEX_COUNT * 3);
    surfaces.forEach((s, i) => {
      gatherFromRender(Float32Array.from(s.positions), s.morphIndex, canonBase, i === 0);
    });

    const canonOut = new Float32Array(CANONICAL_VERTEX_COUNT * 3);
    const fautifs: string[] = [];

    for (const gender of ["male", "female"] as const) {
      for (const build of ["slim", "athletic", "muscular", "heavy"] as const) {
        for (const archetype of ["human", "alien", "synthetic", "mutant"] as const) {
          const poids = macroWeights(selectionToMacro({ gender, build, archetype }));
          applyMorphs(canonBase, canonOut, sets, poids, MAKEHUMAN_TO_METERS);
          const n = compteNaN(canonOut);
          if (n > 0) {
            let premier = -1;
            for (let i = 0; i < canonOut.length && premier < 0; i++) {
              if (!Number.isFinite(canonOut[i])) premier = i;
            }
            fautifs.push(
              `${gender}/${build}/${archetype} → ${n} non finis, 1er au sommet ` +
              `${Math.floor(premier / 3)}`,
            );
          }
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it("la passe complète ne produit AUCUN NaN sur aucune surface", async () => {
    const surfaces = await lireSurfaces();
    const sets: MorphSet[] = [
      parseMorphSet(
        fs.readFileSync(path.join(RACINE, "morphs/macrodetails.morphs")).buffer as ArrayBuffer,
      ),
    ];

    // ── Exactement ce que fait `travail` : un canonBase pour toutes les surfaces,
    //    remise à zéro sur la PREMIÈRE seulement.
    const canonBase = new Float32Array(CANONICAL_VERTEX_COUNT * 3);
    surfaces.forEach((s, i) => {
      gatherFromRender(Float32Array.from(s.positions), s.morphIndex, canonBase, i === 0);
    });
    expect(compteNaN(canonBase), "canonBase").toBe(0);

    const canonOut = new Float32Array(CANONICAL_VERTEX_COUNT * 3);
    const poids = macroWeights(selectionToMacro({
      gender: "male", build: "athletic", archetype: "human",
    }));
    applyMorphs(canonBase, canonOut, sets, poids, MAKEHUMAN_TO_METERS);
    expect(compteNaN(canonOut), "canonOut").toBe(0);

    for (const s of surfaces) {
      const rendu = new Float32Array(s.positions.length);
      scatterToRender(canonOut, s.morphIndex, rendu);
      expect(compteNaN(rendu), `rendu ${s.nom}`).toBe(0);
    }
  });
});
