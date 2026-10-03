// ══════════════════════════════════════════════════════════════════════════════
// Vérification sur les VRAIS fichiers produits par le pipeline MPFB.
//
// `morphSet.test.ts` teste le contrat de format sur des données fabriquées.
// Ce fichier-ci teste l'autre moitié : que ce que les scripts écrivent
// réellement est lisible. C'est cette vérification qui a trouvé le bug
// d'alignement d'en-tête que les données synthétiques masquaient.
//
// Les tests se SAUTENT si le pipeline n'a pas encore tourné : les 46 Mo de
// morphs ne sont pas versionnés, et une machine fraîche ne doit pas voir une
// suite rouge pour autant.
//
//   node scripts/mpfb-base-to-glb.mjs "<…>/data/3dobjs/base.obj"
//   node scripts/mpfb-targets-to-bin.mjs "<…>/data/targets"
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseMorphSet, assertCompatible, MAKEHUMAN_TO_METERS } from "./morphSet";

const RACINE = path.resolve(__dirname, "../../../../public/models/personnages/_body");
const INDEX = path.join(RACINE, "morphs", "index.json");
const present = fs.existsSync(INDEX);

/** Charge un `.morphs` en `ArrayBuffer` — `Buffer` est une VUE, pas un buffer. */
function lire(fichier: string): ArrayBuffer {
  const b = fs.readFileSync(fichier);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

describe.skipIf(!present)("pipeline MPFB — fichiers réels", () => {
  const index = present
    ? JSON.parse(fs.readFileSync(INDEX, "utf8")) as {
        canonicalVertexCount: number;
        regions: Array<{ region: string; morphs: number; bytes: number }>;
      }
    : { canonicalVertexCount: 0, regions: [] };

  it("l'index déclare l'espace canonique MakeHuman", () => {
    expect(index.canonicalVertexCount).toBe(19158);
    expect(index.regions.length).toBeGreaterThan(20);
  });

  it("CHAQUE région se relit, et sur le même espace canonique", () => {
    // Le contrôle qui compte vraiment : un en-tête illisible ou un espace
    // divergent rendrait le corps difforme au runtime, sans erreur.
    for (const r of index.regions) {
      const set = parseMorphSet(lire(path.join(RACINE, "morphs", `${r.region}.morphs`)));
      expect(set.region, `région ${r.region}`).toBe(r.region);
      expect(set.morphs.size, `région ${r.region}`).toBe(r.morphs);
      expect(() => assertCompatible(set, index.canonicalVertexCount)).not.toThrow();
    }
  });

  it("aucun indice ne sort de l'espace canonique", () => {
    // Un indice hors bornes écrit dans la mémoire d'un sommet voisin. Le script
    // les écarte déjà à la génération ; on vérifie ici que rien n'est passé.
    for (const r of index.regions) {
      const set = parseMorphSet(lire(path.join(RACINE, "morphs", `${r.region}.morphs`)));
      for (const m of set.morphs.values()) {
        let max = 0;
        for (const i of m.indices) if (i > max) max = i;
        expect(max, `${r.region}/${m.name}`).toBeLessThan(index.canonicalVertexCount);
      }
    }
  });

  it("les déplacements restent d'une amplitude humaine", () => {
    // Garde-fou anti-quantification foireuse : un `scale` mal calculé
    // produirait des déplacements de plusieurs mètres. On borne à 50 cm, ce qui
    // laisse la place aux morphs de taille les plus amples.
    const set = parseMorphSet(lire(path.join(RACINE, "morphs", "legs.morphs")));
    for (const m of set.morphs.values()) {
      let maxD = 0;
      for (let k = 0; k < m.count; k++) {
        const d = Math.hypot(m.deltas[k * 3], m.deltas[k * 3 + 1], m.deltas[k * 3 + 2]) * m.scale;
        if (d > maxD) maxD = d;
      }
      const cm = maxD * MAKEHUMAN_TO_METERS * 100;
      expect(cm, `${m.name} déplace de ${cm.toFixed(1)} cm`).toBeLessThan(50);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Le corps RIGGÉ — `scripts/mpfb-skin-base.mjs`
//
// Contrôles sur le binaire réel : le GLB déclare-t-il ce qu'il faut pour que le
// runtime puisse à la fois le morpher et l'animer ? Un fichier auquel il
// manquerait `_MORPH_INDEX` ou son squelette ne lèverait rien — le corps
// resterait figé, ou inanimé, sans explication.
// ══════════════════════════════════════════════════════════════════════════════

const SKINNED = path.join(RACINE, "base_skinned.glb");
const riggé = fs.existsSync(SKINNED);

describe.skipIf(!riggé)("corps riggé — base_skinned.glb", () => {
  /** Lit les `extras` de la racine sans dépendre d'un chargeur glTF complet. */
  function extras(): Record<string, unknown> {
    const b = fs.readFileSync(SKINNED);
    // En-tête GLB : magic(4) version(4) length(4), puis chunk JSON len(4) type(4).
    const jsonLen = b.readUInt32LE(12);
    const json = JSON.parse(b.subarray(20, 20 + jsonLen).toString("utf8"));
    return (json.extras ?? {}) as Record<string, unknown>;
  }

  it("est en MÈTRES et annonce le facteur des morphs", () => {
    // Le piège d'unités du portage : squelette Mixamo en mètres, deltas
    // MakeHuman en décimètres. Le fichier porte le facteur pour que le runtime
    // ne l'invente pas.
    const e = extras();
    expect(e.units).toBe("meters");
    expect(e.morphUnitScale).toBeCloseTo(MAKEHUMAN_TO_METERS, 6);
  });

  it("conserve l'espace canonique des morphs", () => {
    expect(extras().canonicalVertexCount).toBe(19158);
  });

  it("porte un rig aux noms d'os que nos animations pilotent", () => {
    // ⚠ CE TEST EXIGEAIT « 52 os » (Mixamo), au motif que les clips affichaient
    // « tracks=52 ». MESURÉ le 2026-08-10 par `scripts/audit-anim-bones.mjs` sur
    // les 668 GLB de `public/models/animations` : 186 os animés, AUCUN préfixe,
    // noms UNREAL. Confrontation aux rigs MPFB :
    //     rig.game_engine → 52 de ses 53 os communs
    //     rig.mixamo      → 0 os commun
    // La prémisse était donc fausse, et un corps riggé en Mixamo aurait été
    // INANIMABLE par toute la bibliothèque — sans erreur, three liant les
    // pistes aux nœuds par leur NOM.
    //
    // Ce qui compte n'est pas un COMPTE d'os mais leur NOMMAGE. On vérifie donc
    // la chaîne centrale, animée par 643 fichiers sur 668.
    expect(extras().rig).toBe("manny89");
    // Trace de la source : le rig d'auteur avant complétion structurelle.
    expect(extras().rigSource).toBe("game_engine");
  });

  it("nomme les os selon la convention des clips (UE), pas Mixamo", () => {
    // Même lecture d'en-tête que `extras()` : pas de chargeur glTF ici non plus.
    const b = fs.readFileSync(SKINNED);
    const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString("utf8"));
    const joints: string[] = (json.skins?.[0]?.joints ?? [])
      .map((i: number) => json.nodes?.[i]?.name)
      .filter(Boolean);

    expect(joints.length).toBeGreaterThan(0);
    for (const os of ["pelvis", "spine_01", "head", "upperarm_l", "hand_l", "thigh_l", "foot_l"]) {
      expect(joints, `os « ${os} » attendu`).toContain(os);
    }
    // Un seul nom préfixé `mixamorig:` et plus aucun clip ne s'applique.
    expect(joints.filter((n) => n.startsWith("mixamorig:"))).toEqual([]);
  });
});
