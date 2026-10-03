// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/MorphedBody.tsx — Le mannequin nu homme/femme, morphable.
//
// C'est la BASE de la création de personnage : le corps physique, sans
// vêtements, que les curseurs de morphologie déforment en continu. Les
// équipements viendront se poser dessus plus tard, via le Marchand — ce
// composant n'en sait rien et ne doit rien en savoir.
//
// COMPOSANT SÉPARÉ, DÉLIBÉRÉMENT. Il ne touche ni `ModularCreatorScreen` ni
// `bodySlots` : l'appelant le monte où il veut.
//
// ── CORPS SKINNÉ, PAS UN SIMPLE MESH ─────────────────────────────────────────
//
// `base_skinned.glb` porte le squelette Mixamo 52 os du jeu, transféré depuis
// les pièces `_parts/mpfb/` (cf. `scripts/mpfb-skin-base.mjs`). C'est ce qui
// permet au mannequin d'être animé comme n'importe quel personnage.
//
// Morpher un mesh SKINNÉ fonctionne : le skinning s'applique PAR-DESSUS les
// positions morphées, dans cet ordre. Un corps plus large reste donc
// correctement attaché à ses os.
//
// ── DEUX SURFACES, UN SEUL ESPACE CANONIQUE ──────────────────────────────────
//
// Le GLB porte DEUX primitives — la peau (`skin`, 14 517 sommets) et les yeux
// (`Eyes`, 160). Elles existent séparément pour une seule raison : une primitive
// porte un matériau, et fondre les yeux dans la peau rendrait toute couleur
// d'iris impossible.
//
// Mais elles indexent le MÊME espace canonique, sur des plages disjointes. D'où
// un seul `canonBase` alimenté par les deux (`reset: false` sur la seconde,
// sinon elle efface la première), une seule passe de morphs pour tout le
// personnage, puis une redistribution par surface.
//
// ── LA CHAÎNE, À CHAQUE CHANGEMENT DE CURSEUR ────────────────────────────────
//
//   poids ──> applyMorphs      (espace canonique, 19 158, ×MAKEHUMAN_TO_METERS)
//         ──> scatterToRender  (par surface : 14 517 puis 160)
//         ──> needsUpdate + computeVertexNormals
//
// Les tableaux sont alloués UNE FOIS et réutilisés : un curseur produit des
// dizaines de changements par seconde.
//
// ⚠ UNITÉS. Le GLB riggé est en MÈTRES (il hérite du squelette), les deltas de
// morphs en DÉCIMÈTRES MakeHuman. D'où `MAKEHUMAN_TO_METERS` passé à
// `applyMorphs` — l'oublier déforme le corps dix fois trop, sans erreur.
// Et donc AUCUN `scale` sur le groupe : le corps est déjà à l'échelle.
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import {
  applyMorphs, scatterToRender, gatherFromRender,
  MAKEHUMAN_TO_METERS, type MorphSet, type MorphWeights,
} from "./morphSet";
import { loadMorphRegions, BODY_ROOT, CANONICAL_VERTEX_COUNT, type MorphRegion } from "./morphLoader";
import { EYE_MATERIAL } from "./skinTint";
import { construireSliders, poidsDesSliders, type MorphSlider } from "./morphSliders";
import { HairOnBody } from "./HairOnBody";
import {
  loadJointCubes, positionsMonde, translationsLocales, type RecetteSquelette,
} from "./jointCubes";

const BODY_URL = `${BODY_ROOT}/base_skinned.glb`;

/**
 * Couleur d'iris par défaut — le bleu-gris que `build-base-body.mjs` posait déjà
 * sur les yeux MakeHuman. Neutre à dessein : c'est un point de départ pour les
 * curseurs, pas un parti pris esthétique.
 */
const IRIS_DEFAUT = "#4073a6";

/**
 * Une primitive du GLB, prête à être morphée et teintée.
 *
 * `materiau` est mémorisé plutôt que relu depuis `mesh.material` à chaque
 * teinte : `SkeletonUtils.clone` NE clone PAS les matériaux, donc on en pose un
 * neuf par surface et par exemplaire. Sans ça, deux aperçus ouverts en même
 * temps partageraient leur couleur de peau.
 */
interface Surface {
  mesh: THREE.Mesh;
  geo: THREE.BufferGeometry;
  pos: THREE.BufferAttribute;
  morphIndex: Uint32Array;
  estOeil: boolean;
  materiau: THREE.MeshStandardMaterial;
  /**
   * Copie PLATE des positions, allouée une fois.
   *
   * ⚠ NE JAMAIS PASSER `pos.array` AUX FONCTIONS DE MORPH.
   * Le `GLTFLoader` de three rend une géométrie ENTRELACÉE : positions,
   * normales et UV partagent un seul tampon, et `pos.array` désigne alors le
   * tampon ENTIER. Le lire comme s'il était compact (`array[i * 3]`) donne des
   * valeurs mélangées, puis des lectures hors bornes — donc `undefined`, donc
   * NaN. C'est ce qui figeait le mannequin sur sa pose neutre.
   *
   * gltf-transform, lui, rend des accesseurs séparés : le même fichier passe
   * en test et échoue dans le navigateur. On ne présume donc PLUS de la
   * disposition mémoire — `getX/setXYZ` connaissent `offset` et `stride`.
   *
   * Même idiome que `rebindSkinnedMesh`, qui documentait déjà ce piège.
   */
  plat: Float32Array;
}

/** Positions d'un attribut vers un tableau compact, entrelacement compris. */
function versPlat(pos: THREE.BufferAttribute, sortie: Float32Array): Float32Array {
  for (let i = 0; i < pos.count; i++) {
    sortie[i * 3] = pos.getX(i);
    sortie[i * 3 + 1] = pos.getY(i);
    sortie[i * 3 + 2] = pos.getZ(i);
  }
  return sortie;
}

/** Régions chargées d'office : celles qui portent le corps homme/femme. */
export const REGIONS_CORPS: MorphRegion[] = ["macrodetails"];

/**
 * Retrouve l'attribut de renvoi vers l'espace canonique.
 *
 * `GLTFLoader` met en MINUSCULES les attributs qu'il ne connaît pas. On accepte
 * donc les deux graphies : si three changeait de convention, le corps cesserait
 * d'être morphable sans lever la moindre erreur.
 */
/** Indice du premier NaN/Infini, ou -1. Sort au premier trouvé. */
function premierNonFini(a: Float32Array): number {
  for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) return i;
  return -1;
}

function litMorphIndex(geo: THREE.BufferGeometry): Uint32Array | null {
  const attr = (geo.getAttribute("_morph_index") ?? geo.getAttribute("_MORPH_INDEX")) as
    THREE.BufferAttribute | undefined;
  if (!attr) return null;

  // ⚠ NE JAMAIS RENVOYER `attr.array`, MÊME QUAND SON TYPE EST LE BON.
  //
  // Le `GLTFLoader` de three ENTRELACE : `_morph_index` partage son tampon avec
  // position, uv, skinIndex et skinWeight. Mesuré sur `base_skinned.glb` —
  // `count` 14 517 mais `array.length` 174 204, et ce tampon EST un
  // `Uint32Array`. Un test `instanceof` le laissait donc passer tel quel : on
  // repartait avec 174 204 « indices » faits de positions réinterprétées en
  // entiers. `gatherFromRender` bouclait alors bien au-delà du tableau de
  // positions → `undefined` → NaN, et le mannequin restait figé sur sa pose
  // neutre. Le contrôle de type semblait protéger ; il validait le cas qui casse.
  //
  // `getX` connaît `offset` et `stride`. C'est la seule lecture correcte, que la
  // géométrie soit entrelacée ou non.
  const out = new Uint32Array(attr.count);
  for (let i = 0; i < attr.count; i++) out[i] = attr.getX(i);
  return out;
}

export interface MorphedBodyProps {
  /** Poids par nom de morph — typiquement la sortie de `macroWeights()`. */
  weights: MorphWeights;
  /** Régions à charger en plus du corps (têtes, jambes… selon l'onglet ouvert). */
  regions?: readonly MorphRegion[];
  /** Teinte de peau. Le matériau reste volontairement simple à ce stade. */
  skinColor?: string;
  /** Couleur d'iris. Séparée de `skinColor` : c'est tout l'intérêt d'avoir deux
   *  primitives — teinter la peau ne doit jamais colorer les yeux. */
  eyeColor?: string;
  /**
   * Morphologie fine : position de chaque curseur, de -1 à +1.
   *
   * On reçoit les positions BRUTES, pas des poids. Les résoudre demande les
   * NOMS des cibles, qui ne sont connus qu'une fois le pack chargé — et c'est
   * ce composant qui les charge. L'appelant devrait sinon télécharger les mêmes
   * fichiers une seconde fois pour construire les mêmes curseurs.
   *
   * Les régions à charger se DÉDUISENT des clés (`<région>.<axe>`) : un
   * personnage neutre ne télécharge donc aucun des 22 packs (~5 Mo).
   */
  sliderValues?: Readonly<Record<string, number>>;
  /**
   * Coiffure posée sur le mannequin (cf. `hairCatalog`).
   *
   * Elle PARTAGE le squelette du corps — pas une copie. C'est ce qu'exigent
   * three et Epic pour un personnage modulaire, et ce que le portage 53 → 89 os
   * a rendu possible : avant, corps et coiffure n'avaient que 52 os en commun.
   */
  hairPath?: string;
  /** Teinte de la chevelure. */
  hairColor?: string;
  /**
   * Pose les pieds sur `y = 0`.
   *
   * Le corps MakeHuman est CENTRÉ sur l'origine (Y de -0,82 à +0,85), pas posé
   * dessus : monté tel quel, il est à moitié enterré. Et comme le curseur de
   * taille change sa hauteur, un décalage constant ferait s'enfoncer les grands
   * et flotter les petits — d'où un recalcul à chaque passe de morph.
   *
   * À mettre à `false` pour une scène qui place le personnage elle-même.
   */
  groundAlign?: boolean;
  /** Notifié quand le corps est prêt à être affiché. */
  onReady?: () => void;
  /** Notifié si le chargement échoue — l'appelant décide quoi montrer. */
  onError?: (e: Error) => void;
}

export function MorphedBody({
  weights, regions = REGIONS_CORPS, sliderValues,
  hairPath, hairColor = "#2b1d16",
  skinColor = "#c8a08a", eyeColor = IRIS_DEFAUT,
  groundAlign = true, onReady, onError,
}: MorphedBodyProps) {
  /**
   * Régions à charger = celles demandées + celles qu'un curseur touche.
   *
   * Déduites des clés plutôt que déclarées : ajouter un curseur d'une nouvelle
   * région suffit, aucune liste à tenir à jour ailleurs.
   */
  const regionsUtiles = useMemo(() => {
    const s = new Set<MorphRegion>(regions);
    for (const cle in sliderValues) {
      if (sliderValues[cle]) s.add(cle.slice(0, cle.indexOf(".")) as MorphRegion);
    }
    return [...s];
  }, [regions, sliderValues]);
  const { scene } = useGLTF(BODY_URL);
  const [sets, setSets] = useState<MorphSet[] | null>(null);
  /** Le filet anti-NaN ne parle qu'une fois : l'effet tourne à chaque curseur. */
  const signale = useRef(false);

  /**
   * Recette des joint cubes — permet au SQUELETTE de suivre la morphologie.
   *
   * Absente, le corps se déforme quand même : seuls les os restent figés. On ne
   * bloque donc pas le rendu dessus, on l'applique dès qu'elle arrive.
   */
  const [recette, setRecette] = useState<RecetteSquelette | null>(null);
  useEffect(() => {
    let vivant = true;
    loadJointCubes()
      .then((r) => { if (vivant) setRecette(r); })
      .catch((e: unknown) => console.warn("[MorphedBody] joint cubes indisponibles —", e));
    return () => { vivant = false; };
  }, []);

  /**
   * Signature de contenu des poids.
   *
   * `weights` est presque toujours construit en ligne par l'appelant
   * (`macroWeights(...)` dans le JSX) : son IDENTITÉ change à chaque rendu,
   * alors que son contenu ne bouge que quand un curseur bouge. Dépendre de
   * l'identité relancerait la passe de morph complète à chaque rendu de
   * l'appelant, pour un résultat identique.
   *
   * Comparer le contenu ici plutôt que d'exiger un `useMemo` de chaque appelant :
   * une exigence non tenue ne se voit pas, une comparaison sur place se tient
   * toute seule. Coût : quelques dizaines d'entrées.
   */
  /**
   * Poids effectifs = macro + morphologie fine.
   *
   * Les curseurs sont résolus ICI, une fois les packs chargés : `sets` porte les
   * noms de cibles, seule source qui dise quelles cibles un axe pilote.
   *
   * Les deux familles visent des cibles DISJOINTES — `macrodetails` d'un côté,
   * les 22 régions fines de l'autre — donc la fusion n'écrase jamais rien.
   */
  const poidsEffectifs = useMemo(() => {
    if (!sets || !sliderValues) return weights;
    const sliders: MorphSlider[] = [];
    sets.forEach((set, i) => {
      sliders.push(...construireSliders(regionsUtiles[i], [...set.morphs.keys()]));
    });
    return { ...weights, ...poidsDesSliders(sliders, sliderValues) };
  }, [sets, sliderValues, weights, regionsUtiles]);

  const signatureWeights = useMemo(
    () => Object.keys(poidsEffectifs).filter((n) => poidsEffectifs[n]).sort()
      .map((n) => `${n}=${poidsEffectifs[n].toFixed(5)}`).join("|"),
    [poidsEffectifs],
  );

  /**
   * Copie profonde de la scène, squelette compris.
   *
   * `useGLTF` met la scène en cache et la PARTAGE. `SkeletonUtils.clone` est le
   * seul clone qui recrée aussi le squelette et rebranche les os : un
   * `scene.clone()` ordinaire laisserait tous les exemplaires attachés au MÊME
   * squelette, et deux aperçus se déformeraient ensemble.
   */
  const travail = useMemo(() => {
    const racine = SkeletonUtils.clone(scene) as THREE.Object3D;

    // Toutes les surfaces morphables, pas seulement la première. Une primitive
    // dépourvue de `_MORPH_INDEX` est ignorée : sans renvoi canonique, la
    // morpher écrirait n'importe où.
    const surfaces: Surface[] = [];
    racine.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;

      const partagee = mesh.geometry as THREE.BufferGeometry;
      const morphIndex = litMorphIndex(partagee);
      if (!morphIndex) return;

      // ⚠ GÉOMÉTRIE CLONÉE, SANS QUOI ON MORPHE LE CACHE.
      //
      // `SkeletonUtils.clone` recrée les nœuds et le squelette mais PAS les
      // géométries : le mesh cloné pointe sur celle de la scène mémorisée par
      // `useGLTF`. Écrire les positions morphées dedans corrompt le cache pour
      // tout autre consommateur, et le `dispose()` de démontage libère une
      // ressource encore référencée. Au remontage, les positions « d'origine »
      // sont alors celles du morph précédent : les déformations se CUMULENT.
      //
      // Le même piège est déjà documenté pour les matériaux plus bas. La
      // géométrie l'a aussi ; il est resté invisible tant que ce composant n'a
      // jamais été monté.
      const geo = partagee.clone();
      mesh.geometry = geo;

      // Le nom du matériau vient du GLB, où le pipeline l'a posé à dessein
      // (`SURFACES` dans mpfb-base-to-glb.mjs). C'est le seul lien entre les
      // deux bouts de la chaîne — le renommer d'un côté casse l'autre.
      const source = mesh.material as THREE.Material | THREE.Material[];
      const nom = Array.isArray(source) ? (source[0]?.name ?? "") : (source?.name ?? "");
      const estOeil = nom === EYE_MATERIAL;

      // Le matériau du GLB est un placeholder du script de riggage : on le
      // remplace pour que les teintes du créateur s'appliquent. Un iris est
      // lisse, la peau ne l'est pas — d'où deux rugosités.
      const materiau = new THREE.MeshStandardMaterial({
        roughness: estOeil ? 0.15 : 0.75,
        metalness: 0,
      });
      mesh.material = materiau;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const pos = geo.getAttribute("position") as THREE.BufferAttribute;
      surfaces.push({
        mesh, geo, morphIndex, estOeil, materiau, pos,
        plat: new Float32Array(pos.count * 3),
      });
    });
    if (surfaces.length === 0) return null;

    // Un SEUL espace canonique pour toutes les surfaces : elles y occupent des
    // plages disjointes, donc une passe de morphs les couvre toutes.
    //
    // ⚠ `reset` vrai pour la PREMIÈRE seulement. Le laisser à sa valeur par
    // défaut ferait effacer la peau par les yeux — un corps réduit à deux
    // globes flottants. Cf. le test dédié dans `morphSet.test.ts`.
    const canonBase = new Float32Array(CANONICAL_VERTEX_COUNT * 3);
    surfaces.forEach((s, i) => {
      // Positions de rendu D'ORIGINE, aplaties : sans cette copie, morpher
      // écraserait la référence et les déformations se cumuleraient d'un
      // réglage à l'autre. `versPlat` traverse l'entrelacement éventuel.
      gatherFromRender(versPlat(s.pos, s.plat), s.morphIndex, canonBase, i === 0);
    });

    // ── Contrôle de l'ENTRÉE, séparé du contrôle de la sortie ────────────────
    //
    // Un NaN en sortie de morphs peut venir de DEUX endroits : la géométrie
    // qu'on vient de lire, ou les deltas qu'on va ajouter. Rejouer la chaîne
    // hors React sur les mêmes fichiers a donné 0 NaN sur les 32 combinaisons
    // du créateur — donc le suspect est ce que three.js nous rend, pas le
    // calcul. On le mesure ICI pour ne plus avoir à choisir entre les deux.
    //
    // `pos.array` peut mentir : sur une géométrie ENTRELACÉE il renvoie tout le
    // tampon (position+normale+uv mêlées), et sur une géométrie QUANTIFIÉE ce
    // n'est pas un Float32Array. Les deux cas se voient dans ce relevé.
    if (premierNonFini(canonBase) >= 0) {
      console.error(
        "[MorphedBody] la GÉOMÉTRIE LUE contient déjà des valeurs non finies — " +
        "le calcul de morphs est hors de cause. Surfaces :",
        surfaces.map((s) => ({
          nom: s.estOeil ? "Eyes" : "skin",
          sommets: s.pos.count,
          longueurTableau: (s.pos.array as ArrayLike<number>).length,
          typeTableau: (s.pos.array as object).constructor.name,
          entrelacee: !!(s.pos as { isInterleavedBufferAttribute?: boolean }).isInterleavedBufferAttribute,
          morphIndex: s.morphIndex.length,
          morphIndexMax: s.morphIndex.reduce((a, b) => (b > a ? b : a), 0),
        })),
      );
    }

    return {
      racine, surfaces,
      // Squelette du mannequin, PARTAGÉ avec les pièces qu'on y pose.
      skeleton: (surfaces[0].mesh as THREE.SkinnedMesh).skeleton ?? null,
      canonBase,
      canonOut: new Float32Array(CANONICAL_VERTEX_COUNT * 3),
    };
  }, [scene]);

  // ── Chargement des packs ────────────────────────────────────────────────────
  useEffect(() => {
    let vivant = true;
    loadMorphRegions(regionsUtiles)
      .then((s) => { if (vivant) setSets(s); })
      .catch((e: unknown) => {
        if (!vivant) return;
        const err = e instanceof Error ? e : new Error(String(e));
        console.warn("[MorphedBody]", err.message);
        onError?.(err);
      });
    return () => { vivant = false; };
    // `regions` est un tableau : on dépend de son CONTENU, pas de son identité,
    // sinon un littéral en ligne relancerait le chargement à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionsUtiles.join("|")]);

  // ── Application des morphs ──────────────────────────────────────────────────
  useEffect(() => {
    if (!travail || !sets) return;
    const { surfaces, canonBase, canonOut } = travail;

    // Une seule passe pour tout le personnage — les surfaces partagent l'espace
    // canonique, seule la redistribution est per-surface.
    applyMorphs(canonBase, canonOut, sets, poidsEffectifs, MAKEHUMAN_TO_METERS);

    // ── Filet anti-NaN ─────────────────────────────────────────────────────
    //
    // Un seul NaN dans les positions et three affiche, à chaque frame :
    //   « computeBoundingBox(): Computed min/max have NaN values »
    // sans dire NI quelle surface NI d'où il vient — puis le maillage disparaît
    // (sphère de culling NaN = jamais dans le frustum). On refuse donc d'écrire
    // un résultat empoisonné, et on nomme le coupable UNE fois.
    const fautif = premierNonFini(canonOut);
    if (fautif >= 0) {
      if (!signale.current) {
        signale.current = true;
        const actifs = Object.keys(poidsEffectifs).filter((n) => poidsEffectifs[n]);
        console.error(
          `[MorphedBody] morph non fini au sommet canonique ${Math.floor(fautif / 3)} — ` +
          `géométrie NON mise à jour. Morphs actifs : ${actifs.join(", ") || "(aucun)"}`,
        );
      }
      return;
    }

    // ── LE SQUELETTE SUIT LA MORPHOLOGIE ────────────────────────────────────
    //
    // Les morphs déplacent AUSSI les sommets des joint cubes : recalculer leur
    // centroïde fait bouger les os avec la peau. Sans ce bloc, un crâne rétréci
    // garde son os `head` en place et toute pièce qui s'y accroche — une
    // coiffure — reste suspendue dans le vide.
    //
    // Seuls les 53 os d'auteur ont un cube. Les 36 os Manny injectés ont une
    // translation locale NULLE : ils suivent leur parent par construction, donc
    // ne pas y toucher les fait suivre aussi.
    if (recette && travail.skeleton) {
      const locales = translationsLocales(positionsMonde(canonOut, recette), recette);
      for (const os of travail.skeleton.bones) {
        const t = locales.get(os.name);
        if (t) os.position.set(t[0], t[1], t[2]);
      }
      // Les matrices monde des os alimentent le skinning ET la position des
      // pièces greffées : les rafraîchir ici évite une frame de retard visible.
      travail.racine.updateMatrixWorld(true);
    }

    let bas = Infinity;
    for (const s of surfaces) {
      // Redistribution dans la copie PLATE, puis réinjection par `setXYZ` :
      // écrire dans `s.pos.array` corromprait normales et UV sur une géométrie
      // entrelacée, où le tampon est partagé entre les trois attributs.
      scatterToRender(canonOut, s.morphIndex, s.plat);
      for (let i = 0; i < s.pos.count; i++) {
        s.pos.setXYZ(i, s.plat[i * 3], s.plat[i * 3 + 1], s.plat[i * 3 + 2]);
      }
      s.pos.needsUpdate = true;
      // Sans recalcul, l'éclairage reste celui du corps neutre : la morphologie
      // change la silhouette mais ne se voit pas sur les volumes.
      s.geo.computeVertexNormals();
      s.geo.computeBoundingBox();
      s.geo.computeBoundingSphere();
      const y = s.geo.boundingBox?.min.y;
      if (y !== undefined && y < bas) bas = y;
    }

    // Le point le plus bas ramené à zéro. Déplacer la RACINE et non le mesh :
    // elle porte aussi la hiérarchie d'os, qui doit suivre — la transform d'un
    // nœud portant un mesh skinné est ignorée, celle de ses os ne l'est pas.
    if (groundAlign && Number.isFinite(bas)) travail.racine.position.y = -bas;

    onReady?.();
    // `onReady`/`onError` volontairement hors dépendances : ce sont des
    // notifications, pas des entrées du calcul. Les inclure relancerait la passe
    // de morph à chaque rendu de l'appelant.
    // `signatureWeights` remplace `weights` : cf. son commentaire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travail, sets, signatureWeights, groundAlign, recette]);

  // ── Teintes, à chaud ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!travail) return;
    for (const s of travail.surfaces) {
      s.materiau.color.set(s.estOeil ? eyeColor : skinColor);
    }
  }, [travail, skinColor, eyeColor]);

  useEffect(() => () => {
    // Géométries ET matériaux : ils sont créés par exemplaire (cf. `Surface`),
    // donc personne d'autre ne les tient.
    travail?.surfaces.forEach((s) => { s.geo.dispose(); s.materiau.dispose(); });
  }, [travail]);

  if (!travail) return null;

  // Aucune mise à l'échelle : `base_skinned.glb` est déjà en mètres, et son
  // squelette avec. Un `scale` ici décalerait le corps de ses os.
  //
  // La seule transform posée est le `position.y` d'alignement au sol, et elle
  // l'est sur `racine` — qui porte AUSSI les os, donc ils suivent. Le faire sur
  // le mesh seul n'aurait aucun effet visible : glTF ignore la transform du
  // nœud d'un mesh skinné.
  return (
    <>
      <primitive object={travail.racine} />
      {/* La coiffure est montée À CÔTÉ du corps, pas dedans : elle a sa propre
          géométrie et son propre matériau, et ne partage QUE le squelette. */}
      {hairPath && travail.skeleton && (
        <HairOnBody
          key={hairPath}
          path={hairPath}
          skeleton={travail.skeleton}
          color={hairColor}
          onIncompatible={(r) => console.warn(`[MorphedBody] coiffure écartée — ${r}`)}
        />
      )}
    </>
  );
}

useGLTF.preload(BODY_URL);
