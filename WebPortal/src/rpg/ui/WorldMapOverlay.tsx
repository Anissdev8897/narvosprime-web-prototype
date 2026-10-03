// ══════════════════════════════════════════════════════════════════════════════
// ui/WorldMapOverlay.tsx — Carte du monde plein ecran (Canvas 2D)
//
// Affiche un graphe hexagonal des zones jouables de NARVOS PRIME.
// Chaque noeud = une map du manifest. Le joueur voit sa position sur la map
// courante via un chevron pulsant cyan.
//
// Controles :
//   - Molette .............. Zoom (0.5x .. 4x)
//   - Clic-glisser ......... Panoramique
//   - Clic sur un noeud .... Affiche les details de la zone
//   - Echap / bouton X ..... Ferme l'overlay
//
// Rendu a 30 Hz (requestAnimationFrame + throttle) — pas de GPU, pas de R3F.
// ══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import {
  WORLD_MAP_NODES,
  ZONE_POIS,
  POI_COLORS,
  POI_LABELS,
  type MapNode,
  type PoiType,
} from "./worldMapData";
import styles from "./WorldMapOverlay.module.css";

// ── Types publics ────────────────────────────────────────────────────────────

interface WorldMapOverlayProps {
  /** Identifiant de la map ou se trouve le joueur (cle de MAPS). */
  currentMap: string;
  /** Position monde du joueur (x, z) — affichee sur le noeud courant. */
  playerPosition: { x: number; z: number };
  /** Callback de fermeture (bouton X ou Echap). */
  onClose: () => void;
  /** Callback de teleportation rapide (futur). */
  onTeleport?: (mapId: string) => void;
}

// ── Constantes de rendu ──────────────────────────────────────────────────────

/** Espacement grille (pixels canvas) entre les noeuds. */
const GRID_SPACING = 180;
/** Rayon de l'hexagone representant une zone. */
const HEX_RADIUS = 52;
/** Zoom min / max. */
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4.0;
/** Pas de zoom par cran de molette. */
const ZOOM_STEP = 0.15;
/** Intervalle de rendu cible (ms) — ~30 Hz. */
const FRAME_INTERVAL = 33;

// ── Utilitaires geometriques ─────────────────────────────────────────────────

/** Trace un hexagone regulier pointe-en-haut centré sur (cx, cy). */
function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Teste si le point (px, py) est a l'interieur de l'hexagone (cx, cy, r). */
function insideHex(px: number, py: number, cx: number, cy: number, r: number): boolean {
  const dx = Math.abs(px - cx);
  const dy = Math.abs(py - cy);
  // Approximation rectangle + coin tronque (suffisant pour le clic).
  return dx <= r * 0.866 && dy <= r && (dy + dx * 0.577) <= r;
}

// ── Composant principal ──────────────────────────────────────────────────────

export function WorldMapOverlay({
  currentMap,
  playerPosition,
  onClose,
  onTeleport,
}: WorldMapOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Etat camera (pan + zoom) ─────────────────────────────────────────────
  const cameraRef = useRef({ x: 0, y: 0, zoom: 1.0 });
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; camX: number; camY: number }>({
    active: false, startX: 0, startY: 0, camX: 0, camY: 0,
  });

  // ── Noeud selectionne pour le panneau de details ─────────────────────────
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  // Le zoom est stocke en ref pour le rendu, mais on expose une copie en state
  // pour afficher le niveau de zoom dans l'UI (re-render leger).
  const [zoomDisplay, setZoomDisplay] = useState(1.0);

  // ── Timestamp pour le pulse du joueur ────────────────────────────────────
  const timeRef = useRef(0);

  // ── Conversion grille → coordonnees canvas ───────────────────────────────
  const gridToCanvas = useCallback(
    (gx: number, gy: number): [number, number] => {
      const cam = cameraRef.current;
      const cv = canvasRef.current;
      if (!cv) return [0, 0];
      const cx = cv.width / 2 + (gx * GRID_SPACING + cam.x) * cam.zoom;
      const cy = cv.height / 2 + (gy * GRID_SPACING + cam.y) * cam.zoom;
      return [cx, cy];
    },
    [],
  );

  // ── Boucle de rendu ──────────────────────────────────────────────────────
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let lastFrame = 0;

    /** Redimensionne le canvas pour coller au conteneur (devicePixelRatio). */
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = cv.getBoundingClientRect();
      cv.width = rect.width * dpr;
      cv.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (timestamp: number) => {
      rafId = requestAnimationFrame(draw);
      if (timestamp - lastFrame < FRAME_INTERVAL) return;
      lastFrame = timestamp;
      timeRef.current = timestamp;

      const W = cv.getBoundingClientRect().width;
      const H = cv.getBoundingClientRect().height;
      ctx.clearRect(0, 0, W, H);

      const cam = cameraRef.current;
      const zoom = cam.zoom;
      const scaledR = HEX_RADIUS * zoom;

      // ── Fond : grille subtile ────────────────────────────────────────────
      drawGrid(ctx, W, H, cam);

      // ── Aretes (connexions entre maps) ───────────────────────────────────
      for (const node of WORLD_MAP_NODES) {
        const [ax, ay] = gridToCanvas(node.gridPos[0], node.gridPos[1]);
        for (const connId of node.connections) {
          const target = WORLD_MAP_NODES.find((n) => n.id === connId);
          if (!target || target.id < node.id) continue; // eviter le double trace
          const [bx, by] = gridToCanvas(target.gridPos[0], target.gridPos[1]);
          drawEdge(ctx, ax, ay, bx, by, timestamp);
        }
      }

      // ── Noeuds hexagonaux ────────────────────────────────────────────────
      for (const node of WORLD_MAP_NODES) {
        const [cx, cy] = gridToCanvas(node.gridPos[0], node.gridPos[1]);
        const isCurrent = node.id === currentMap;
        const isSelected = selectedNode?.id === node.id;
        drawHexNode(ctx, cx, cy, scaledR, node, isCurrent, isSelected, timestamp);
      }

      // ── POI sur chaque zone visible ──────────────────────────────────────
      for (const node of WORLD_MAP_NODES) {
        const pois = ZONE_POIS[node.id];
        if (!pois) continue;
        const [cx, cy] = gridToCanvas(node.gridPos[0], node.gridPos[1]);
        for (const poi of pois) {
          drawPoi(ctx, cx + poi.offset[0] * zoom, cy + poi.offset[1] * zoom, poi.type, zoom);
        }
      }

      // ── Joueur (chevron pulsant sur le noeud courant) ────────────────────
      const currentNode = WORLD_MAP_NODES.find((n) => n.id === currentMap);
      if (currentNode) {
        const [cx, cy] = gridToCanvas(currentNode.gridPos[0], currentNode.gridPos[1]);
        drawPlayer(ctx, cx, cy, timestamp);
      }
    };

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, [currentMap, selectedNode, gridToCanvas]);

  // ── Gestion des evenements clavier (Echap) ───────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [onClose]);

  // ── Gestion de la molette (zoom) ─────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
    const cam = cameraRef.current;
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    cam.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cam.zoom + delta));
    setZoomDisplay(Math.round(cam.zoom * 100) / 100);
  }, []);

  // ── Gestion du panoramique (clic-glisser) ────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    const cam = cameraRef.current;
    d.active = true;
    d.startX = e.clientX;
    d.startY = e.clientY;
    d.camX = cam.x;
    d.camY = cam.y;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.active) return;
    const cam = cameraRef.current;
    cam.x = d.camX + (e.clientX - d.startX) / cam.zoom;
    cam.y = d.camY + (e.clientY - d.startY) / cam.zoom;
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      const wasDrag = Math.abs(e.clientX - d.startX) > 4 || Math.abs(e.clientY - d.startY) > 4;
      d.active = false;

      // Clic simple (sans glisser) → detecter un noeud sous le curseur.
      if (!wasDrag) {
        const cv = canvasRef.current;
        if (!cv) return;
        const rect = cv.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const cam = cameraRef.current;
        const scaledR = HEX_RADIUS * cam.zoom;

        let hit: MapNode | null = null;
        for (const node of WORLD_MAP_NODES) {
          const [cx, cy] = gridToCanvas(node.gridPos[0], node.gridPos[1]);
          if (insideHex(mx, my, cx, cy, scaledR)) {
            hit = node;
            break;
          }
        }
        setSelectedNode(hit);
      }
    },
    [gridToCanvas],
  );

  // ── Boutons zoom +/- ─────────────────────────────────────────────────────
  const handleZoomIn = useCallback(() => {
    const cam = cameraRef.current;
    cam.zoom = Math.min(ZOOM_MAX, cam.zoom + ZOOM_STEP);
    setZoomDisplay(Math.round(cam.zoom * 100) / 100);
  }, []);

  const handleZoomOut = useCallback(() => {
    const cam = cameraRef.current;
    cam.zoom = Math.max(ZOOM_MIN, cam.zoom - ZOOM_STEP);
    setZoomDisplay(Math.round(cam.zoom * 100) / 100);
  }, []);

  // ── Rendu JSX ────────────────────────────────────────────────────────────
  return (
    <div className={styles.overlay}>
      {/* En-tete */}
      <div className={styles.header}>
        <span className={styles.title}>Carte du Monde</span>
        <span className={styles.headerHint}>Molette = zoom ・ Glisser = deplacer</span>
        <button type="button" className={styles.closeBtn} onClick={onClose}>
          ✕ Fermer
        </button>
      </div>

      {/* Canvas + couches d'UI superposees */}
      <div className={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />

        {/* Legende (bas-gauche) */}
        <div className={styles.legend}>
          <span className={styles.legendTitle}>Legende</span>
          {(Object.keys(POI_COLORS) as PoiType[]).map((type) => (
            <span key={type} className={styles.legendItem}>
              {type === "portal" ? (
                <span className={styles.legendDiamond} style={{ background: POI_COLORS[type] }} />
              ) : type === "spawn" ? (
                <span className={styles.legendTriangle} style={{ color: POI_COLORS[type] }} />
              ) : (
                <span className={styles.legendDot} style={{ background: POI_COLORS[type] }} />
              )}
              {POI_LABELS[type]}
            </span>
          ))}
          <span className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: "#38bdf8", boxShadow: "0 0 6px #38bdf8" }} />
            Vous etes ici
          </span>
        </div>

        {/* Panneau d'info de zone (droite) */}
        {selectedNode && (
          <div className={styles.mapInfo} key={selectedNode.id}>
            <div className={styles.mapInfoTitle} style={{ color: selectedNode.color }}>
              {selectedNode.icon} {selectedNode.label}
            </div>
            <div className={styles.mapInfoLevel} style={{ color: selectedNode.color }}>
              Niv. {selectedNode.levelRange}
            </div>
            <div className={styles.mapInfoDesc}>{selectedNode.description}</div>
            {selectedNode.id === currentMap && (
              <span className={styles.mapInfoCurrent}>Position actuelle</span>
            )}
            {onTeleport && selectedNode.id !== currentMap && (
              <button
                type="button"
                className={styles.teleportBtn}
                onClick={() => onTeleport(selectedNode.id)}
              >
                Teleportation rapide
              </button>
            )}
          </div>
        )}

        {/* Controles de zoom (bas-droite) */}
        <div className={styles.zoomControls}>
          <button type="button" className={styles.zoomBtn} onClick={handleZoomIn}>+</button>
          <span className={styles.zoomLevel}>{zoomDisplay.toFixed(1)}x</span>
          <button type="button" className={styles.zoomBtn} onClick={handleZoomOut}>-</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Fonctions de dessin Canvas 2D (appelees depuis la boucle draw)
// ══════════════════════════════════════════════════════════════════════════════

/** Grille de fond subtile pour donner de la profondeur. */
function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, cam: { x: number; y: number; zoom: number }): void {
  const spacing = 40 * cam.zoom;
  if (spacing < 8) return; // trop zoome-out pour etre visible
  const ox = ((w / 2 + cam.x * cam.zoom) % spacing + spacing) % spacing;
  const oy = ((h / 2 + cam.y * cam.zoom) % spacing + spacing) % spacing;

  ctx.strokeStyle = "rgba(56, 189, 248, 0.04)";
  ctx.lineWidth = 0.5;
  for (let x = ox; x < w; x += spacing) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = oy; y < h; y += spacing) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
}

/** Arete entre deux noeuds — trait pointille avec lueur cyan. */
function drawEdge(
  ctx: CanvasRenderingContext2D,
  ax: number, ay: number,
  bx: number, by: number,
  _t: number,
): void {
  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = "rgba(56, 189, 248, 0.18)";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/** Noeud hexagonal — fond, bordure, label, icone. */
function drawHexNode(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  node: MapNode,
  isCurrent: boolean,
  isSelected: boolean,
  t: number,
): void {
  // Lueur externe pour le noeud courant (pulse).
  if (isCurrent) {
    const pulse = 0.35 + 0.2 * Math.sin(t * 0.003);
    ctx.save();
    hexPath(ctx, cx, cy, r + 8);
    ctx.strokeStyle = `rgba(56, 189, 248, ${pulse})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = "#38bdf8";
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.restore();
  }

  // Fond de l'hexagone.
  hexPath(ctx, cx, cy, r);
  const grad = ctx.createRadialGradient(cx, cy - r * 0.3, 0, cx, cy, r);
  grad.addColorStop(0, isSelected ? "rgba(30, 40, 60, 0.95)" : "rgba(10, 16, 28, 0.88)");
  grad.addColorStop(1, "rgba(4, 6, 12, 0.95)");
  ctx.fillStyle = grad;
  ctx.fill();

  // Bordure.
  hexPath(ctx, cx, cy, r);
  ctx.strokeStyle = isSelected
    ? node.color
    : isCurrent
      ? "rgba(56, 189, 248, 0.6)"
      : "rgba(56, 189, 248, 0.2)";
  ctx.lineWidth = isSelected ? 2 : 1.2;
  ctx.stroke();

  // Icone (centree, au-dessus du label).
  ctx.fillStyle = node.color;
  ctx.font = `${Math.round(r * 0.38)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(node.icon, cx, cy - r * 0.18);

  // Label.
  ctx.fillStyle = isCurrent ? "#e8ecf6" : "#9ca3af";
  ctx.font = `600 ${Math.round(r * 0.2)}px "Chakra Petch", system-ui, sans-serif`;
  ctx.fillText(node.label, cx, cy + r * 0.24);

  // Niveau.
  ctx.fillStyle = "rgba(155, 184, 204, 0.55)";
  ctx.font = `${Math.round(r * 0.15)}px "Inter", system-ui, sans-serif`;
  ctx.fillText(`Niv. ${node.levelRange}`, cx, cy + r * 0.48);
}

/** Point d'interet — forme dependante du type. */
function drawPoi(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  type: PoiType,
  zoom: number,
): void {
  const s = Math.max(2.5, 4 * zoom);
  const color = POI_COLORS[type];
  ctx.fillStyle = color;

  switch (type) {
    case "npc": {
      // Cercle bleu.
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "merchant": {
      // Cercle or legerement plus grand.
      ctx.beginPath();
      ctx.arc(x, y, s * 1.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "portal": {
      // Losange violet.
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.restore();
      break;
    }
    case "spawn": {
      // Triangle vert (pointe vers le haut).
      ctx.beginPath();
      ctx.moveTo(x, y - s * 1.3);
      ctx.lineTo(x + s, y + s * 0.7);
      ctx.lineTo(x - s, y + s * 0.7);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
}

/** Joueur — chevron cyan pulsant sur le noeud courant. */
function drawPlayer(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number): void {
  const pulse = 0.7 + 0.3 * Math.sin(t * 0.005);
  const size = 8;

  ctx.save();
  ctx.translate(cx, cy);

  // Halo pulsant.
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(56, 189, 248, ${0.1 * pulse})`;
  ctx.fill();

  // Chevron / fleche (pointe vers le haut = Nord).
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.65, size * 0.5);
  ctx.lineTo(0, size * 0.15);
  ctx.lineTo(-size * 0.65, size * 0.5);
  ctx.closePath();
  ctx.fillStyle = `rgba(56, 189, 248, ${pulse})`;
  ctx.fill();
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}
