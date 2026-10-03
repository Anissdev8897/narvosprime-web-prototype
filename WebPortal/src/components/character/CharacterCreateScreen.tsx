/**
 * CharacterCreateScreen.tsx — UI de création de personnage RPG (Quaternius).
 *
 * 4 classes guerrier, aperçu 3D Bullet (Wraith/Murdock), stats depuis ClassDef.baseStats.
 */

import React, { useState, useMemo } from "react";
import { ArrowLeft, Play, Loader2 } from "lucide-react";
import { MeshyAvatarPreview } from "./MeshyAvatarPreview";
import { CustomCharPreview3D } from "./CustomCharPreview3D";
import { PLAYER_AVATARS } from "../../rpg/characters/playerAvatars";
import { useCustomCharacters, isCustomCharacter } from "../../rpg/characters/customCharacterStore";
import { CLASSES, CLASS_IDS } from "../../rpg/classes/classes";
import { ELEMENTS } from "../../rpg/elements/elements";
import { CLASS_VIDEOS } from "../../rpg/loaders/launcherAssets";
import { useCharacterStorage } from "./useCharacterStorage";
import { saveAppearance } from "../../rpg/persistence/appearance";
import { sanitizeHexColor } from "../../rpg/utils/color";
import { noclipDefault } from "../../rpg/runtime/movement/noclipUi";
import type { ClassId } from "../../rpg/types";
import type { SavedCharacter } from "../../types";

// ── Presets de couleur du personnage ──────────────────────────────────────────
const TINT_PRESETS: { label: string; hex: string }[] = [
  { label: "Naturel",  hex: "#ffffff" },
  { label: "Rubis",    hex: "#ff4444" },
  { label: "Saphir",   hex: "#4488ff" },
  { label: "Émeraude", hex: "#44cc88" },
  { label: "Ambre",    hex: "#ffaa44" },
  { label: "Violet",   hex: "#aa44ff" },
  { label: "Cyan",     hex: "#44ffff" },
  { label: "Or",       hex: "#ffee44" },
  { label: "Ébène",    hex: "#667788" },
];

// ── Types ──────────────────────────────────────────────────────────────────────
interface CharacterCreateScreenProps {
  username: string;
  serverId?: string;
  /**
   * Retour à la liste. ABSENT en création forcée (roster vide) : y revenir
   * relancerait aussitôt la redirection, le joueur ferait des allers-retours.
   */
  onCancel?: () => void;
  /**
   * Déconnexion — seule issue en création forcée.
   *
   * Sans elle, un joueur dont la création échoue de façon répétée (nom pris,
   * base en panne) n'a plus AUCUNE sortie : pas de retour, pas de logout.
   */
  onLogout?: () => void;
  /** Appelé après création réussie — plus de HeroDef. */
  onCreated: (character: SavedCharacter) => void;
}

type RoleTab = "dps" | "control" | "support" | "tank";

const ROLE_TABS: { key: RoleTab; label: string }[] = [
  { key: "dps",     label: "Attaque"  },
  { key: "control", label: "Contrôle" },
  { key: "support", label: "Soutien"  },
  { key: "tank",    label: "Défense"  },
];

/** DPS + Hybride regroupés dans le premier onglet. */
function getClassesForRole(role: RoleTab) {
  return CLASS_IDS.map((id) => CLASSES[id]).filter((cls) => {
    if (role === "dps") return cls.role === "dps" || cls.role === "hybrid";
    return cls.role === role;
  });
}

/** Couleur accent principale d'une classe (emissive de son élément). */
function classAccent(classId: ClassId): string {
  const cls = CLASSES[classId];
  return ELEMENTS[cls.element].emissive ?? cls.outfitEmissive;
}

// ── Composant principal ────────────────────────────────────────────────────────
export function CharacterCreateScreen({
  username,
  serverId,
  onCancel,
  onLogout,
  onCreated,
}: CharacterCreateScreenProps) {
  const [roleTab, setRoleTab]           = useState<RoleTab>("dps");
  const [selectedClassId, setSelectedClassId] = useState<ClassId>("warrior_bruiser");
  const [tint, setTint]                 = useState<string>(() =>
    // sanitize : d'anciens builds persistaient des hex PARTIELS ("#d") à chaque frappe.
    sanitizeHexColor(localStorage.getItem("narvos:create_tint") || "#ffffff")
  );
  const [name, setName]                 = useState("");
  const customChars = useCustomCharacters(); // persos composés (Forge Personnages) sélectionnables
  // Noclip par défaut : OFF par défaut (moins intrusif). Persisté → appliqué à l'entrée en jeu.
  const [noclipOnSpawn, setNoclipOnSpawn] = useState<boolean>(() => {
    const v = localStorage.getItem("narvos:noclip_default");
    return v === null ? false : v === "1";
  });
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const saved = localStorage.getItem("narvos:create_model");
    return saved && (PLAYER_AVATARS.some((a) => a.id === saved) || isCustomCharacter(saved)) ? saved : "wraith";
  });
  const [creating, setCreating]         = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const { createCharacter } = useCharacterStorage(username, serverId);

  const classesInRole  = useMemo(() => getClassesForRole(roleTab), [roleTab]);
  const selectedClass  = CLASSES[selectedClassId];
  const selectedElement = ELEMENTS[selectedClass.element];
  const accent         = selectedElement.emissive ?? selectedClass.outfitEmissive;

  // Switch role → auto-select première classe du rôle
  const handleRoleChange = (role: RoleTab) => {
    setRoleTab(role);
    const first = getClassesForRole(role)[0];
    if (first) setSelectedClassId(first.id as ClassId);
  };

  const handleCreate = async () => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed)                               { setError("Entre un nom de personnage"); return; }
    if (trimmed.length < 2)                     { setError("Nom trop court (min 2 caractères)"); return; }
    if (trimmed.length > 16)                    { setError("Nom trop long (max 16 caractères)"); return; }
    if (!/^[a-zA-Z0-9 àâäéèêëîïôöùûü]+$/.test(trimmed)) { setError("Caractères invalides (a-z, 0-9, accents français, espaces)"); return; }

    setCreating(true);
    try {
      const newChar = await createCharacter({
        name: trimmed,
        classId: selectedClassId,
        gender: "M",
        username,
        serverId,
      });
      try {
        saveAppearance(newChar.id, { tint, model: selectedModel }); // localStorage + base
        localStorage.setItem("narvos:create_tint", tint);            // pré-remplissage UI (local)
        localStorage.setItem("narvos:create_model", selectedModel);
        noclipDefault.set(noclipOnSpawn);                            // noclip à l'entrée en jeu
      } catch { /* ignore */ }
      onCreated(newChar);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la création");
      setCreating(false);
    }
  };

  const classVideo = CLASS_VIDEOS[selectedClassId];

  return (
    <div className="w-screen h-screen bg-[#0a0e14] text-white flex flex-col overflow-hidden relative">
      {/* Vidéo d'ambiance de la classe sélectionnée (change avec la classe) */}
      {classVideo && (
        <video
          key={selectedClassId}           // remonte le composant → redémarre la vidéo
          className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
          src={classVideo}
          autoPlay loop muted playsInline
        />
      )}

      {/* Ambiance lumineuse depuis l'élément de la classe */}
      <div
        className="absolute inset-0 transition-all duration-700 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at center, ${accent}22, transparent 60%)` }}
      />

      {/* Top bar */}
      <div className="relative z-20 flex justify-between items-center bg-black/60 border-b border-white/10 px-6 py-3 backdrop-blur-sm">
        {/* Retour OU déconnexion — jamais les deux, jamais aucun des deux.
            En création forcée le retour n'existe pas, mais laisser le joueur
            sans aucune issue serait pire. */}
        {onCancel ? (
          <button
            onClick={onCancel}
            className="flex items-center gap-2 text-stone-300 hover:text-white text-sm uppercase font-bold tracking-widest transition-colors"
          >
            <ArrowLeft size={16} /> Retour
          </button>
        ) : onLogout ? (
          <button
            onClick={onLogout}
            className="flex items-center gap-2 text-stone-400 hover:text-white text-sm uppercase font-bold tracking-widest transition-colors"
          >
            <ArrowLeft size={16} /> Déconnexion
          </button>
        ) : (
          <span />
        )}
        <h1 className="text-2xl font-black uppercase tracking-[0.4em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-orange-300">
          Création du Personnage
        </h1>
        <span className="text-white/70 text-sm font-mono">{username}</span>
      </div>

      <div className="relative z-10 flex-1 flex gap-6 px-8 py-6 min-h-0">
        {/* ── LEFT : Role tabs + liste de classes ────────────────────────── */}
        <div className="w-80 flex flex-col gap-4 bg-black/40 rounded-2xl p-4 border border-white/10 backdrop-blur-sm overflow-hidden">
          {/* Role tabs */}
          <div className="grid grid-cols-4 rounded-lg overflow-hidden border border-stone-800">
            {ROLE_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleRoleChange(tab.key)}
                className="py-2.5 text-[10px] font-black uppercase tracking-wider transition-all"
                style={{
                  background: roleTab === tab.key ? accent : "#0c0a09",
                  color:      roleTab === tab.key ? "#000"  : "#57534e",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Liste des classes du rôle */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {classesInRole.map((cls) => {
              const isSelected   = cls.id === selectedClassId;
              const clsAccent    = ELEMENTS[cls.element].emissive ?? cls.outfitEmissive;
              return (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClassId(cls.id as ClassId)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    isSelected
                      ? "border-2 shadow-lg"
                      : "border-stone-800 bg-stone-900/50 hover:border-stone-600 hover:bg-stone-900"
                  }`}
                  style={
                    isSelected
                      ? { borderColor: clsAccent, background: `${clsAccent}15`, boxShadow: `0 0 20px ${clsAccent}33` }
                      : {}
                  }
                >
                  <div className="flex items-center gap-3">
                    {/* Icône lettre */}
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-base flex-shrink-0"
                      style={{
                        background: `${cls.outfitColor}33`,
                        color:      clsAccent,
                        border:     `2px solid ${clsAccent}`,
                      }}
                    >
                      {cls.label.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className="font-black text-sm uppercase truncate"
                        style={{ color: isSelected ? clsAccent : "#fff" }}
                      >
                        {cls.label}
                      </div>
                      <div className="text-xs text-stone-500 uppercase tracking-wider truncate">
                        {ELEMENTS[cls.element].label}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── CENTER : Aperçu 3D ────────────────────────────────────────── */}
        <div className="flex-1 relative bg-black/30 rounded-2xl border border-white/10 overflow-hidden">
          {isCustomCharacter(selectedModel) ? (
            <CustomCharPreview3D modelId={selectedModel} tint={tint} />
          ) : (
            <MeshyAvatarPreview modelId={selectedModel} />
          )}

          {/* Badge élément */}
          <div
            className="absolute top-6 left-6 px-4 py-2 rounded-full font-black uppercase tracking-[0.2em] text-xs border-2"
            style={{
              background:  `${selectedClass.outfitColor}cc`,
              borderColor: accent,
              color:       accent,
            }}
          >
            {selectedElement.label}
          </div>

          {/* Watermark moteur */}
          <div className="absolute bottom-3 right-3 text-stone-700 text-[10px] uppercase tracking-widest font-black opacity-50">
            NARVOS ENGINE v5
          </div>
        </div>

        {/* ── RIGHT : Infos + stats + nom + bouton Créer ─────────────────── */}
        <div className="w-96 flex flex-col gap-4">
          {/* Info classe */}
          <div className="bg-black/50 rounded-2xl p-6 border border-white/10 backdrop-blur-sm">
            <div className="text-xs uppercase tracking-[0.3em] text-stone-500 mb-1">
              {selectedElement.label} · {selectedClass.role.toUpperCase()}
            </div>
            <h2 className="text-3xl font-black uppercase tracking-wider mb-3" style={{ color: accent }}>
              {selectedClass.label}
            </h2>
            <p className="text-sm text-stone-400 italic leading-relaxed">
              {selectedClass.description}
            </p>
          </div>

          {/* Avatar (modèle 3D jouable) */}
          <div className="bg-black/50 rounded-2xl p-4 border border-white/10 backdrop-blur-sm">
            <div className="text-xs uppercase tracking-[0.3em] text-stone-500 mb-2">Avatar</div>
            <div className="grid grid-cols-3 gap-1.5">
              {[...PLAYER_AVATARS.map((a) => ({ id: a.id, label: a.label })),
                ...customChars.map((c) => ({ id: c.id, label: `🧬 ${c.name}` }))].map((a) => {
                const sel = selectedModel === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => { setSelectedModel(a.id); localStorage.setItem("narvos:create_model", a.id); }}
                    className="px-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all"
                    style={{
                      background: sel ? accent : "#14141e",
                      color:      sel ? "#000"  : "#9aa",
                      border:     sel ? `1px solid ${accent}` : "1px solid #2a2a3a",
                    }}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stats de base */}
          <div className="bg-black/50 rounded-2xl p-6 border border-white/10 backdrop-blur-sm">
            <div className="text-xs uppercase tracking-[0.3em] text-stone-500 mb-3">Statistiques de base</div>
            <div className="space-y-2 font-mono">
              <StatBar label="PV"      value={selectedClass.baseStats.hp}           max={200} color="#ef4444" />
              <StatBar label="Mana"    value={selectedClass.baseStats.mana}          max={200} color="#818cf8" />
              <StatBar label="Attaque" value={selectedClass.baseStats.attackPower}   max={30}  color={accent} />
              <StatBar label="Défense" value={selectedClass.baseStats.defense}       max={30}  color="#06b6d4" />
              {selectedClass.baseStats.moveSpeed !== 1.0 && (
                <div className="text-xs text-stone-400 pt-2 border-t border-stone-800">
                  Vitesse :{" "}
                  <span style={{ color: accent }}>
                    {selectedClass.baseStats.moveSpeed > 1 ? "+" : ""}
                    {Math.round((selectedClass.baseStats.moveSpeed - 1) * 100)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Palette couleur GLOBALE (option C) : teinte d'ensemble qui multiplie les vraies
              couleurs du modèle. Blanc = couleurs d'origine (neutre). Le mesh étant un blob
              Tripo monolithique (1 matériau), la teinte est globale, pas par-partie. */}
          {(
          <div className="bg-black/50 rounded-2xl p-4 border border-white/10 backdrop-blur-sm">
            <div className="text-xs uppercase tracking-[0.3em] text-stone-500 mb-2">Couleur (teinte globale)</div>
            <div className="grid grid-cols-9 gap-1 mb-2">
              {TINT_PRESETS.map((p) => (
                <button
                  key={p.hex}
                  title={p.label}
                  onClick={() => { setTint(p.hex); localStorage.setItem("narvos:create_tint", p.hex); }}
                  className="w-full aspect-square rounded transition-all hover:scale-110"
                  style={{
                    background:  p.hex,
                    outline:     tint === p.hex ? `2px solid ${accent}` : "2px solid transparent",
                    outlineOffset: "2px",
                    boxShadow:   tint === p.hex ? `0 0 8px ${accent}99` : "none",
                  }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(tint) ? tint : "#ffffff"}  /* hex partiel du champ texte → pas de warning "#d" */
                onChange={(e) => { setTint(e.target.value); localStorage.setItem("narvos:create_tint", e.target.value); }}
                className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                title="Couleur personnalisée"
              />
              <input
                type="text"
                value={tint}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                    setTint(v);
                    if (v.length === 7) localStorage.setItem("narvos:create_tint", v);
                  }
                }}
                placeholder="#ffffff"
                maxLength={7}
                className="flex-1 bg-stone-950 text-white text-xs font-mono p-1.5 rounded border border-stone-700 outline-none uppercase"
                style={{ borderColor: /^#[0-9a-fA-F]{6}$/.test(tint) ? accent : "#44403c" }}
              />
              {tint !== "#ffffff" && (
                <button
                  onClick={() => { setTint("#ffffff"); localStorage.setItem("narvos:create_tint", "#ffffff"); }}
                  className="text-stone-500 hover:text-white text-xs font-black px-2 py-1 rounded border border-stone-700 transition-colors"
                  title="Réinitialiser"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          )}

          {/* Saisie du nom */}
          <div className="bg-black/50 rounded-2xl p-6 border border-white/10 backdrop-blur-sm">
            <div className="text-xs uppercase tracking-[0.3em] text-stone-500 mb-2">Identité</div>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              placeholder="Nom du personnage"
              maxLength={16}
              className="w-full bg-stone-950 text-white text-2xl font-black p-3 rounded-lg border-2 outline-none uppercase tracking-widest placeholder:text-stone-700 transition-all"
              style={{
                borderColor: error ? "#ef4444" : (name.length >= 2 ? accent : "#1c1917"),
              }}
            />
            {error && <p className="mt-2 text-red-400 text-xs font-mono">⚠ {error}</p>}
          </div>

          {/* Noclip par défaut — entre en jeu en vol libre (F4 pour couper). */}
          <label className="bg-black/50 rounded-2xl p-4 border border-white/10 backdrop-blur-sm flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={noclipOnSpawn}
              onChange={(e) => setNoclipOnSpawn(e.target.checked)}
              className="w-5 h-5 accent-current"
              style={{ accentColor: accent }}
            />
            <div>
              <div className="text-sm font-black uppercase tracking-wider text-white">Noclip par défaut</div>
              <div className="text-xs text-stone-500">Vol libre, sans collision. F4 pour activer/désactiver en jeu.</div>
            </div>
          </label>

          {/* Bouton Créer */}
          <button
            onClick={handleCreate}
            disabled={creating || name.length < 2}
            className="w-full py-5 rounded-2xl font-black uppercase tracking-[0.3em] text-lg flex items-center justify-center gap-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-100"
            style={{
              background:  accent,
              color:       "#000",
              boxShadow:   name.length >= 2 ? `0 0 30px ${accent}66` : "none",
            }}
          >
            {creating ? <Loader2 className="animate-spin" /> : <Play size={24} fill="currentColor" />}
            {creating ? "Création..." : "Créer le Personnage"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function StatBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs text-stone-400 mb-0.5">
        <span className="uppercase tracking-wider font-bold">{label}</span>
        <span style={{ color }}>{value}</span>
      </div>
      <div className="h-2 bg-stone-900 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}99` }}
        />
      </div>
    </div>
  );
}
