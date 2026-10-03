// ══════════════════════════════════════════════════════════════════════════════
// runtime/debug/gameplayDebugger/Debug3DScene.tsx — Rendu 3D des debug draws
//
// Composant React à monter DANS le <Canvas> R3F.
// Consomme les DebugDrawCall produits par les catégories chaque frame et les
// affiche sous forme de lignes, sphères, et textes 3D (sprites / billboards).
// ══════════════════════════════════════════════════════════════════════════════

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { gameplayDebugger } from "./core";
import type { DebugDrawCall, DebugLineCall, DebugSphereCall, DebugTextCall } from "./core";

/** Matériau partagé pour les lignes de debug (évite d'en créer N). */
const LINE_MAT = new THREE.LineBasicMaterial({ depthTest: false, transparent: true, opacity: 0.8 });

/** Matériau partagé pour les sphères de debug. */
const SPHERE_MAT = new THREE.MeshBasicMaterial({
  wireframe: true,
  depthTest: false,
  transparent: true,
  opacity: 0.5,
});

/** Géo partagée pour les sphères (sphère unitaire, scale appliqué). */
const SPHERE_GEO = new THREE.SphereGeometry(1, 16, 12);

/**
 * Composant à monter DANS le <Canvas>.
 * Appelle gameplayDebugger.tick() chaque frame et dessine les draw calls 3D.
 */
export function Debug3DScene() {
  const lineRef = useRef<THREE.Group>(new THREE.Group());
  const sphereRef = useRef<THREE.Group>(new THREE.Group());
  const textRef = useRef<THREE.Group>(new THREE.Group());

  // Pool de sprites pour le texte (recyclage)
  const textSpritePool = useRef<THREE.Sprite[]>([]);
  const textIdx = useRef(0);

  // Canvas 2D offscreen pour générer les sprites textuels
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Géométrie partagée pour les lignes
  const lineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(6); // 2 points × 3 coords
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setDrawRange(0, 2);
    return geo;
  }, []);

  useFrame(() => {
    const g = gameplayDebugger;
    if (!g.visible) {
      lineRef.current.visible = false;
      sphereRef.current.visible = false;
      textRef.current.visible = false;
      return;
    }

    lineRef.current.visible = true;
    sphereRef.current.visible = true;
    textRef.current.visible = true;

    // Tick le debugger
    g.tick(0.016); // approximatif, le vrai dt est géré par les catégories

    // Récupère les draw calls
    const calls = g.flushDrawCalls();

    // Sépare par type
    const lines: DebugLineCall[] = [];
    const spheres: DebugSphereCall[] = [];
    const texts: DebugTextCall[] = [];

    for (const call of calls) {
      if (call.type === "line") lines.push(call);
      else if (call.type === "sphere") spheres.push(call);
      else if (call.type === "text") texts.push(call);
    }

    // ── Lignes ──────────────────────────────────────────────────────────
    const lineGroup = lineRef.current;
    while (lineGroup.children.length < lines.length) {
      const mesh = new THREE.Line(lineGeo.clone(), LINE_MAT.clone());
      lineGroup.add(mesh);
    }
    while (lineGroup.children.length > lines.length) {
      lineGroup.remove(lineGroup.children[lineGroup.children.length - 1]);
    }
    for (let i = 0; i < lines.length; i++) {
      const mesh = lineGroup.children[i] as THREE.Line;
      const l = lines[i];
      const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
      pos.array[0] = l.start.x;
      pos.array[1] = l.start.y;
      pos.array[2] = l.start.z;
      pos.array[3] = l.end.x;
      pos.array[4] = l.end.y;
      pos.array[5] = l.end.z;
      pos.needsUpdate = true;
      (mesh.material as THREE.LineBasicMaterial).color.setHex(l.color);
      mesh.visible = true;
    }

    // ── Sphères ─────────────────────────────────────────────────────────
    const sphereGroup = sphereRef.current;
    while (sphereGroup.children.length < spheres.length) {
      const mesh = new THREE.Mesh(SPHERE_GEO, SPHERE_MAT.clone());
      sphereGroup.add(mesh);
    }
    while (sphereGroup.children.length > spheres.length) {
      sphereGroup.remove(sphereGroup.children[sphereGroup.children.length - 1]);
    }
    for (let i = 0; i < spheres.length; i++) {
      const mesh = sphereGroup.children[i] as THREE.Mesh;
      const s = spheres[i];
      mesh.position.copy(s.center);
      mesh.scale.setScalar(s.radius);
      (mesh.material as THREE.MeshBasicMaterial).color.setHex(s.color);
      mesh.visible = true;
    }

    // ── Textes (sprites) ────────────────────────────────────────────────
    const textGroup = textRef.current;
    while (textGroup.children.length < texts.length) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ depthTest: false, transparent: true }),
      );
      textGroup.add(sprite);
    }
    while (textGroup.children.length > texts.length) {
      textGroup.remove(textGroup.children[textGroup.children.length - 1]);
    }
    for (let i = 0; i < texts.length; i++) {
      const sprite = textGroup.children[i] as THREE.Sprite;
      const t = texts[i];
      sprite.position.copy(t.position);
      (sprite.material as THREE.SpriteMaterial).color.setHex(t.color);

      // Génère la texture texte avec Canvas 2D
      const size = t.size ?? 0.4;
      sprite.scale.setScalar(size * 10); // ratio pour taille lisible
      sprite.material.map = makeTextTexture(t.text);
      sprite.material.needsUpdate = true;
      sprite.visible = true;
    }
  });

  return (
    <group>
      <primitive object={lineRef.current} />
      <primitive object={sphereRef.current} />
      <primitive object={textRef.current} />
    </group>
  );
}

/** Cache de textures textuelles (évite de recréer à chaque frame). */
const textTextureCache = new Map<string, THREE.CanvasTexture>();

function makeTextTexture(text: string): THREE.CanvasTexture {
  const cached = textTextureCache.get(text);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.font = "bold 32px Consolas, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "white";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 4;

  const maxWidth = 480;
  const measured = ctx.measureText(text);
  const scale = measured.width > maxWidth ? maxWidth / measured.width : 1;
  if (scale < 1) {
    ctx.font = `bold ${Math.round(32 * scale)}px Consolas, monospace`;
  }
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textureCacheCleanup();
  textTextureCache.set(text, texture);
  return texture;
}

/** Nettoie le cache si trop d'entrées (évite fuite mémoire). */
function textureCacheCleanup(): void {
  if (textTextureCache.size > 100) {
    const firstKey = textTextureCache.keys().next().value;
    if (firstKey !== undefined) {
      const tex = textTextureCache.get(firstKey);
      if (tex) tex.dispose();
      textTextureCache.delete(firstKey);
    }
  }
}

/**
 * Couche de texte de debug simplifiée (sans pool 3D).
 * Version alternative de Debug3DScene qui utilise un canvas 2D superposé
 * pour un rendu de texte plus net. Utile quand le texte 3D est trop flou.
 */
export function DebugTextLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useFrame(() => {
    const g = gameplayDebugger;
    if (!g.visible) return;

    const calls = g.flushDrawCalls();
    const textCalls = calls.filter((c): c is DebugTextCall => c.type === "text");

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Le rendu 2D superposé est géré par le parent qui projette les positions 3D
    // → voir GameplayDebuggerOverlay pour le rendu texte 2D
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 9998,
        pointerEvents: "none",
      }}
    />
  );
}
