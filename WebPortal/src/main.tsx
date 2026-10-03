import React from 'react'
import ReactDOM from 'react-dom/client'
import { useGLTF } from '@react-three/drei'
import { Cache as ThreeCache } from 'three'
import App from './App'
import { installKtx2Everywhere } from './rpg/loaders/installKtx2Everywhere'
import './rpg/styles/tokens.css'
import './index.css'
import './rpg/runtime/testing/testInputBridge' // API test agents

// ── Cache d'octets three.js (anti-rechargement) ──────────────────────────────
// Tous les loaders three (GLTFLoader, FBXLoader, TextureLoader…) partagent alors les
// fichiers déjà téléchargés EN MÉMOIRE : un GLB chargé au boot (BootLoadingScreen) n'est
// PAS re-téléchargé/relu par le préchargeur de map ni par useGLTF → re-chargements
// quasi instantanés. Les gros chunks de map sont PURGÉS de ce cache après parse
// (PuzzleMap) pour ne pas gonfler la RAM.
ThreeCache.enabled = true

// ── Configuration globale Draco (offline-safe) ───────────────────────────────
// Les decoders Draco sont servis depuis public/draco/ (copiés depuis
// node_modules/three/examples/jsm/libs/draco/gltf/). Avantage par rapport au
// CDN Google par défaut : marche en build Electron sans connexion Internet.
//
// Effet : tout GLB compressé Draco (via `gltf-pipeline -d`) se décompresse
// automatiquement à l'ouverture. Les GLB non-Draco fonctionnent toujours.
useGLTF.setDecoderPath('/draco/')

// ── KTX2 global (textures GPU compressées) ───────────────────────────────────
// Draco a une configuration globale (ci-dessus) ; KTX2 n'en a PAS chez drei — il
// faut passer un `extendLoader` à chaque `useGLTF`, ce que 37 appels sur 40
// oubliaient. On installe donc le transcodeur au niveau du PROTOTYPE de
// GLTFLoader : plus aucun call-site ne peut le rater. Détail dans le fichier.
installKtx2Everywhere()

// ── Silence d'un warning THREE bénin mais SPAMMANT ───────────────────────────
// "THREE.PropertyBinding: No target node found for track: <os>" : un clip Mixamo
// possède des pistes de DOIGTS (LeftHandRing/Pinky…) que certains mesh n'ont PAS
// (ex: boss mutant simplifiés sans phalanges). Le clip se lie quand même sur les os
// présents ; ces pistes orphelines ne font rien — mais THREE log un warning par piste
// à chaque binding → la console est NOYÉE (perçu comme un « chargement infini »).
// On filtre UNIQUEMENT ce message précis ; tout le reste passe normalement.
{
  const _warn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    const m = args[0];
    if (typeof m === "string" && m.startsWith("THREE.PropertyBinding: No target node found")) return;
    _warn(...args);
  };
}

// PAS de <React.StrictMode> : en dev il MONTE-DÉMONTE-REMONTE tout l'arbre — pour un jeu
// 3D ça signifie DEUX créations de contexte WebGL + DEUX passes de chargement de map à
// chaque entrée (le « THREE.WebGLRenderer: Context Lost » au boot venait du 1er canvas
// jeté par le remount, pas d'un vrai crash GPU) + double travail au boot. Le mode dev
// se comporte désormais comme la prod.
ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
