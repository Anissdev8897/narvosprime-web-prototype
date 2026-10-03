import { ChatMessage, ChatChannel, NetworkMessageType, NetworkMessage } from '../../types/network';
import { Faction } from '../../types';
import { INetworkService } from './INetworkService';

/**
 * Service de chat multijoueur
 */
export class ChatService {
  private static instance: ChatService;
  private messages: ChatMessage[] = [];
  private maxMessages = 100;
  private networkService: INetworkService | null = null;
  private messageCallbacks: ((message: ChatMessage) => void)[] = [];

  private constructor() {}

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  // Initialiser avec le service réseau
  public initialize(networkService: INetworkService): void {
    this.networkService = networkService;
    
    networkService.onMessage((message) => {
      if (message.type === NetworkMessageType.CHAT_MESSAGE) {
        this.handleChatMessage(message);
      }
    });
  }

  // Envoyer un message
  public sendMessage(
    uid: string,
    username: string,
    message: string,
    channel: ChatChannel,
    faction?: Faction
  ): boolean {
    if (!this.networkService) {
      return false;
    }

    const chatMessage: ChatMessage = {
      uid,
      username,
      message: message.trim(),
      channel,
      timestamp: Date.now(),
      faction
    };

    // Valider le message
    if (!this.validateMessage(chatMessage)) {
      return false;
    }

    // Envoyer au réseau
    this.networkService.send({
      type: NetworkMessageType.CHAT_MESSAGE,
      timestamp: Date.now(),
      data: chatMessage
    });

    // Ajouter localement
    this.addMessage(chatMessage);
    return true;
  }

  // Recevoir un message
  private handleChatMessage(networkMessage: NetworkMessage): void {
    const chatMessage = networkMessage.data as ChatMessage;
    this.addMessage(chatMessage);
    this.messageCallbacks.forEach(cb => cb(chatMessage));
  }

  // Ajouter un message à l'historique
  private addMessage(message: ChatMessage): void {
    this.messages.push(message);
    
    // Limiter l'historique
    if (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }
  }

  // Valider un message
  private validateMessage(message: ChatMessage): boolean {
    // Vérifier la longueur
    if (message.message.length === 0 || message.message.length > 500) {
      return false;
    }

    // Vérifier les caractères interdits (à personnaliser)
    const forbiddenChars = /[<>]/;
    if (forbiddenChars.test(message.message)) {
      return false;
    }

    return true;
  }

  // Obtenir les messages
  public getMessages(channel?: ChatChannel, limit?: number): ChatMessage[] {
    let filtered = this.messages;
    
    if (channel) {
      filtered = filtered.filter(m => m.channel === channel);
    }

    if (limit) {
      filtered = filtered.slice(-limit);
    }

    return filtered;
  }

  // Écouter les nouveaux messages
  public onMessage(callback: (message: ChatMessage) => void): void {
    this.messageCallbacks.push(callback);
  }

  // Envoyer un message système
  public sendSystemMessage(message: string): void {
    const systemMessage: ChatMessage = {
      uid: 'SYSTEM',
      username: 'Système',
      message,
      channel: ChatChannel.SYSTEM,
      timestamp: Date.now()
    };

    this.addMessage(systemMessage);
    this.messageCallbacks.forEach(cb => cb(systemMessage));
  }

  // Effacer l'historique
  public clearHistory(): void {
    this.messages = [];
  }
}

export const chatService = ChatService.getInstance();

