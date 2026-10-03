/**
 * Proto_combat/useCombatClips.ts — Chargement des clips du banc.
 *
 * UN fetch par chemin unique, puis un clip par job (`renameClip` pour les
 * actions, clip brut pour le reste). Même montage que `sandbox/SandboxCharacter`,
 * dont c'est la recette éprouvée : `GLTFLoader` + `configureGLTFLoader` (DRACO
 * + KTX2, workers) plutôt que `useGLTF`, parce qu'on charge une LISTE et qu'on
 * veut publier une seule fois, à la fin.
 *
 * Publication unique et non progressive : monter le personnage avec la moitié
 * de ses clips ferait apparaître une frame de T-pose — précisément le genre
 * d'artefact qu'un banc d'essai doit débusquer, pas produire.
 */
import { useEffect, useState } from "react";
import type * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { renameClip } from "../../src/rpg/animation/mixamoRetarget";
import { configureGLTFLoader } from "../../src/rpg/loaders/sharedLoaders";
import { CHEMINS_UNIQUES, TOUS_LES_JOBS } from "./combatClips";

const chargeur = new GLTFLoader();
configureGLTFLoader(chargeur);

export interface EtatClips {
  clips: THREE.AnimationClip[] | null;
  /** Fichiers chargés / total — le banc affiche la progression. */
  charges: number;
  total: number;
  /** Chemins en échec. Un échec est un VRAI signal : le test d'existence
   *  garantit le disque, donc c'est réseau, transcodage ou corruption. */
  echecs: string[];
}

export function useCombatClips(): EtatClips {
  const [etat, setEtat] = useState<EtatClips>({
    clips: null,
    charges: 0,
    total: CHEMINS_UNIQUES.length,
    echecs: [],
  });

  useEffect(() => {
    let annule = false;
    const parChemin = new Map<string, THREE.AnimationClip[]>();
    const echecs: string[] = [];
    let restants = CHEMINS_UNIQUES.length;
    let faits = 0;

    const assembler = () => {
      if (annule) return;
      const finaux: THREE.AnimationClip[] = [];
      for (const job of TOUS_LES_JOBS) {
        const anims = parChemin.get(job.path);
        if (!anims || anims.length === 0) continue;
        if (job.action) finaux.push(renameClip(anims[0], job.action));
        else finaux.push(...anims);
      }
      setEtat({ clips: finaux, charges: faits, total: CHEMINS_UNIQUES.length, echecs });
    };

    const avancer = () => {
      faits++;
      if (!annule) {
        setEtat((e) => (e.clips ? e : { ...e, charges: faits, echecs }));
      }
      if (--restants === 0) assembler();
    };

    for (const path of CHEMINS_UNIQUES) {
      chargeur.load(
        path,
        (gltf) => {
          if (annule) return;
          parChemin.set(path, gltf.animations);
          avancer();
        },
        undefined,
        () => {
          echecs.push(path);
          avancer();
        },
      );
    }

    return () => { annule = true; };
  }, []);

  return etat;
}
