// loaders/installKtx2Everywhere.ts — attache KTX2 à TOUT GLTFLoader, où qu'il naisse.
//
// POURQUOI UN PATCH DE PROTOTYPE PLUTÔT QUE `extendLoader` PARTOUT
//
// drei ne câble PAS KTX2 : son `useGLTF` n'installe que Draco et Meshopt, et ne
// touche au KTX2Loader que si on lui passe explicitement un `extendLoader` en 4e
// argument. Or sur ~40 appels à `useGLTF` dans src/rpg/**, TROIS le faisaient.
// Tous les autres — dont `OwnAnimPlayerCharacter` qui charge le personnage du
// JOUEUR — créaient un loader sans transcodeur.
//
// Conséquence concrète : convertir un GLB en KTX2 le rendait ILLISIBLE par ces
// call-sites. GLTFLoader lève alors
//   "THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures"
// et le personnage ne s'affiche plus du tout. Le gain VRAM était donc inaccessible
// tant que le câblage restait déclaratif.
//
// Corriger les 40 sites un par un aurait marché AUJOURD'HUI et cassé demain : le
// prochain `useGLTF(path)` écrit sans le 4e argument réintroduit le bug, en
// silence, et seulement sur les assets convertis. Le patch ci-dessous déplace la
// garantie du call-site vers le type : il n'existe plus de GLTFLoader sans KTX2.
//
// DEUX constructeurs à patcher — ce ne sont pas les mêmes classes :
//   • `three-stdlib` → celui qu'instancie drei (useGLTF)
//   • `three/examples/jsm` → celui des loaders manuels (AssetPreloader, PuzzleMap,
//     StreamingPuzzleMap, ForgeBuiltMap…)
//
// L'attachement est PARESSEUX (au parse, pas à la construction) : à ce moment le
// Canvas est monté depuis longtemps, donc `detectSupport(renderer)` a un renderer
// réel à interroger. Voir `attachKTX2` dans sharedLoaders.ts.
import { GLTFLoader as StdlibGLTFLoader } from "three-stdlib";
import { GLTFLoader as CoreGLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { attachKTX2 } from "./sharedLoaders";

/** Marqueur d'idempotence : HMR et double-import ne doivent pas empiler les patchs. */
const PATCHED = "__narvosKtx2Patched";

/* eslint-disable @typescript-eslint/no-explicit-any */
type LoaderCtor = { prototype: Record<string, any> };

function patchPrototype(Ctor: LoaderCtor | undefined, label: string): boolean {
  const proto = Ctor?.prototype;
  if (!proto || typeof proto.parse !== "function") return false;
  if (proto[PATCHED]) return false;

  const originalParse = proto.parse;
  // GLTFLoader lit `this.ktx2Loader` au moment de construire son GLTFParser :
  // le poser juste avant `parse` suffit, et couvre load(), loadAsync() et
  // parseAsync() qui délèguent tous ici.
  proto.parse = function patchedParse(this: any, ...args: unknown[]) {
    if (!this.ktx2Loader) attachKTX2(this);
    return originalParse.apply(this, args);
  };
  Object.defineProperty(proto, PATCHED, { value: label, enumerable: false });
  return true;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * À appeler UNE FOIS au boot (main.tsx), avant tout rendu React.
 * Idempotent : les appels suivants sont des no-op.
 */
export function installKtx2Everywhere(): void {
  const patched: string[] = [];
  if (patchPrototype(StdlibGLTFLoader as unknown as LoaderCtor, "three-stdlib")) patched.push("three-stdlib");
  if (patchPrototype(CoreGLTFLoader as unknown as LoaderCtor, "three")) patched.push("three");
  if (patched.length > 0) {
    console.info(`[KTX2] transcodeur câblé globalement sur GLTFLoader (${patched.join(" + ")})`);
  }
}
