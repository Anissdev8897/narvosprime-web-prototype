// characters/ForgePersonnages.tsx — FORGE PERSONNAGES (composition no-code, admin).
//
// Compose un perso : CORPS (Sorcier v1) + ATTACHEMENTS rigides (casque/cape/accessoire/arme
// sur sockets Head/Spine/Main, depuis le catalogue de modèles) + teinte + échelle.
// Aperçu 3D live, sauvegarde (customCharacterStore), puis jouable + choisissable à la création.
import { Component, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage } from "@react-three/drei";
import * as THREE from "three";
import { HumanCharacter } from "./HumanCharacter";
import { MeshyPlayerCharacter } from "./MeshyPlayerCharacter";
import { OwnAnimPlayerCharacter } from "./OwnAnimPlayerCharacter";
import { FORGE_BODIES, ownAnimPath, ownAnimScale, isMeshyAvatar, avatarSharedRig } from "./playerAvatars";
import { createPlayerState } from "../runtime/movement/playerState";
import type { CharacterConfig } from "../types";
import { customCharacterStore, useCustomCharacters, type CustomCharacter } from "./customCharacterStore";
import type { CharAttachment } from "./BoneAttachment";
import type { SocketName } from "../weapons/weaponTypes";
import { scanAssets, type AssetEntry } from "../forge/assetScanner";
import { useEquipmentLib, type EquipmentItem } from "./customEquipmentStore";
// Pont modulaire v2 (pipeline bone dominance)
import { ModularPreviewCharacter, modularPropsFromCustomCharacter } from "./modular/ModularPreviewCharacter";
import { ModularCreatorScreen } from "./modular/ModularCreatorScreen";
import type { ArchetypeId, BuildId } from "./modular/bodyArchetypes";
import { DEFAULT_SKIN_TINT, DEFAULT_EYE_TINT } from "./modular/modularEditorState";
import { isModularCustomCharacter, MODULAR_BODY_ID } from "./modular/bridge";
import { partsFor, starterOutfit, type Gender } from "./modular/partCatalog";
import type { BodySlot, EditorTab } from "./modular/bodySlots";
// Corps MakeHuman morphable — affiché sur l'onglet « Corps » uniquement.
import { MorphedBody } from "./modular/MorphedBody";
import { macroWeights } from "./modular/macroWeights";
import { selectionToMacro } from "./modular/selectionToMacro";
import { coiffureById } from "./modular/hairCatalog";

import { RendererRegistrar } from "../loaders/RendererRegistrar";

/**
 * Isole l'aperçu du reste du Canvas.
 *
 * POURQUOI CE FILET EXISTE. Une exception dans un enfant de `<Canvas>` remonte
 * à `<CanvasImpl>`, et React démonte alors l'arbre ENTIER : le Canvas meurt, la
 * zone 3D reste vide, et le symptôme perçu est « il manque des corps » alors
 * que le catalogue est intact. Constaté sur un GLB d'anatomie qui rebindait mal.
 *
 * Rend `null` — surtout PAS un fallback DOM : à l'intérieur d'un Canvas, les
 * enfants sont des objets three, pas des éléments HTML. Même parti pris que
 * `HeadErrorBoundary` et `PropErrorBoundary` ailleurs dans le projet.
 */
class PreviewErrorBoundary extends Component<
  { quoi: string; children: ReactNode },
  { erreur: Error | null }
> {
  state = { erreur: null as Error | null };
  static getDerivedStateFromError(erreur: Error) { return { erreur }; }
  componentDidCatch(erreur: unknown) {
    console.error(`[Aperçu] « ${this.props.quoi} » a planté — le reste du Canvas survit :`, erreur);
  }
  // Remonter une erreur ne doit pas la figer pour toujours : changer d'onglet
  // remonte un `quoi` différent, donc un nouveau boundary, donc un nouvel essai.
  render() { return this.state.erreur ? null : this.props.children; }
}

import { FORGE } from "../forge/forgeTheme";
const ACCENT = FORGE.accent;
const SOCKETS: SocketName[] = ["Head", "Spine", "RightHand", "LeftHand"];
const SOCKET_LABEL: Record<SocketName, string> = { Head: "🪖 Tête", Spine: "🧥 Dos/Cape", RightHand: "✋ Main D.", LeftHand: "🤚 Main G." };

// Defaults for CharacterConfig used by HumanCharacter fallback rendering.
// The forge primarily uses own/meshy avatars; these only matter when baseAvatar
// triggers the HumanCharacter path (<1% of compositions).
const DEFAULT_FORGE_CONFIG = {
  gender: "male" as const,
  classId: "warrior_bruiser" as const,
  outfitStyle: "Ranger" as const,
  skinColor: "#e0ac69",
  parts: {} as Record<string, string>,
};

// Unique ID with millisecond timestap + random suffix (avoids Date.now() collision).
const genAttId = () => "att_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Aperçu : refs joueur/caméra figées (idle au centre). Dispatche sur le corps choisi
// (own/meshy/sorcier/modular) → attachements montés sur n'importe quel rig.
function Preview({ baseAvatar, config, attachments, scaleMult, customChar }: { baseAvatar: string; config: CharacterConfig; attachments: CharAttachment[]; scaleMult: number; customChar?: CustomCharacter }) {
  const pos = useRef(new THREE.Vector3(0, 0, 0));
  const cam = useRef(createPlayerState());

  // Corps modulaire BikerBundle (pipeline bone dominance v2)
  if (baseAvatar === MODULAR_BODY_ID && customChar) {
    const props = modularPropsFromCustomCharacter(customChar, config.gender);
    return (
      <Suspense fallback={null}>
        <ModularPreviewCharacter {...props} skinTint={customChar.skinTint} eyeTint={customChar.eyeTint} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={null}>
      {ownAnimPath(baseAvatar) ? (
        <OwnAnimPlayerCharacter path={ownAnimPath(baseAvatar)!} playerPosition={pos} cameraState={cam}
          scaleMul={ownAnimScale(baseAvatar) * scaleMult} sharedRig={avatarSharedRig(baseAvatar)} offsetKey={baseAvatar} attachments={attachments} />
      ) : isMeshyAvatar(baseAvatar) ? (
        <MeshyPlayerCharacter modelId={baseAvatar} playerPosition={pos} cameraState={cam} attachments={attachments} scaleMult={scaleMult} />
      ) : (
        <HumanCharacter config={config} playerPosition={pos} cameraState={cam} attachments={attachments} scaleMult={scaleMult} />
      )}
    </Suspense>
  );
}

interface Props { onExit: () => void; }

export function ForgePersonnages({ onExit }: Props) {
  const all = useCustomCharacters();
  const lib = useEquipmentLib();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [models, setModels] = useState<AssetEntry[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => { scanAssets().then((cats) => setModels(cats.flatMap((c) => c.assets))).catch(() => {}); }, []);

  const editing = editingId ? customCharacterStore.get(editingId) : null;

  const config: CharacterConfig | null = editing && {
    ...DEFAULT_FORGE_CONFIG,
    // Le genre vient du PERSONNAGE, plus du défaut codé en dur. Sans ça, rouvrir
    // un personnage féminin le ramenait au catalogue masculin.
    gender: editing.gender ?? DEFAULT_FORGE_CONFIG.gender,
    tint: editing.tint,
    modelId: editing.baseAvatar,
  };

  const update = (patch: Partial<Omit<CustomCharacter, "id">>) => editing && customCharacterStore.save(editing.id, patch);
  const addAttach = (path: string) => {
    // TODO(P6): Offsets are entered blindly — add a 3D gizmo for visual offset tuning.
    if (!editing) return;
    const a: CharAttachment = { id: genAttId(), socket: "Head", path, offsetPos: [0, 0, 0], offsetRot: [0, 0, 0], scale: 1 };
    update({ attachments: [...editing.attachments, a] });
  };
  // Depuis la BIBLIOTHÈQUE : ajoute une pièce avec son offset PRÉ-RÉGLÉ (zéro tuning).
  const addFromLib = (it: EquipmentItem) => {
    if (!editing) return;
    const a: CharAttachment = { id: genAttId(), socket: it.socket, path: it.path, offsetPos: [...it.offsetPos], offsetRot: [...it.offsetRot], scale: it.scale };
    update({ attachments: [...editing.attachments, a] });
  };
  const patchAttach = (id: string, p: Partial<CharAttachment>) =>
    editing && update({ attachments: editing.attachments.map((a) => (a.id === id ? { ...a, ...p } : a)) });
  const removeAttach = (id: string) => editing && update({ attachments: editing.attachments.filter((a) => a.id !== id) });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return models.filter((m) => !q || m.label.toLowerCase().includes(q)).slice(0, 120);
  }, [models, search]);

  // ── Liste ──────────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <div style={{ position: "fixed", inset: 0, background: FORGE.bg, color: FORGE.text, fontFamily: FORGE.mono, padding: 28, overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${ACCENT}44`, paddingBottom: 14, marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "0.3em", color: FORGE.text, textShadow: `0 0 16px ${FORGE.accentDim}` }}>FORGE <span style={{ color: ACCENT }}>PERSONNAGES</span></div>
          <button onClick={onExit} style={btn(FORGE.textDim, "transparent")}>← Quitter</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 20, maxWidth: 480 }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom du personnage"
            style={inp()} onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) { const c = customCharacterStore.create(newName, "wraith"); setNewName(""); setEditingId(c.id); } }} />
          <button onClick={() => { if (newName.trim()) { const c = customCharacterStore.create(newName, "wraith"); setNewName(""); setEditingId(c.id); } }}
            style={{ ...btn(ACCENT, "transparent"), width: "auto" }}>Créer</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
          {all.length === 0 && <div style={{ color: FORGE.textFaint }}>Aucun personnage. Crée-en un.</div>}
          {all.map((c) => (
            <div key={c.id} style={{ background: FORGE.panel, border: `1px solid ${ACCENT}33`, borderRadius: 4, padding: 14 }}>
              <div style={{ fontWeight: 800 }}>{c.name}</div>
              <div style={{ fontSize: 11, color: FORGE.textDim }}>corps : {c.baseAvatar} · {c.attachments.length} pièce(s)</div>
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button onClick={() => setEditingId(c.id)} style={{ ...btn(ACCENT, "transparent"), padding: "5px 10px" }}>Éditer</button>
                <button onClick={() => customCharacterStore.remove(c.id)} style={{ ...btn(FORGE.danger, "transparent"), width: "auto", padding: "5px 8px" }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Éditeur ────────────────────────────────────────────────────────────
  // Aperçu partagé entre les deux mises en page — un seul endroit où la scène
  // est décrite, sinon les deux versions divergeraient au premier réglage.
  const previewCanvas = (tab: EditorTab) => (
    <Canvas shadows camera={{ position: [0, 1.4, 3.2], fov: 45 }} dpr={[1, 2]}>
      {/* SANS LUI, LES TEXTURES KTX2 NE SE TRANSCODENT PAS ────────────────────
          `KTX2Loader` exige `detectSupport(renderer)` avant tout transcodage.
          Faute de renderer enregistré, `attachKTX2` en fabrique un jetable :
          ça consomme un contexte WebGL, et le transcodage peut échouer — le
          maillage s'affiche alors en BLANC, sans erreur.
          Les pièces d'anatomie du pack Biker sont en KTX2 depuis le 03/08. */}
      <RendererRegistrar />
      <Suspense fallback={null}>
        <Stage intensity={0.6} environment="city" shadows={false} adjustCamera={false}>
          {/* DEUX CORPS, UN SEUL CANVAS.

              « Corps » montre le mannequin MakeHuman morphable : morphologie
              CONTINUE, et la seule surface où les curseurs de macro-morphs ont
              un sens. « Création » montre le personnage assemblé à partir des
              pièces découpées — c'est là que l'équipement se pose.

              Ils ne fusionnent pas aujourd'hui : le remap d'os des pièces
              suppose une géométrie fixe, qu'un corps morphé n'a plus. Les
              montrer côte à côte est l'étape qui permet d'en juger. */}
          {/* `key` sur l'onglet : changer d'onglet reconstruit le boundary, donc
              un aperçu qui a planté retente au retour au lieu de rester mort. */}
          {tab === "corps"
            ? (
              <PreviewErrorBoundary key="corps" quoi="mannequin morphable">
                <MorphedBody
                  weights={macroWeights(selectionToMacro({
                    gender: config.gender === "female" ? "female" : "male",
                    build: (editing.build as BuildId) ?? "athletic",
                    archetype: (editing.archetype as ArchetypeId) ?? "human",
                  }))}
                  // Positions BRUTES des curseurs. `MorphedBody` les résout en
                  // poids lui-même : c'est lui qui charge les packs, donc lui
                  // seul connaît les noms de cibles. Les résoudre ici obligerait
                  // à charger les mêmes fichiers une seconde fois.
                  sliderValues={editing.morphs}
                  // Résolu ICI : le personnage stocke un ID, pas un chemin — un
                  // pack déplacé sur le disque ne casse donc pas les sauvegardes.
                  hairPath={coiffureById(editing.hairId)?.path}
                  hairColor={editing.hairTint}
                  skinColor={editing.skinTint ?? DEFAULT_SKIN_TINT}
                  eyeColor={editing.eyeTint ?? DEFAULT_EYE_TINT}
                />
              </PreviewErrorBoundary>
            )
            : config && (
              <PreviewErrorBoundary key="assemble" quoi="personnage assemblé">
                <Preview baseAvatar={editing.baseAvatar} config={config} attachments={editing.attachments} scaleMult={editing.scaleMult} customChar={editing} />
              </PreviewErrorBoundary>
            )}
        </Stage>
      </Suspense>
      <OrbitControls target={[0, 1, 0]} enablePan={false} minDistance={1.5} maxDistance={7} />
    </Canvas>
  );

  // Un personnage modulaire ouvre l'ÉCRAN DE CRÉATION plein cadre : rail de
  // parties, carrousels de vignettes, corps de base et teinte. La mise en page
  // « aperçu + colonne de propriétés » ne sert plus qu'aux corps monoblocs.
  if (isModularCustomCharacter(editing)) {
    return (
      <ModularCreatorScreen
        title={editing.name}
        preview={previewCanvas}
        selection={{
          archetype: (editing.archetype as ArchetypeId) ?? "human",
          build: (editing.build as BuildId) ?? "athletic",
          gender: config.gender,
          proportions: editing.proportions,
          equipped: editing.equipped ?? {},
          skinTint: editing.skinTint ?? DEFAULT_SKIN_TINT,
          eyeTint: editing.eyeTint ?? DEFAULT_EYE_TINT,
          morphs: editing.morphs,
          hairId: editing.hairId,
          hairTint: editing.hairTint,
        }}
        onChange={(next) => update({
          equipped: next.equipped,
          archetype: next.archetype,
          build: next.build,
          gender: next.gender,   // sans lui, la bascule s'annulait au rendu suivant
          proportions: next.proportions,  // idem : les curseurs reviendraient au centre
          skinTint: next.skinTint,
          eyeTint: next.eyeTint,
          // Sans cette ligne, chaque curseur reviendrait à zéro au rendu suivant
          // — même écueil que `gender` et `proportions` plus haut.
          morphs: next.morphs,
          hairId: next.hairId,
          hairTint: next.hairTint,
        })}
        onReset={() => update({
          equipped: { ...starterOutfit(config.gender) },
          skinTint: DEFAULT_SKIN_TINT,
        })}
        onExit={() => setEditingId(null)}
      />
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: FORGE.bg, color: FORGE.text, fontFamily: FORGE.mono, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 18px", borderBottom: `1px solid ${ACCENT}44` }}>
        <div style={{ fontWeight: 900, color: ACCENT, letterSpacing: "0.15em" }}>{editing.name}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setEditingId(null)} style={{ ...btn(FORGE.textDim, "transparent"), width: "auto" }}>← Liste</button>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Aperçu 3D */}
        <div style={{ flex: 1, position: "relative" }}>
          <Canvas shadows camera={{ position: [0, 1.4, 3.2], fov: 45 }} dpr={[1, 2]}>
            {/* Même raison qu'au Canvas de l'aperçu partagé : sans renderer
                enregistré, les pièces KTX2 rendent en blanc. */}
            <RendererRegistrar />
            <Suspense fallback={null}>
              <Stage intensity={0.6} environment="city" shadows={false} adjustCamera={false}>
                {config && <Preview baseAvatar={editing.baseAvatar} config={config} attachments={editing.attachments} scaleMult={editing.scaleMult} customChar={editing} />}
              </Stage>
            </Suspense>
            <OrbitControls target={[0, 1, 0]} enablePan={false} minDistance={1.5} maxDistance={7} />
          </Canvas>
          <div style={{ position: "absolute", bottom: 8, left: 12, fontSize: 10, color: FORGE.textFaint }}>Glisse pour tourner · molette pour zoomer</div>
        </div>

        {/* Propriétés */}
        {/* La console d'assemblage a besoin de largeur : son rail de catégories
            plus une rangée « ◀ nom ▶ » ne tiennent pas dans 320 px. */}
        <div style={{ width: isModularCustomCharacter(editing) ? 480 : 320, borderLeft: `1px solid ${ACCENT}33`, overflowY: "auto", padding: 14 }}>
          <Section title="Corps">
            <Row label="Avatar de base">
              <select value={editing.baseAvatar} onChange={(e) => {
                const newBody = e.target.value;
                const patch: Partial<Omit<CustomCharacter, "id">> = { baseAvatar: newBody };
                // Initialiser equipped quand on passe en mode modulaire.
                // Genre par défaut = FEMME pour un personnage qui n'en a pas
                // encore ; un genre déjà choisi est respecté.
                if (newBody === MODULAR_BODY_ID && !editing.equipped) {
                  const g = editing.gender ?? "female";
                  patch.gender = g;
                  patch.equipped = { ...starterOutfit(g) };
                }
                update(patch);
              }} style={inp()}>
                {FORGE_BODIES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </Row>
          </Section>

          <Section title="Apparence">
            <Row label="Teinte tenue">
              <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(editing.tint) ? editing.tint : "#ffffff"}
                onChange={(e) => update({ tint: e.target.value })} style={{ width: 36, height: 28, border: "none", background: "transparent", cursor: "pointer" }} />
              <button onClick={() => update({ tint: "#ffffff" })} style={mini()}>↺</button>
            </Row>
            <Row label={`Échelle ${editing.scaleMult.toFixed(2)}`}>
              <input type="range" min={0.5} max={2} step={0.05} value={editing.scaleMult} onChange={(e) => update({ scaleMult: +e.target.value })} style={{ flex: 1 }} />
            </Row>
          </Section>

          {/* Console d'assemblage — TOUJOURS visible.
              Elle était conditionnée à `baseAvatar === "modular"` : un perso créé
              sur un héros (Wraith, Murdock…) ne voyait donc jamais la section, et
              rien à l'écran n'indiquait que l'assemblage existait. La porte
              d'entrée est maintenant dans la section elle-même. */}
          <Section title="🧩 Assemblage modulaire">
            {/* Ce panneau ne concerne QUE les corps monoblocs : un personnage
                modulaire part sur l'écran de création plein cadre, plus haut
                (retour anticipé). Il ne reste donc ici que la porte d'entrée. */}
              <div style={{ fontSize: 11, color: FORGE.textDim, lineHeight: 1.5 }}>
                Corps « {editing.baseAvatar} » monté d'un seul bloc — non découpable en jeu.
                Bascule en assemblage pour composer tête, buste, bras, jambes et vêtements
                pièce par pièce.
                <button
                  onClick={() => {
                    // Même règle qu'au sélecteur d'avatar : femme par défaut,
                    // genre existant respecté.
                    const g = editing.gender ?? "female";
                    update({ baseAvatar: MODULAR_BODY_ID, gender: g, equipped: { ...starterOutfit(g) } });
                  }}
                  style={{ ...btn(ACCENT, "transparent"), width: "100%", marginTop: 10 }}
                >
                  Passer à l'assemblage modulaire
                </button>
              </div>
          </Section>

          <Section title={`Attachements (${editing.attachments.length})`}>
            {editing.attachments.map((a) => (
              <div key={a.id} style={{ background: FORGE.panel, border: `1px solid ${ACCENT}22`, borderRadius: 3, padding: 8, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: FORGE.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{a.path.split("/").pop()}</span>
                  <button onClick={() => removeAttach(a.id)} style={{ ...mini(), color: FORGE.danger }}>✕</button>
                </div>
                <select value={a.socket} onChange={(e) => patchAttach(a.id, { socket: e.target.value as SocketName })} style={{ ...inp(), marginBottom: 6 }}>
                  {SOCKETS.map((s) => <option key={s} value={s}>{SOCKET_LABEL[s]}</option>)}
                </select>
                <Row label="Pos X/Y/Z">
                  {[0, 1, 2].map((i) => (
                    <input key={i} type="number" step={0.01} value={a.offsetPos[i]}
                      onChange={(e) => { const p = [...a.offsetPos] as [number, number, number]; p[i] = +e.target.value || 0; patchAttach(a.id, { offsetPos: p }); }}
                      style={{ ...inp(), width: 48 }} />
                  ))}
                </Row>
                <Row label={`Échelle ${a.scale.toFixed(2)}`}>
                  <input type="range" min={0.05} max={3} step={0.05} value={a.scale} onChange={(e) => patchAttach(a.id, { scale: +e.target.value })} style={{ flex: 1 }} />
                </Row>
                <Row label="Rot Y°">
                  <input type="range" min={0} max={360} step={5} value={Math.round(a.offsetRot[1] * 180 / Math.PI)}
                    onChange={(e) => patchAttach(a.id, { offsetRot: [a.offsetRot[0], +e.target.value * Math.PI / 180, a.offsetRot[2]] })} style={{ flex: 1 }} />
                </Row>
              </div>
            ))}
          </Section>

          {lib.length > 0 && (
            <Section title={`📚 Bibliothèque (${lib.length}) — offset pré-réglé`}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {lib.map((it) => (
                  <button key={it.id} onClick={() => addFromLib(it)}
                    style={{ textAlign: "left", padding: "4px 8px", fontSize: 11, background: FORGE.panel, color: FORGE.textDim, border: `1px solid ${ACCENT}33`, borderRadius: 3, cursor: "pointer", fontFamily: FORGE.mono }}>
                    ＋ {it.name} <span style={{ color: FORGE.textFaint }}>· {it.socket}</span>
                  </button>
                ))}
              </div>
            </Section>
          )}

          <Section title="Ajouter un modèle brut">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="rechercher un modèle…" style={{ ...inp(), marginBottom: 8 }} />
            <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
              {filtered.map((m) => (
                <button key={m.id} onClick={() => addAttach(m.path)} title={m.path}
                  style={{ textAlign: "left", padding: "4px 8px", fontSize: 11, background: "transparent", color: FORGE.textDim, border: `1px solid ${ACCENT}22`, borderRadius: 3, cursor: "pointer", fontFamily: FORGE.mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  ＋ {m.label}
                </button>
              ))}
            </div>
          </Section>

          <div style={{ fontSize: 10, color: FORGE.textFaint, marginTop: 10, lineHeight: 1.5 }}>
            Enregistré en continu. Le perso est choisissable à la création de personnage et jouable en jeu.
            (v1 : corps = Sorcier + attachements. Échange de corps complet à venir.)
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.15em", color: ACCENT, textTransform: "uppercase", marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}><span style={{ width: 92, fontSize: 10, color: FORGE.textDim }}>{label}</span>{children}</div>;
}
function inp(): React.CSSProperties { return { flex: 1, background: FORGE.bg, color: FORGE.text, border: `1px solid ${ACCENT}44`, borderRadius: 3, padding: "5px 7px", fontFamily: FORGE.mono, fontSize: 12 }; }
function mini(): React.CSSProperties { return { background: "transparent", border: `1px solid ${ACCENT}44`, color: ACCENT, borderRadius: 4, cursor: "pointer", padding: "2px 6px", fontSize: 11 }; }
function btn(color: string, bg: string): React.CSSProperties { return { width: "100%", padding: "8px 14px", fontSize: 11, fontWeight: 900, cursor: "pointer", background: bg, color, border: `1px solid ${color}66`, borderRadius: 3, fontFamily: FORGE.mono, textTransform: "uppercase" }; }
