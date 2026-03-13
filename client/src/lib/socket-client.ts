
import { io, Socket } from 'socket.io-client';

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  content: string;
  createdAt: string;
  read: boolean;
}

interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: Message;
  updatedAt: string;
  unreadCount?: number;
}

class SocketClient {
  private socket: Socket | null = null;
  private userId: string | null = null;
  private listeners = new Map<string, Set<Function>>();

  connect(userId: string) {
    if (this.socket?.connected && this.userId === userId) {
      return;
    }

    this.userId = userId;
    this.socket = io(window.location.origin, {
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected');
      this.socket?.emit('authenticate', userId);
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });

    // Set up event listeners
    this.socket.on('conversations', (conversations: Conversation[]) => {
      this.emit('conversations', conversations);
    });

    this.socket.on('conversation_loaded', (data: { conversation: Conversation; messages: Message[] }) => {
      this.emit('conversation_loaded', data);
    });

    this.socket.on('new_message', (message: Message) => {
      this.emit('new_message', message);
    });

    this.socket.on('message_sent', (message: Message) => {
      this.emit('message_sent', message);
    });

    this.socket.on('conversation_updated', (conversation: Conversation) => {
      this.emit('conversation_updated', conversation);
    });

    // Notification events
    this.socket.on('notification', (notification: any) => {
      console.log('🔔 Notification received:', notification);
      this.emit('notification', notification);
    });

    // Admin messages
    this.socket.on('admin_message', (data: any) => {
      console.log('📨 Admin message received:', data);
      this.emit('admin_message', data);
    });

    this.socket.on('admin_broadcast', (data: any) => {
      console.log('📢 Admin broadcast received:', data);
      this.emit('admin_broadcast', data);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.userId = null;
      this.listeners.clear();
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  private emit(event: string, data: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data));
    }
  }

  getConversation(recipientId: string) {
    this.socket?.emit('get_conversation', { recipientId });
  }

  sendMessage(recipientId: string, content: string) {
    this.socket?.emit('send_message', { recipientId, content });
  }

  markAsRead(conversationId: string) {
    this.socket?.emit('mark_read', { conversationId });
  }

  getConversations() {
    this.socket?.emit('get_conversations');
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketClient = new SocketClient();
export type { Message, Conversation };
