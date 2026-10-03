/**
 * CharacterSelectScreen.tsx — Liste des personnages sauvegardés du joueur.
 *
 * Migré de Meshy/heroes-catalog vers CLASSES RPG (Quaternius) :
 *   - ClassPreview3D remplace HeroPreview3D
 *   - CLASSES + ELEMENTS remplacent HEROES_CATALOG / HeroDef
 *   - onPlay : (character: SavedCharacter) => void (HeroDef supprimé)
 *
 * Layout :
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ Header (compte, serveur, déconnexion)                       │
 *   ├──────────────┬──────────────────────────────┬───────────────┤
 *   │ Roster list  │ Aperçu 3D de la classe        │ Stats + Play  │
 *   │ (clickable)  │ (ClassPreview3D)              │               │
 *   └──────────────┴──────────────────────────────┴───────────────┘
 *
 * Si aucun perso : grand bouton "Créer un personnage".
 */

import React, { useState, useEffect, useMemo } from "react";
import { Play, Trash2, UserPlus, LogOut, Loader2, Cloud } from "lucide-react";
import { ClassPreview3D } from "./ClassPreview3D";
import { CLASSES, CLASS_IDS } from "../../rpg/classes/classes";
import { ELEMENTS } from "../../rpg/elements/elements";
import { CLASS_VIDEOS } from "../../rpg/loaders/launcherAssets";
import { useCharacterStorage } from "./useCharacterStorage";
import type { ClassId } from "../../rpg/types";
import type { SavedCharacter } from "../../types";

// ── Helpers ────────────────────────────────────────────────────────────────────
/** Retourne un ClassId valide, fallback sur "warrior_bruiser" si l'id est inconnu (anciens persos). */
const safeClassId = (id: string): ClassId =>
  CLASS_IDS.includes(id as ClassId) ? (id as ClassId) : "warrior_bruiser";

/** Accent color (emissive) d'une classe. */
const classAccent = (classId: ClassId): string => {
  const cls = CLASSES[classId];
  return ELEMENTS[cls.element].emissive ?? cls.outfitEmissive;
};

/** Vidéo d'ambiance par classe. */
const CLASS_VIDEO = CLASS_VIDEOS;

// ── Props ──────────────────────────────────────────────────────────────────────
interface CharacterSelectScreenProps {
  username: string;
  serverName?: string;
  serverId?: string;
  /** HeroDef supprimé — le classId est directement dans SavedCharacter. */
  onPlay: (character: SavedCharacter) => void;
  onCreateNew: () => void;
  onLogout: () => void;
  onChangeServer?: () => void;
  /**
   * Appelé quand une lecture ABOUTIE révèle un roster vide.
   *
   * N'est jamais déclenché sur une erreur de stockage : « aucun personnage » et
   * « impossible de savoir » commandent des actions opposées.
   */
  onRosterEmpty?: () => void;
}

// ── Composant principal ────────────────────────────────────────────────────────
export function CharacterSelectScreen({
  username,
  serverName,
  serverId,
  onPlay,
  onCreateNew,
  onLogout,
  onChangeServer,
  onRosterEmpty,
}: CharacterSelectScreenProps) {
  const { characters, loading, error, deleteError, hasLoaded, refresh, removeCharacter } =
    useCharacterStorage(username, serverId);

  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [purgeConfirm, setPurgeConfirm]   = useState(false);
  const [purging, setPurging]             = useState(false);

  // Vrai si l'appli tourne dans Electron (accès DB MySQL)
  const isElectron = !!(window as any).narvosLauncher?.isElectron;

  // ── Purge admin ─────────────────────────────────────────────────────────────
  const handlePurgeAll = async () => {
    if (!purgeConfirm) {
      setPurgeConfirm(true);
      setTimeout(() => setPurgeConfirm(false), 4000);
      return;
    }
    setPurging(true);
    try {
      const launcher = (window as any).narvosLauncher;
      const result = await launcher?.deleteAllCharacters?.();
      console.log("[Admin] Purge résultat:", result);
      setPurgeConfirm(false);
      await refresh();
    } catch (e) {
      console.error("[Admin] Purge failed:", e);
    } finally {
      setPurging(false);
    }
  };

  // Auto-select premier perso à la première charge
  useEffect(() => {
    if (!selectedId && characters.length > 0) {
      setSelectedId(characters[0].id);
    }
  }, [characters, selectedId]);

  const selectedChar = useMemo(
    () => characters.find((c) => c.id === selectedId) ?? null,
    [characters, selectedId],
  );

  /** Classe RPG du perso sélectionné (fallback warrior_bruiser si classId inconnu). */
  const selectedCls = useMemo(() => {
    if (!selectedChar) return null;
    return CLASSES[safeClassId(selectedChar.classId)];
  }, [selectedChar]);

  const selectedAccent = useMemo(
    () => (selectedCls ? classAccent(selectedCls.id as ClassId) : "#06b6d4"),
    [selectedCls],
  );

  // ── Suppression individuelle ────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 3000);
      return;
    }
    const ok = await removeCharacter(id);
    if (!ok) return;   // failure: keep confirm state visible
    if (selectedId === id) {
      setSelectedId(characters.find((c) => c.id !== id)?.id ?? null);
    }
    setConfirmDelete(null);
  };

  // ── ROSTER VIDE → CRÉATION OBLIGATOIRE ──────────────────────────────────────
  //
  // Trois conditions, et les trois comptent :
  //   hasLoaded  une lecture s'est TERMINÉE. `!loading` ne suffit pas : il vaut
  //              `false` au tout premier rendu, avant même que le fetch parte.
  //   !error     une source muette n'est PAS un roster vide. Y déclencher la
  //              création forcée fabriquerait un doublon sur simple lenteur.
  //   length===0 le joueur n'a réellement aucun personnage.
  const rosterVide = hasLoaded && !error && characters.length === 0;

  useEffect(() => {
    if (rosterVide) onRosterEmpty?.();
  }, [rosterVide, onRosterEmpty]);

  if (rosterVide) {
    // L'appelant redirige vers la création. On n'affiche plus l'invitation
    // manuelle : elle laissait le joueur libre de rester sur un écran vide.
    return (
      <div className="w-screen h-screen bg-[#0a0e14] text-white flex items-center justify-center">
        <p className="font-mono text-sm text-stone-400 tracking-widest uppercase">
          Aucun personnage — ouverture de la création…
        </p>
      </div>
    );
  }

  // ── ERREUR DE STOCKAGE ──────────────────────────────────────────────────────
  //
  // Distinct du cas précédent : ici on NE SAIT PAS si le joueur a des
  // personnages. On lui laisse la main plutôt que de décider à sa place.
  if (hasLoaded && error && characters.length === 0) {
    return (
      <div className="w-screen h-screen bg-[#0a0e14] text-white flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/20 via-transparent to-orange-950/20" />

        <TopBar
          username={username}
          serverName={serverName}
          onLogout={onLogout}
          onChangeServer={onChangeServer}
        />

        <div className="relative z-10 text-center max-w-2xl px-8">
          <h1 className="text-3xl font-black uppercase tracking-[0.3em] mb-4 text-red-400">
            Stockage indisponible
          </h1>
          <p className="text-stone-400 mb-8 font-mono text-sm">⚠ {error.message}</p>
          <p className="text-stone-500 mb-8 text-sm">
            Impossible de lire la liste des personnages. Créer un personnage maintenant
            risquerait de dupliquer un héros existant.
          </p>
          <button
            onClick={() => refresh()}
            className="px-8 py-4 bg-stone-700 hover:bg-stone-600 text-white font-black uppercase tracking-[0.2em] rounded-xl transition-all"
          >
            Réessayer
          </button>
          <button
            onClick={onCreateNew}
            className="ml-4 px-8 py-4 border border-stone-600 hover:border-stone-400 text-stone-400 font-black uppercase tracking-[0.2em] rounded-xl transition-all"
          >
            <UserPlus className="inline mr-2 mb-1" size={20} />
            Créer quand même
          </button>
        </div>
      </div>
    );
  }

  // ── LOADING ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-screen h-screen bg-[#0a0e14] text-white flex items-center justify-center">
        <Loader2 className="animate-spin text-cyan-400" size={48} />
      </div>
    );
  }

  // ── MAIN UI ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-screen h-screen bg-[#0a0e14] text-white flex flex-col overflow-hidden relative">
      {/* Vidéo d'ambiance de la classe sélectionnée (launcher) */}
      {selectedCls && CLASS_VIDEO[selectedCls.id as ClassId] && (
        <video
          key={selectedCls.id}
          className="absolute inset-0 w-full h-full object-cover opacity-25 pointer-events-none"
          src={CLASS_VIDEO[selectedCls.id as ClassId]}
          autoPlay loop muted playsInline
        />
      )}

      {/* Ambiance lumineuse de la classe sélectionnée */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none transition-all duration-700"
        style={{
          background: `radial-gradient(ellipse at center, ${selectedAccent}33, transparent 60%)`,
        }}
      />

      <TopBar
        username={username}
        serverName={serverName}
        onLogout={onLogout}
        onChangeServer={onChangeServer}
      />

      {/* Title */}
      <div className="relative z-10 text-center pt-6 pb-4">
        <h1 className="text-3xl font-black uppercase tracking-[0.4em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-orange-300">
          Sélection du Personnage
        </h1>
      </div>

      {/* Delete error banner — inline, above the character list, not full-screen */}
      {deleteError && (
        <div className="relative z-10 mx-8 mb-0 px-4 py-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 font-mono text-sm">
          ⚠ {deleteError}
        </div>
      )}

      <div className="relative z-10 flex-1 flex gap-6 px-8 pb-8 min-h-0">
        {/* ── LEFT : Roster list ─────────────────────────────────────────── */}
        <div className="w-80 flex flex-col gap-2 overflow-y-auto bg-black/40 rounded-2xl p-4 border border-white/10 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs uppercase tracking-[0.2em] text-stone-400 font-bold">
              Vos personnages ({characters.length})
            </h2>
            <button
              onClick={refresh}
              className="text-stone-500 hover:text-cyan-400 text-xs"
              title="Rafraîchir"
            >
              ↻
            </button>
          </div>

          {characters.map((char) => {
            const cId         = safeClassId(char.classId);
            const cls         = CLASSES[cId];
            const accent      = classAccent(cId);
            const isSelected  = selectedId === char.id;
            const isPendingDel = confirmDelete === char.id;

            return (
              <button
                key={char.id}
                onClick={() => setSelectedId(char.id)}
                className={`group relative text-left p-3 rounded-lg border transition-all ${
                  isSelected
                    ? "border-2 shadow-lg"
                    : "border-stone-800 bg-stone-900/50 hover:border-stone-600 hover:bg-stone-900"
                }`}
                style={
                  isSelected
                    ? { borderColor: accent, boxShadow: `0 0 20px ${accent}33` }
                    : {}
                }
              >
                <div className="flex items-center gap-3">
                  {/* Icône lettre classe */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-black text-lg flex-shrink-0"
                    style={{
                      background: `${cls.outfitColor}33`,
                      color:      accent,
                      border:     `2px solid ${accent}`,
                    }}
                  >
                    {char.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-black text-sm uppercase truncate"
                      style={{ color: isSelected ? accent : "#fff" }}
                    >
                      {char.name}
                    </div>
                    <div className="text-xs text-stone-500 uppercase tracking-wider">
                      {cls.label} · Niv. {char.level ?? 1}
                    </div>
                  </div>
                  {char.isFromSql && <Cloud size={14} className="text-cyan-400/70" />}
                </div>

                {/* Bouton supprimer (hover) */}
                <div
                  onClick={(e) => { e.stopPropagation(); handleDelete(char.id); }}
                  className={`absolute top-2 right-2 p-1.5 rounded transition-all cursor-pointer ${
                    isPendingDel
                      ? "bg-red-600 text-white opacity-100"
                      : "opacity-0 group-hover:opacity-100 hover:bg-red-500/30 text-red-400"
                  }`}
                  title={isPendingDel ? "Cliquer à nouveau pour confirmer" : "Supprimer"}
                >
                  <Trash2 size={12} />
                </div>
              </button>
            );
          })}

          {/* Bouton créer */}
          <button
            onClick={onCreateNew}
            className="mt-4 p-4 rounded-lg border-2 border-dashed border-stone-700 hover:border-cyan-500 hover:bg-cyan-500/5 text-stone-400 hover:text-cyan-400 transition-all flex items-center justify-center gap-2 font-bold uppercase tracking-wider text-sm"
          >
            <UserPlus size={18} /> Nouveau Personnage
          </button>

          {/* ADMIN : purge totale (Electron seulement) */}
          {isElectron && (
            <button
              onClick={handlePurgeAll}
              disabled={purging}
              className={`mt-1 p-2.5 rounded-lg border text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                purgeConfirm
                  ? "border-red-500 bg-red-500/20 text-red-300 animate-pulse"
                  : "border-stone-800/60 text-stone-600 hover:text-red-500 hover:border-red-800"
              }`}
              title="ADMIN — Supprime tous les personnages de la DB (irréversible)"
            >
              <Trash2 size={12} />
              {purging ? "Purge…" : purgeConfirm ? "Confirmer la purge ?" : "Purger tous les perso."}
            </button>
          )}
        </div>

        {/* ── CENTER : Aperçu 3D ─────────────────────────────────────────── */}
        <div className="flex-1 relative bg-black/30 rounded-2xl border border-white/10 overflow-hidden">
          {selectedChar && selectedCls ? (
            <ClassPreview3D
              classId={selectedCls.id as ClassId}
              accentColor={selectedAccent}
              tint={localStorage.getItem("narvos:tint:" + selectedChar.id) || "#ffffff"}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-stone-600 italic">
              Sélectionnez un personnage pour voir son aperçu
            </div>
          )}

          {/* Badge élément */}
          {selectedCls && (
            <div
              className="absolute top-6 left-6 px-4 py-2 rounded-full font-black uppercase tracking-[0.2em] text-xs border-2"
              style={{
                background:  `${selectedCls.outfitColor}cc`,
                borderColor: selectedAccent,
                color:       selectedAccent,
              }}
            >
              {ELEMENTS[selectedCls.element].label}
            </div>
          )}
        </div>

        {/* ── RIGHT : Info + stats + bouton Play ────────────────────────── */}
        <div className="w-96 flex flex-col gap-4">
          {selectedChar && selectedCls && (
            <>
              {/* Carte identité */}
              <div className="bg-black/50 rounded-2xl p-6 border border-white/10 backdrop-blur-sm">
                <div className="text-xs uppercase tracking-[0.3em] text-stone-500 mb-2">
                  {ELEMENTS[selectedCls.element].label} · {selectedCls.role.toUpperCase()}
                </div>
                <h2
                  className="text-4xl font-black uppercase tracking-wider mb-1"
                  style={{ color: selectedAccent }}
                >
                  {selectedChar.name}
                </h2>
                <div className="text-sm text-stone-400 uppercase tracking-wider">
                  {selectedCls.label}
                </div>
                <p className="mt-4 text-sm text-stone-400 italic leading-relaxed">
                  {selectedCls.description}
                </p>
              </div>

              {/* Stats */}
              <div className="bg-black/50 rounded-2xl p-6 border border-white/10 backdrop-blur-sm">
                <div className="text-xs uppercase tracking-[0.3em] text-stone-500 mb-3">
                  Statistiques · Niveau {selectedChar.level ?? 1}
                </div>
                <div className="space-y-2 font-mono">
                  <StatBar label="PV"      value={selectedCls.baseStats.hp}          max={200} color="#ef4444" />
                  <StatBar label="Mana"    value={selectedCls.baseStats.mana}         max={200} color="#818cf8" />
                  <StatBar label="Attaque" value={selectedCls.baseStats.attackPower}  max={30}  color={selectedAccent} />
                  <StatBar label="Défense" value={selectedCls.baseStats.defense}      max={30}  color="#06b6d4" />
                  {selectedCls.baseStats.moveSpeed !== 1.0 && (
                    <div className="text-xs text-stone-500 pt-2 border-t border-stone-800">
                      Vitesse :{" "}
                      <span style={{ color: selectedAccent }}>
                        {selectedCls.baseStats.moveSpeed > 1 ? "+" : ""}
                        {Math.round((selectedCls.baseStats.moveSpeed - 1) * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Play button */}
              <button
                onClick={() => onPlay(selectedChar)}
                className="w-full py-5 rounded-2xl font-black uppercase tracking-[0.3em] text-lg flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-100"
                style={{
                  background: selectedAccent,
                  color:      "#000",
                  boxShadow:  `0 0 30px ${selectedAccent}66`,
                }}
              >
                <Play size={24} fill="currentColor" />
                Entrer dans le hub
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function TopBar({
  username,
  serverName,
  onLogout,
  onChangeServer,
}: {
  username: string;
  serverName?: string;
  onLogout: () => void;
  onChangeServer?: () => void;
}) {
  return (
    <div className="relative z-20 flex justify-between items-center bg-black/60 border-b border-white/10 px-6 py-3 backdrop-blur-sm">
      <div className="flex gap-4 items-center">
        <span className="text-white/70 text-sm font-mono">
          Compte : <span className="text-cyan-400 font-bold">{username}</span>
        </span>
        {serverName && (
          <span
            className="text-white/70 text-sm font-mono cursor-pointer hover:text-cyan-400 transition-colors"
            onClick={onChangeServer}
            title="Changer de serveur"
          >
            Serveur : <span className="text-orange-400 font-bold">{serverName}</span>
          </span>
        )}
      </div>
      <button
        onClick={onLogout}
        className="flex items-center gap-2 text-red-400 hover:text-red-300 text-xs uppercase font-bold border border-red-500/30 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-all"
      >
        <LogOut size={14} /> Déconnexion
      </button>
    </div>
  );
}

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
