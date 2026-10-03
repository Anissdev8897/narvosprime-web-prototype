/**
 * useCharacterStorage.ts — Hook unifié pour load/save/delete persos.
 *
 * Centralise tous les appels MySQL/Electron/IndexedDB derrière une seule API.
 * Garantit qu'on n'a PAS de doublons de logique réseau dans App.tsx ou ailleurs.
 *
 * Sources sous-jacentes utilisées (utils/storage.ts) :
 *   - getSavedCharacters → Electron MySQL OU WebSocket fallback
 *   - saveCharacter      → Electron createCharacter handler
 *   - deleteCharacter    → MySQL DELETE
 *
 * Le hook expose :
 *   - characters       : SavedCharacter[]  (état réactif)
 *   - loading          : bool
 *   - error            : Error | null
 *   - refresh()        : refetch la liste
 *   - createCharacter(data) → Promise<SavedCharacter>
 *   - removeCharacter(id)   → Promise<void>
 *
 * Pourquoi un hook React et pas un service ?
 *   - Réactif : tout consommateur se re-render quand un perso est créé/supprimé
 *   - Évite la prop drilling de `setSavedCharacters` partout dans App.tsx
 *   - Permet de tester unitairement (un seul mock du module utils/storage)
 */

import { useState, useEffect, useCallback } from "react";
import {
  fetchSavedCharacters,
  saveCharacter,
  deleteCharacter as deleteCharacterStorage,
} from "../../utils/storage";
import type { SavedCharacter } from "../../types";
import type { ClassId } from "../../rpg/types";
import { loadProgression } from "../../rpg/stats/progressionStore";

/**
 * Enrichit chaque SavedCharacter avec son niveau RÉEL lu depuis
 * progressionStore (localStorage). Pourquoi : `SavedCharacter.level` reste
 * figé à 1 (champ DB legacy Dofus), alors que le vrai niveau RPG évolue dans
 * `progressionStore.stats.level`. Sans ce merge, la liste afficherait
 * toujours "Niv. 1" même après plusieurs heures de jeu.
 *
 * Pure et défensif : si aucune progression sauvegardée → on garde le niveau
 * source (1). On ne mute pas le tableau d'entrée.
 */
function enrichWithProgressionLevels(list: SavedCharacter[]): SavedCharacter[] {
  return list.map((c) => {
    const prog = loadProgression(c.id);
    const realLvl = prog?.stats?.level;
    if (typeof realLvl === "number" && realLvl > 0 && realLvl !== c.level) {
      return { ...c, level: realLvl };
    }
    return c;
  });
}

interface UseCharacterStorageResult {
  characters: SavedCharacter[];
  loading: boolean;
  error: Error | null;
  /** Erreur de suppression (distinct de l'erreur de lecture pour ne pas casser rosterVide). */
  deleteError: string | null;
  /**
   * Une lecture du roster s'est-elle TERMINÉE au moins une fois ?
   *
   * ── POURQUOI PAS `!loading` ──────────────────────────────────────────────
   *
   * `loading` démarre à `false` : au tout premier rendu, avant même que
   * `refresh` ne parte, `!loading && characters.length === 0` est VRAI. Toute
   * décision prise sur ce signal — envoyer en création forcée, autoriser une
   * purge — se déclencherait sur un état qui n'a encore rien mesuré.
   *
   * `hasLoaded` ne passe à `true` que dans le `finally` de `refresh`.
   */
  hasLoaded: boolean;
  refresh: () => Promise<void>;
  createCharacter: (params: CreateCharacterParams) => Promise<SavedCharacter>;
  removeCharacter: (id: string) => Promise<boolean>;
}

export interface CreateCharacterParams {
  name: string;
  /** Classe RPG canonique (Quaternius). */
  classId: ClassId;
  /** Genre du personnage — 'M' | 'F'. */
  gender: "M" | "F";
  username: string;
  serverId?: string;
}

export function useCharacterStorage(
  username: string | null,
  serverId?: string,
): UseCharacterStorageResult {
  const [characters, setCharacters] = useState<SavedCharacter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!username) {
      setCharacters([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSavedCharacters(username, serverId);

      // Une source muette n'est PAS un roster vide. La traiter en erreur évite
      // qu'une panne de 2 s soit lue comme « ce joueur n'a aucun personnage ».
      if (res.status === "unavailable") {
        setError(new Error(`Stockage indisponible — ${res.reason}`));
        return;
      }

      // Fusionne le niveau réel (progressionStore) par-dessus le niveau DB.
      // Conséquence : si un perso est niveau 6 en sauvegarde RPG, "Niv. 6"
      // s'affiche dans la liste — pas "Niv. 1".
      setCharacters(enrichWithProgressionLevels(res.characters));
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
      // Dans le `finally` : une lecture qui échoue a quand même EU LIEU. Le
      // consommateur doit pouvoir distinguer « pas encore mesuré » de
      // « mesuré, et voici le résultat, erreur comprise ».
      setHasLoaded(true);
    }
  }, [username, serverId]);

  // Auto-load à la connexion
  useEffect(() => {
    refresh();
  }, [refresh]);

  const createCharacter = useCallback(
    async ({
      name,
      classId,
      gender,
      username: createUsername,
      serverId: createServerId,
    }: CreateCharacterParams): Promise<SavedCharacter> => {
      if (!name.trim()) throw new Error("Nom requis");
      if (name.trim().length < 2) throw new Error("Nom trop court (min 2 caractères)");
      if (name.length > 16) throw new Error("Nom trop long (max 16 caractères)");

      const newChar: SavedCharacter = {
        id: `char_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: name.trim(),
        classId,
        gender,
        colors: {
          // Champs legacy pour compat DB — la couleur réelle est dérivée de l'élément en jeu
          skin: "#e0c19e",
          hair: "#4a3728",
          jacket: "#888888",
        },
        headIndex: 0,
        level: 1,
        server: createServerId ?? "local",
        username: createUsername,
        spriteDataUrl: "",
        lastMap: { x: 0, y: 0 },
        createdAt: Date.now(),
      };

      // `saveCharacter` renvoie `null` en cas d'échec SANS lever. Laisser
      // passer un `null` ferait croire à une création réussie : l'appelant
      // fermerait l'écran, le roster resterait vide, et en création forcée le
      // joueur reboucle indéfiniment sur le même formulaire.
      const savedId = await saveCharacter(newChar, createUsername, createServerId);
      if (!savedId) throw new Error("Échec de l'enregistrement du personnage");

      await refresh();
      return newChar;
    },
    [refresh],
  );

  const removeCharacter = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await deleteCharacterStorage(id, username);
      if (!result.success) {
        setDeleteError(result.error ?? 'Échec de la suppression du personnage');
        return false;
      }
      setDeleteError(null);
      setCharacters((prev) => prev.filter((c) => c.id !== id));
      return true;
    },
    [username],
  );

  return {
    characters,
    loading,
    error,
    deleteError,
    hasLoaded,
    refresh,
    createCharacter,
    removeCharacter,
  };
}
