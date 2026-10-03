/**
 * forge/ForgeOutliner.tsx — Navigateur de scène (arbre catégorie → modèle → instances).
 *
 * POURQUOI CE PANNEAU EXISTE
 * La liste d'objets du panneau Calques est PLATE et en ordre de placement, plafonnée
 * à 240 px de haut. Passé quelques dizaines d'objets elle devient illisible : impossible
 * de retrouver un arbre parmi cinquante, ni de savoir combien on en a posé.
 *
 * Ici on regroupe : plusieurs objets partagent le même `model` (le même GLB), et
 * plusieurs modèles partagent le même dossier racine. On obtient donc naturellement
 * un arbre à trois niveaux — catégorie → modèle → instances — trié par nom partout.
 *
 * CHOIX D'ERGONOMIE
 * • Tout est REPLIÉ au départ : sur une map de 500 objets, ouvrir tout serait pire
 *   que la liste plate qu'on remplace.
 * • La recherche DÉPLIE automatiquement ce qui correspond — chercher puis devoir
 *   cliquer pour ouvrir annulerait le bénéfice de la recherche.
 * • Chaque niveau affiche son compte : c'est l'information la plus demandée en
 *   édition de map (« combien d'arbres ai-je posés ? »).
 * • Sélectionner une instance passe par le même `onSelectObject` que la liste
 *   existante : le gizmo XYZ apparaît, aucun chemin de code nouveau.
 */
import { useMemo, useState, useCallback } from 'react';
import type { ForgeObject } from './forgeSceneStore';

// ── Dérivations de nommage ────────────────────────────────────────────────────

/** Nom lisible d'un modèle depuis son chemin GLB. */
function modelName(path: string): string {
  const base = path.split('/').pop() ?? path;
  return base.replace(/\.(glb|gltf)$/i, '').replace(/[_-]+/g, ' ').trim() || base;
}

/**
 * Catégorie = premier segment sous `/models/`.
 *
 * On ne réutilise PAS `inferCategory` d'assetScanner : ce panneau classe des objets
 * DÉJÀ POSÉS, dont on ne connaît que le chemin. Dupliquer une heuristique de scan
 * d'assets ici la ferait diverger silencieusement le jour où l'une des deux change.
 */
function modelCategory(path: string): string {
  const m = path.match(/\/models\/([^/]+)\//i);
  return m ? m[1].replace(/[_-]+/g, ' ') : 'divers';
}

/** Tri alphabétique insensible à la casse et aux accents. */
const byName = (a: string, b: string) => a.localeCompare(b, 'fr', { sensitivity: 'base' });

// ── Structure de l'arbre ──────────────────────────────────────────────────────

interface ModelGroup {
  key: string;          // chemin GLB — identifiant stable
  name: string;
  instances: ForgeObject[];
}
interface CategoryGroup {
  key: string;
  name: string;
  models: ModelGroup[];
  total: number;        // nombre d'instances, toutes profondeurs confondues
}

/** Regroupe les objets en catégorie → modèle → instances, trié par nom partout. */
export function buildOutline(objects: ForgeObject[]): CategoryGroup[] {
  const parCategorie = new Map<string, Map<string, ForgeObject[]>>();

  for (const obj of objects) {
    const cat = modelCategory(obj.model);
    let modeles = parCategorie.get(cat);
    if (!modeles) { modeles = new Map(); parCategorie.set(cat, modeles); }
    const liste = modeles.get(obj.model);
    if (liste) liste.push(obj);
    else modeles.set(obj.model, [obj]);
  }

  return [...parCategorie.entries()]
    .map(([cat, modeles]) => {
      const models = [...modeles.entries()]
        .map(([chemin, instances]) => ({ key: chemin, name: modelName(chemin), instances }))
        .sort((a, b) => byName(a.name, b.name));
      return {
        key: cat,
        name: cat,
        models,
        total: models.reduce((n, m) => n + m.instances.length, 0),
      };
    })
    .sort((a, b) => byName(a.name, b.name));
}

// ── Composant ─────────────────────────────────────────────────────────────────

interface Props {
  objects: ForgeObject[];
  selectedObjectId?: string | null;
  onSelectObject?: (id: string) => void;
  onRemoveObject?: (id: string) => void;
  onClose?: () => void;
}

export function ForgeOutliner({ objects, selectedObjectId, onSelectObject, onRemoveObject, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [ouverts, setOuverts] = useState<Set<string>>(() => new Set());

  const outline = useMemo(() => buildOutline(objects), [objects]);

  const q = search.trim().toLowerCase();
  const filtre = useMemo(() => {
    if (!q) return outline;
    return outline
      .map((cat) => ({
        ...cat,
        models: cat.models.filter((m) => m.name.toLowerCase().includes(q)),
      }))
      .map((cat) => ({ ...cat, total: cat.models.reduce((n, m) => n + m.instances.length, 0) }))
      .filter((cat) => cat.models.length > 0);
  }, [outline, q]);

  const basculer = useCallback((cle: string) => {
    setOuverts((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(cle)) suivant.delete(cle);
      else suivant.add(cle);
      return suivant;
    });
  }, []);

  // Pendant une recherche, tout ce qui correspond est déplié : demander un clic
  // de plus après avoir tapé annulerait l'intérêt de la recherche.
  const estOuvert = useCallback((cle: string) => q.length > 0 || ouverts.has(cle), [q, ouverts]);

  const totalObjets = objects.length;
  const totalModeles = outline.reduce((n, c) => n + c.models.length, 0);

  return (
    <div style={S.panneau}>
      <div style={S.entete}>
        <h3 style={S.titre}>🗂️ Navigateur de scène</h3>
        {onClose && <button onClick={onClose} style={S.fermer}>✕</button>}
      </div>

      <div style={S.stats}>
        {totalObjets} objet{totalObjets > 1 ? 's' : ''} · {totalModeles} modèle{totalModeles > 1 ? 's' : ''} · {outline.length} catégorie{outline.length > 1 ? 's' : ''}
      </div>

      <div style={{ padding: '8px 10px' }}>
        <input
          type="text"
          placeholder="🔍 Filtrer par nom de modèle…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={S.recherche}
        />
      </div>

      <div style={S.corps}>
        {filtre.length === 0 && (
          <div style={S.vide}>
            {totalObjets === 0 ? 'Aucun objet placé.' : 'Aucun modèle ne correspond.'}
          </div>
        )}

        {filtre.map((cat) => {
          const catOuverte = estOuvert(`cat:${cat.key}`);
          return (
            <div key={cat.key} style={{ marginBottom: 2 }}>
              <button onClick={() => basculer(`cat:${cat.key}`)} style={S.ligneCategorie}>
                <span style={S.chevron}>{catOuverte ? '▾' : '▸'}</span>
                <span style={S.nomCategorie}>{cat.name}</span>
                <span style={S.compte}>{cat.total}</span>
              </button>

              {catOuverte && cat.models.map((mod) => {
                const modOuvert = estOuvert(`mod:${mod.key}`);
                const contientSelection = mod.instances.some((o) => o.id === selectedObjectId);
                return (
                  <div key={mod.key}>
                    <button
                      onClick={() => basculer(`mod:${mod.key}`)}
                      title={mod.key}
                      style={{ ...S.ligneModele, color: contientSelection ? '#4fc3f7' : '#cbd5e1' }}
                    >
                      <span style={S.chevron}>{modOuvert ? '▾' : '▸'}</span>
                      <span style={S.nomModele}>{mod.name}</span>
                      <span style={S.compte}>{mod.instances.length}</span>
                    </button>

                    {modOuvert && mod.instances.map((obj, i) => {
                      const actif = obj.id === selectedObjectId;
                      return (
                        <div
                          key={obj.id}
                          onClick={() => onSelectObject?.(obj.id)}
                          style={{ ...S.ligneInstance, background: actif ? '#16324a' : 'transparent',
                                   borderColor: actif ? '#4fc3f7' : 'transparent' }}
                        >
                          <span style={S.puce}>#{i + 1}</span>
                          <span style={{ ...S.coords, color: actif ? '#e2e8f0' : '#64748b' }}>
                            {obj.pos.map((v) => v.toFixed(1)).join('  ')}
                          </span>
                          {onRemoveObject && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onRemoveObject(obj.id); }}
                              title="Supprimer cet objet"
                              style={S.supprimer}
                            >✕</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Styles (inline, comme le reste des panneaux Forge) ────────────────────────
const S: Record<string, React.CSSProperties> = {
  panneau: {
    width: 260, background: '#1e293b', borderLeft: '1px solid #334155', flexShrink: 0,
    maxHeight: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
    fontFamily: 'JetBrains Mono, monospace',
  },
  entete: {
    padding: '12px', borderBottom: '1px solid #334155',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
  },
  titre: { margin: 0, fontSize: 14, color: '#e2e8f0' },
  fermer: {
    background: 'transparent', border: 'none', color: '#94a3b8',
    cursor: 'pointer', fontSize: 13, padding: 2,
  },
  stats: {
    padding: '6px 12px', fontSize: 10, color: '#64748b',
    borderBottom: '1px solid #334155', flexShrink: 0,
  },
  recherche: {
    width: '100%', padding: '6px 10px', background: '#0f172a', border: '1px solid #334155',
    borderRadius: 6, color: '#e2e8f0', fontSize: 12, outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
  },
  corps: { flex: 1, overflow: 'auto', padding: '0 8px 12px' },
  vide: { fontSize: 11, color: '#475569', fontStyle: 'italic', padding: '12px 4px' },
  ligneCategorie: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 6px', background: '#0f172a', border: 'none', borderRadius: 5,
    cursor: 'pointer', color: '#e2e8f0', fontSize: 11, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'inherit',
  },
  ligneModele: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 6,
    padding: '5px 6px 5px 18px', background: 'transparent', border: 'none',
    cursor: 'pointer', fontSize: 11, textAlign: 'left', fontFamily: 'inherit',
  },
  ligneInstance: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '3px 6px 3px 34px', borderRadius: 4, cursor: 'pointer',
    border: '1px solid transparent',
  },
  chevron: { fontSize: 9, width: 10, flexShrink: 0, color: '#64748b' },
  nomCategorie: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' },
  nomModele: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  compte: {
    fontSize: 10, color: '#64748b', background: '#0f172a',
    borderRadius: 8, padding: '1px 6px', flexShrink: 0, fontWeight: 400,
  },
  puce: { fontSize: 10, color: '#475569', flexShrink: 0, minWidth: 22 },
  coords: { flex: 1, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  supprimer: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    fontSize: 10, color: '#ef5350', padding: 0, flexShrink: 0,
  },
};
