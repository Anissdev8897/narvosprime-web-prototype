// forge/TextureBrowser.tsx — navigateur de TEXTURES (vignettes <img>, zéro WebGL).
//
// Lit textures_index.json (généré par build-texture-index). Grille d'aperçus cliquables :
// clic → onPick(path). Recherche + filtre "mes textures" (dossier public/textures). Léger
// (pas de Canvas par item → aucun risque de "Too many WebGL contexts").
import { useEffect, useMemo, useState } from "react";
import { FORGE } from "./forgeTheme";

export interface TextureEntry { path: string; name: string; folder: string; sizeKb: number; user: boolean; }

let cache: TextureEntry[] | null = null;
export async function scanTextures(): Promise<TextureEntry[]> {
  if (cache) return cache;
  try {
    const r = await fetch("/textures_index.json");
    if (!r.ok) return [];
    const { textures } = (await r.json()) as { textures: TextureEntry[] };
    cache = textures;
    return textures;
  } catch { return []; }
}

export function TextureBrowser({ onPick, onClose }: { onPick: (path: string) => void; onClose: () => void }) {
  const [all, setAll] = useState<TextureEntry[]>([]);
  const [search, setSearch] = useState("");
  const [userOnly, setUserOnly] = useState(false);

  useEffect(() => { scanTextures().then(setAll); }, []);
  const list = useMemo(() => {
    const q = search.toLowerCase();
    return all.filter((t) => (!userOnly || t.user) && (!q || t.name.toLowerCase().includes(q) || t.folder.toLowerCase().includes(q))).slice(0, 300);
  }, [all, search, userOnly]);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 1100, background: "rgba(2,4,10,0.96)", display: "flex", flexDirection: "column", fontFamily: FORGE.mono, color: FORGE.text }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${FORGE.accentDim}` }}>
        <span style={{ fontWeight: 900, letterSpacing: "0.2em", color: FORGE.accent }}>TEXTURES <span style={{ color: FORGE.textDim, fontWeight: 400 }}>({all.length})</span></span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 rechercher…"
          style={{ flex: 1, background: "rgba(2,6,12,0.85)", color: FORGE.text, border: `1px solid ${FORGE.accentDim}`, borderRadius: 3, padding: "5px 8px", fontFamily: FORGE.mono, fontSize: 12, outline: "none" }} />
        <button onClick={() => setUserOnly((v) => !v)} style={{ padding: "5px 10px", fontSize: 10, cursor: "pointer", fontFamily: FORGE.mono, borderRadius: 3, background: userOnly ? FORGE.accentFaint : "transparent", color: userOnly ? FORGE.accent : FORGE.textDim, border: `1px solid ${userOnly ? FORGE.accent : FORGE.accentDim}` }}>Mes textures</button>
        <button onClick={onClose} style={{ padding: "5px 10px", fontSize: 11, cursor: "pointer", fontFamily: FORGE.mono, borderRadius: 3, background: "transparent", color: FORGE.textDim, border: `1px solid ${FORGE.accentDim}` }}>✕</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8, alignContent: "start" }}>
        {list.length === 0 && (
          <div style={{ gridColumn: "1/-1", color: FORGE.textFaint, fontSize: 12, lineHeight: 1.6 }}>
            Aucune texture. Dépose des images dans <code style={{ color: FORGE.accent }}>public/textures/</code> puis relance (index auto).
          </div>
        )}
        {list.map((t) => (
          <button key={t.path} onClick={() => onPick(t.path)} title={`${t.name}\n${t.path}`}
            style={{ background: "#0a1018", border: `1px solid ${t.user ? FORGE.accent : FORGE.accentDim}`, borderRadius: 4, padding: 4, cursor: "pointer", display: "flex", flexDirection: "column", gap: 4 }}>
            <img src={t.path} alt={t.name} loading="lazy" style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 2, background: "#02040a" }} />
            <span style={{ fontSize: 9, color: FORGE.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
