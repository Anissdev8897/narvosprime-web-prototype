// components/forge/ForgeMapScreen.tsx — MODE FORGE MAP (atelier de création de cartes).
//
// Mode SÉPARÉ du jeu, réservé aux ADMINS (gate dans App). Permet de :
//   • voir toutes les maps (manifest + customs) avec leur état (jouable / à construire) ;
//   • ENREGISTRER une nouvelle map (GLB unique ou dossier de chunks — pipeline Blender du
//     README de public/models/Maps) → visible par tout le moteur ;
//   • LIER les maps entre elles : créer un PORTAIL sur une map hôte vers une map cible
//     (donjon → portail → planète, planètes entre elles…) ;
//   • TESTER une map en entrant dedans en jeu.
import { useEffect, useState } from "react";
import { MAPS } from "../../rpg/loaders/assetManifest";
import { customMapStore, useCustomMaps, customChunkPaths } from "../../rpg/world/customMapStore";
import { forgeSceneStore } from "../../rpg/forge/forgeSceneStore";
import { portalStore } from "../../rpg/runtime/donjon/portalStore";
import { hydrateAllStores } from "../../rpg/runtime/loading/hydrateAll";

import { FORGE } from "../../rpg/forge/forgeTheme";
const ACCENT = FORGE.accent;

interface Props {
  username: string;
  onExit: () => void;
  /** Absent = bouton masqué. Idem `onOpenChars` : l'éditeur de monde est passé
   *  en prototype (Prototype/Proto_editeur). */
  onOpenEditor?: () => void;
  /** Absent = bouton masqué. Le créateur de personnage est passé en prototype
   *  (Prototype/Proto_charactere), qui n'est servi qu'en dev : en production le
   *  lien serait mort, donc l'entrée disparaît au lieu de mener nulle part. */
  onOpenChars?: () => void;
  onOpenEquip: () => void;
  onTestMap: (mapId: string) => void;
}

type MapStatus = "vérification…" | "jouable" | "à construire";

export function ForgeMapScreen({ username, onExit, onOpenEditor, onOpenChars, onOpenEquip, onTestMap }: Props) {
  const customMaps = useCustomMaps(); // re-render + dep de re-probe quand le registre change
  const [status, setStatus] = useState<Record<string, MapStatus>>({});
  const [form, setForm] = useState({ id: "", label: "", kind: "chunks" as "glb" | "chunks", path: "", count: 4, notes: "" });
  const [formMsg, setFormMsg] = useState<string | null>(null);
  const [link, setLink] = useState({ host: "orbital", target: "", label: "Portail", x: 0, z: 10 });
  const [linkMsg, setLinkMsg] = useState<string | null>(null);

  // Hydrate (maps custom + portails) puis vérifie la JOUABILITÉ de chaque map (HEAD sur
  // le 1er fichier : chunk_01 si chunké, sinon le GLB unique).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await hydrateAllStores();
      const ids = Object.keys(MAPS);
      for (const id of ids) {
        if (cancelled) return;
        const def = MAPS[id];
        // Map d'ÉDITEUR (editor://) : environnement vide JOUABLE immédiatement (aucun
        // fichier à vérifier — les modèles sont ajoutés dans l'éditeur 3D).
        if (def.path.startsWith("editor://")) {
          if (!cancelled) setStatus((s) => ({ ...s, [id]: "jouable" }));
          continue;
        }
        const probe = def.chunks?.[0] ?? def.path;
        setStatus((s) => ({ ...s, [id]: "vérification…" }));
        try {
          const r = await fetch(probe, { method: "HEAD" });
          const ct = r.headers.get("content-type") ?? "";
          // Le dev-server renvoie l'index.html (SPA fallback) pour un fichier absent.
          const ok = r.ok && !ct.includes("text/html");
          if (!cancelled) setStatus((s) => ({ ...s, [id]: ok ? "jouable" : "à construire" }));
        } catch {
          if (!cancelled) setStatus((s) => ({ ...s, [id]: "à construire" }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [customMaps]); // re-probe à chaque changement du registre custom (FIX : dep réelle)

  const allIds = Object.keys(MAPS);
  const customIds = new Set(customMaps.map((m) => m.id));

  // Crée une CARTE VIDE (éditeur) : scène vierge nommée → enregistrée jouable → on entre
  // dans l'éditeur 3D pour y déposer des modèles. Pas de chunks, pas de fichiers Blender.
  const createEmptyMap = () => {
    const label = (form.label || form.id || "Nouvelle carte").trim();
    const scene = forgeSceneStore.create(label);
    const res = customMapStore.add({ id: scene.id, label, kind: "editor", sceneId: scene.id, notes: form.notes });
    if (!res.ok) { setFormMsg(`⚠ ${res.error}`); return; }
    setForm({ id: "", label: "", kind: form.kind, path: "", count: 4, notes: "" });
    // L'éditeur est passé en prototype : absent des builds de production. Sans
    // lui, la scène vient d'être créée et RIEN ne s'ouvre — on le DIT plutôt
    // que de laisser un clic sans effet, qui se lit comme un bug.
    if (!onOpenEditor) {
      setFormMsg(`✔ Scène « ${label} » créée. L'éditeur 3D n'est pas disponible dans cette build.`);
      return;
    }
    onOpenEditor(); // → éditeur 3D (liste des scènes, la nouvelle y est)
  };

  const submitMap = () => {
    setFormMsg(null);
    if (!form.id.trim() || !form.label.trim() || !form.path.trim()) {
      setFormMsg("⚠ id, label et chemin requis"); return;
    }
    const base = form.path.startsWith("/") ? form.path : `/models/Maps/${form.path}`;
    const res = customMapStore.add({
      id: form.id, label: form.label, kind: form.kind, notes: form.notes,
      ...(form.kind === "glb" ? { glbPath: base.endsWith(".glb") ? base : `${base}.glb` }
        : { chunkDir: base.replace(/\/$/, ""), chunkCount: Math.max(1, form.count) }),
    });
    if (!res.ok) { setFormMsg(`⚠ ${res.error}`); return; }
    setFormMsg(`✓ Map « ${form.label} » enregistrée — dépose les fichiers puis vérifie son état.`);
    setForm({ id: "", label: "", kind: form.kind, path: "", count: 4, notes: "" });
  };

  const submitLink = () => {
    setLinkMsg(null);
    if (!link.target || link.target === link.host) { setLinkMsg("⚠ choisis une map CIBLE différente de l'hôte"); return; }
    portalStore.add(link.host, {
      pos: [link.x, 0, link.z],
      target: link.target,
      unlockQuest: "",            // libre (verrou par quête réglable in-game, éditeur F10)
      lockMode: "active",
      label: link.label || `Vers ${MAPS[link.target]?.label ?? link.target}`,
    });
    setLinkMsg(`✓ Portail créé sur « ${MAPS[link.host]?.label} » → « ${MAPS[link.target]?.label} ». Ajuste sa position au gizmo (F10 in-game).`);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: FORGE.bg, color: FORGE.text, fontFamily: FORGE.mono, overflowY: "auto",
      backgroundImage: `linear-gradient(${FORGE.accentFaint} 1px, transparent 1px), linear-gradient(90deg, ${FORGE.accentFaint} 1px, transparent 1px)`,
      backgroundSize: "44px 44px" }}>
      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "28px 24px 60px" }}>
        {/* En-tête */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${FORGE.accentDim}`, paddingBottom: 14, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "0.32em", color: FORGE.text, textShadow: `0 0 18px ${FORGE.accentDim}` }}>FORGE <span style={{ color: ACCENT }}>MAP</span></div>
            <div style={{ fontSize: 10, color: FORGE.textDim, letterSpacing: "0.12em", marginTop: 3 }}>ATELIER DE CRÉATION · ACCÈS ADMINISTRATEUR · {username}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {onOpenChars && (
              <button onClick={onOpenChars} style={{ ...btn(ACCENT, ""), width: "auto" }}>◢ Personnages ↗</button>
            )}
            <button onClick={onOpenEquip} style={{ ...btn(ACCENT, ""), width: "auto" }}>◳ Équipements</button>
            {onOpenEditor && (
              <button onClick={onOpenEditor} style={{ ...btn(ACCENT, ""), width: "auto" }}>◰ Éditeur 3D ↗</button>
            )}
            <button onClick={onExit} style={{ ...btn(FORGE.textDim, ""), width: "auto" }}>← Quitter</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 22 }}>
          {/* ── Colonne 1 : maps existantes ─────────────────────────── */}
          <div>
            <h3 style={h3()}>Cartes du monde ({allIds.length})</h3>
            {allIds.map((id) => {
              const def = MAPS[id];
              const st = status[id] ?? "vérification…";
              const custom = customIds.has(id);
              const portalsOut = portalStore.list(id).length;
              return (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", marginBottom: 6, background: "#160e07", border: `1px solid ${ACCENT}26`, borderRadius: 8 }}>
                  <span style={{ fontSize: 17 }}>{def.chunks ? "🧩" : "🗺️"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>
                      {def.label} <span style={{ color: FORGE.textFaint, fontWeight: 400 }}>· {id}</span>
                      {custom && <span style={{ color: ACCENT, fontSize: 10 }}> [custom]</span>}
                    </div>
                    <div style={{ fontSize: 10, color: FORGE.textDim }}>
                      {def.chunks ? `${def.chunks.length} chunks` : "GLB unique"} · {portalsOut} portail(s) sortant(s)
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 10,
                    color: st === "jouable" ? FORGE.ok : st === "à construire" ? FORGE.warn : FORGE.textDim,
                    border: `1px solid ${st === "jouable" ? "#8aff8a44" : "#ffd27a44"}` }}>
                    {st === "jouable" ? "✓ jouable" : st}
                  </span>
                  <button onClick={() => onTestMap(id)} disabled={st !== "jouable"}
                    style={{ ...btn(FORGE.ok, "#0a2008"), opacity: st === "jouable" ? 1 : 0.35, padding: "5px 10px" }}>
                    ▶ Tester
                  </button>
                  {custom && (
                    <button onClick={() => customMapStore.remove(id)} title="Retirer du registre (fichiers conservés)"
                      style={{ ...btn(FORGE.danger, "transparent"), padding: "5px 8px" }}>✕</button>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Colonne 2 : créer + lier ─────────────────────────────── */}
          <div>
            <h3 style={h3()}>Nouvelle carte vide</h3>
            <div style={card()}>
              <div style={{ fontSize: 11, color: FORGE.textDim, marginBottom: 10, lineHeight: 1.5 }}>
                Crée un environnement <b>vide jouable immédiatement</b>. Pas de fichiers Blender :
                tu entres dans l'éditeur 3D et tu déposes tes modèles.
              </div>
              <Field label="Nom de la carte"><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ma Planète, Mon Donjon…" style={inp()}
                onKeyDown={(e) => { if (e.key === "Enter" && form.label.trim()) createEmptyMap(); }} /></Field>
              <button onClick={createEmptyMap} disabled={!form.label.trim()}
                style={{ ...btn(ACCENT, "#241204"), opacity: form.label.trim() ? 1 : 0.4 }}>
                ✨ Créer & ouvrir l'éditeur
              </button>
              {formMsg && <div style={{ fontSize: 11, marginTop: 6, color: formMsg.startsWith("✓") ? FORGE.ok : FORGE.warn }}>{formMsg}</div>}
            </div>

            <h3 style={h3()}>Importer une map Blender (avancé)</h3>
            <div style={card()}>
              <div style={{ fontSize: 10, color: FORGE.textFaint, marginBottom: 8 }}>
                Pour une map exportée depuis Blender (GLB / chunks). Les fichiers doivent exister.
              </div>
              <Field label="Identifiant (slug)"><input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="ma_planete" style={inp()} /></Field>
              <Field label="Nom affiché"><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ma Planète" style={inp()} /></Field>
              <Field label="Type">
                <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "glb" | "chunks" })} style={inp()}>
                  <option value="chunks">Chunks (pipeline Blender)</option>
                  <option value="glb">GLB unique (petites maps)</option>
                </select>
              </Field>
              <Field label={form.kind === "chunks" ? "Dossier des chunks" : "Fichier GLB"}>
                <input value={form.path} onChange={(e) => setForm({ ...form, path: e.target.value })}
                  placeholder={form.kind === "chunks" ? "ma_planete  (→ /models/Maps/ma_planete/chunk_01.glb…)" : "ma_planete.glb"} style={inp()} />
              </Field>
              {form.kind === "chunks" && (
                <Field label="Nombre de chunks">
                  <input type="number" min={1} max={32} value={form.count} onChange={(e) => setForm({ ...form, count: Math.max(1, +e.target.value || 1) })} style={{ ...inp(), width: 70 }} />
                </Field>
              )}
              <Field label="Notes"><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="biome, état Blender…" style={inp()} /></Field>
              <button onClick={submitMap} style={btn(FORGE.textDim, "transparent")}>＋ Enregistrer l'import</button>
            </div>

            <h3 style={h3()}>Lier deux cartes (portail)</h3>
            <div style={card()}>
              <Field label="Sur la carte (hôte)">
                <select value={link.host} onChange={(e) => setLink({ ...link, host: e.target.value })} style={inp()}>
                  {allIds.map((id) => <option key={id} value={id}>{MAPS[id].label} ({id})</option>)}
                </select>
              </Field>
              <Field label="Mène vers (cible)">
                <select value={link.target} onChange={(e) => setLink({ ...link, target: e.target.value })} style={inp()}>
                  <option value="">— choisir —</option>
                  {allIds.map((id) => <option key={id} value={id}>{MAPS[id].label} ({id})</option>)}
                </select>
              </Field>
              <Field label="Nom du portail"><input value={link.label} onChange={(e) => setLink({ ...link, label: e.target.value })} style={inp()} /></Field>
              <Field label="Position X / Z">
                <input type="number" value={link.x} onChange={(e) => setLink({ ...link, x: +e.target.value || 0 })} style={{ ...inp(), width: 70 }} />
                <input type="number" value={link.z} onChange={(e) => setLink({ ...link, z: +e.target.value || 0 })} style={{ ...inp(), width: 70 }} />
              </Field>
              <button onClick={submitLink} style={btn("#c9a8ff", "#150a24")}>🌀 Créer le portail</button>
              {linkMsg && <div style={{ fontSize: 11, marginTop: 6, color: linkMsg.startsWith("✓") ? FORGE.ok : FORGE.warn }}>{linkMsg}</div>}
            </div>

            <h3 style={h3()}>Pipeline Blender (résumé)</h3>
            <div style={{ ...card(), fontSize: 11, color: FORGE.textDim, lineHeight: 1.6 }}>
              1. Découper la map en chunks de 5-30 Mo (terrain d'abord, puis bâtiments, props…).<br />
              2. Export glTF Binary, <b>Selected Objects</b>, SANS toucher aux transforms (position monde conservée).<br />
              3. Nommer <code>chunk_01.glb</code>, <code>chunk_02.glb</code>… dans <code>public/models/Maps/&lt;dossier&gt;/</code>.<br />
              4. Compresser : <code>npx gltf-pipeline -i chunk_01.glb -o chunk_01.glb -d</code>.<br />
              5. Enregistrer la carte ici → elle passe « jouable » dès que les fichiers répondent.<br />
              Spec complète : <code>public/models/Maps/README.md</code>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <span style={{ width: 150, fontSize: 11, color: FORGE.textDim }}>{label}</span>
      {children}
    </div>
  );
}
function h3(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 900, letterSpacing: "0.2em", color: ACCENT, textTransform: "uppercase", margin: "16px 0 8px" };
}
function card(): React.CSSProperties {
  return { background: FORGE.panel, border: `1px solid ${FORGE.accentFaint}`, borderRadius: 4, padding: 14, marginBottom: 8 };
}
function inp(): React.CSSProperties {
  return { flex: 1, background: "rgba(2,6,12,0.85)", color: FORGE.text, border: `1px solid ${FORGE.accentDim}`, borderRadius: 3, padding: "6px 8px", fontFamily: FORGE.mono, fontSize: 12, outline: "none" };
}
function btn(color: string, _bg: string): React.CSSProperties {
  return { padding: "8px 14px", fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", cursor: "pointer", background: "rgba(8,14,24,0.7)", color, border: `1px solid ${color}66`, borderRadius: 3, fontFamily: FORGE.mono, textTransform: "uppercase", width: "100%" };
}
