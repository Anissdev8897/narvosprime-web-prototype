// npc/NpcAdminPanel.tsx — panneau admin PNJ (rouge, F9) : créer/configurer/placer/lister
// + PRÉCHARGEMENT (modèle + toutes les anims) au SELECT → placement sans freeze (pattern arme).
import { useEffect, type ReactNode } from "react";
import { useEditMode } from "../runtime/gameModeStore";
import { NPC_CATALOG, getNpc } from "./npcCatalog";
import { npcAdminStore } from "./npcAdminStore";
import { npcPlacementStore } from "./npcPlacementStore";
import { collisionWorld } from "../runtime/CollisionWorld";
import { useNpcAdmin } from "./useNpcAdmin";
import { useNpcPlacements } from "./useNpcPlacements";
import { preloadNpcAssets, isNpcWarmed, useNpcWarmVersion, npcAnimInfo } from "./preloadNpc";
import { DIFFICULTY_PRESETS, BOSS_STATS, MOB_STATS, type Difficulty } from "./npcStatPresets";
import { FACTIONS } from "../factions/factions";
import { CLASS_IDS, CLASSES } from "../classes/classes";
import type { FactionId } from "../runtime/core/worldTypes";
import type { ClassId } from "../types";

const RED = "#ff5555";

interface Props { open: boolean; onClose: () => void; currentMap: string; }

export function NpcAdminPanel({ open, onClose, currentMap }: Props) {
  const cfg = useNpcAdmin();
  const placed = useNpcPlacements(currentMap);
  useNpcWarmVersion(); // re-render quand le PNJ sélectionné devient préchauffé
  // PRÉCHARGEMENT au SELECT (panneau ouvert) : modèle + pack d'anim du PNJ choisi → quand on
  // le place, tout est en cache = pas de freeze (le pack creature_melee, 8 GLB, était le coût).
  useEffect(() => { if (open) preloadNpcAssets(cfg.folder); }, [open, cfg.folder]);
  if (!open) return null;

  const warmed = isNpcWarmed(cfg.folder);
  const anim = npcAnimInfo(cfg.folder);

  return (
    <div style={{
      position: "fixed", top: 60, right: 366, zIndex: 250, width: 320,
      background: "rgba(18, 8, 8, 0.94)", border: `1px solid ${RED}59`, borderRadius: 12, padding: 18,
      color: "#ffd6d6", fontFamily: "monospace", fontSize: 12,
      boxShadow: `0 0 36px ${RED}30, 0 0 80px rgba(0,0,0,0.6)`, backdropFilter: "blur(8px)",
      maxHeight: "82vh", overflowY: "auto",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${RED}33` }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.28em", color: RED, textTransform: "uppercase" }}>⚙ Éditeur PNJ · F9</div>
        <button onClick={onClose} style={{ background: "transparent", color: RED, border: `1px solid ${RED}55`, borderRadius: 6, padding: "2px 8px", fontSize: 10, cursor: "pointer", fontFamily: "monospace", fontWeight: 700 }}>✕</button>
      </div>

      {/* Archétype */}
      <Label>Archétype</Label>
      <select value={cfg.folder} onChange={(e) => npcAdminStore.set({ folder: e.target.value })}
        style={{ width: "100%", marginBottom: 10, padding: 5, background: "#1a0e0e", color: "#ffd6d6", border: `1px solid ${RED}40`, borderRadius: 5, fontFamily: "monospace", fontSize: 11 }}>
        {NPC_CATALOG.map((n) => <option key={n.folder} value={n.folder}>{n.label} ({n.role})</option>)}
      </select>
      {getNpc(cfg.folder)?.description && (
        <div style={{ fontSize: 10, color: "#c8a0a0", marginTop: -4, marginBottom: 8, fontStyle: "italic", lineHeight: 1.45 }}>
          {getNpc(cfg.folder)?.description}
        </div>
      )}

      {/* Préchargement + animations du PNJ — comme l'éditeur d'arme : tout prêt avant le placement */}
      <div style={{ marginBottom: 10, padding: 8, border: `1px solid ${RED}26`, borderRadius: 6, background: `${RED}0a` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10 }}>
          <span style={{ color: "#c8a0a0", letterSpacing: "0.08em" }}>PRÉCHARGEMENT</span>
          <span style={{ fontWeight: 800, color: warmed ? "#7ce0a0" : "#ffcf6b" }}>
            {warmed ? "✅ Prêt (placement sans freeze)" : "⏳ Chargement…"}
          </span>
        </div>
        <div style={{ fontSize: 9, color: "#a88", marginTop: 6 }}>Anims · <b style={{ color: "#ffd6d6" }}>{anim.source}</b></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4 }}>
          {anim.actions.map((a, i) => (
            <span key={`${a}-${i}`} style={{ fontSize: 8, padding: "1px 5px", borderRadius: 4, background: `${RED}1a`, color: "#ffbcbc", fontFamily: "monospace" }}>{a}</span>
          ))}
        </div>
      </div>

      {/* Niveau */}
      <Slider label="Niveau" value={cfg.level} min={1} max={50} step={1} fmt={(v) => String(v)} onChange={(v) => npcAdminStore.set({ level: Math.round(v) })} />

      {/* Difficulté */}
      <Label>Difficulté</Label>
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {(["facile", "difficile", "expert"] as Difficulty[]).map((d) => (
          <button key={d} onClick={() => npcAdminStore.set({ ...DIFFICULTY_PRESETS[d] })}
            style={{ flex: 1, padding: "5px 4px", fontSize: 9, fontWeight: 700, cursor: "pointer", background: `${RED}10`, color: "#ffb3b3", border: `1px solid ${RED}40`, borderRadius: 5, textTransform: "uppercase", fontFamily: "monospace" }}>{d}</button>
        ))}
      </div>

      {/* Curseurs de stats */}
      <Slider label="Taille"      value={cfg.scaleMult}  min={0.5} max={3}   step={0.05} fmt={(v) => `×${v.toFixed(2)}`} onChange={(v) => npcAdminStore.set({ scaleMult: v })} />
      <Slider label="Vie"         value={cfg.hpMult}     min={0.3} max={6}   step={0.1}  fmt={(v) => `×${v.toFixed(1)}`} onChange={(v) => npcAdminStore.set({ hpMult: v })} />
      <Slider label="Résistance"  value={cfg.resistMult} min={0}   max={0.9} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => npcAdminStore.set({ resistMult: v })} />

      {/* Boss (nouveau PNJ) */}
      <button onClick={() => npcAdminStore.set(cfg.rank === "boss" ? { rank: "mob", ...MOB_STATS } : { rank: "boss", ...BOSS_STATS })}
        style={{ width: "100%", marginTop: 4, marginBottom: 12, padding: "7px", fontSize: 11, fontWeight: 900, cursor: "pointer", background: cfg.rank === "boss" ? "#ffcf4d" : `${RED}10`, color: cfg.rank === "boss" ? "#1a1a00" : "#ffcf4d", border: "1px solid #ffcf4d66", borderRadius: 6, fontFamily: "monospace", textTransform: "uppercase" }}>
        👑 Boss : {cfg.rank === "boss" ? "ON" : "OFF"}
      </button>

      {/* Faction override */}
      <Label>Faction (override)</Label>
      <select value={cfg.factionOverride ?? ""}
        onChange={(e) => npcAdminStore.set({ factionOverride: (e.target.value || undefined) as FactionId | undefined })}
        style={{ width: "100%", marginBottom: 10, padding: 5, background: "#1a0e0e", color: "#ffd6d6", border: `1px solid ${RED}40`, borderRadius: 5, fontFamily: "monospace", fontSize: 11 }}>
        <option value="">— Catalogue (défaut)</option>
        {(Object.keys(FACTIONS) as FactionId[]).map((fid) => (
          <option key={fid} value={fid} style={{ color: FACTIONS[fid].color }}>{FACTIONS[fid].name}</option>
        ))}
      </select>

      {/* ClassId override (sorts) */}
      <Label>Classe / Sorts (override)</Label>
      <select value={cfg.classIdOverride ?? ""}
        onChange={(e) => npcAdminStore.set({ classIdOverride: e.target.value || undefined })}
        style={{ width: "100%", marginBottom: 10, padding: 5, background: "#1a0e0e", color: "#ffd6d6", border: `1px solid ${RED}40`, borderRadius: 5, fontFamily: "monospace", fontSize: 11 }}>
        <option value="">— Catalogue (défaut)</option>
        {CLASS_IDS.map((cid) => (
          <option key={cid} value={cid}>{CLASSES[cid].label} ({CLASSES[cid].element})</option>
        ))}
      </select>

      {/* AI behavior — aggroRange + attackRange */}
      <Label>Comportement IA</Label>
      <Slider label="Portée aggro" value={cfg.aggroRange ?? 25} min={5} max={60} step={1}
        fmt={(v) => `${v}m`}
        onChange={(v) => npcAdminStore.set({ aggroRange: v })} />
      <Slider label="Portée attaque" value={cfg.attackRange ?? 14} min={3} max={40} step={1}
        fmt={(v) => `${v}m`}
        onChange={(v) => npcAdminStore.set({ attackRange: v })} />
      <button onClick={() => npcAdminStore.set({ aggroRange: undefined, attackRange: undefined })}
        style={{ width: "100%", marginBottom: 12, padding: "5px", fontSize: 9, fontWeight: 700, cursor: "pointer",
          background: `${RED}0a`, color: "#ff9a9a", border: `1px solid ${RED}30`, borderRadius: 5, fontFamily: "monospace" }}>
        Réinitialiser IA (valeurs catalogue)
      </button>

      {/* Mode placement */}
      <button onClick={() => npcAdminStore.set({ placementActive: !cfg.placementActive, selectedId: null })}
        style={{ width: "100%", padding: "8px", fontSize: 11, fontWeight: 900, cursor: "pointer", background: cfg.placementActive ? RED : `${RED}18`, color: cfg.placementActive ? "#1a0000" : RED, border: `1px solid ${RED}`, borderRadius: 6, fontFamily: "monospace", textTransform: "uppercase" }}>
        🎯 {cfg.placementActive ? "Placement actif — clique dans la scène (re-clique pour arrêter)" : "Activer le placement"}
      </button>

      {/* Gizmo de transformation (PNJ sélectionné via ✥) */}
      {cfg.selectedId && (
        <div style={{ marginTop: 10, padding: 8, border: `1px solid ${RED}33`, borderRadius: 6, background: `${RED}0d` }}>
          <Label>Gizmo — PNJ sélectionné</Label>
          <div style={{ display: "flex", gap: 4 }}>
            {(["translate", "rotate"] as const).map((m) => (
              <button key={m} onClick={() => npcAdminStore.set({ gizmoMode: m })}
                style={{ flex: 1, padding: "5px 4px", fontSize: 10, fontWeight: 700, cursor: "pointer",
                  background: cfg.gizmoMode === m ? RED : `${RED}12`, color: cfg.gizmoMode === m ? "#1a0000" : "#ffb3b3",
                  border: `1px solid ${RED}40`, borderRadius: 5, fontFamily: "monospace" }}>
                {m === "translate" ? "✥ Déplacer" : "⟳ Tourner"}
              </button>
            ))}
            <button onClick={() => npcAdminStore.set({ selectedId: null })}
              style={{ padding: "5px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer", background: "transparent", color: "#ff9a9a", border: `1px solid ${RED}40`, borderRadius: 5, fontFamily: "monospace" }}>✕</button>
          </div>
        </div>
      )}

      {/* Liste des placés */}
      <div style={{ marginTop: 14, borderTop: `1px solid ${RED}22`, paddingTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <Label>PNJ placés ({placed.length})</Label>
          <div style={{ display: "flex", gap: 6 }}>
            {/* Rattrape les placements dont l'altitude avait été écrasée à 0 par
                l'ancien gizmo : recalcule le Y réel de chaque PNJ par raycast. */}
            {placed.length > 0 && (
              <button
                onClick={() => {
                  const n = npcPlacementStore.resnapToGround(currentMap, (x, z) =>
                    collisionWorld.getGroundY(x, z),
                  );
                  // eslint-disable-next-line no-alert
                  alert(n > 0 ? `${n} PNJ re-accroché(s) au sol.` : "Aucun PNJ à corriger (déjà au sol).");
                }}
                title="Recalcule l'altitude de tous les PNJ par raycast vers le sol"
                style={{ background: "transparent", color: "#8affb0", border: `1px solid ${RED}40`, borderRadius: 5, padding: "2px 6px", fontSize: 9, cursor: "pointer", fontFamily: "monospace" }}
              >⇩ Accrocher au sol</button>
            )}
            {placed.length > 0 && <button onClick={() => npcPlacementStore.clear(currentMap)} style={{ background: "transparent", color: "#ff8a8a", border: `1px solid ${RED}40`, borderRadius: 5, padding: "2px 6px", fontSize: 9, cursor: "pointer", fontFamily: "monospace" }}>Tout supprimer</button>}
          </div>
        </div>
        {placed.map((p) => {
          const label = getNpc(p.folder)?.label ?? p.folder;
          const sel = cfg.selectedId === p.id;
          return (
            <div key={p.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 4px", fontSize: 10, background: sel ? `${RED}1f` : "transparent", borderRadius: 5 }}>
                <span style={{ flex: 1, color: p.rank === "boss" ? "#ffcf4d" : "#ffd6d6" }}>
                  {p.rank === "boss" ? "👑 " : ""}{label} <span style={{ color: "#a07070" }}>Lvl {p.level}</span>
                  <span style={{ color: "#7fae7f" }}> ↻{p.respawnSec ?? (p.rank === "boss" ? 0 : 45)}s{(p.packSize ?? 1) > 1 ? ` ×${p.packSize}` : ""}</span>
                </span>
                <button title="Déplacer / tourner (gizmo)" onClick={() => npcAdminStore.set({ selectedId: sel ? null : p.id, placementActive: false })}
                  style={{ background: sel ? RED : "transparent", border: `1px solid ${RED}66`, color: sel ? "#1a0000" : RED, borderRadius: 5, padding: "1px 6px", fontSize: 11, cursor: "pointer" }}>✥</button>
                <button title="Boss" onClick={() => npcPlacementStore.update(currentMap, p.id, p.rank === "boss" ? { rank: "mob", ...MOB_STATS } : { rank: "boss", ...BOSS_STATS })}
                  style={{ background: "transparent", border: "1px solid #ffcf4d55", color: "#ffcf4d", borderRadius: 5, padding: "1px 6px", fontSize: 11, cursor: "pointer" }}>👑</button>
                <button title="Supprimer" onClick={() => npcPlacementStore.remove(currentMap, p.id)}
                  style={{ background: "transparent", border: `1px solid ${RED}55`, color: RED, borderRadius: 5, padding: "1px 7px", fontSize: 11, cursor: "pointer" }}>✕</button>
              </div>
              {sel && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 8px 6px", fontSize: 10, color: "#d8a8a8" }}>
                  <span title="Délai de réapparition après la mort (0 = jamais)">↻ Respawn (s)</span>
                  <input type="number" min={0} max={600} step={5} value={p.respawnSec ?? (p.rank === "boss" ? 0 : 45)}
                    onChange={(e) => npcPlacementStore.update(currentMap, p.id, { respawnSec: Math.max(0, Number(e.target.value) || 0) })}
                    style={{ width: 52, background: "#1a0d0d", color: "#ffd6d6", border: `1px solid ${RED}44`, borderRadius: 4, padding: "2px 4px", fontFamily: "monospace" }} />
                  <span title="Nombre de copies spawnées autour du point (1-5)">Meute</span>
                  <input type="number" min={1} max={5} step={1} value={p.packSize ?? 1}
                    onChange={(e) => npcPlacementStore.update(currentMap, p.id, { packSize: Math.min(5, Math.max(1, Number(e.target.value) || 1)) })}
                    style={{ width: 40, background: "#1a0d0d", color: "#ffd6d6", border: `1px solid ${RED}44`, borderRadius: 4, padding: "2px 4px", fontFamily: "monospace" }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 10, color: "#c88", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6, fontWeight: 700 }}>{children}</div>;
}

function Slider({ label, value, min, max, step, fmt, onChange }: {
  label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2 }}>
        <span style={{ color: "#ffd6d6" }}>{label}</span>
        <span style={{ color: "#ff8a8a", fontWeight: 900 }}>{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: RED, cursor: "pointer" }} />
    </div>
  );
}

// ── Bouton flottant ⚙ ROUGE (sous le cyan) ─────────────────────────────────
export function NpcAdminFloatingButton({ onClick }: { onClick: () => void }) {
  if (!useEditMode()) return null;
  return (
    <button onClick={onClick} title="Éditeur PNJ (F9)"
      style={{ position: "fixed", top: 110, right: 14, zIndex: 240, width: 42, height: 42, borderRadius: 21,
        background: "rgba(18, 8, 8, 0.85)", border: `2px solid ${RED}`, color: RED, fontSize: 20, fontWeight: 900,
        cursor: "pointer", boxShadow: `0 0 18px ${RED}73`, fontFamily: "monospace",
        display: "flex", alignItems: "center", justifyContent: "center" }}>⚙</button>
  );
}
