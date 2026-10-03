/**
 * Proto_combat/CombatPrototypeSandbox.tsx — Banc d'essai de combat.
 *
 * Scène vide : un plan, un ciel, une lumière, UN personnage, UN mannequin.
 * Zéro dépendance au jeu (pas de map, pas de streaming, pas de HUD, pas de PNJ).
 *
 * RÉPARTITION — c'est elle qui compte, pas ce fichier :
 *   `combat/combatMachine.ts`  = TOUTE la règle, en TS pur, testée sans DOM.
 *   ce fichier                 = coquille : entrées clavier, clips, affichage.
 * Pattern « logique pure / coquille impure » du projet (cf. runtime/movement/).
 * Une règle de combat écrite ICI serait intestable et non promouvable.
 *
 * http://127.0.0.1:3005/Prototype/Proto_combat/
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Sky, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";

import { RendererRegistrar } from "../../src/rpg/loaders/RendererRegistrar";
import { AnimationController } from "../../src/rpg/animation/AnimationController";
import { setBuiltinWeaponVisible } from "../../src/rpg/characters/builtinWeaponMask";
import { collisionWorld } from "../../src/rpg/runtime/CollisionWorld";
import type { ActionId } from "../../src/rpg/types";

import { HAUTEUR_CIBLE, PERSONNAGE } from "./combatClips";
import { useCombatClips } from "./useCombatClips";
import { CombatPanel, type InstantaneCombat } from "./CombatPanel";
import {
  COMBO_MAINS_NUES,
  REGLAGES_DEFAUT,
  type AttackDef,
  type AttackId,
} from "./combat/combatCatalog";
import { CombatMachine, type CombatEvent } from "./combat/combatMachine";

const GROUND_SIZE = 200;

/** Distance joueur → mannequin. Sous la portée d'un jab (1,6 m) : tout connecte. */
const DISTANCE_MANNEQUIN = 1.4;
const PV_MANNEQUIN = 120;

// ── Sol ──────────────────────────────────────────────────────────────────────

function GroundWithCollision() {
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    const m = meshRef.current;
    if (m) collisionWorld.add(m);
    return () => { if (m) collisionWorld.remove(m); };
  }, []);

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
      <meshStandardMaterial color="#2a2a3e" roughness={0.9} />
    </mesh>
  );
}

// ── Mannequin d'entraînement ─────────────────────────────────────────────────

/** Capsule inerte. Elle encaisse, elle clignote, elle ne décide rien. */
function Mannequin({ flashRef }: { flashRef: React.MutableRefObject<number> }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((_, dt) => {
    if (!matRef.current) return;
    flashRef.current = Math.max(0, flashRef.current - dt * 3);
    matRef.current.emissiveIntensity = flashRef.current;
  });

  return (
    <group position={[0, 0, -DISTANCE_MANNEQUIN]}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <capsuleGeometry args={[0.32, 0.9, 8, 16]} />
        <meshStandardMaterial ref={matRef} color="#3d4668" emissive="#ff5d5d" emissiveIntensity={0} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.34, 0.4, 32]} />
        <meshBasicMaterial color="#ff7a7a" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

/** Cercle de portée du coup en cours — rend la portée LISIBLE au lieu d'abstraite. */
function CerclePortee({ porteeRef }: { porteeRef: React.MutableRefObject<number> }) {
  const g = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((_, dt) => {
    if (!g.current || !mat.current) return;
    const r = porteeRef.current;
    g.current.visible = r > 0;
    g.current.scale.setScalar(Math.max(0.001, r));
    mat.current.opacity = Math.max(0, mat.current.opacity - dt * 1.6);
    if (mat.current.opacity <= 0) porteeRef.current = 0;
  });

  return (
    <group ref={g} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <mesh>
        <ringGeometry args={[0.97, 1, 48]} />
        <meshBasicMaterial ref={mat} color="#ffd166" transparent opacity={0} />
      </mesh>
    </group>
  );
}

// ── Personnage ───────────────────────────────────────────────────────────────

interface PersonnageProps {
  /**
   * Clips déjà chargés. Ils arrivent en PROP et ne sont pas chargés ici :
   * R3F ne monte le sous-arbre du `<Canvas>` qu'une fois celui-ci mesuré, donc
   * un chargeur placé dans ce composant ne démarre pas tant que la scène n'est
   * pas visible. Mesuré : zéro requête GLB, liste de clips vide, aucune erreur.
   * Les clips sont de la DONNÉE — leur place est au-dessus du Canvas.
   */
  clips: THREE.AnimationClip[] | null;
  /** Reçoit le contrôleur dès qu'il existe — le clavier et le panneau en ont besoin. */
  onControleur: (ctrl: AnimationController | null) => void;
  /** Appelé une fois par frame, APRÈS l'avance du mixer. */
  onFrame: (nowMs: number) => void;
}

function PrototypeCharacter({ clips, onControleur, onFrame }: PersonnageProps) {
  const group = useRef<THREE.Group>(null);
  const ctrl = useRef<AnimationController | null>(null);
  const { scene } = useGLTF(PERSONNAGE);

  // Montage identique au jeu : clone → ombres → matériaux clonés → bbox →
  // échelle normalisée. `groundY` pose les pieds à y = 0 : le pivot d'un GLB
  // Paragon n'est pas sous la semelle.
  const { object, echelle, groundY } = useMemo(() => {
    const c = SkeletonUtils.clone(scene);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      if (Array.isArray(m.material)) m.material = m.material.map((x) => x.clone());
      else if (m.material) m.material = (m.material as THREE.Material).clone();
    });
    c.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(c);
    const h = Math.max(0.001, box.max.y - box.min.y);
    const s = HAUTEUR_CIBLE / h;
    return { object: c, echelle: s, groundY: -box.min.y * s };
  }, [scene]);

  // Arme intégrée (canon Paragon, 18 614 tris) masquée — comme en jeu.
  useEffect(() => { setBuiltinWeaponVisible(object, false); }, [object]);

  useEffect(() => {
    if (!group.current || !clips || clips.length === 0) return;
    // `remapToRig` (et PAS `avatarKey`) : adapte les pistes aux os RÉELS du rig
    // — même sécurité qu'en jeu — sans écrire dans `animClipStore`, qui
    // appartient au jeu. Sans lui, aucune piste ne se lie et c'est la T-pose.
    const c = new AnimationController(group.current, clips, {
      initial: "idle",
      remapToRig: true,
    });
    ctrl.current = c;
    onControleur(c);
    return () => {
      onControleur(null);
      c.dispose();
      ctrl.current = null;
    };
  }, [clips, onControleur]);

  useFrame((_, dt) => {
    ctrl.current?.update(dt);
    onFrame(performance.now());
  });

  return (
    <group ref={group}>
      {/* Pas de clips, pas de rendu : une frame de T-pose ne doit jamais
          apparaître — c'est l'artefact que le banc doit débusquer, pas produire. */}
      {clips && <primitive object={object} scale={echelle} position={[0, groundY, 0]} />}
    </group>
  );
}

// ── Scène + pilotage ─────────────────────────────────────────────────────────

export function CombatPrototypeSandbox() {
  const [catalogue, setCatalogue] = useState<Record<AttackId, AttackDef>>({ ...COMBO_MAINS_NUES });
  const [clipJoue, setClipJoue] = useState<string | null>(null);
  const [fonduSec, setFonduSec] = useState(0.15);
  const [journal, setJournal] = useState<string[]>([]);
  const [instantane, setInstantane] = useState<InstantaneCombat>(INSTANTANE_VIDE);

  // Chargement HORS Canvas (cf. PersonnageProps.clips).
  const { clips, charges, total, echecs } = useCombatClips();
  const nomsClips = useMemo(
    () => (clips ?? []).map((c) => c.name).sort((a, b) => a.localeCompare(b)),
    [clips],
  );

  const ctrlRef = useRef<AnimationController | null>(null);
  const pvRef = useRef(PV_MANNEQUIN);
  const flashRef = useRef(0);
  const porteeRef = useRef(0);
  const publicationRef = useRef(0);

  // ── La machine : créée UNE fois, jamais recréée par un rendu React ──────────
  //
  // Les réglages sont un objet muté EN PLACE (convention `gameSettings`) : le
  // panneau écrit dedans, la machine relit à chaque frame. Recréer la machine à
  // chaque réglage remettrait le combo et l'endurance à zéro en plein essai —
  // exactement ce qu'un banc d'essai ne doit pas faire.
  const reglages = useMemo(() => ({ ...REGLAGES_DEFAUT }), []);
  const evenementRef = useRef<(ev: CombatEvent) => void>(() => {});
  const machine = useMemo(
    () => new CombatMachine({ reglages, onEvent: (ev) => evenementRef.current(ev) }),
    [reglages],
  );

  useEffect(() => { machine.remplacerCatalogue(catalogue); }, [machine, catalogue]);

  const tracer = useCallback((ligne: string) => {
    setJournal((j) => [ligne, ...j].slice(0, 40));
  }, []);

  // Traduction événement → scène. Passée par REF et non au constructeur : le
  // gestionnaire dépend de `fonduSec` (donc change à chaque réglage) alors que
  // la machine, elle, ne doit jamais être recréée — sinon un coup de curseur
  // remet le combo et l'endurance à zéro en plein essai.
  const surEvenement = useCallback((ev: CombatEvent) => {
    const ctrl = ctrlRef.current;
    switch (ev.type) {
      case "anim":
        ctrl?.play(ev.action as ActionId, fonduSec);
        setClipJoue(null); // le combat reprend la main sur la lecture manuelle
        break;

      case "impact": {
        porteeRef.current = ev.portee;
        // Le seul « moteur de collision » du banc : une distance. Une vraie
        // hitbox n'apprendrait rien de plus sur le TIMING, qui est le sujet.
        if (DISTANCE_MANNEQUIN <= ev.portee) {
          pvRef.current = Math.max(0, pvRef.current - ev.degats);
          flashRef.current = 1.4;
          tracer(`💥 ${ev.attaque} touche · -${ev.degats} PV`);
        } else {
          tracer(`· ${ev.attaque} dans le vide (portée ${ev.portee} m < ${DISTANCE_MANNEQUIN} m)`);
        }
        break;
      }

      case "fenetre":
        tracer(ev.ouverte ? `▸ fenêtre OUVERTE (${ev.attaque})` : `◂ fenêtre fermée`);
        break;
      case "refus":
        tracer(`⨯ refusé — ${ev.raison}`);
        break;
      case "combo_reset":
        tracer(`↺ combo ${ev.raison}`);
        break;
      case "encaisse":
        tracer(`${ev.bloque ? "🛡" : "✖"} coup ${ev.direction} · ${Math.round(ev.degats)} dégâts`);
        break;
      case "garde":
        tracer(ev.active ? "🛡 garde levée" : "garde baissée");
        break;
      case "garde_brisee":
        tracer("‼ GARDE BRISÉE");
        break;
      case "charge":
        tracer(
          ev.etat === "debut" ? "⟳ charge…"
          : ev.etat === "prete" ? "⟳ charge PRÊTE"
          : ev.etat === "relachee" ? "⇥ charge relâchée"
          : "⟳ charge perdue",
        );
        break;
    }
  }, [fonduSec, tracer]);

  useEffect(() => { evenementRef.current = surEvenement; }, [surEvenement]);

  // ── Clavier ────────────────────────────────────────────────────────────────
  const machineRef = useRef(machine);
  machineRef.current = machine;

  useEffect(() => {
    const bas = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const m = machineRef.current;
      const now = performance.now();
      switch (e.code) {
        // §8 : la touche d'attaque a un APPUI et un RELÂCHEMENT. La durée entre
        // les deux choisit la variante — un `pressAttack` sur le keydown seul
        // rendrait l'attaque chargée injouable.
        case "KeyA": m.chargeCommencee(now); break;
        case "KeyE": m.setGarde(true); break;
        case "KeyH": m.recevoirCoup(now, { degats: 12, angleRad: 0 }); break;
        case "KeyB": m.recevoirCoup(now, { degats: 12, angleRad: Math.PI }); break;
        case "KeyR": reinitialiser(); break;
      }
    };
    const haut = (e: KeyboardEvent) => {
      const m = machineRef.current;
      if (e.code === "KeyE") m.setGarde(false);
      if (e.code === "KeyA") m.chargeRelachee(performance.now());
    };
    // Le panneau est du DOM par-dessus le canvas : un clic sur un curseur ne
    // doit pas déclencher une attaque.
    const surPanneau = (e: MouseEvent) =>
      Boolean((e.target as HTMLElement).closest("aside,button,input,select"));
    const clicBas = (e: MouseEvent) => {
      if (e.button !== 0 || surPanneau(e)) return;
      machineRef.current.chargeCommencee(performance.now());
    };
    const clicHaut = (e: MouseEvent) => {
      if (e.button !== 0) return;
      machineRef.current.chargeRelachee(performance.now());
    };
    window.addEventListener("keydown", bas);
    window.addEventListener("keyup", haut);
    window.addEventListener("mousedown", clicBas);
    window.addEventListener("mouseup", clicHaut);
    return () => {
      window.removeEventListener("keydown", bas);
      window.removeEventListener("keyup", haut);
      window.removeEventListener("mousedown", clicBas);
      window.removeEventListener("mouseup", clicHaut);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Boucle ─────────────────────────────────────────────────────────────────

  const surFrame = useCallback((nowMs: number) => {
    machineRef.current.update(nowMs);
    // Publication à ~15 Hz : un `setState` par frame re-rendrait le panneau 60
    // fois par seconde pour des chiffres illisibles à cette vitesse.
    if (nowMs - publicationRef.current < 66) return;
    publicationRef.current = nowMs;
    const m = machineRef.current;
    setInstantane({
      phase: m.phase,
      attaque: m.attaqueCourante,
      rang: m.rang,
      fenetre: m.enFenetre,
      tampon: m.tamponArme(nowMs),
      endurance: m.enduranceCourante,
      avancementMs: m.avancementMs(nowMs),
      enCharge: m.enCharge,
      chargePrete: m.chargePreteMaintenant,
      chargeMs: m.chargeTenueMs(nowMs),
      pvMannequin: pvRef.current,
      pvMax: PV_MANNEQUIN,
      chargesClips: chargesRef.current.charges,
      totalClips: chargesRef.current.total,
      echecsClips: chargesRef.current.echecs,
    });
  }, []);

  // La progression change hors frame ; une ref évite de recréer `surFrame`
  // (donc de re-souscrire la boucle) à chaque fichier chargé.
  const chargesRef = useRef({ charges, total, echecs });
  chargesRef.current = { charges, total, echecs };
  useEffect(() => {
    setInstantane((s) => ({ ...s, chargesClips: charges, totalClips: total, echecsClips: echecs }));
  }, [charges, total, echecs]);

  const surControleur = useCallback((ctrl: AnimationController | null) => {
    ctrlRef.current = ctrl;
  }, []);

  const jouerClip = useCallback((nom: string) => {
    const clip = clips?.find((c) => c.name === nom);
    if (!clip) return;
    // `playEmote` accepte un CLIP arbitraire, là où `play()` n'accepte qu'un
    // `ActionId` du catalogue. C'est ce qui permet de parcourir les 61 clips du
    // rig sans rien ajouter à `CLIP_CANDIDATES` (étape 2 du brief).
    ctrlRef.current?.playEmote(clip, true, fonduSec);
    setClipJoue(nom);
  }, [clips, fonduSec]);

  const arreterClip = useCallback(() => {
    ctrlRef.current?.cancelEmote(fonduSec);
    setClipJoue(null);
  }, [fonduSec]);

  const reinitialiser = useCallback(() => {
    pvRef.current = PV_MANNEQUIN;
    setJournal([]);
    setCatalogue({ ...COMBO_MAINS_NUES });
    Object.assign(reglages, REGLAGES_DEFAUT);
  }, [reglages]);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0a0a14", position: "relative" }}>
      <Canvas shadows camera={{ position: [3.2, 2.1, 3.4], fov: 50 }} gl={{ preserveDrawingBuffer: true }}>
        <RendererRegistrar />

        <Sky sunPosition={[100, 50, 100]} turbidity={8} rayleigh={3} />
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[50, 40, 30]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={50}
          shadow-camera-bottom={-50}
        />

        <GroundWithCollision />
        <CerclePortee porteeRef={porteeRef} />
        <Mannequin flashRef={flashRef} />

        <Suspense fallback={null}>
          <PrototypeCharacter clips={clips} onControleur={surControleur} onFrame={surFrame} />
        </Suspense>

        <OrbitControls
          enableDamping
          dampingFactor={0.1}
          target={[0, 0.9, -DISTANCE_MANNEQUIN / 2]}
          minDistance={1.5}
          maxDistance={60}
          minPolarAngle={0.1}
          maxPolarAngle={Math.PI / 2.1}
        />

        <gridHelper args={[GROUND_SIZE, GROUND_SIZE / 2, "#334155", "#1e293b"]} />
      </Canvas>

      <CombatPanel
        instantane={instantane}
        reglages={reglages}
        catalogue={catalogue}
        onCatalogue={setCatalogue}
        clips={nomsClips}
        clipJoue={clipJoue}
        onJouerClip={jouerClip}
        onArreterClip={arreterClip}
        fonduSec={fonduSec}
        onFondu={setFonduSec}
        journal={journal}
        onReinitialiser={reinitialiser}
      />
    </div>
  );
}

const INSTANTANE_VIDE: InstantaneCombat = {
  phase: "neutre",
  attaque: null,
  rang: 0,
  fenetre: false,
  tampon: false,
  endurance: REGLAGES_DEFAUT.enduranceMax,
  avancementMs: -1,
  enCharge: false,
  chargePrete: false,
  chargeMs: -1,
  pvMannequin: PV_MANNEQUIN,
  pvMax: PV_MANNEQUIN,
  chargesClips: 0,
  totalClips: 0,
  echecsClips: [],
};
