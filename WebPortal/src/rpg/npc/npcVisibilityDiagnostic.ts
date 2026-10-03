// ══════════════════════════════════════════════════════════════════════════════
// npc/npcVisibilityDiagnostic.ts — « pourquoi ce monstre est-il invisible ? »
//
// Un PNJ peut ATTAQUER sans être VISIBLE : la logique de combat vit dans
// `npcRegistry` (enregistré au montage du composant), le mesh dans la scène
// Three. Les deux se désynchronisent silencieusement, et rien ne le signale.
//
// Ce diagnostic croise les deux et nomme la cause pour chaque PNJ placé. Il
// existe parce que les causes possibles se ressemblent toutes à l'écran :
//
//   pas monté      → l'étalement du montage (npcStagedCount) n'a pas atteint ce PNJ
//   échelle nulle  → `scaleMult` à 0 dans le placement → mesh de taille zéro
//   sous le sol    → placement fait sur une AUTRE version de la map (cf. l'offset
//                    recalculé de la Forge) → le mesh est là, mais enterré
//   hors du sol    → aucun terrain sous ses pieds → il tombe
//   invisible      → `.visible = false` posé par le LOD ou une bascule
//
// Usage en jeu, dans la console du navigateur :
//     __narvosNpcDiag()
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import { npcRegistry } from "./npcRegistry";
import { npcPlacementStore } from "./npcPlacementStore";
import { collisionWorld } from "../runtime/CollisionWorld";

export interface NpcDiagRow {
  id: string;
  folder: string;
  /** Position telle que STOCKÉE dans le placement. */
  posPlacement: [number, number, number];
  /** Position réelle du groupe dans la scène, si on l'y trouve. */
  posScene: [number, number, number] | null;
  scaleMult: number;
  /** Échelle effective du mesh (produit de tous les facteurs). */
  echelleMesh: number | null;
  dansRegistre: boolean;
  dansScene: boolean;
  visible: boolean | null;
  /** Hauteur du sol sous le placement — `null` s'il n'y a rien. */
  solY: number | null;
  verdict: string;
}

export function diagnoseNpcVisibility(mapId: string): {
  resume: string;
  lignes: NpcDiagRow[];
} {
  const places = npcPlacementStore.list(mapId);
  const racine = collisionWorld.sceneRoot();

  // Index des groupes de PNJ présents dans la scène, par id.
  const parId = new Map<string, THREE.Object3D>();
  racine?.traverse((o) => {
    const id = (o.userData as { npcId?: string } | undefined)?.npcId;
    if (id) parId.set(id, o);
  });

  const lignes: NpcDiagRow[] = places.map((p) => {
    const obj = parId.get(p.id) ?? null;
    const dansRegistre = !!npcRegistry.get?.(p.id);
    // Signature réelle : (x, z, hauteurDeDépart) — surtout pas (x, y, z).
    const solY = collisionWorld.getGroundY(p.pos[0], p.pos[2], p.pos[1] + 50);

    let echelle: number | null = null;
    let visible: boolean | null = null;
    let posScene: [number, number, number] | null = null;
    if (obj) {
      obj.updateWorldMatrix(true, false);
      const s = new THREE.Vector3();
      obj.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
      echelle = Math.min(s.x, s.y, s.z);
      visible = obj.visible;
      posScene = [obj.position.x, obj.position.y, obj.position.z];
    }

    // Ordre des verdicts : du plus déterminant au plus subtil. Le premier qui
    // s'applique est LA raison — inutile de lister les suivantes.
    let verdict: string;
    if (!obj && !dansRegistre) verdict = "PAS MONTÉ — l'étalement du montage ne l'a pas atteint";
    else if (!obj && dansRegistre) verdict = "REGISTRE SANS MESH — le composant vit, son modèle n'est pas dans la scène";
    else if (echelle !== null && echelle < 0.01) verdict = `ÉCHELLE NULLE (${echelle?.toFixed(4)}) — scaleMult=${p.scaleMult}`;
    else if (visible === false) verdict = "MASQUÉ — .visible = false (LOD ou bascule)";
    else if (solY === null) verdict = "SANS SOL — aucun terrain sous ses pieds à cette position";
    else if (posScene && posScene[1] < solY - 2) verdict = `ENTERRÉ — mesh à y=${posScene[1].toFixed(1)}, sol à y=${solY.toFixed(1)}`;
    else verdict = "OK — devrait être visible";

    return {
      id: p.id, folder: p.folder,
      posPlacement: p.pos,
      posScene,
      scaleMult: p.scaleMult,
      echelleMesh: echelle,
      dansRegistre, dansScene: !!obj, visible, solY,
      verdict,
    };
  });

  const parVerdict = new Map<string, number>();
  for (const l of lignes) {
    const cle = l.verdict.split(" —")[0];
    parVerdict.set(cle, (parVerdict.get(cle) ?? 0) + 1);
  }
  const resume = places.length === 0
    ? `Aucun PNJ placé sur « ${mapId} » — rien à afficher, c'est le placement qui manque.`
    : [...parVerdict].map(([k, n]) => `${n}× ${k}`).join(" · ");

  return { resume, lignes };
}

/**
 * Expose `__narvosNpcDiag()` dans la console.
 *
 * Passe par `window` plutôt que par un panneau : le diagnostic sert quand
 * l'affichage est justement ce qui ne marche pas, et une ligne de console reste
 * lisible même si la scène est vide.
 */
export function installNpcDiagnostic(getMapId: () => string): () => void {
  if (typeof window === "undefined") return () => {};
  const w = window as unknown as Record<string, unknown>;
  w.__narvosNpcDiag = () => {
    const r = diagnoseNpcVisibility(getMapId());
    console.info(`[NpcDiag] ${r.resume}`);
    if (r.lignes.length) console.table(r.lignes.map((l) => ({
      id: l.id.slice(0, 14), folder: l.folder,
      "placé (x,y,z)": l.posPlacement.map((v) => Math.round(v)).join(","),
      "scène (x,y,z)": l.posScene ? l.posScene.map((v) => Math.round(v)).join(",") : "—",
      échelle: l.echelleMesh?.toFixed(3) ?? "—",
      sol: l.solY?.toFixed(1) ?? "AUCUN",
      verdict: l.verdict,
    })));
    return r;
  };
  return () => { delete w.__narvosNpcDiag; };
}
