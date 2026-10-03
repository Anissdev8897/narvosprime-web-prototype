// npc/preloadNpc.ts — préchauffe les assets d'un PNJ pour ÉVITER le freeze au 1er spawn.
//
// Quand l'admin SÉLECTIONNE un PNJ dans l'éditeur (ou le place, ou au chargement de map), le
// GLB du modèle + son PACK d'anim éventuel sont parsés au 1er rendu → hitch. On préchauffe le
// cache drei (useGLTF.preload) EN AVANCE → à l'apparition, tout est en cache = pas de gel.
// Pattern identique à l'éditeur d'arme (préchargement → plus de bug au placement).
import { useSyncExternalStore } from "react";
import { useGLTF } from "@react-three/drei";
import { getNpc } from "./npcCatalog";
import { getNpcModelPath } from "../loaders/assetManifest";
import { qualityVariant } from "../loaders/assetQuality";
import { resolveMonsterAnimPack } from "./monsterAnimationAssignment";
import { preloadGltfPack } from "../animation/useFbxAnimationPack";

const warmed = new Set<string>(); // assets déjà préchauffés (clé = URL ou "pack:<id>")
let version = 0;
const listeners = new Set<() => void>();
function notify() { version++; for (const fn of listeners) fn(); }

/** URLs GLB (modèle variante-qualité + clips du pack) d'un PNJ — pour le registre global. */
export function npcAssetUrls(folder: string): string[] {
  const def = getNpc(folder);
  const urls = [qualityVariant(def?.modelPath ?? getNpcModelPath(folder, def?.assetRoot, def?.modelFile))];
  const pack = def ? resolveMonsterAnimPack(def) : null;
  if (pack) for (const s of pack) urls.push(s.path);
  return urls;
}

function modelPath(folder: string): string {
  const def = getNpc(folder);
  return qualityVariant(def?.modelPath ?? getNpcModelPath(folder, def?.assetRoot, def?.modelFile));
}

/** Préchauffe le modèle + le pack d'anim d'un PNJ (idempotent + notifie le statut). */
export function preloadNpcAssets(folder: string): void {
  const def = getNpc(folder);
  let changed = false;
  const path = modelPath(folder);
  if (!warmed.has(path)) { warmed.add(path); try { useGLTF.preload(path); } catch { /* absent */ } changed = true; }
  const pack = def ? resolveMonsterAnimPack(def) : null;
  if (pack && pack.length && def?.animPack) {
    const key = `pack:${def.animPack}`;
    if (!warmed.has(key)) { warmed.add(key); preloadGltfPack(pack); changed = true; }
  }
  if (changed) notify();
}

/** Préchauffe TOUS les PNJ d'une liste (recharge map / hydrate). */
export function preloadNpcList(folders: Iterable<string>): void {
  for (const f of folders) preloadNpcAssets(f);
}

/** Vrai si le PNJ (modèle + pack) a été préchauffé → placement sans freeze. */
export function isNpcWarmed(folder: string): boolean {
  const def = getNpc(folder);
  const modelOk = warmed.has(modelPath(folder));
  const packOk = !def?.animPack || warmed.has(`pack:${def.animPack}`);
  return modelOk && packOk;
}

/** Hook : version du préchauffe (re-render quand un PNJ devient prêt). */
export function useNpcWarmVersion(): number {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    () => version, () => version,
  );
}

/** Source + actions d'anim d'un PNJ (affichage éditeur). */
export function npcAnimInfo(folder: string): { source: string; actions: string[] } {
  const def = getNpc(folder);
  if (def?.ownAnims) return { source: "Anims propres (embarquées dans le modèle)", actions: ["idle", "walk", "run", "attack", "death", "…"] };
  if (def?.animPack) {
    const pack = resolveMonsterAnimPack(def) ?? [];
    return { source: `Pack « ${def.animPack} »${def.animPackStrip === false ? " (mixamo)" : ""}`, actions: pack.map((s) => s.action) };
  }
  return { source: "Anims biped partagées (soldat_humain)", actions: ["idle", "walk", "run", "attack", "death"] };
}
