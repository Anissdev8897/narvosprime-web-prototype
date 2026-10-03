// mapgen/MapGenPanel.tsx — GÉNÉRATEUR DE CARTES (panneau admin, F6).
//
// Flux : régler seed/densités → « Générer (aperçu) » → marqueurs 3D temps réel + rapport
// de VALIDATION → « Appliquer » écrit dans les stores existants (PNJ + récolte) avec le
// flag gen=true → persistance/édition/respawn immédiats. « Supprimer le généré » nettoie.
import { type ReactNode } from "react";
import { useEditMode } from "../runtime/gameModeStore";
import { mapGenStore, useMapGen } from "./mapGenStore";
import { generateMap, validateGeneration, type MapGenConfig } from "./mapGenerator";
import { getNpcsByRole } from "../npc/npcCatalog";
import { npcPlacementStore } from "../npc/npcPlacementStore";
import { harvestNodeStore } from "../professions/harvestNodeStore";

const CYAN = "#36d3c2";

interface Props { open: boolean; onClose: () => void; currentMap: string; }

function fullConfig(cfg: ReturnType<typeof mapGenStore.get>["config"]): MapGenConfig {
  return { ...cfg, enemyFolders: getNpcsByRole("enemy").map((d) => d.folder) };
}

export function MapGenPanel({ open, onClose, currentMap }: Props) {
  const s = useMapGen();
  const isEdit = useEditMode();
  // TOUS les hooks AVANT le moindre retour anticipé. `!open || !useEditMode()`
  // court-circuitait : panneau fermé → `useEditMode()` jamais appelé, panneau
  // ouvert → appelé. Le nombre de hooks changeait entre deux rendus et React
  // levait « Rendered more hooks than during the previous render », que
  // GameErrorBoundary rattrapait en DÉTRUISANT tout le monde de jeu.
  if (!open || !isEdit) return null;
  const cfg = s.config;

  const doGenerate = () => {
    const full = fullConfig(cfg);
    const result = generateMap(full);
    const validation = validateGeneration(result, full);
    mapGenStore.set({ preview: result, validation });
  };

  const doApply = () => {
    if (!s.preview || !s.validation?.ok) return;
    for (const m of s.preview.monsters) {
      npcPlacementStore.add(currentMap, {
        folder: m.folder, pos: [m.x, cfg.spawnY, m.z], level: m.level, rank: "mob",
        scaleMult: 1, hpMult: 1, resistMult: 0,
        respawnSec: m.respawnSec, packSize: m.packSize, gen: true,
      });
    }
    for (const r of s.preview.resources) {
      harvestNodeStore.add(currentMap, { pos: [r.x, cfg.spawnY, r.z], profession: r.profession, gen: true });
    }
    mapGenStore.clearPreview();
  };

  const doClearGenerated = () => {
    const n1 = npcPlacementStore.removeGenerated(currentMap);
    const n2 = harvestNodeStore.removeGenerated(currentMap);
    // eslint-disable-next-line no-console
    console.info(`[MapGen] supprimé : ${n1} PNJ + ${n2} ressources générés`);
  };

  return (
    <div style={{
      position: "fixed", top: 60, left: 16, zIndex: 250, width: 300, maxHeight: "84vh", overflowY: "auto",
      background: "rgba(4,18,16,0.95)", border: `1px solid ${CYAN}55`, borderRadius: 12, padding: 16,
      color: "#d8fff8", fontFamily: "monospace", fontSize: 12, boxShadow: `0 0 30px ${CYAN}22`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.18em", color: CYAN }}>🌍 GÉNÉRATEUR DE CARTE · F6</div>
        <button onClick={onClose} style={{ background: "transparent", color: CYAN, border: `1px solid ${CYAN}55`, borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>✕</button>
      </div>
      <div style={{ fontSize: 10, color: "#8fc9c0", marginBottom: 10 }}>
        Map : <b style={{ color: CYAN }}>{currentMap}</b> — peuple la map (biomes / monstres / ressources / POI).
        Même seed = même monde.
      </div>

      <Row label="Seed">
        <input type="number" value={cfg.seed} onChange={(e) => mapGenStore.setConfig({ seed: Number(e.target.value) || 0 })} style={num()} />
        <button onClick={() => mapGenStore.setConfig({ seed: Math.floor(Math.random() * 1e9) })} style={mini()}>🎲</button>
      </Row>
      <Row label={`Monstres (${cfg.monsterPoints})`}>
        <input type="range" min={0} max={80} value={cfg.monsterPoints} onChange={(e) => mapGenStore.setConfig({ monsterPoints: +e.target.value })} style={{ flex: 1 }} />
      </Row>
      <Row label={`Meute max (${cfg.maxPack})`}>
        <input type="range" min={1} max={5} value={cfg.maxPack} onChange={(e) => mapGenStore.setConfig({ maxPack: +e.target.value })} style={{ flex: 1 }} />
      </Row>
      <Row label={`Ressources (${cfg.resources})`}>
        <input type="range" min={0} max={60} value={cfg.resources} onChange={(e) => mapGenStore.setConfig({ resources: +e.target.value })} style={{ flex: 1 }} />
      </Row>
      <Row label={`POI (${cfg.pois})`}>
        <input type="range" min={0} max={10} value={cfg.pois} onChange={(e) => mapGenStore.setConfig({ pois: +e.target.value })} style={{ flex: 1 }} />
      </Row>
      <Row label="Niveaux">
        <input type="number" value={cfg.levelRange[0]} onChange={(e) => mapGenStore.setConfig({ levelRange: [Math.max(1, +e.target.value || 1), cfg.levelRange[1]] })} style={num()} />
        <span style={{ color: "#8fc9c0" }}>→</span>
        <input type="number" value={cfg.levelRange[1]} onChange={(e) => mapGenStore.setConfig({ levelRange: [cfg.levelRange[0], Math.min(50, +e.target.value || 1)] })} style={num()} />
      </Row>
      <Row label={`Rayon sûr (${cfg.safeRadius} m)`}>
        <input type="range" min={5} max={80} value={cfg.safeRadius} onChange={(e) => mapGenStore.setConfig({ safeRadius: +e.target.value })} style={{ flex: 1 }} />
      </Row>
      <Row label="Bornes ±">
        <input type="number" value={cfg.bounds.maxX}
          onChange={(e) => { const v = Math.max(30, +e.target.value || 30); mapGenStore.setConfig({ bounds: { minX: -v, maxX: v, minZ: -v, maxZ: v } }); }}
          style={num()} />
        <span style={{ fontSize: 10, color: "#8fc9c0" }}>m autour du hub</span>
      </Row>

      <button onClick={doGenerate} style={btn(CYAN, "#04211c")}>⚙ Générer (aperçu)</button>

      {s.validation && (
        <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, border: `1px solid ${s.validation.ok ? "#5dca5d55" : "#ff6a6a55"}`, background: s.validation.ok ? "#10240f66" : "#2a0f0f66" }}>
          <div style={{ fontWeight: 800, color: s.validation.ok ? "#8aff8a" : "#ff8a8a", marginBottom: 4 }}>
            {s.validation.ok ? "✓ Validation OK" : "✗ Validation ÉCHOUÉE"}
            {s.preview && <span style={{ color: "#8fc9c0", fontWeight: 400 }}> — {s.preview.monsters.length} monstres · {s.preview.resources.length} ressources · {s.preview.pois.length} POI</span>}
          </div>
          {s.validation.errors.slice(0, 4).map((e, i) => <div key={i} style={{ color: "#ff9a9a", fontSize: 10 }}>• {e}</div>)}
          {s.validation.warnings.slice(0, 3).map((w, i) => <div key={i} style={{ color: "#ffd27a", fontSize: 10 }}>⚠ {w}</div>)}
        </div>
      )}

      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={doApply} disabled={!s.preview || !s.validation?.ok}
          style={{ ...btn("#8aff8a", "#0a2008"), opacity: s.preview && s.validation?.ok ? 1 : 0.4, flex: 1 }}>
          ✔ Appliquer
        </button>
        <button onClick={() => mapGenStore.clearPreview()} disabled={!s.preview}
          style={{ ...btn("#ffd27a", "#241a06"), opacity: s.preview ? 1 : 0.4, flex: 1 }}>
          Annuler
        </button>
      </div>
      <button onClick={doClearGenerated} style={{ ...btn("#ff8a8a", "#240808"), marginTop: 6 }}>
        🗑 Supprimer le contenu généré de cette map
      </button>
      <div style={{ fontSize: 9, color: "#6fa39b", marginTop: 8, lineHeight: 1.4 }}>
        Le contenu appliqué est ÉDITABLE avec les éditeurs existants (F9 PNJ, F11 récolte) et
        persiste (base + local). Les monstres générés respawnent (45 s).
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <span style={{ width: 110, fontSize: 10, color: "#9fd9d0" }}>{label}</span>
      {children}
    </div>
  );
}
function num(): React.CSSProperties {
  return { width: 64, background: "#06201c", color: "#d8fff8", border: `1px solid ${CYAN}44`, borderRadius: 4, padding: "2px 4px", fontFamily: "monospace" };
}
function mini(): React.CSSProperties {
  return { background: "transparent", border: `1px solid ${CYAN}44`, color: CYAN, borderRadius: 4, cursor: "pointer", padding: "2px 6px" };
}
function btn(color: string, bg: string): React.CSSProperties {
  return { width: "100%", padding: "8px", fontSize: 11, fontWeight: 900, cursor: "pointer", background: bg, color, border: `1px solid ${color}66`, borderRadius: 6, fontFamily: "monospace", textTransform: "uppercase" };
}
