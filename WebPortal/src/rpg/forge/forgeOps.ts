// forge/forgeOps.ts — Diff et application d'OPÉRATIONS de scène. Logique PURE.
//
// POURQUOI
//
// Forge Live diffusait un SNAPSHOT COMPLET de la scène à chaque modification, et
// le récepteur l'appliquait tel quel. Sémantique « dernier enregistrement gagne » :
// si deux personnes déplacent deux objets DIFFÉRENTS dans la même seconde, le
// snapshot le plus récent écrase l'autre. Le travail du premier disparaît sans
// message, sans conflit visible — il n'a simplement jamais existé pour l'autre.
//
// Ici on calcule ce qui a CHANGÉ, et on ne diffuse que ça. Deux modifications sur
// des objets distincts deviennent deux opérations disjointes : elles fusionnent
// au lieu de s'écraser. Le dernier écrivain ne gagne plus que sur l'objet qu'il
// a réellement touché.
//
// Ce fichier ne connaît ni le réseau, ni React, ni le store : il transforme des
// données en données. C'est ce qui le rend testable — et la règle d'arbitrage
// d'une co-édition est exactement ce qu'on veut pouvoir tester.

import type { ForgeObject, ForgePath, ForgeWater, SceneSnapshot } from "./forgeSceneStore";

/** Collections de la scène indexées par `id` — celles qui se diffent élément par élément. */
export type CollectionName = "objects" | "waters" | "paths";

/** Champs de scène SANS identité propre : ils se remplacent en bloc. */
export type SceneFields = Partial<Omit<SceneSnapshot, CollectionName>>;

/**
 * Une opération = le plus petit changement diffusable.
 *
 * `upsert` couvre création ET modification : le récepteur n'a pas à savoir si
 * l'élément existait chez lui. Un pair qui vient de rejoindre reçoit un `upsert`
 * pour un objet qu'il n'a pas — et le crée, sans cas particulier.
 */
export type SceneOp =
  | { op: "upsert"; coll: "objects"; items: ForgeObject[] }
  | { op: "upsert"; coll: "waters"; items: ForgeWater[] }
  | { op: "upsert"; coll: "paths"; items: ForgePath[] }
  | { op: "remove"; coll: CollectionName; ids: string[] }
  | { op: "set"; fields: SceneFields };

type Identified = { id: string };

/** Champs de scène qui ne sont pas des collections indexées. */
const FIELD_KEYS = ["baseMap", "terrain", "terrains", "weather", "layers"] as const;

const byId = <T extends Identified>(list: readonly T[] | undefined): Map<string, T> =>
  new Map((list ?? []).map((x) => [x.id, x]));

/** Égalité structurelle. Suffisant ici : ces données sont du JSON sérialisable. */
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Calcule les opérations qui font passer `prev` à `next`.
 *
 * Rend un tableau VIDE si rien n'a changé — l'appelant peut donc s'en servir
 * comme dirty-check et ne rien émettre du tout.
 */
export function diffScenes(prev: SceneSnapshot | null, next: SceneSnapshot): SceneOp[] {
  const ops: SceneOp[] = [];

  for (const coll of ["objects", "waters", "paths"] as const) {
    const before = byId(prev?.[coll] as Identified[] | undefined);
    const after = byId(next[coll] as Identified[] | undefined);

    // Créés ou modifiés : présents après, absents avant ou différents.
    const changed = [...after.values()].filter((x) => !same(before.get(x.id), x));
    if (changed.length) {
      // `as never` : le discriminant `coll` garantit l'accord items/collection,
      // mais TypeScript ne relie pas la boucle au type de l'union.
      ops.push({ op: "upsert", coll, items: changed as never });
    }

    // Supprimés : présents avant, absents après.
    const gone = [...before.keys()].filter((id) => !after.has(id));
    if (gone.length) ops.push({ op: "remove", coll, ids: gone });
  }

  // Champs sans identité : remplacement en bloc, mais SEULEMENT ceux qui bougent.
  const fields: SceneFields = {};
  let anyField = false;
  for (const k of FIELD_KEYS) {
    if (!same(prev?.[k], next[k])) {
      (fields as Record<string, unknown>)[k] = next[k];
      anyField = true;
    }
  }
  if (anyField) ops.push({ op: "set", fields });

  return ops;
}

/**
 * Applique des opérations à une scène et rend le résultat.
 *
 * N'écrase QUE ce que les opérations désignent : un objet non mentionné garde sa
 * valeur locale. C'est toute la différence avec l'ancien snapshot complet, et la
 * raison pour laquelle deux éditeurs peuvent enfin travailler côte à côte.
 *
 * Ne mute pas l'entrée — le store attend un patch neuf.
 */
export function applyOps(base: SceneSnapshot, ops: readonly SceneOp[]): SceneSnapshot {
  let out: SceneSnapshot = { ...base };

  for (const op of ops) {
    if (op.op === "set") {
      out = { ...out, ...op.fields };
      continue;
    }

    const current = (out[op.coll] ?? []) as Identified[];

    if (op.op === "upsert") {
      const map = byId(current);
      for (const item of op.items as Identified[]) map.set(item.id, item);
      // L'ordre suit celui de la liste locale, les nouveaux venus à la fin :
      // deux pairs qui insèrent en même temps convergent sans dépendre de l'ordre
      // d'arrivée des messages.
      const kept = current.filter((x) => map.has(x.id)).map((x) => map.get(x.id)!);
      const known = new Set(kept.map((x) => x.id));
      const added = (op.items as Identified[]).filter((x) => !known.has(x.id));
      out = { ...out, [op.coll]: [...kept, ...added] } as SceneSnapshot;
    } else {
      const drop = new Set(op.ids);
      out = { ...out, [op.coll]: current.filter((x) => !drop.has(x.id)) } as SceneSnapshot;
    }
  }

  return out;
}
