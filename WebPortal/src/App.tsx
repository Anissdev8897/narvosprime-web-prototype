/**
 * App.tsx — Point d'entrée NARVOS PRIME.
 *
 * Flux de navigation :
 *   intro → menu → login → server_select → list (CharacterSelectScreen)
 *                                             ├─ play    → game (RpgGameWorld — runtime RPG)
 *                                             └─ create  → create (CharacterCreateScreen)
 *                                                           └─ created → game
 *
 * RUNTIME 3D : src/rpg/ (Quaternius modulaire + caméra FPS/TPS + anim + PNJ).
 *   L'ancien runtime FPS (components/fps/, components/world/, GameWorld3D) a été
 *   SUPPRIMÉ — voir AUDIT_MIGRATION.md.
 *
 * UI create/select : migré vers les classes RPG canoniques (Task #9).
 *   - Plus de HeroDef / heroes-catalog / heroToClassId()
 *   - SavedCharacter.classId contient directement un ClassId RPG
 */

import React, { useState, useEffect } from "react";
import { IntroScreen } from "./components/IntroScreen";
import { MainMenu } from "./components/MainMenu";
import { LoginScreen } from "./components/LoginScreen";
import { ServerSelection, GameServer } from "./components/ServerSelection";
import { CharacterSelectScreen, CharacterCreateScreen } from "./components/character";
import { audioManager } from "./utils/AudioManager";
import type { SavedCharacter } from "./types";
// ── Runtime RPG (Quaternius modulaire + caméra/anim neuves) ──────────────────
import { RpgGameWorld } from "./rpg";
import type { ClassId } from "./rpg/types";
import { useUiSounds } from "./rpg/runtime/uiSound";
import { loadAppearance, loadAppearanceDb, type Appearance } from "./rpg/persistence/appearance";
import { coerceAvatarId } from "./rpg/characters/playerAvatars";
import { BootLoadingScreen } from "./rpg/runtime/loading/BootLoadingScreen";
import { ForgeMapScreen } from "./components/forge/ForgeMapScreen";
import { ForgeEquipements } from "./rpg/characters/ForgeEquipements";
import { GameErrorBoundary } from "./components/GameErrorBoundary";
import SandboxPrototype from "./rpg/sandbox/SandboxPrototype";

type Stage = "intro" | "menu" | "login" | "boot_load" | "server_select" | "list" | "create" | "game"
  // `forge_chars` et `forge_editor` retirés : passés en prototypes.
  | "forge_login" | "forge_denied" | "forge" | "forge_equip"
  // Bancs d'essai isolés. Écrans PAIRS de `game`, pas des modes du jeu : ils ne
  // chargent ni map, ni HUD, ni PNJ. Cf. docs/ARCHITECTURE_PROTOTYPES.md.
  | "sandbox";

/**
 * Ouvre un prototype dans l'onglet courant — ou rien du tout en production.
 *
 * `Prototype/` n'a AUCUNE entrée dans le build (pas de multi-pages) : en prod
 * le lien tomberait sur le fallback SPA de Vite, qui renvoie `text/html` en 200
 * au lieu d'un 404 — donc une page blanche, sans erreur, impossible à
 * diagnostiquer. Renvoyer `undefined` fait disparaître le bouton, ce qui est la
 * seule réponse honnête : la fonctionnalité n'existe pas dans cette build.
 */
const ouvrirPrototype = (dossier: string): (() => void) | undefined =>
  import.meta.env.DEV
    ? () => { window.location.href = `/Prototype/${dossier}/`; }
    : undefined;

const App: React.FC = () => {
  useUiSounds(); // sons d'interface globaux (clic/survol) sur tous les boutons
  const [stage, setStage]               = useState<Stage>("intro");
  const [username, setUsername]         = useState<string | null>(null);
  const [userRole, setUserRole]         = useState<string | null>(null);
  const [currentServer, setCurrentServer] = useState<GameServer | null>(null);

  // Le perso actuellement engagé dans le monde de jeu
  const [activeCharacter, setActiveCharacter] = useState<SavedCharacter | null>(null);
  // FORGE MAP : map à tester depuis l'atelier (sinon spawn normal "orbital").
  const [forgeTestMap, setForgeTestMap] = useState<string | null>(null);
  // Écran de chargement entre la sélection et le monde de jeu
  const [gameReady, setGameReady] = useState(false);
  // Apparence (teinte + avatar) : localStorage instantané puis base (cross-device).
  const [appearance, setAppearance] = useState<Appearance>({ tint: "#ffffff", model: "wraith" });
  /**
   * Création de personnage IMPOSÉE : le roster est vide, le joueur ne peut pas
   * revenir à la liste.
   *
   * Drapeau local plutôt que remontée de `useCharacterStorage` dans App : deux
   * consommateurs du hook = deux chargements concurrents du roster, donc deux
   * fenêtres de timeout et deux occasions de faux positif.
   */
  const [forcedCreate, setForcedCreate] = useState(false);

  useEffect(() => {
    if (!activeCharacter) return;
    setAppearance(loadAppearance(activeCharacter.id)); // instantané (cache local)
    let cancelled = false;
    loadAppearanceDb(activeCharacter.id).then((a) => { if (a && !cancelled) setAppearance(a); }); // base
    return () => { cancelled = true; };
  }, [activeCharacter]);

  // ── Audio par stage ─────────────────────────────────────────────────────────
  useEffect(() => {
    // Menus MUETS (aucune musique auto sur intro/login/serveurs) — MAIS on ne coupe PLUS
    // à l'entrée en JEU : ce stopAll, déclenché aussi sur stage→"game", gagnait la course
    // contre le setMap("orbital") de RpgGameWorld (effets enfant d'abord, parent ensuite)
    // → le hub n'avait JAMAIS ni musique ni ambiance. En jeu, RpgGameWorld pilote l'audio.
    if (stage !== "game") audioManager.stopAll();
  }, [stage]);

  // ── F8 : bascule vers le banc d'essai (dev) ─────────────────────────────────
  // ⚠ F8 est DÉJÀ pris par le panneau admin (RpgGameWorld.tsx). Ce listener est
  // global, l'autre est monté avec le monde 3D : sans garde, une frappe en jeu
  // déclencherait les deux. On refuse donc la bascule depuis `game` — le banc
  // s'ouvre depuis les menus, ce qui suffit puisqu'il ne charge rien du jeu.
  //
  // `setStage` en forme fonctionnelle : la dépendance vide garde le listener
  // posé une seule fois, et l'état lu reste le courant (pas de closure périmée).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "F8") return;
      setStage((s) => (s === "game" ? s : s === "sandbox" ? "menu" : "sandbox"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Écran de chargement : reset à l'entrée du jeu + filet de sécurité 12s ────
  useEffect(() => {
    if (stage !== "game") return;
    setGameReady(false);
    // Filet de sécurité long : on évite TOUTE apparition prématurée du joueur.
    // Le vrai signal de fin de chargement reste <SceneReady> (Suspense résolu).
    // 120 s était PLUS COURT que le chargement réel. Mesuré sur la Forge :
    // 165 s pour les 8 chunks (14,4 + 23,4 + 18,1 + 35,1 + 34,1 + 19,8 + 14,3
    // + 5,8 s). Le filet tirait donc systématiquement, révélant le jeu par
    // dessus une map encore en assemblage — exactement ce qu'il devait éviter.
    //
    // Il doit rester SUPÉRIEUR à la soupape de StreamingPuzzleMap (détection de
    // blocage, 45 s d'inactivité) : c'est elle qui doit trancher en premier, en
    // connaissance de cause. Celui-ci n'est qu'un dernier recours contre un
    // blocage total du pipeline.
    const safety = setTimeout(() => {
      console.warn("[App] Filet de sécurité 5 min déclenché — le chargement normal n'a pas abouti à temps");
      setGameReady(true);
    }, 300000);
    return () => clearTimeout(safety);
  }, [stage]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleLogin = (user: string, role: string) => {
    setUsername(user);
    setUserRole(role);
    // Boot : chargement GLOBAL (avatar, packs d'anims, armes, hydratation DB) derrière un
    // écran de progression AVANT le choix du serveur → entrées en jeu beaucoup plus rapides.
    setStage("boot_load");
  };

  const handleServerSelect = (server: GameServer) => {
    setCurrentServer(server);
    setStage("list");
  };

  /** FORGE MAP : même écran de connexion, mais l'entrée est RÉSERVÉE aux admins.
   *  Rôle DB "ADMIN" ou flag local narvos:admin (mode dev) — sinon ACCÈS REFUSÉ. */
  const handleForgeLogin = (user: string, role: string) => {
    setUsername(user);
    setUserRole(role);
    const admin = role?.toUpperCase() === "ADMIN" || localStorage.getItem("narvos:admin") === "1";
    setStage(admin ? "forge" : "forge_denied");
  };

  /** Depuis CharacterSelectScreen — plus de HeroDef. */
  const handlePlay = (character: SavedCharacter) => {
    setActiveCharacter(character);
    setStage("game");
  };

  const handleExitGame = () => {
    setActiveCharacter(null);
    setStage("list");
  };

  const handleCreateNew = () => setStage("create");

  /** Depuis CharacterCreateScreen — plus de HeroDef, direction jeu directement. */
  const handleCharacterCreated = (character: SavedCharacter) => {
    // Le roster n'est plus vide : lever la contrainte, sinon la prochaine
    // visite de l'écran de création serait encore sans issue.
    setForcedCreate(false);
    setActiveCharacter(character);
    setStage("game");
  };

  const handleLogout = () => {
    setForcedCreate(false);
    setUsername(null);
    setUserRole(null);
    setCurrentServer(null);
    setActiveCharacter(null);
    setStage("menu");
  };

  // ── Rendering ───────────────────────────────────────────────────────────────
  //
  // La sandbox passe AVANT tout le reste : elle doit s'ouvrir depuis n'importe
  // quel écran, y compris pendant une partie. C'est un banc d'essai, pas une
  // étape du parcours joueur.
  // Sortie = F8 à nouveau (le composant n'expose aucune prop : il reste
  // strictement autonome, c'est App qui possède la navigation).
  if (stage === "sandbox") {
    return <SandboxPrototype />;
  }

  if (stage === "intro") {
    return <IntroScreen onDone={() => setStage("menu")} />;
  }

  if (stage === "menu") {
    return (
      <MainMenu
        onPlay={() => setStage("login")}
        onForgeMap={() => setStage("forge_login")}
        onQuit={() => { try { window.close(); } catch { /* web : pas d'effet */ } }}
      />
    );
  }

  if (stage === "forge_login") {
    return <LoginScreen onLogin={handleForgeLogin} />;
  }

  if (stage === "forge_denied") {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#0a0502", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 18, fontFamily: "monospace" }}>
        <div style={{ fontSize: 46, fontWeight: 900, letterSpacing: "0.3em", color: "#ff4444", textTransform: "uppercase" }}>
          Accès refusé
        </div>
        <div style={{ color: "#c9a285", fontSize: 13 }}>
          Le mode Forge Map est réservé aux administrateurs.
        </div>
        <button onClick={() => setStage("menu")}
          style={{ marginTop: 12, padding: "10px 26px", fontWeight: 900, letterSpacing: "0.2em", cursor: "pointer",
            background: "transparent", color: "#ffe9d6", border: "1px solid #ff8c3a66", borderRadius: 8, fontFamily: "monospace" }}>
          ← Retour au menu
        </button>
      </div>
    );
  }

  if (stage === "forge" && username) {
    return (
      <ForgeMapScreen
        username={username}
        onExit={() => setStage("menu")}
        onOpenEditor={ouvrirPrototype("Proto_editeur")}
        onOpenChars={ouvrirPrototype("Proto_charactere")}
        onOpenEquip={() => setStage("forge_equip")}
        onTestMap={(mapId) => { setForgeTestMap(mapId); setStage("game"); }}
      />
    );
  }

  // NOTE — `forge_chars` et `forge_editor` ont été retirés. Le créateur de
  // personnage modulaire et l'éditeur de monde sont passés en PROTOTYPES
  // (Prototype/Proto_charactere, Prototype/Proto_editeur) : inachevés, ils
  // n'ont plus leur place dans le parcours joueur. Ne plus les importer ici les
  // sort du graphe de modules du jeu — c'est ça, « sortir du jeu de base ».
  //
  // ⚠ Ce qui RESTE dans `src/`, volontairement : les DONNÉES, pas les écrans.
  //   • `characters/modular/` — cinq modules vivants en dépendent :
  //     `loot/modularItems`, `loot/LootRegistry`, `npc/merchants` (marchand
  //     Vasska), `runtime/InventoryPanel`, `characters/customCharacterStore`.
  //   • `rpg/forge/` — `RpgGameWorld` monte `ForgeBuiltMap`, `hydrateAll` lit
  //     `forgeSceneStore`, et `forgeTheme` habille la moitié des panneaux.
  // Déplacer l'un ou l'autre inverserait la règle « Prototype ne dépend jamais
  // de src » et casserait le jeu. Cf. docs/ARCHITECTURE_PROTOTYPES.md.

  if (stage === "forge_equip") {
    // Bibliothèque d'équipements : pièces réutilisables (casque/cape/arme) à offset pré-réglé.
    return <ForgeEquipements onExit={() => setStage("forge")} />;
  }

  if (stage === "login") {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (stage === "boot_load") {
    return <BootLoadingScreen onDone={() => setStage("server_select")} />;
  }

  if (stage === "server_select") {
    return <ServerSelection username={username || "Invité"} onSelect={handleServerSelect} />;
  }

  if (stage === "list" && username) {
    return (
      <CharacterSelectScreen
        username={username}
        serverName={currentServer?.name}
        serverId={currentServer?.id}
        onPlay={handlePlay}
        onCreateNew={handleCreateNew}
        onLogout={handleLogout}
        onChangeServer={() => setStage("server_select")}
        onRosterEmpty={() => { setForcedCreate(true); setStage("create"); }}
      />
    );
  }

  if (stage === "create" && username) {
    return (
      <CharacterCreateScreen
        username={username}
        serverId={currentServer?.id}
        // En création FORCÉE, pas de retour : la liste est vide, y revenir
        // relancerait immédiatement la redirection. La seule sortie est la
        // déconnexion.
        onCancel={forcedCreate ? undefined : () => setStage("list")}
        onLogout={forcedCreate ? handleLogout : undefined}
        onCreated={handleCharacterCreated}
      />
    );
  }

  if (stage === "game" && (activeCharacter || forgeTestMap)) {
    // Modèle 3D unique (Sorcier) ; la classe ne change que l'élément, les stats et la teinte.
    // FORGE MAP : test SANS personnage → perso jetable "forge_test" + spawn sur la map testée.
    const classId: ClassId = (activeCharacter?.classId as ClassId) ?? "warrior_bruiser";
    const tint = appearance.tint;
    const modelId = coerceAvatarId(appearance.model); // avatar retiré du roster → fallback (anti-404)

    console.log(`[App] Lancement jeu — perso: ${activeCharacter?.name ?? "FORGE TEST"} | classId: ${classId} | map: ${forgeTestMap ?? "forge"}`);

    const exitGame = forgeTestMap ? () => { setForgeTestMap(null); setStage("forge"); } : handleExitGame;
    return (
      <>
        <GameErrorBoundary onExit={exitGame}>
        <RpgGameWorld
          classId={classId}
          characterId={activeCharacter?.id ?? "forge_test"}
          characterName={activeCharacter?.name ?? "Testeur de la Forge"}
          serverType={(currentServer?.type as string) === "HEROIC" ? "HEROIC" : "NORMAL"}
          mapId={forgeTestMap ?? "forge"}  // spawn par défaut sur la Forge
          forceMap={!!forgeTestMap}           // test Forge : impose la map (ignore la sauvegarde)
          tint={tint}
          modelId={modelId}
          onExit={exitGame}
          onReady={() => setGameReady(true)}
        />
        </GameErrorBoundary>
        {!gameReady && (
          <div className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden">
            <video
              className="absolute inset-0 w-full h-full object-cover"
              src="/models/launcher/ecran_dechargement.mp4"
              autoPlay loop muted playsInline
            />
            <div className="relative z-10 text-cyan-300 font-black uppercase tracking-[0.3em] text-lg animate-pulse">
              Chargement…
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback : état inattendu → login
  return <LoginScreen onLogin={handleLogin} />;
};

export default App;
