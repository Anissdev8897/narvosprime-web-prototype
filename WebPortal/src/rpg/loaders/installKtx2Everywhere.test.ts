// Garde-fou du câblage KTX2 global.
//
// Ce test existe parce que la panne qu'il surveille est SILENCIEUSE et DIFFÉRÉE :
// un `useGLTF` sans KTX2 fonctionne parfaitement tant que l'asset n'est pas
// converti, puis échoue le jour de la conversion — loin du code fautif.
import { describe, it, expect, beforeAll } from "vitest";
import { GLTFLoader as StdlibGLTFLoader } from "three-stdlib";
import { GLTFLoader as CoreGLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { installKtx2Everywhere } from "./installKtx2Everywhere";

/** glTF minimal valide : suffit à déclencher parse() sans dépendre d'un fichier. */
const EMPTY_GLTF = JSON.stringify({ asset: { version: "2.0" } });

/** Forme minimale commune aux deux GLTFLoader. `three-stdlib` ne déclare pas
 *  `ktx2Loader` dans ses types (contrairement à `three`) alors que la propriété
 *  existe bien au runtime — c'est elle que setKTX2Loader écrit. */
type AnyGltfLoader = {
  parse: (...a: unknown[]) => unknown;
  ktx2Loader?: unknown;
};

const asLoader = (l: object): AnyGltfLoader => l as AnyGltfLoader;

/** Déclenche parse() en ignorant son issue — seul l'effet de bord nous intéresse. */
function tryParse(loader: object): void {
  try {
    asLoader(loader).parse(EMPTY_GLTF, "", () => {}, () => {});
  } catch {
    // Un parse qui échoue est acceptable ici : attachKTX2 s'exécute AVANT lui.
  }
}

describe("installKtx2Everywhere", () => {
  beforeAll(() => {
    installKtx2Everywhere();
  });

  it("marque les deux prototypes de GLTFLoader comme patchés", () => {
    // Les deux classes coexistent : drei charge celle de three-stdlib, les
    // loaders manuels celle de three. Patcher une seule laisse un trou.
    expect(StdlibGLTFLoader.prototype).toHaveProperty("__narvosKtx2Patched");
    expect(CoreGLTFLoader.prototype).toHaveProperty("__narvosKtx2Patched");
  });

  it("attache un KTX2Loader au loader de three-stdlib (celui de drei) au parse", () => {
    const loader = new StdlibGLTFLoader();
    expect(asLoader(loader).ktx2Loader).toBeFalsy();

    tryParse(loader);

    expect(asLoader(loader).ktx2Loader).toBeTruthy();
  });

  it("attache un KTX2Loader au loader de three (loaders manuels) au parse", () => {
    const loader = new CoreGLTFLoader();
    expect(asLoader(loader).ktx2Loader).toBeFalsy();

    tryParse(loader);

    expect(asLoader(loader).ktx2Loader).toBeTruthy();
  });

  it("réutilise le MÊME singleton entre loaders — pas un transcodeur par instance", () => {
    // Chaque KTX2Loader alloue son propre pool de workers : en créer un par GLB
    // ferait exploser la mémoire et le nombre de threads.
    const a = new StdlibGLTFLoader();
    const b = new CoreGLTFLoader();
    tryParse(a);
    tryParse(b);

    expect(asLoader(a).ktx2Loader).toBe(asLoader(b).ktx2Loader);
  });

  it("ne réécrase pas un KTX2Loader déjà posé explicitement", () => {
    // Les call-sites qui passent encore `mapLoaderExtend` doivent rester maîtres.
    const loader = new CoreGLTFLoader();
    const custom = { marker: "custom" } as never;
    loader.setKTX2Loader(custom);

    tryParse(loader);

    expect(asLoader(loader).ktx2Loader).toBe(custom);
  });

  it("est idempotent : un second appel n'empile pas un deuxième wrapper", () => {
    // Sans garde, HMR ou un double import empileraient les patchs et chaque
    // parse traverserait N couches.
    const before = CoreGLTFLoader.prototype.parse;
    installKtx2Everywhere();
    expect(CoreGLTFLoader.prototype.parse).toBe(before);
  });
});
