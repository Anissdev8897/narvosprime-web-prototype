// ══════════════════════════════════════════════════════════════════════════════
// runtime/MapBoundsPanel.tsx — panneau admin des LIMITES DE MAP.
//
// Ajouter, déplacer, ajuster et supprimer les murs invisibles d'une map, sans
// toucher au code. Trois façons de poser un mur, de la plus sûre à la plus fine :
//
//   1. « Cerner la map »  — MESURE l'emprise réelle (géométrie chargée + PNJ
//      placés) et pose un `keepIn` autour. C'est la réponse au problème d'origine :
//      une limite calculée ne peut pas laisser les PNJ dehors, contrairement à
//      une limite réglée à l'œil.
//   2. « Ici »            — pose un volume à la position du joueur, pour boucher
//      un trou précis qu'on vient de repérer en marchant dessus.
//   3. Les champs         — ajustement au chiffre près sur le mur sélectionné.
//
// Le rendu 3D est dans `MapBoundsGizmo` : ici on ne fait que l'UI de réglage.
// ══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import { mapBoundsStore, useMapBoundsVersion, type MapWall } from "./mapBoundsStore";
import { fitMapExtent, FIT_MARGIN } from "./mapBoundsFit";
import { collisionWorld } from "./CollisionWorld";
import { npcPlacementStore } from "../npc/npcPlacementStore";
import { mapSpawn } from "./mapConfig";

const BOITE = {
  position: "absolute" as const,
  right: 12,
  top: 96,
  width: 320,
  maxHeight: "70vh",
  overflowY: "auto" as const,
  background: "rgba(6,10,16,0.94)",
  border: "1px solid #1e3a5f",
  borderRadius: 8,
  padding: 12,
  color: "#cbd5e1",
  font: "12px/1.45 ui-monospace, monospace",
  pointerEvents: "auto" as const,
  zIndex: 60,
};

const BOUTON = {
  background: "#0f2038",
  border: "1px solid #2a4d7a",
  color: "#7dd3fc",
  borderRadius: 5,
  padding: "5px 8px",
  cursor: "pointer",
  font: "inherit",
};

/** Champ numérique compact — libellé à gauche, valeur éditable à droite. */
function Num({
  label, value, step = 1, onChange,
}: { label: string; value: number; step?: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
      <span style={{ width: 26, opacity: 0.7 }}>{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          // Un champ vidé donne NaN ; l'écrire dans le store produirait un mur
          // dont AUCUN test de collision ne peut plus rien dire (NaN <= x est
          // toujours faux) — donc un mur silencieusement inopérant.
          if (Number.isFinite(v)) onChange(v);
        }}
        style={{
          flex: 1, minWidth: 0, background: "#0a1420", border: "1px solid #1e3a5f",
          color: "#e2e8f0", borderRadius: 4, padding: "2px 5px", font: "inherit",
        }}
      />
    </label>
  );
}

export function MapBoundsPanel({
  mapId, playerPos, selectedId, onSelect, onClose,
}: {
  mapId: string;
  playerPos: MutableRefObject<THREE.Vector3>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  useMapBoundsVersion();
  const [info, setInfo] = useState<string>("");
  const walls = mapBoundsStore.walls(mapId);
  const sel = walls.find((w) => w.id === selectedId) ?? null;
  const bounds = mapBoundsStore.get(mapId);

  const maj = (patch: Partial<Omit<MapWall, "id">>) => {
    if (sel) mapBoundsStore.update(mapId, sel.id, patch);
  };

  /** Pose un `keepIn` mesuré sur le contenu réel de la map. */
  const cernerLaMap = () => {
    // Les PNJ placés entrent dans le calcul : c'est exactement ce qui manquait
    // à l'ancienne limite, qui les laissait au-delà du mur.
    const npcs = npcPlacementStore.list(mapId).map((n) => n.pos);
    const fit = fitMapExtent(collisionWorld.sceneRoot(), npcs, FIT_MARGIN);
    if (!fit) {
      setInfo("Rien à mesurer — la map n'est pas encore chargée.");
      return;
    }
    const w = mapBoundsStore.add(mapId, {
      label: "Limite de map (mesurée)",
      mode: "keepIn",
      center: fit.center,
      size: fit.size,
      yaw: 0,
      enabled: true,
    });
    onSelect(w.id);
    setInfo(
      `Mesuré sur ${fit.meshCount} meshes${fit.shellsSkipped ? ` (${fit.shellsSkipped} coque(s) écartée(s))` : ""}` +
      ` + ${npcs.length} PNJ · ${fit.size[0]}×${fit.size[2]} u.`,
    );
  };

  /** Pose un volume interdit là où se tient le joueur. */
  const murIci = () => {
    const p = playerPos.current;
    const w = mapBoundsStore.add(mapId, {
      label: `Mur ${walls.length + 1}`,
      mode: "block",
      center: [round2(p.x), round2(p.y), round2(p.z)],
      size: [10, 10, 2],
      yaw: 0,
      enabled: true,
    });
    onSelect(w.id);
    setInfo("Mur posé à ta position — ajuste taille et rotation ci-dessous.");
  };

  const replisFall = mapSpawn(mapId)[1] - 200;

  return (
    <div style={BOITE}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong style={{ color: "#7dd3fc" }}>Limites de map — {mapId}</strong>
        <button style={{ ...BOUTON, padding: "2px 7px" }} onClick={onClose}>✕</button>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <button style={{ ...BOUTON, flex: 1 }} onClick={cernerLaMap}>⬛ Cerner la map</button>
        <button style={{ ...BOUTON, flex: 1 }} onClick={murIci}>➕ Mur ici</button>
      </div>

      {info && (
        <div style={{ marginBottom: 8, padding: 6, background: "#0a1420", borderRadius: 4, color: "#94a3b8" }}>
          {info}
        </div>
      )}

      {/* ── Liste ────────────────────────────────────────────────────────── */}
      {walls.length === 0 ? (
        <div style={{ opacity: 0.6, marginBottom: 8 }}>
          Aucun mur — la map n'a aucune limite. Le joueur peut aller partout.
        </div>
      ) : (
        <div style={{ marginBottom: 8 }}>
          {walls.map((w) => (
            <div
              key={w.id}
              onClick={() => onSelect(w.id === selectedId ? null : w.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "4px 6px", cursor: "pointer",
                borderRadius: 4, marginBottom: 2,
                background: w.id === selectedId ? "#12263f" : "transparent",
                border: `1px solid ${w.id === selectedId ? "#2a4d7a" : "transparent"}`,
              }}
            >
              <span style={{ color: w.mode === "keepIn" ? "#4ade80" : "#ff4d4d" }}>
                {w.mode === "keepIn" ? "◻" : "◼"}
              </span>
              <span style={{ flex: 1, opacity: w.enabled ? 1 : 0.45 }}>{w.label}</span>
              <button
                style={{ ...BOUTON, padding: "1px 5px" }}
                onClick={(e) => { e.stopPropagation(); mapBoundsStore.update(mapId, w.id, { enabled: !w.enabled }); }}
                title={w.enabled ? "Désactiver (sans supprimer)" : "Réactiver"}
              >
                {w.enabled ? "on" : "off"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Édition du mur sélectionné ───────────────────────────────────── */}
      {sel && (
        <div style={{ borderTop: "1px solid #1e3a5f", paddingTop: 8 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <button
              style={{ ...BOUTON, flex: 1, borderColor: sel.mode === "keepIn" ? "#4ade80" : "#2a4d7a" }}
              onClick={() => maj({ mode: "keepIn" })}
              title="Volume AUTORISÉ : on ne peut pas en sortir"
            >◻ Limite</button>
            <button
              style={{ ...BOUTON, flex: 1, borderColor: sel.mode === "block" ? "#ff4d4d" : "#2a4d7a" }}
              onClick={() => maj({ mode: "block" })}
              title="Volume INTERDIT : on ne peut pas y entrer"
            >◼ Obstacle</button>
          </div>

          <div style={{ opacity: 0.7, marginBottom: 3 }}>Centre</div>
          <Num label="X" value={sel.center[0]} onChange={(v) => maj({ center: [v, sel.center[1], sel.center[2]] })} />
          <Num label="Y" value={sel.center[1]} onChange={(v) => maj({ center: [sel.center[0], v, sel.center[2]] })} />
          <Num label="Z" value={sel.center[2]} onChange={(v) => maj({ center: [sel.center[0], sel.center[1], v] })} />

          <div style={{ opacity: 0.7, margin: "6px 0 3px" }}>Taille (dimensions pleines)</div>
          <Num label="L" value={sel.size[0]} onChange={(v) => maj({ size: [Math.max(0.1, v), sel.size[1], sel.size[2]] })} />
          <Num label="H" value={sel.size[1]} onChange={(v) => maj({ size: [sel.size[0], Math.max(0.1, v), sel.size[2]] })} />
          <Num label="P" value={sel.size[2]} onChange={(v) => maj({ size: [sel.size[0], sel.size[1], Math.max(0.1, v)] })} />

          <div style={{ opacity: 0.7, margin: "6px 0 3px" }}>Rotation (degrés)</div>
          <Num
            label="↻"
            step={5}
            value={Math.round((sel.yaw * 180) / Math.PI)}
            onChange={(v) => maj({ yaw: (v * Math.PI) / 180 })}
          />

          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button
              style={{ ...BOUTON, flex: 1 }}
              onClick={() => {
                const p = playerPos.current;
                maj({ center: [round2(p.x), round2(p.y), round2(p.z)] });
              }}
              title="Recentre le mur sur ta position actuelle"
            >⌖ Sur moi</button>
            <button
              style={{ ...BOUTON, flex: 1, borderColor: "#7f1d1d", color: "#fca5a5" }}
              onClick={() => { mapBoundsStore.remove(mapId, sel.id); onSelect(null); }}
            >🗑 Supprimer</button>
          </div>
        </div>
      )}

      {/* ── Altitude de chute ────────────────────────────────────────────── */}
      <div style={{ borderTop: "1px solid #1e3a5f", marginTop: 8, paddingTop: 8 }}>
        <div style={{ opacity: 0.7, marginBottom: 3 }}>Altitude de chute</div>
        <div style={{ opacity: 0.55, marginBottom: 5 }}>
          Sous cette altitude et sans sol, le joueur est renvoyé au point d'apparition.
        </div>
        {bounds.fallY === null ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ flex: 1, opacity: 0.7 }}>auto ({round2(mapBoundsStore.fallFloor(mapId, replisFall))})</span>
            <button style={BOUTON} onClick={() => mapBoundsStore.setFallY(mapId, round2(mapBoundsStore.fallFloor(mapId, replisFall)))}>
              Régler
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1 }}>
              <Num label="Y" value={bounds.fallY} step={10} onChange={(v) => mapBoundsStore.setFallY(mapId, v)} />
            </div>
            <button style={BOUTON} onClick={() => mapBoundsStore.setFallY(mapId, null)}>Auto</button>
          </div>
        )}
      </div>
    </div>
  );
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
