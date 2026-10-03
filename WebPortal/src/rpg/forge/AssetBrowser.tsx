/**
 * forge/AssetBrowser.tsx — Navigateur d'assets avec aperçu texturé.
 *
 * ⚠️ ANTI-CRASH WebGL : on n'utilise QU'UN SEUL <Canvas> (le panneau d'aperçu), partagé.
 * L'ancienne version créait un <Canvas> PAR vignette → avec 673 modèles, des centaines de
 * contextes WebGL → "Too many active WebGL contexts" → Context Lost → éditeur cassé.
 * Les vignettes sont désormais de simples boutons (icône + nom) ; l'aperçu 3D ne se rend
 * que pour le modèle SURVOLÉ/sélectionné, dans l'unique canvas de droite.
 *
 * - Parcourir par catégories · chercher par nom · aperçu 3D (rotation auto) du survolé
 * - Clic = placer dans la scène (événement forge:placeAsset)
 */
import { useState, useCallback, useEffect, Suspense, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Center, Stage } from '@react-three/drei';
import * as THREE from 'three';
import type { AssetEntry, AssetCategory } from './assetScanner';
import { RendererRegistrar } from '../loaders/RendererRegistrar';

// ── Aperçu 3D (UNIQUE instance, modèle survolé/sélectionné) ────────────────────
function PreviewModel({ path }: { path: string }) {
  const { scene } = useGLTF(path);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  return <Center><primitive object={cloned} /></Center>;
}

function PreviewPane({ asset }: { asset: AssetEntry | null }) {
  return (
    <div style={{ width: 240, flexShrink: 0, borderLeft: '1px solid #1e293b', display: 'flex', flexDirection: 'column', background: '#0b1220' }}>
      <div style={{ height: 240, position: 'relative' }}>
        {asset ? (
          <Canvas camera={{ position: [2.5, 2, 2.5], fov: 45 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}>
            <RendererRegistrar />
            <Suspense fallback={null}>
              <Stage intensity={0.7} environment={null} shadows={false} adjustCamera>
                <PreviewModel path={asset.path} />
              </Stage>
            </Suspense>
            <OrbitControls enableZoom enablePan={false} autoRotate autoRotateSpeed={3} />
          </Canvas>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#475569', fontSize: 12, textAlign: 'center', padding: 20 }}>
            Survole un modèle pour l'aperçu 3D
          </div>
        )}
      </div>
      {asset && (
        <div style={{ padding: 12, borderTop: '1px solid #1e293b', fontSize: 11, color: '#94a3b8' }}>
          <div style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: 4 }}>{asset.label}</div>
          <div style={{ color: '#64748b', wordBreak: 'break-all' }}>{asset.path}</div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('forge:placeAsset', { detail: asset }))}
            style={{ marginTop: 10, width: '100%', padding: '8px', background: '#4fc3f7', color: '#0f172a', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
            ＋ Placer dans la scène
          </button>
        </div>
      )}
    </div>
  );
}

// ── Vignette LÉGÈRE (zéro WebGL : icône + nom) ─────────────────────────────────
function AssetTile({ asset, active, onHover, onPlace }: {
  asset: AssetEntry; active: boolean; onHover: () => void; onPlace: () => void;
}) {
  return (
    <button
      onMouseEnter={onHover}
      onClick={onPlace}
      title={asset.label}
      style={{
        width: 130, height: 64, background: active ? '#16324a' : '#1a1a2e',
        border: `2px solid ${active ? '#4fc3f7' : 'transparent'}`, borderRadius: 8,
        cursor: 'pointer', color: '#cbd5e1', fontSize: 11, fontFamily: 'inherit',
        padding: '6px 8px', textAlign: 'left', overflow: 'hidden', display: 'flex',
        flexDirection: 'column', justifyContent: 'space-between', transition: 'border-color .15s, background .15s',
      }}>
      <span style={{ fontSize: 18 }}>📦</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{asset.label}</span>
    </button>
  );
}

interface AssetBrowserProps {
  categories?: AssetCategory[];
  onSelectAsset?: (asset: AssetEntry) => void;
  onClose?: () => void;
}

export function AssetBrowser({ categories: propCategories, onSelectAsset, onClose }: AssetBrowserProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<AssetCategory[]>(propCategories || []);
  const [loading, setLoading] = useState(categories.length === 0);
  const [hovered, setHovered] = useState<AssetEntry | null>(null);
  const [showCategories, setShowCategories] = useState(true);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scan AUTO : index généré (models_index.json) via assetScanner. Plus de fetch
  // manifest bidon (qui retournait l'index.html en dev → SyntaxError trompeuse).
  useEffect(() => {
    if (categories.length > 0) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const { scanAssets } = await import('./assetScanner');
        const scanned = await scanAssets();
        if (!cancelled) setCategories(scanned);
      } catch (err) {
        console.warn('[AssetBrowser] scan échoué', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [categories.length]);

  const place = useCallback((asset: AssetEntry) => {
    onSelectAsset?.(asset);
    window.dispatchEvent(new CustomEvent('forge:placeAsset', { detail: asset }));
  }, [onSelectAsset]);

  // Debounce du survol → évite de recharger un GLB d'aperçu à chaque pixel parcouru.
  const hoverAsset = useCallback((asset: AssetEntry) => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => setHovered(asset), 120);
  }, []);

  const filteredCategories = useMemo(() => {
    const q = search.toLowerCase();
    return categories
      .filter(cat => !activeCategory || cat.name === activeCategory)
      .map(cat => ({ ...cat, assets: cat.assets.filter(a => !q || a.label.toLowerCase().includes(q)) }))
      .filter(cat => cat.assets.length > 0);
  }, [categories, search, activeCategory]);

  const totalAssets = categories.reduce((sum, c) => sum + c.assets.length, 0);

  if (loading) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.95)', zIndex: 1000, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, margin: '0 auto 16px', border: '2px solid #4fc3f7', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          Analyse des modèles…
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.97)', zIndex: 1000, display: 'flex', flexDirection: 'column', fontFamily: 'JetBrains Mono, monospace' }}>
      {/* En-tête */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button
          onClick={() => setShowCategories(v => !v)}
          title="Afficher / masquer la colonne des catégories"
          style={{
            background: showCategories ? '#4fc3f7' : '#334155',
            color: showCategories ? '#0f172a' : '#94a3b8',
            border: 'none', padding: '6px 12px', borderRadius: 4,
            cursor: 'pointer', fontSize: 13, fontWeight: 700, flexShrink: 0,
          }}>📚 Catégories</button>
        <h2 style={{ margin: 0, fontSize: 16, color: '#e2e8f0', flex: 1 }}>
          📦 Bibliothèque de Modèles <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>({totalAssets} modèles · {categories.length} catégories)</span>
        </h2>
        <button onClick={onClose} style={{ background: '#334155', border: 'none', color: '#94a3b8', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>✕ Fermer</button>
      </div>

      {/* Recherche */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
        <input type="text" placeholder="🔍 Rechercher un modèle…" value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Corps : colonne de catégories (gauche) + grille + aperçu (droite) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── COLONNE DE CATÉGORIES ────────────────────────────────────────
            C'était une barre HORIZONTALE défilante. Avec 20 catégories elle
            obligeait à faire défiler vers la droite pour atteindre la moitié
            d'entre elles, sans jamais les voir toutes d'un coup. Une colonne
            les montre intégralement et laisse la place aux compteurs. */}
        {showCategories && (
          <div style={{ width: 210, flexShrink: 0, borderRight: '1px solid #1e293b', overflow: 'auto', padding: 8, background: '#0b1220' }}>
            <CatRow label="Tous les modèles" count={totalAssets} active={!activeCategory}
              onClick={() => setActiveCategory(null)} />
            <div style={{ height: 8 }} />
            {categories.map(cat => (
              <CatRow key={cat.name} label={cat.label} count={cat.assets.length}
                active={activeCategory === cat.name}
                onClick={() => setActiveCategory(cat.name === activeCategory ? null : cat.name)} />
            ))}
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {filteredCategories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Aucun modèle trouvé</div>
          ) : filteredCategories.map(cat => (
            <div key={cat.name} style={{ marginBottom: 22 }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: 13, color: '#e2e8f0', fontWeight: 700, borderBottom: '1px solid #1e293b', paddingBottom: 6 }}>
                {cat.label} <span style={{ color: '#64748b', fontWeight: 400 }}>· {cat.assets.length}</span>
              </h3>

              {/* Second niveau : le dossier d'origine. « Nature ▸ trees » est
                  lisible ; « trees » seul, au sommet, ne l'était pas. */}
              {groupBySub(cat.assets).map(groupe => (
                <div key={groupe.name} style={{ marginBottom: 14 }}>
                  {groupe.name && (
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, letterSpacing: '0.06em' }}>
                      ▸ {groupe.name} <span style={{ color: '#475569' }}>({groupe.assets.length})</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {groupe.assets.map(asset => (
                      <AssetTile key={asset.id} asset={asset} active={hovered?.id === asset.id}
                        onHover={() => hoverAsset(asset)} onPlace={() => place(asset)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <PreviewPane asset={hovered} />
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .asset-thumbnail:hover{box-shadow:0 4px 12px rgba(79,195,247,.2)}`}</style>
    </div>
  );
}

/**
 * Regroupe les assets d'une catégorie par sous-catégorie (dossier d'origine).
 *
 * Les assets arrivent DÉJÀ triés par sous-catégorie puis par nom (cf.
 * assetScanner) : un simple parcours séquentiel suffit donc, sans re-trier.
 */
function groupBySub(assets: AssetEntry[]): { name: string; assets: AssetEntry[] }[] {
  const out: { name: string; assets: AssetEntry[] }[] = [];
  for (const a of assets) {
    const nom = a.subCategory ?? '';
    const dernier = out[out.length - 1];
    if (dernier && dernier.name === nom) dernier.assets.push(a);
    else out.push({ name: nom, assets: [a] });
  }
  // Une sous-catégorie unique n'apporte rien : on retire l'en-tête intermédiaire.
  if (out.length === 1) out[0].name = '';
  return out;
}

/** Ligne de la colonne de catégories — libellé à gauche, compteur à droite. */
function CatRow({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title={label} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 9px', marginBottom: 2, borderRadius: 6, border: 'none',
      background: active ? '#16324a' : 'transparent',
      boxShadow: active ? 'inset 0 0 0 1px #4fc3f7' : 'none',
      color: active ? '#e2e8f0' : '#94a3b8',
      fontSize: 12, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
    }}>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontSize: 10, color: '#64748b', background: '#0f172a', borderRadius: 8, padding: '1px 6px', flexShrink: 0 }}>{count}</span>
    </button>
  );
}

// Hook pour écouter l'événement de placement (inchangé).
export function useForgeAssetPlacement(onPlace: (asset: AssetEntry) => void) {
  useEffect(() => {
    const handler = (e: Event) => onPlace((e as CustomEvent<AssetEntry>).detail);
    window.addEventListener('forge:placeAsset', handler);
    return () => window.removeEventListener('forge:placeAsset', handler);
  }, [onPlace]);
}
