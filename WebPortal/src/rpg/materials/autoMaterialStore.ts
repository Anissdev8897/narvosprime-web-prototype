// ══════════════════════════════════════════════════════════════════════════════
// materials/autoMaterialStore.ts — Chargement et application de l'auto-material.
//
// Singleton hors-React, comme `collisionWorld` et `npcRegistry` : les chunks se
// montent et se démontent en continu, et les 15 textures de la bibliothèque
// (~56 Mo de VRAM) doivent survivre à tout ça. Les recharger par chunk
// annulerait le gain.
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import { FORGE_AUTO_MATERIAL } from "./autoMaterialConfig";
import type { AutoMaterialConfig } from "./autoMaterialConfig";
import { makeAutoMaterial, allLayerTextureUrls } from "./AutoMaterial";
import { getKTX2, getRegisteredRenderer } from "../loaders/sharedLoaders";

/**
 * Matériaux d'Unreal auxquels on substitue l'auto-material.
 *
 * `MTL_MWAM_*` est le préfixe du pack MWLandscapeAutoMaterial ; `Landscape`
 * attrape les variantes renommées. Volontairement ÉTROIT : élargir ce motif
 * repeindrait des bâtiments en roche. Mesuré sur halo_map.glb : 244 matériaux
 * concernés, 110 520 triangles, soit 4,5 % de la map.
 */
const AUTO_MATERIAL_RE = /MWAM|MWLandscape/i;

export function isAutoMaterialName(name: string | undefined): boolean {
  return !!name && AUTO_MATERIAL_RE.test(name);
}

/**
 * Composants de Landscape Unreal sortis SANS matériau.
 *
 * Le Landscape n'est pas un Static Mesh : son matériau vit sur l'ACTEUR, pas sur
 * ses composants. L'exportateur glTF sort donc chaque composant sans matériau, et
 * Unreal y substitue `WorldGridMaterial` — son damier par défaut. En jeu ça
 * donnait de grandes plaques grises uniformes, parce que le chargeur de chunks
 * remplace `WorldGridMaterial` par un gris plat.
 *
 * Mesuré sur la Forge réimportée : 10 primitives portent `WorldGridMaterial`,
 * 536 494 triangles — 26 % de la map — et TOUTES s'appellent
 * `Landscape(Nanite)Component_*`. Aucun autre objet n'est concerné, donc aucun
 * risque de repeindre une caisse en neige. 91,6 % de ces triangles sont sur des
 * surfaces larges et plates.
 *
 * Le triplanaire n'a besoin ni d'UV ni de matériau source — il travaille en
 * position monde et en pente. Il donne donc un meilleur résultat ici que le
 * matériau qu'Unreal n'a pas exporté.
 *
 * Le test porte sur les DEUX noms : un Landscape qui aurait un vrai matériau doit
 * le garder. Seul le cas « composant de Landscape SANS matériau » est repris.
 */
const LANDSCAPE_NODE_RE = /^Landscape(Nanite)?Component/i;
const UNREAL_DEFAULT_MATERIAL = "WorldGridMaterial";

export function isLandscapeFallback(
  meshName: string | undefined,
  materialName: string | undefined,
): boolean {
  return !!meshName && !!materialName
    && LANDSCAPE_NODE_RE.test(meshName)
    && materialName.includes(UNREAL_DEFAULT_MATERIAL);
}

const textures = new Map<string, THREE.Texture>();
/**
 * Cache par matériau SOURCE → évite de recompiler un programme par instance.
 *
 * REMPLACÉ, jamais vidé, quand la config change : un `WeakMap` n'a pas de
 * `clear()`. Sans ce remplacement, `applyAutoMaterial` reservirait le matériau
 * patché avec les ANCIENNES textures et le changement de couche n'aurait aucun
 * effet visible — panne silencieuse, la pire à diagnostiquer.
 */
let patched = new WeakMap<THREE.Material, THREE.MeshStandardMaterial>();
/**
 * Lien INVERSE patché → source. Nécessaire pour la bascule de diagnostic :
 * une fois le matériau remplacé sur le mesh, le matériau d'origine n'est plus
 * accessible autrement, et on ne pourrait plus revenir en arrière.
 */
const original = new WeakMap<THREE.Material, THREE.Material>();
let loadPromise: Promise<void> | null = null;
let loaded = false;
let failed = false;
/** Tentatives déjà consommées — borne les reprises sur un fichier réellement absent. */
let attempts = 0;
const MAX_ATTEMPTS = 2;

/**
 * Auto-material désactivé — les chunks gardent leurs matériaux bakés d'origine.
 *
 * Bascule de DIAGNOSTIC. Une surface PÂLE ET PLATE au milieu d'une roche n'est
 * pas de la géométrie manquante (celle-ci laisserait voir l'arrière-plan) : c'est
 * de la géométrie présente mais mal ombrée. Couper l'auto-material sépare les
 * deux en une touche — si les taches disparaissent, le défaut est dans le shader
 * triplanaire ; sinon il est dans les assets ou le rendu de base.
 */
let disabled = false;

/** Coupe/rétablit l'auto-material. Retourne le nouvel état (true = coupé). */
export function toggleAutoMaterial(): boolean {
  disabled = !disabled;
  return disabled;
}

/**
 * CONFIG ACTIVE — ce que l'éditeur Forge modifie.
 *
 * Le compteur de génération est la façon dont le monde 3D apprend qu'il doit se
 * repeindre. `StreamingPuzzleMap` le compare au sien à chaque frame : c'est une
 * comparaison d'entiers, donc gratuite, là où un abonnement traverserait la
 * frontière React/Three à contre-sens (le monde 3D n'est pas re-rendu par React).
 */
let activeConfig: AutoMaterialConfig = FORGE_AUTO_MATERIAL;
let generation = 0;

/**
 * Matériaux patchés VIVANTS — le `WeakMap` ne s'énumère pas, et il faut bien
 * pouvoir libérer ce qu'on remplace.
 *
 * Chaque matériau patché porte son propre programme GLSL. Sans libération, un
 * aller-retour entre deux couches en laisserait un par matériau source à chaque
 * fois : sur les 242 matériaux MWAM de la Forge, quelques allers-retours dans
 * l'éditeur suffisent à perdre le contexte WebGL.
 */
let liveMaterials = new Set<THREE.Material>();
/** Patchés de la génération précédente, en attente de libération. */
let staleMaterials: THREE.Material[] = [];

export function getAutoMaterialConfig(): AutoMaterialConfig { return activeConfig; }

/** Numéro de version de la config — change à chaque modification. */
export function autoMaterialGeneration(): number { return generation; }

/**
 * Change les couches de terrain. Invalide le cache de matériaux patchés, sinon
 * les meshes déjà peints garderaient l'ancienne apparence.
 *
 * Ne recharge AUCUNE texture : la bibliothèque entière est chargée au démarrage
 * (cf. `allLayerTextureUrls`), donc n'importe quelle combinaison est disponible
 * immédiatement.
 */
export function setAutoMaterialConfig(cfg: AutoMaterialConfig): void {
  activeConfig = cfg;
  patched = new WeakMap();
  // Pas de dispose() ICI : les meshes des chunks pointent encore dessus tant que
  // la boucle de rendu n'a pas fait son passage de repeint. Libérer maintenant
  // laisserait des matériaux détruits attachés à des meshes rendus la même frame.
  staleMaterials.push(...liveMaterials);
  liveMaterials = new Set();
  generation++;
}

/**
 * Libère les matériaux de la génération précédente.
 *
 * À appeler UNE FOIS que tous les chunks résidents ont été repeints — c'est
 * `StreamingPuzzleMap` qui sait quand, puisque c'est lui qui les parcourt.
 * Retourne le nombre libéré.
 */
export function disposeStaleAutoMaterials(): number {
  const n = staleMaterials.length;
  for (const m of staleMaterials) m.dispose();
  staleMaterials = [];
  return n;
}

/**
 * Réservé aux TESTS — enregistre un matériau comme patché vivant.
 *
 * `applyAutoMaterial` a besoin d'un vrai contexte WebGL et de textures KTX2
 * chargées ; les tests tournent en environnement `node` sans DOM. Ce point
 * d'entrée permet de vérifier le CYCLE DE VIE (quand un matériau est libéré)
 * sans avoir à en fabriquer un vrai.
 */
export function __registerLiveMaterialForTest(m: THREE.Material): void {
  liveMaterials.add(m);
}

export function isAutoMaterialDisabled(): boolean { return disabled; }

/** Les textures sont-elles prêtes ? Si non, `applyAutoMaterial` ne touche à rien. */
export function isAutoMaterialReady(): boolean {
  return loaded && !failed;
}

/**
 * Charge les 7 textures. Idempotent, et sûr à appeler en parallèle : les appels
 * concurrents partagent la même promesse.
 */
export function loadAutoMaterialTextures(): Promise<void> {
  if (loadPromise) return loadPromise;
  if (loaded && failed) return Promise.resolve(); // abandon définitif, cf. plus bas
  attempts++;

  const ktx2 = getKTX2();
  if (!ktx2) {
    failed = true;
    console.warn("[AutoMaterial] loader KTX2 indisponible — auto-material désactivé");
    loadPromise = Promise.resolve();
    return loadPromise;
  }

  // Toute la bibliothèque, pas la seule config : l'éditeur change de couche à
  // chaud et un chargement en cours de frame produirait le gel qu'on évite.
  const urls = allLayerTextureUrls();
  loadPromise = Promise.all(
    urls.map(({ url, srgb }) =>
      ktx2.loadAsync(url).then(
        (tex: THREE.Texture) => {
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          // Sans sRGB sur les couleurs, le rendu ressort délavé ; AVEC sur les
          // normales, l'éclairage part de travers. Le choix se fait par suffixe
          // de fichier, pas au jugé.
          tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          // Le carrelage monde est vu en biais dans 90 % des cas — l'anisotropie
          // est ce qui empêche le sol de partir en bouillie vers l'horizon.
          tex.anisotropy = 8;

          // PRÉ-UPLOAD GPU IMMÉDIAT. `collectTextures` de StreamingPuzzleMap ne
          // parcourt que les propriétés du matériau ; ces textures-ci vivent
          // dans les uniforms d'une closure et lui sont donc invisibles. Sans
          // cet appel, elles échappent à la barrière de révélation et c'est la
          // PREMIÈRE frame affichant du terrain qui uploade 26 Mo d'un coup —
          // le gel que la barrière existe précisément pour éviter, déplacé au
          // pire moment possible.
          const renderer = getRegisteredRenderer();
          if (renderer) {
            try { renderer.initTexture(tex); } catch { /* contexte perdu → upload différé */ }
          }

          textures.set(url, tex);
        },
        (err: unknown) => {
          console.warn(`[AutoMaterial] échec ${url} :`, err);
          failed = true;
        },
      ),
    ),
  ).then(() => {
    if (failed) {
      // ÉCHEC PARTIEL — on ne garde RIEN. Conserver les textures déjà chargées
      // laissait ~24 Mo de VRAM occupés pour un système définitivement inerte :
      // `loaded` passait à true, `isAutoMaterialReady()` restait false, et
      // `loadPromise` court-circuitait toute nouvelle tentative. Les terrains
      // restaient délavés pour TOUTE la session, changement de map compris,
      // avec un seul console.warn noyé dans les logs de streaming.
      //
      // Déclencheur réaliste : le fallback SPA de Vite renvoie du text/html en
      // 200 pour un fichier absent (cf. CLAUDE.md), et KTX2Loader rejette alors
      // sur le magic number. Un seul .ktx2 mal déployé suffit.
      for (const t of textures.values()) t.dispose();
      textures.clear();
      loadPromise = null;
      failed = false;
      loaded = false;
      if (attempts < MAX_ATTEMPTS) {
        console.warn(
          `[AutoMaterial] chargement incomplet — nouvelle tentative au prochain chunk ` +
          `(${attempts}/${MAX_ATTEMPTS})`,
        );
      } else {
        loaded = true;   // plus de reprise : on fige l'état, bakes conservés
        failed = true;
        console.warn(
          "[AutoMaterial] abandon après " + MAX_ATTEMPTS + " tentatives — les terrains " +
          "gardent leurs textures bakées (délavées sur les grandes surfaces). " +
          "Vérifier que /models/materials/mwam/*.ktx2 est bien déployé.",
        );
      }
      return;
    }
    loaded = true;
    console.info(`[AutoMaterial] ${textures.size} textures prêtes — carrelage monde actif`);
  });

  return loadPromise;
}

/**
 * Remplace, dans un sous-arbre, les matériaux d'auto-material par leur version
 * carrelée monde. Sans effet si les textures ne sont pas prêtes.
 *
 * Retourne le nombre de meshes repeints — utile pour vérifier en un coup d'œil
 * que le motif attrape bien quelque chose plutôt que de le supposer.
 */
export function applyAutoMaterial(
  root: THREE.Object3D,
  cfg: AutoMaterialConfig = activeConfig,
): number {
  if (disabled || !isAutoMaterialReady()) return 0;

  const texMap: Record<string, THREE.Texture | null> = {};
  for (const [url, tex] of textures) texMap[url] = tex;

  let count = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;

    const swap = (m: THREE.Material): THREE.Material => {
      // Deux portes d'entrée : le matériau MWAM nommé, et le composant de
      // Landscape qu'Unreal a exporté sans matériau (cf. isLandscapeFallback).
      if (!isAutoMaterialName(m.name) && !isLandscapeFallback(mesh.name, m.name)) return m;
      const cached = patched.get(m);
      if (cached) { count++; return cached; }
      // On part du matériau existant plutôt que d'un ShaderMaterial, qui n'aurait
      // ni les ombres ni le brouillard de la scène.
      //
      // `isMeshStandardMaterial` est vrai AUSSI pour MeshPhysicalMaterial, qui en
      // hérite — et c'est bien le cas ici : les matériaux MWAM portent un
      // KHR_materials_specular, donc GLTFLoader en fait des Physical. C'est
      // volontaire : ils sont patchables et makeAutoMaterial largue leurs cartes
      // spéculaires. Seuls les Basic/Lambert/Phong passent au travers, faute de
      // pipeline PBR à patcher.
      if (!(m as THREE.MeshStandardMaterial).isMeshStandardMaterial) return m;
      const next = makeAutoMaterial(m as THREE.MeshStandardMaterial, cfg, texMap);
      patched.set(m, next);
      original.set(next, m);
      liveMaterials.add(next);
      count++;
      return next;
    };

    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(swap)
      : swap(mesh.material);
  });

  return count;
}

/**
 * Rebascule un sous-arbre entre matériaux d'origine et auto-material.
 *
 * Retourne le nombre de meshes touchés. Appelé sur TOUS les chunks résidents
 * quand la bascule change — sinon seuls les chunks chargés ensuite suivraient
 * l'état, et la comparaison visuelle ne voudrait rien dire.
 */
export function refreshAutoMaterial(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const swap = (m: THREE.Material): THREE.Material => {
      if (disabled) {
        const src = original.get(m);
        if (src) { n++; return src; }
        return m;
      }
      const p = patched.get(m);
      if (p) { n++; return p; }
      return m;
    };
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(swap)
      : swap(mesh.material);
  });
  return n;
}

/**
 * Repeint un sous-arbre avec la config COURANTE, en repartant des matériaux
 * d'origine.
 *
 * `refreshAutoMaterial` ne suffit pas après un changement de config : il ressert
 * le contenu de `patched`, qui vient d'être remplacé par un cache vide. Il faut
 * d'abord REVENIR aux matériaux source, sinon `applyAutoMaterial` ne reconnaîtra
 * plus rien — le nom des matériaux déjà patchés se termine par `__autoMaterial`
 * et ne correspond plus au motif MWAM, donc le second passage ne toucherait
 * aucun mesh et le changement de couche resterait invisible.
 */
export function rebuildAutoMaterial(root: THREE.Object3D): number {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const restore = (m: THREE.Material): THREE.Material => original.get(m) ?? m;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(restore)
      : restore(mesh.material);
  });
  return applyAutoMaterial(root);
}

/** Libère les textures — appelé au changement de map. */
export function disposeAutoMaterial(): void {
  for (const t of textures.values()) t.dispose();
  textures.clear();
  for (const m of liveMaterials) m.dispose();
  liveMaterials = new Set();
  disposeStaleAutoMaterials();
  patched = new WeakMap();
  loadPromise = null;
  loaded = false;
  failed = false;
  attempts = 0;
}
