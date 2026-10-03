// characters/ForgeEquipements.tsx — BIBLIOTHÈQUE D'ÉQUIPEMENTS (no-code, admin).
//
// Enregistre des pièces (casque/cape/arme/accessoire) : GLB + socket + offset tuné une
// fois, avec aperçu 3D sur le Sorcier. Réutilisables dans Forge Personnages.
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage } from "@react-three/drei";
import * as THREE from "three";
import { HumanCharacter } from "./HumanCharacter";
import { createPlayerState } from "../runtime/movement/playerState";
import type { CharacterConfig } from "../types";
import { customEquipmentStore, useEquipmentLib, type EquipCategory, type EquipmentItem } from "./customEquipmentStore";
import type { CharAttachment } from "./BoneAttachment";
import type { SocketName } from "../weapons/weaponTypes";
import { scanAssets, scanEquipment, EQUIPMENT_ROOT, type AssetEntry } from "../forge/assetScanner";

import { FORGE } from "../forge/forgeTheme";
import { RendererRegistrar } from "../loaders/RendererRegistrar";
const ACCENT = FORGE.accent;
const SOCKETS: SocketName[] = ["Head", "Spine", "RightHand", "LeftHand"];
const SOCKET_LABEL: Record<SocketName, string> = { Head: "🪖 Tête", Spine: "🧥 Dos", RightHand: "✋ Main D.", LeftHand: "🤚 Main G." };
const CATS: { id: EquipCategory; label: string }[] = [
  { id: "casque", label: "🪖 Casque" }, { id: "cape", label: "🧥 Cape" }, { id: "arme", label: "⚔️ Arme" }, { id: "accessoire", label: "✨ Accessoire" },
];

const PREVIEW_CONFIG: CharacterConfig = { gender: "male", classId: "warrior_bruiser", outfitStyle: "Ranger", parts: {}, skinColor: "#e0ac69", tint: "#ffffff", modelId: "wraith" };

function Preview({ attach }: { attach: CharAttachment | null }) {
  const pos = useRef(new THREE.Vector3(0, 0, 0));
  const cam = useRef(createPlayerState());
  return (
    <Suspense fallback={null}>
      <HumanCharacter config={PREVIEW_CONFIG} playerPosition={pos} cameraState={cam} attachments={attach ? [attach] : []} />
    </Suspense>
  );
}

const toAttach = (it: EquipmentItem): CharAttachment => ({ id: it.id, socket: it.socket, path: it.path, offsetPos: it.offsetPos, offsetRot: it.offsetRot, scale: it.scale });

export function ForgeEquipements({ onExit }: { onExit: () => void }) {
  const lib = useEquipmentLib();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [models, setModels] = useState<AssetEntry[]>([]);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newCat, setNewCat] = useState<EquipCategory>("casque");
  const [allModels, setAllModels] = useState(false); // false = dossier équipement seul

  // Dossier ÉQUIPEMENT dédié par défaut (assets_character/equipe) ; option : tout le catalogue.
  useEffect(() => {
    if (allModels) scanAssets().then((c) => setModels(c.flatMap((x) => x.assets))).catch(() => {});
    else scanEquipment().then(setModels).catch(() => {});
  }, [allModels]);
  const editing = editingId ? customEquipmentStore.get(editingId) : null;
  const upd = (p: Partial<Omit<EquipmentItem, "id">>) => editing && customEquipmentStore.save(editing.id, p);
  const filtered = useMemo(() => { const q = search.toLowerCase(); return models.filter((m) => !q || m.label.toLowerCase().includes(q)).slice(0, 120); }, [models, search]);

  // ── Liste + création ──────────────────────────────────────────────────
  if (!editing) {
    return (
      <div style={{ position: "fixed", inset: 0, background: FORGE.bg, color: FORGE.text, fontFamily: FORGE.mono, padding: 28, overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${ACCENT}44`, paddingBottom: 14, marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "0.28em", color: FORGE.text, textShadow: `0 0 16px ${FORGE.accentDim}` }}>BIBLIOTHÈQUE <span style={{ color: ACCENT }}>D'ÉQUIPEMENTS</span></div>
          <button onClick={onExit} style={btn(FORGE.textDim, "transparent")}>← Quitter</button>
        </div>
        <div style={{ background: FORGE.panel, border: `1px solid ${ACCENT}33`, borderRadius: 4, padding: 14, marginBottom: 20, maxWidth: 560 }}>
          <div style={{ fontSize: 11, color: FORGE.textDim, marginBottom: 8 }}>Nouvelle pièce : nom + catégorie, puis choisis un modèle.</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom (ex: Heaume de fer)" style={inp()} />
            <select value={newCat} onChange={(e) => setNewCat(e.target.value as EquipCategory)} style={{ ...inp(), flex: "0 0 130px" }}>
              {CATS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          {/* Source des modèles : dossier équipement dédié (défaut) ou tout le catalogue. */}
          <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
            <button onClick={() => setAllModels(false)} style={srcBtn(!allModels)}>Dossier équipement</button>
            <button onClick={() => setAllModels(true)} style={srcBtn(allModels)}>Tout le catalogue</button>
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 modèle…" style={{ ...inp(), marginBottom: 8 }} />
          <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
            {!allModels && models.length === 0 && (
              <div style={{ fontSize: 10, color: FORGE.textFaint, lineHeight: 1.5, padding: "4px 0" }}>
                Dossier vide. Dépose des GLB/FBX/OBJ dans<br /><code style={{ color: ACCENT }}>{EQUIPMENT_ROOT.replace('/models', 'public/models')}</code><br />
                puis relance le jeu (conversion + index auto). Ou passe sur « Tout le catalogue ».
              </div>
            )}
            {filtered.map((m) => (
              <button key={m.id} disabled={!newName.trim()} onClick={() => { const it = customEquipmentStore.create(newName, m.path, newCat); setNewName(""); setEditingId(it.id); }}
                style={{ textAlign: "left", padding: "4px 8px", fontSize: 11, background: "transparent", color: newName.trim() ? FORGE.text : FORGE.textFaint, border: `1px solid ${ACCENT}22`, borderRadius: 3, cursor: newName.trim() ? "pointer" : "default", fontFamily: FORGE.mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                ＋ {m.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
          {lib.length === 0 && <div style={{ color: FORGE.textFaint }}>Bibliothèque vide.</div>}
          {lib.map((it) => (
            <div key={it.id} style={{ background: FORGE.panel, border: `1px solid ${ACCENT}33`, borderRadius: 4, padding: 14 }}>
              <div style={{ fontWeight: 800 }}>{CATS.find((c) => c.id === it.category)?.label.split(" ")[0]} {it.name}</div>
              <div style={{ fontSize: 11, color: FORGE.textDim }}>{SOCKET_LABEL[it.socket]} · ×{it.scale.toFixed(2)}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button onClick={() => setEditingId(it.id)} style={{ ...btn(ACCENT, "transparent"), padding: "5px 10px" }}>Régler</button>
                <button onClick={() => customEquipmentStore.remove(it.id)} style={{ ...btn(FORGE.danger, "transparent"), width: "auto", padding: "5px 8px" }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Éditeur d'une pièce ───────────────────────────────────────────────
  const attach = toAttach(editing);
  return (
    <div style={{ position: "fixed", inset: 0, background: FORGE.bg, color: FORGE.text, fontFamily: FORGE.mono, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 18px", borderBottom: `1px solid ${ACCENT}44` }}>
        <div style={{ fontWeight: 900, color: ACCENT, letterSpacing: "0.15em" }}>{editing.name}</div>
        <button onClick={() => setEditingId(null)} style={{ ...btn(FORGE.textDim, "transparent"), width: "auto" }}>← Liste</button>
      </div>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Canvas shadows camera={{ position: [0, 1.4, 3], fov: 45 }} dpr={[1, 2]}>
            <RendererRegistrar />
            <Suspense fallback={null}>
              <Stage intensity={0.6} environment="city" shadows={false} adjustCamera={false}>
                <Preview attach={attach} />
              </Stage>
            </Suspense>
            <OrbitControls target={[0, 1, 0]} enablePan={false} minDistance={1.5} maxDistance={6} />
          </Canvas>
          <div style={{ position: "absolute", bottom: 8, left: 12, fontSize: 10, color: FORGE.textFaint }}>Réglé sur le Sorcier — l'offset vaut pour tous les corps (os identiques)</div>
        </div>
        <div style={{ width: 300, borderLeft: `1px solid ${ACCENT}33`, overflowY: "auto", padding: 14 }}>
          <Row label="Nom"><input value={editing.name} onChange={(e) => upd({ name: e.target.value })} style={inp()} /></Row>
          <Row label="Catégorie">
            <select value={editing.category} onChange={(e) => upd({ category: e.target.value as EquipCategory })} style={inp()}>
              {CATS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Row>
          <Row label="Socket">
            <select value={editing.socket} onChange={(e) => upd({ socket: e.target.value as SocketName })} style={inp()}>
              {SOCKETS.map((s) => <option key={s} value={s}>{SOCKET_LABEL[s]}</option>)}
            </select>
          </Row>
          <Row label="Pos X/Y/Z">
            {[0, 1, 2].map((i) => (
              <input key={i} type="number" step={0.01} value={editing.offsetPos[i]}
                onChange={(e) => { const p = [...editing.offsetPos] as [number, number, number]; p[i] = +e.target.value || 0; upd({ offsetPos: p }); }}
                style={{ ...inp(), width: 50 }} />
            ))}
          </Row>
          <Row label={`Échelle ${editing.scale.toFixed(2)}`}>
            <input type="range" min={0.05} max={3} step={0.05} value={editing.scale} onChange={(e) => upd({ scale: +e.target.value })} style={{ flex: 1 }} />
          </Row>
          {(["x", "y", "z"] as const).map((ax, i) => (
            <Row key={ax} label={`Rot ${ax.toUpperCase()}°`}>
              <input type="range" min={0} max={360} step={5} value={Math.round(editing.offsetRot[i] * 180 / Math.PI)}
                onChange={(e) => { const r = [...editing.offsetRot] as [number, number, number]; r[i] = +e.target.value * Math.PI / 180; upd({ offsetRot: r }); }} style={{ flex: 1 }} />
            </Row>
          ))}
          <div style={{ fontSize: 10, color: FORGE.textFaint, marginTop: 12, lineHeight: 1.5 }}>
            Enregistré en continu. Disponible dans Forge Personnages → onglet Bibliothèque (offset pré-réglé).
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><span style={{ width: 84, fontSize: 10, color: FORGE.textDim }}>{label}</span>{children}</div>;
}
function inp(): React.CSSProperties { return { flex: 1, background: FORGE.bg, color: FORGE.text, border: `1px solid ${ACCENT}44`, borderRadius: 3, padding: "5px 7px", fontFamily: FORGE.mono, fontSize: 12 }; }
function btn(color: string, bg: string): React.CSSProperties { return { width: "100%", padding: "8px 14px", fontSize: 11, fontWeight: 900, cursor: "pointer", background: bg, color, border: `1px solid ${color}66`, borderRadius: 3, fontFamily: FORGE.mono, textTransform: "uppercase" }; }
function srcBtn(active: boolean): React.CSSProperties { return { padding: "4px 10px", fontSize: 10, cursor: "pointer", fontFamily: FORGE.mono, borderRadius: 3, background: active ? FORGE.accentFaint : "transparent", color: active ? ACCENT : FORGE.textDim, border: `1px solid ${active ? ACCENT : FORGE.accentDim}` }; }
