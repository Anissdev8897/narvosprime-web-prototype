// ══════════════════════════════════════════════════════════════════════════════
// chat/registerAdminCommands.ts — Commandes admin enregistrées dans le chat
//
// Enregistre les commandes "/" suivantes via chatStore.registerCommand :
//   /adminmode — Bascule le mode admin (affiche/masque TOUS les outils, sans reload)
//   /noclip    — Bascule le vol libre (admin uniquement)
//   /tp x y z  — Teleporte le joueur aux coordonnees (admin uniquement, callback parent)
//   /clear     — Vide l'historique du chat (tous les joueurs)
//   /give      — Equipe une arme, ou remet le joueur a mains nues (admin)
//   /help      — Affiche la liste des commandes disponibles
//
// /help se construit tout seul depuis chatStore.getCommandNames() : aucune
// liste a maintenir en double lors de l'ajout d'une commande.
//
// Appelé une seule fois au montage du composant parent (RpgGameWorld ou similaire).
// ══════════════════════════════════════════════════════════════════════════════

import { chatStore } from "./chatStore";
import { isAdmin } from "../runtime/admin/AdminPanel";
import { gameModeStore } from "../runtime/gameModeStore";
import { noclipUi } from "../runtime/movement/noclipUi";
import { equippedWeaponStore, type WeaponSlot } from "../weapons/equippedWeaponStore";
import { weaponRegistry } from "../weapons/weaponRegistry";

/**
 * Enregistre les commandes admin dans le singleton chatStore.
 *
 * @param onTeleport — Callback optionnel appele quand /tp est utilise.
 *   Recoit les coordonnees (x, y, z) parsees depuis les arguments.
 *   Si absent, /tp affiche juste un message systeme sans action.
 */
export function registerAdminCommands(
  onTeleport?: (x: number, y: number, z: number) => void,
  onRespawn?: () => void,
): void {
  // ── /help — Liste des commandes disponibles (accessible a tous) ────────

  chatStore.registerCommand("help", () => {
    const names = chatStore.getCommandNames();
    const list = names.map((n) => `  /${n}`).join("\n");
    chatStore.pushSystem(`Commandes disponibles :\n${list}`);
  });

  // ── /clear — Vider l'historique du chat (accessible a tous) ────────────

  chatStore.registerCommand("clear", () => {
    chatStore.clear();
    chatStore.pushSystem("Historique du chat efface.");
  });

  // ── /adminmode — Basculer le mode administrateur ───────────────────────
  // Bascule gameModeStore (normal ↔ edit), qui est RÉACTIF : toutes les UI admin
  // apparaissent/disparaissent immédiatement, sans rechargement de page.
  //
  // isAdmin() reste la PERMISSION (qui a le droit d'utiliser la commande) ;
  // gameModeStore est l'INTERRUPTEUR (est-ce affiché en ce moment).

  chatStore.registerCommand("adminmode", () => {
    if (!isAdmin()) {
      chatStore.pushError("Acces refuse — droits admin requis.");
      return;
    }

    gameModeStore.toggle();

    if (gameModeStore.get() === "edit") {
      chatStore.pushAdmin(
        "Mode admin ACTIVE — outils d'edition et de personnalisation affiches.",
      );
    } else {
      chatStore.pushSystem(
        "Mode admin DESACTIVE — retour au mode jeu, outils masques.",
      );
    }
  });

  // ── /noclip — Basculer le vol libre (admin uniquement) ─────────────────

  chatStore.registerCommand("noclip", () => {
    if (!isAdmin()) {
      chatStore.pushError("Acces refuse — droits admin requis.");
      return;
    }

    const newState = !noclipUi.get();
    noclipUi.set(newState);
    chatStore.pushSystem(
      newState
        ? "NOCLIP ACTIVE — vol libre (Space monte, Ctrl descend)."
        : "NOCLIP DESACTIVE — collisions retablies.",
    );
  });

  // ── /tp x y z — Teleportation (admin uniquement) ───────────────────────
  // Parse les 3 coordonnees depuis les arguments. Si le callback onTeleport
  // est fourni, l'execute ; sinon affiche juste les coordonnees.

  chatStore.registerCommand("tp", (args) => {
    if (!isAdmin()) {
      chatStore.pushError("Acces refuse — droits admin requis.");
      return;
    }

    const parts = args.split(/\s+/).filter(Boolean);
    if (parts.length < 3) {
      chatStore.pushError("Usage : /tp <x> <y> <z>");
      return;
    }

    const x = parseFloat(parts[0]);
    const y = parseFloat(parts[1]);
    const z = parseFloat(parts[2]);

    if (isNaN(x) || isNaN(y) || isNaN(z)) {
      chatStore.pushError(
        "Coordonnees invalides. Utilisation : /tp <x> <y> <z>",
      );
      return;
    }

    if (onTeleport) {
      onTeleport(x, y, z);
      chatStore.pushSystem(
        `Teleportation vers (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}).`,
      );
    } else {
      chatStore.pushSystem(
        `Teleportation demandee vers (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}) — non connecte au mouvement.`,
      );
    }
  });

  // ── /respawn — Renvoyer le joueur au point d'apparition de la map ──────
  //
  // POURQUOI CETTE COMMANDE EXISTE.
  // La position de départ d'un personnage n'est PAS `MAP_SPAWN` : c'est sa
  // DERNIÈRE POSITION SAUVEGARDÉE (`RpgGameWorld.tsx`, initialisation de
  // `playerPos`). Un personnage sauvegardé alors qu'il était sous la carte ou
  // enfermé dans une structure y renaît à CHAQUE connexion, et se re-sauvegarde
  // au même endroit : la sauvegarde est empoisonnée, définitivement.
  //
  // Corriger `MAP_SPAWN` ne débloque pas ces personnages — la valeur n'est
  // jamais lue pour eux. Il faut pouvoir forcer le retour au point de la map.

  chatStore.registerCommand("respawn", () => {
    if (!isAdmin()) {
      chatStore.pushError("Acces refuse — droits admin requis.");
      return;
    }

    if (!onRespawn) {
      chatStore.pushError("Respawn indisponible — non connecte au monde.");
      return;
    }

    onRespawn();
    chatStore.pushAdmin(
      "Retour au point d'apparition de la map. La position sera re-sauvegardee ici.",
    );
  });

  // ── /give [id] [slot] — Equiper une arme (admin uniquement) ────────────
  //
  // `equippedWeaponStore` est un singleton HORS React : on peut donc l'ecrire
  // ici sans elargir la signature de registerAdminCommands, qui n'accepte qu'un
  // seul callback (onTeleport) et n'est appelee qu'une fois dans un useEffect
  // vide. Le store notifie ses abonnes, l'arme apparait sans rechargement.
  //
  // `/give none` remet le joueur a MAINS NUES. Ce n'est pas un ajout de
  // confort : le combo de poings ne se declenche que si aucune arme PRIMAIRE
  // n'est equipee (RpgGameWorld.tsx:1663). Sans moyen de se desequiper, les
  // animations de frappe sont intestables.

  chatStore.registerCommand("give", (args) => {
    if (!isAdmin()) {
      chatStore.pushError("Acces refuse — droits admin requis.");
      return;
    }

    const parts = args.split(/\s+/).filter(Boolean);
    const id = parts[0];
    const slot: WeaponSlot = parts[1] === "secondary" ? "secondary" : "primary";

    // Sans argument : lister ce qui est reellement equipable. On met en avant
    // les profils regles a la main (`arch_*`) — les autres sont auto-generes
    // depuis les GLB et se comptent par centaines.
    if (!id) {
      const tous = weaponRegistry.all().map((w) => w.id);
      const arch = tous.filter((w) => w.startsWith("arch_"));
      chatStore.pushSystem(
        `Usage : /give <id> [secondary]  ·  /give none pour se desequiper\n` +
        `Profils regles : ${arch.join(", ")}\n` +
        `(${tous.length} profils au total, le reste est auto-genere depuis les GLB)`,
      );
      return;
    }

    if (id === "none" || id === "rien") {
      equippedWeaponStore.set({ primary: null, secondary: null, activeSlot: "primary" });
      chatStore.pushAdmin("Mains nues — combo de poings actif (clic gauche).");
      return;
    }

    if (!weaponRegistry.has(id)) {
      const proches = weaponRegistry.all()
        .map((w) => w.id)
        .filter((w) => w.includes(id) || id.includes(w))
        .slice(0, 5);
      chatStore.pushError(
        `Arme inconnue : "${id}".` +
        (proches.length ? ` Vouliez-vous dire : ${proches.join(", ")} ?` : " Tapez /give sans argument pour la liste."),
      );
      return;
    }

    const courant = equippedWeaponStore.get();
    equippedWeaponStore.set({
      primary:   slot === "primary"   ? id : courant.primary,
      secondary: slot === "secondary" ? id : courant.secondary,
      activeSlot: slot,
    });

    chatStore.pushAdmin(`Arme equipee : ${id} (${slot}). Touche F pour la degainer.`);
  });
}
