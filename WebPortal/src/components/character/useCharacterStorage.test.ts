// ── Test 2: removeCharacter sets deleteError on failure ────────────────────────
//
// `useCharacterStorage` distingue l'erreur de suppression (`deleteError`) de
// l'erreur générique (`error`). Le hook retourne un état `deleteError` dédié
// pour que les appelants puissent gérer séparément les erreurs de chargement
// et de suppression.
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from "vitest";

// ═════════════════════════════════════════════════════════════════════════════
//  vi.hoisted() — évite le TDZ causé par le hoisting de vi.mock()
// ═════════════════════════════════════════════════════════════════════════════

const { mockDeleteCharacter, mockFetchSavedCharacters } = vi.hoisted(() => ({
  mockDeleteCharacter: vi.fn(),
  mockFetchSavedCharacters: vi.fn(),
}));

// ═════════════════════════════════════════════════════════════════════════════
// MOCK STORAGE
// ═════════════════════════════════════════════════════════════════════════════

vi.mock("../../utils/storage", () => ({
  fetchSavedCharacters: (...args: any[]) => mockFetchSavedCharacters(...args),
  saveCharacter: vi.fn(),
  deleteCharacter: (...args: any[]) => mockDeleteCharacter(...args),
}));

// ═════════════════════════════════════════════════════════════════════════════
// MOCK progressionStore
// ═════════════════════════════════════════════════════════════════════════════

vi.mock("../../rpg/stats/progressionStore", () => ({
  loadProgression: vi.fn().mockReturnValue(null),
}));

// ═════════════════════════════════════════════════════════════════════════════
// MOCK REACT — exposé pour inspection directe des états
// ═════════════════════════════════════════════════════════════════════════════

export let reactStates: any[] = [];
export let reactSetters: Array<(v: any) => void> = [];
let reactCallIdx = 0;

export function __resetReactMock() {
  reactCallIdx = 0;
  reactStates = [];
  reactSetters = [];
}

vi.mock("react", () => ({
  useState: (init: any) => {
    const i = reactCallIdx++;
    if (reactStates.length <= i) {
      reactStates.push(init);
      reactSetters.push((next: any) => {
        reactStates[i] = typeof next === "function" ? next(reactStates[i]) : next;
      });
    }
    return [reactStates[i], reactSetters[i]];
  },
  useCallback: (fn: any) => fn,
  useEffect: (fn: any) => {
    fn();
  },
  useRef: (v: any) => ({ current: v }),
  useMemo: (fn: any) => fn(),
}));

// ═════════════════════════════════════════════════════════════════════════════

import { useCharacterStorage } from "./useCharacterStorage";
import type { SavedCharacter } from "../../types";
import type { ClassId } from "../../rpg/types";

function makeChar(id: string): SavedCharacter {
  return {
    id,
    name: `Test_${id}`,
    classId: "Warrior" as ClassId,
    gender: "M",
    colors: { skin: "#e0c19e", hair: "#4a3728", jacket: "#888888" },
    headIndex: 0,
    level: 1,
    server: "local",
    username: "testuser",
    spriteDataUrl: "",
    lastMap: { x: 0, y: 0 },
    createdAt: Date.now(),
  };
}

describe("useCharacterStorage — removeCharacter", () => {
  beforeEach(() => {
    __resetReactMock();
    vi.clearAllMocks();
  });

  // ── Test : deleteError exposé par le hook ──────────────────────────────────

  it("deleteError is exposed by the hook", () => {
    // ═══════════════════════════════════════════════════════════════════════
    //  `useCharacterStorage` retourne `deleteError: Error | null` dans son
    //  type de retour, permettant aux appelants de distinguer les erreurs
    //  de suppression des erreurs de chargement.
    // ═══════════════════════════════════════════════════════════════════════

    const hook = useCharacterStorage("testuser", "local");

    // ═════════════════════════════════════════════════════════════════════
    //  `deleteError` fait partie du type de retour et vaut null par défaut.
    // ═════════════════════════════════════════════════════════════════════
    expect("deleteError" in hook).toBe(true);
  });

  // ── Test : la suppression qui échoue conserve le personnage ────────────────

  it("character remains in list and deleteError is set when deletion fails", async () => {
    // ═══════════════════════════════════════════════════════════════════════
    //  Scénario : l'utilisateur tente de supprimer un personnage, mais la
    //  couche storage échoue (DB inaccessible).
    //
    //  Comportement garanti :
    //    1. `deleteError` est positionné avec le message d'erreur
    //    2. Le personnage reste dans la liste (pas de suppression optimiste)
    // ═══════════════════════════════════════════════════════════════════════

    const c = makeChar("char-fail");

    mockFetchSavedCharacters.mockResolvedValue({
      status: "ok" as const,
      characters: [c],
    });
    mockDeleteCharacter.mockResolvedValue({
      success: false,
      error: "Database connection lost",
    });

    useCharacterStorage("testuser", "local");

    // Flush microtasks (useEffect → refresh → await fetchSavedCharacters)
    await new Promise<void>((r) => setTimeout(r, 0));

    // L'index 0 = characters, index 2 = error (les 4 états sont dans l'ordre)
    // Après refresh() : reactStates[0] = [c]
    expect(reactStates[0]).toHaveLength(1);
    expect(reactStates[0][0].id).toBe("char-fail");

    // Appelle removeCharacter via le setter capturé... 
    // Mais removeCharacter n'est pas un setter, c'est une fonction async
    // retournée par le hook. On doit l'appeler depuis le hook.
    //
    // On récupère la fonction removeCharacter depuis l'appel au hook :
    const hook = useCharacterStorage("testuser", "local");
    // (deuxième "render" — reset d'abord)
    // En pratique on refait tout proprement :

    // Nettoyage + re-montage
    __resetReactMock();
    vi.clearAllMocks();

    mockFetchSavedCharacters.mockResolvedValue({
      status: "ok" as const,
      characters: [c],
    });
    mockDeleteCharacter.mockResolvedValue({
      success: false,
      error: "Database connection lost",
    });

    const hook2 = useCharacterStorage("testuser", "local");
    await new Promise<void>((r) => setTimeout(r, 0));

    // Pre-supression : le perso est là
    expect(reactStates[0]).toHaveLength(1);

    await hook2.removeCharacter("char-fail");

    // ═════════════════════════════════════════════════════════════════════
    //  Assertions sur le comportement garanti :
    // ═════════════════════════════════════════════════════════════════════

    // 1. deleteError doit être positionné
    //    Note : le mock React ne re-rend pas → hook2.deleteError est figé
    //    à la valeur au moment de l'appel. On lit reactStates[3] directement
    //    (ordre des useState : characters(0), loading(1), error(2), deleteError(3), hasLoaded(4))
    expect(reactStates[3]).toBeTruthy();

    // 2. Le perso reste dans la liste — on lit l'état directement
    //    (reactStates[0] est mis à jour par le setter de characters)
    expect(reactStates[0]).toHaveLength(1);
    expect(reactStates[0][0].id).toBe("char-fail");
  });
});
