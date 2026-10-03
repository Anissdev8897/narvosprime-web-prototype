// ══════════════════════════════════════════════════════════════════════════════
// chat/chatStore.ts — Singleton de chat in-game NARVOS PRIME
//
// Même pattern que npcRegistry / noclipUi : objet mutable singleton, exposé
// à React via useSyncExternalStore. Zéro dépendance React dans la classe elle-même.
//
// Fonctionnalités :
//   • Envoi de messages joueur, système, admin, erreur
//   • Parsing de commandes "/" avec dispatch vers des handlers enregistrés
//   • Historique limité (200 messages max, les anciens sont purgés)
//   • clear() au changement de map si besoin
// ══════════════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";

/** Types de messages affichables dans le chat. */
export type ChatMessageType = "player" | "system" | "admin" | "error";

/** Structure d'un message dans l'historique. */
export interface ChatMessage {
  /** Identifiant unique (timestamp + suffix aléatoire). */
  id: string;
  /** Nom de l'expéditeur (joueur, "Système", "Admin"). */
  sender: string;
  /** Contenu textuel du message. */
  text: string;
  /** Horodatage Unix ms. */
  timestamp: number;
  /** Catégorie visuelle du message. */
  type: ChatMessageType;
}

/** Signature d'un handler de commande "/" enregistré. */
type CommandHandler = (args: string) => void;

/** Callback de notification pour useSyncExternalStore. */
type Listener = () => void;

// ── Classe ChatStore ─────────────────────────────────────────────────────────

class ChatStore {
  /** Historique courant. */
  private messages: ChatMessage[] = [];
  /** Souscripteurs React (useSyncExternalStore). */
  private subs = new Set<Listener>();
  /** Registre des commandes "/" disponibles. */
  private commands = new Map<string, CommandHandler>();
  /** Nombre maximum de messages conservés. */
  private maxMessages = 200;

  // ── Notification ──────────────────────────────────────────────────────

  /** Notifie tous les abonnés d'un changement d'état. */
  private notify(): void {
    for (const fn of this.subs) fn();
  }

  // ── Commandes ─────────────────────────────────────────────────────────

  /**
   * Enregistre une commande "/" disponible dans le chat.
   * @param name — Nom de la commande (sans le "/"), ex: "help"
   * @param handler — Fonction appelée avec les arguments de la commande
   */
  registerCommand(name: string, handler: CommandHandler): void {
    this.commands.set(name.toLowerCase(), handler);
  }

  /**
   * Retourne les noms de toutes les commandes enregistrées.
   * Utile pour /help.
   */
  getCommandNames(): string[] {
    return Array.from(this.commands.keys());
  }

  // ── Envoi ─────────────────────────────────────────────────────────────

  /**
   * Envoie un message ou exécute une commande "/".
   * Point d'entrée principal depuis l'UI.
   */
  send(sender: string, text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Détection et dispatch de commande "/"
    if (trimmed.startsWith("/")) {
      const spaceIdx = trimmed.indexOf(" ");
      const cmd =
        spaceIdx === -1
          ? trimmed.slice(1)
          : trimmed.slice(1, spaceIdx);
      const args =
        spaceIdx === -1
          ? ""
          : trimmed.slice(spaceIdx + 1).trim();

      const handler = this.commands.get(cmd.toLowerCase());
      if (handler) {
        handler(args);
        return;
      }

      // Commande inconnue → message d'erreur
      this.pushMessage({
        sender: "Systeme",
        text: `Commande inconnue : /${cmd}`,
        type: "error",
      });
      return;
    }

    // Message joueur classique
    this.pushMessage({ sender, text: trimmed, type: "player" });
  }

  /** Ajoute un message système (événement de jeu, info, etc.). */
  pushSystem(text: string): void {
    this.pushMessage({ sender: "Systeme", text, type: "system" });
  }

  /** Ajoute un message admin (annonces, notifications privilégiées). */
  pushAdmin(text: string): void {
    this.pushMessage({ sender: "Admin", text, type: "admin" });
  }

  /** Ajoute un message d'erreur. */
  pushError(text: string): void {
    this.pushMessage({ sender: "Systeme", text, type: "error" });
  }

  // ── Stockage interne ──────────────────────────────────────────────────

  /**
   * Pousse un message dans l'historique avec ID et timestamp auto-générés.
   * Purge les messages les plus anciens si la limite est dépassée.
   */
  private pushMessage(
    partial: Omit<ChatMessage, "id" | "timestamp">,
  ): void {
    const msg: ChatMessage = {
      ...partial,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };
    this.messages.push(msg);

    // Purge si on dépasse la capacité
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }

    this.notify();
  }

  // ── Accesseurs pour useSyncExternalStore ───────────────────────────────
  // Déclarés en arrow pour capturer `this` (passés comme callbacks).

  /** Retourne la liste courante de messages (lecture seule). */
  getMessages = (): readonly ChatMessage[] => this.messages;

  /** Souscrit aux changements. Retourne la fonction de désinscription. */
  subscribe = (fn: Listener): (() => void) => {
    this.subs.add(fn);
    return () => {
      this.subs.delete(fn);
    };
  };

  // ── Utilitaires ───────────────────────────────────────────────────────

  /** Vide tout l'historique (changement de map, /clear, etc.). */
  clear(): void {
    this.messages = [];
    this.notify();
  }
}

// ── Singleton exporté ────────────────────────────────────────────────────────

export const chatStore = new ChatStore();

// Message de bienvenue au démarrage du chat
chatStore.pushSystem("Bienvenue sur Narvos Prime, aventurier !");

// ── Hook React ──────────────────────────────────────────────────────────────

/**
 * Hook pour consommer la liste de messages dans un composant React.
 * Ne re-render QUE les composants abonnés (pas tout le HUD).
 */
export function useChatMessages(): readonly ChatMessage[] {
  return useSyncExternalStore(chatStore.subscribe, chatStore.getMessages);
}
