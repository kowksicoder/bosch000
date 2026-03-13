import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { storage } from './supabase-storage';
import type { Message as DBMessage } from '@shared/schema';

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

const userSockets = new Map<string, string>(); // userId -> socketId
let socketIOInstance: SocketIOServer | null = null;

function getConversationId(userId1: string, userId2: string): string {
  const participants = [userId1, userId2].sort();
  return `conv_${participants.join('_')}`;
}

function convertDBMessageToSocket(dbMsg: DBMessage, conversationId: string): Message {
  return {
    id: dbMsg.id,
    conversationId,
    senderId: dbMsg.senderId,
    recipientId: dbMsg.recipientId,
    content: dbMsg.content,
    createdAt: dbMsg.createdAt?.toISOString() || new Date().toISOString(),
    read: dbMsg.isRead || false
  };
}

export function getSocketIOInstance(): SocketIOServer | null {
  return socketIOInstance;
}

export function emitNotificationToUser(userId: string, notification: any): void {
  if (!socketIOInstance) {
    console.warn('[Socket.IO] Instance not initialized, cannot emit notification');
    return;
  }
  
  const socketId = userSockets.get(userId);
  if (socketId) {
    socketIOInstance.to(socketId).emit('notification', notification);
    console.log(`[Socket.IO] Emitted notification to user ${userId}`);
  } else {
    console.log(`[Socket.IO] User ${userId} not connected, notification will be stored for later`);
  }
}

export function broadcastNotificationToAll(notification: any, excludeUserId?: string): void {
  if (!socketIOInstance) {
    console.warn('[Socket.IO] Instance not initialized, cannot broadcast notification');
    return;
  }
  
  let count = 0;
  userSockets.forEach((socketId, userId) => {
    if (excludeUserId && userId === excludeUserId) return;
    socketIOInstance!.to(socketId).emit('notification', notification);
    count++;
  });
  console.log(`[Socket.IO] Broadcasted notification to ${count} connected users`);
}

export function initializeSocketServer(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  socketIOInstance = io;

  io.on('connection', (socket) => {
    console.log('✅ Socket connected:', socket.id);

    // Authenticate user
    socket.on('authenticate', async (userId: string) => {
      userSockets.set(userId.toLowerCase(), socket.id);
      socket.data.userId = userId.toLowerCase();
      console.log(`✅ User ${userId} authenticated with socket ${socket.id}`);

      // Join rooms with all possible user identifiers for targeted messages
      socket.join(userId.toLowerCase());
      
      // Try to get additional identifiers from the creator profile
      try {
        // Check if userId is a wallet address or Privy ID and find the creator
        let creator = await storage.getCreatorByAddress(userId);
        if (!creator) {
          creator = await storage.getCreatorByPrivyId(userId);
        }
        
        if (creator) {
          // Join rooms for all identifiers to ensure message delivery
          const identifiers = [
            creator.address,
            creator.privyId,
            creator.id,
            creator.email,
            `email_${creator.privyId}` // Support email-based IDs
          ].filter(Boolean);

          for (const identifier of identifiers) {
            const room = identifier!.toLowerCase();
            if (room !== userId.toLowerCase()) {
              socket.join(room);
              console.log(`  ↳ Also joined room: ${room}`);
            }
          }
        }
      } catch (error) {
        console.warn(`Could not fetch additional identifiers for ${userId}:`, error);
      }

      // Send user's conversations
      const userConversations = await getUserConversations(userId.toLowerCase());
      socket.emit('conversations', userConversations);
    });

    // Create or get conversation
    socket.on('get_conversation', async (data: { recipientId: string } | string) => {
      const userId = socket.data.userId;
      if (!userId) return;
      
      // Handle both old string format and new object format
      const recipientId = typeof data === 'string' ? data : data.recipientId;
      if (!recipientId) return;
      
      try {
        const conversationId = getConversationId(userId, recipientId);

        // Get messages between users (this works for both wallet and Privy ID)
        const messages = await storage.getMessagesBetweenUsers(userId, recipientId);

        // Convert DB messages to socket format
        const socketMessages = messages.map(msg => 
          convertDBMessageToSocket(msg, conversationId)
        );

        // Create conversation object
        const conversation: Conversation = {
          id: conversationId,
          participants: [userId, recipientId].sort(),
          lastMessage: socketMessages.length > 0 
            ? socketMessages[socketMessages.length - 1] 
            : undefined,
          updatedAt: socketMessages.length > 0 
            ? socketMessages[socketMessages.length - 1].createdAt 
            : new Date().toISOString(),
          unreadCount: 0
        };

        console.log(`Loaded conversation: ${conversationId} between ${userId} and ${recipientId} with ${messages.length} messages`);

        socket.emit('conversation_loaded', {
          conversation,
          messages: socketMessages,
        });

        // Also emit to the recipient if they're online
        const recipientSocketId = userSockets.get(recipientId);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('conversation_updated', conversation);
        }
      } catch (error) {
        console.error('Error loading conversation:', error);
        socket.emit('error', { message: 'Failed to load conversation' });
      }
    });

    // Send message
    socket.on('send_message', async ({ recipientId, content }: { recipientId: string; content: string }) => {
      const senderId = socket.data.userId;
      if (!senderId) return;

      try {
        // Save message to database
        const dbMessage = await storage.createMessage({
          senderId,
          recipientId: recipientId.toLowerCase(),
          content,
          messageType: 'text'
        });

        const conversationId = getConversationId(senderId, recipientId.toLowerCase());
        const message = convertDBMessageToSocket(dbMessage, conversationId);

        // Send to sender
        socket.emit('message_sent', message);

        // Create conversation object for updates
        const conversation: Conversation = {
          id: conversationId,
          participants: [senderId, recipientId.toLowerCase()].sort(),
          lastMessage: message,
          updatedAt: message.createdAt,
          unreadCount: 1
        };

        // Get all possible recipient identifiers to ensure delivery
        const recipientRooms = [recipientId.toLowerCase()];
        try {
          let recipientCreator = await storage.getCreatorByAddress(recipientId);
          if (!recipientCreator) {
            recipientCreator = await storage.getCreatorByPrivyId(recipientId);
          }
          
          if (recipientCreator) {
            const identifiers = [
              recipientCreator.address,
              recipientCreator.privyId,
              recipientCreator.id,
              recipientCreator.email,
              `email_${recipientCreator.privyId}`
            ].filter(Boolean);
            
            for (const identifier of identifiers) {
              const room = identifier!.toLowerCase();
              if (!recipientRooms.includes(room)) {
                recipientRooms.push(room);
              }
            }
          }
        } catch (error) {
          console.warn('Could not fetch recipient identifiers:', error);
        }

        // Emit to all recipient rooms
        for (const room of recipientRooms) {
          io.to(room).emit('new_message', message);
          io.to(room).emit('conversation_updated', conversation);
        }
        console.log(`✅ Message emitted to rooms: ${recipientRooms.join(', ')}`);

        // Update sender's conversation list
        socket.emit('conversation_updated', { ...conversation, unreadCount: 0 });

        console.log(`✅ Message sent from ${senderId} to ${recipientId}`);
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Mark message as read
    socket.on('mark_read', async ({ conversationId }: { conversationId: string }) => {
      const userId = socket.data.userId;
      if (!userId) return;

      // Extract other user ID from conversation ID
      const participants = conversationId.replace('conv_', '').split('_');
      const otherUserId = participants.find(p => p !== userId);

      if (otherUserId) {
        await storage.markMessagesAsRead(userId, otherUserId);
      }
    });

    // Get all conversations
    socket.on('get_conversations', async () => {
      const userId = socket.data.userId;
      if (!userId) return;

      const userConversations = await getUserConversations(userId);
      socket.emit('conversations', userConversations);
    });

    socket.on('disconnect', () => {
      const userId = socket.data.userId;
      if (userId) {
        userSockets.delete(userId);
        console.log(`✅ User ${userId} disconnected`);
      }
    });
  });

  console.log('✅ Socket.io server initialized');
  return io;
}

async function getUserConversations(userId: string): Promise<Conversation[]> {
  try {
    const conversationsData = await storage.getConversationsForUser(userId);

    const conversations: Conversation[] = await Promise.all(
      conversationsData.map(async ({ otherUserId, lastMessage }) => {
        try {
          const conversationId = getConversationId(userId, otherUserId);
          const unreadCount = await storage.getUnreadMessageCount(userId, otherUserId);

          // lastMessage is already in camelCase format from storage
          const socketMessage: Message = {
            id: lastMessage.id,
            conversationId,
            senderId: lastMessage.senderId,
            recipientId: lastMessage.recipientId,
            content: lastMessage.content,
            createdAt: lastMessage.createdAt instanceof Date 
              ? lastMessage.createdAt.toISOString() 
              : lastMessage.createdAt,
            read: lastMessage.isRead || false
          };

          return {
            id: conversationId,
            participants: [userId, otherUserId].sort(),
            lastMessage: socketMessage,
            updatedAt: socketMessage.createdAt,
            unreadCount
          };
        } catch (error) {
          console.error(`Error processing conversation for ${otherUserId}:`, error);
          return null;
        }
      })
    );

    // Filter out any null conversations
    return conversations
      .filter((c): c is Conversation => c !== null)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (error) {
    console.error('Error getting user conversations:', error);
    return [];
  }
}