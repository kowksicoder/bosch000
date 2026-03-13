import { useState, useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Send, Loader2, MessageSquare, ArrowLeft, Search, X, Edit } from "lucide-react";
import { socketClient, type Message, type Conversation } from "@/lib/socket-client";
import { useQuery } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Inbox() {
  const { user, authenticated } = usePrivy();
  const isMobile = useIsMobile();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [isLoadingConversations, setIsLoadingConversations] = useState(true); // To replace isConnecting
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showComposeDialog, setShowComposeDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessageContent, setNewMessageContent] = useState("");

  const { data: creators } = useQuery<any[]>({
    queryKey: ["/api/creators"],
  });

  const creatorMap = new Map(creators?.map(c => [c.address?.toLowerCase(), c]) || []);

  const filteredCreators = creators?.filter(creator => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const username = creator.username?.toLowerCase() || "";
    const address = creator.address?.toLowerCase() || "";
    const privyId = creator.privyId?.toLowerCase() || "";
    return username.includes(query) || address.includes(query) || privyId.includes(query);
  }).filter(creator => {
    // Exclude current user by comparing both address and privyId
    const currentUserId = user?.wallet?.address?.toLowerCase() || user?.id;
    return creator.address?.toLowerCase() !== currentUserId && 
           creator.privyId?.toLowerCase() !== currentUserId;
  }) || [];

  useEffect(() => {
    if (!authenticated || !user) {
      setIsLoadingConversations(false);
      return;
    }

    // Use wallet address if available, otherwise use Privy ID
    // For email users, prefix with 'email_' to match server-side ID format
    let userId = user.wallet?.address?.toLowerCase();
    if (!userId) {
      userId = user.email ? `email_${user.id}` : user.id;
    }

    console.log('[Inbox] Connecting socket with userId:', userId);

    // Connect to Socket.io
    socketClient.connect(userId);
    setIsLoadingConversations(false);

    // Listen for conversations
    socketClient.on('conversations', (convos: Conversation[]) => {
      setConversations(convos);
      setIsLoadingConversations(false); // Ensure loading is false after receiving conversations
    });

    // Listen for conversation loaded
    socketClient.on('conversation_loaded', (data: { conversation: Conversation; messages: Message[] }) => {
      setMessages(data.messages);
      setSelectedConversation(data.conversation);
      setIsLoadingConversations(false); // Ensure loading is false

      // Update conversations list if this was a new conversation
      setConversations(prev => {
        const exists = prev.some(c => c.id === data.conversation.id);
        if (exists) {
          return prev.map(c => c.id === data.conversation.id ? data.conversation : c);
        }
        return [data.conversation, ...prev].sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
    });

    // Listen for new messages
    socketClient.on('new_message', (message: Message) => {
      if (selectedConversation && message.conversationId === selectedConversation.id) {
        setMessages(prev => [...prev, message]);
        socketClient.markAsRead(selectedConversation.id);
      }
      // Refresh conversations to update last message
      socketClient.getConversations();
    });

    // Listen for message sent
    socketClient.on('message_sent', (message: Message) => {
      setMessages(prev => [...prev, message]);
      setIsSending(false);
      setMessageInput("");
    });

    // Listen for conversation updates
    socketClient.on('conversation_updated', (conversation: Conversation) => {
      setConversations(prev => {
        const index = prev.findIndex(c => c.id === conversation.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = conversation;
          return updated.sort((a, b) => 
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        }
        // If the conversation is new and not in the list, add it
        return [conversation, ...prev].sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
    });

    // Request conversations
    socketClient.getConversations();

    return () => {
      socketClient.disconnect();
    };
  }, [authenticated, user?.wallet?.address, selectedConversation]); // Added selectedConversation to dependency array

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSelectConversation = (conversation: Conversation) => {
    if (!user) return;

    setSelectedConversation(conversation);

    // Use wallet address if available, otherwise use Privy ID with email prefix
    let currentUserId = user.wallet?.address?.toLowerCase();
    if (!currentUserId) {
      currentUserId = user.email ? `email_${user.id}` : user.id;
    }

    const otherParticipantAddress = conversation.participants.find(p => p !== currentUserId);

    if (otherParticipantAddress) {
      console.log('[Inbox] Loading conversation with:', otherParticipantAddress);
      socketClient.getConversation(otherParticipantAddress);
      socketClient.markAsRead(conversation.id);
    }
  };

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedConversation || !user) return;

    // Use wallet address if available, otherwise use Privy ID with email prefix
    let currentUserId = user.wallet?.address?.toLowerCase();
    if (!currentUserId) {
      currentUserId = user.email ? `email_${user.id}` : user.id;
    }

    const recipientId = selectedConversation.participants.find(
      p => p !== currentUserId
    );

    if (!recipientId) return;

    console.log('[Inbox] Sending message to:', recipientId);
    setIsSending(true);
    socketClient.sendMessage(recipientId, messageInput.trim());
  };

  const handleStartConversation = (recipientAddress: string) => {
    if (!recipientAddress || !user) return;

    // Use wallet address if available, otherwise use Privy ID
    const currentUserId = user.wallet?.address?.toLowerCase() || user.id;

    // Check if conversation already exists
    const existingConversation = conversations.find(conv =>
      conv.participants.includes(recipientAddress.toLowerCase())
    );

    if (existingConversation) {
      handleSelectConversation(existingConversation);
      setShowComposeDialog(false);
      setSearchQuery("");
    } else {
      // Create new conversation by requesting it
      socketClient.getConversation(recipientAddress.toLowerCase());

      // Create temporary conversation to show in UI immediately
      const tempConversation: Conversation = {
        id: `temp-${Date.now()}`,
        participants: [currentUserId, recipientAddress.toLowerCase()],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastMessage: null,
        unreadCount: 0,
      };

      setSelectedConversation(tempConversation);
      setMessages([]);
      setShowComposeDialog(false);
      setSearchQuery("");
    }
  };

  const getOtherParticipant = (conversation: Conversation) => {
    if (!user) return { address: "Unknown", username: null, avatar: null };

    // Use wallet address if available, otherwise use Privy ID
    const currentUserId = user.wallet?.address?.toLowerCase() || user.id;
    const otherAddress = conversation.participants.find(p => p !== currentUserId);

    // Provide a fallback with at least an address if creator data is missing
    return creatorMap.get(otherAddress || "") || { address: otherAddress || "Unknown", username: null, avatar: null };
  };

  const getUnreadCount = (conversation: Conversation) => {
    // Return the unread count from the conversation object
    return conversation.unreadCount || 0;
  };


  if (!authenticated) {
    return (
      <div className="container max-w-5xl mx-auto px-4 py-8">
        <Card className="p-12 text-center">
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-muted-foreground">Please connect your wallet to access messaging</p>
        </Card>
      </div>
    );
  }

  if (isLoadingConversations) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isMobile ? 'h-screen' : 'h-[calc(100vh-4rem)]'} flex flex-col max-w-5xl mx-auto`}>
      <div className="px-4 py-4 border-b bg-card/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-bold">Messages</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowComposeDialog(true)}
            className="h-9 w-9"
          >
            <Edit className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className={`${isMobile ? 'w-full' : 'w-full lg:w-80'} border-r flex flex-col bg-card`}>

          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm">No conversations yet</p>
              </div>
            ) : (
              conversations.map((conversation) => {
                const other = getOtherParticipant(conversation);
                const unreadCount = getUnreadCount(conversation); // Use the refined getUnreadCount
                const participantAvatar = other.avatar || "https://i.ibb.co/JRQCPsZK/ev122logo-1-1.png";

                return (
                  <div
                    key={conversation.id}
                    onClick={() => handleSelectConversation(conversation)}
                    className={`p-4 border-b cursor-pointer hover:bg-accent/50 transition-colors ${
                      selectedConversation?.id === conversation.id ? 'bg-accent' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={participantAvatar} />
                        <AvatarFallback>
                          {other.username?.[0]?.toUpperCase() || other.address?.slice(2, 4).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium truncate">
                            {other.username || `${other.address?.slice(0, 6)}...${other.address?.slice(-4)}`}
                          </p>
                          {/* Display unread count if available and greater than 0 */}
                          {(conversation.unreadCount || 0) > 0 && ( 
                            <Badge variant="destructive" className="h-5 px-2">
                              {conversation.unreadCount}
                            </Badge>
                          )}
                        </div>
                        {conversation.lastMessage && (
                          <p className="text-sm text-muted-foreground truncate">
                            {conversation.lastMessage.content}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {(!isMobile || selectedConversation) && (
          <div className="flex-1 flex flex-col">
            {selectedConversation ? (
              <>
                <div className="px-4 py-3 border-b bg-card/95 backdrop-blur-sm sticky top-0 z-10">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedConversation(null)}
                      className="h-9 w-9 lg:hidden" // Show back button only on mobile
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={getOtherParticipant(selectedConversation).avatar || "https://i.ibb.co/JRQCPsZK/ev122logo-1-1.png"} />
                      <AvatarFallback>
                        {getOtherParticipant(selectedConversation).username?.[0]?.toUpperCase() || 
                         getOtherParticipant(selectedConversation).address?.slice(2, 4).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {getOtherParticipant(selectedConversation).username || 
                         `${getOtherParticipant(selectedConversation).address?.slice(0, 6)}...${getOtherParticipant(selectedConversation).address?.slice(-4)}`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((message) => {
                    // Use wallet address if available, otherwise use Privy ID
                    const currentUserId = user?.wallet?.address?.toLowerCase() || user?.id;
                    const isOwnMessage = message.senderId === currentUserId;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                            isOwnMessage
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm break-words">{message.content}</p>
                          <p className={`text-xs mt-1 ${isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-4 border-t bg-card/95 backdrop-blur-sm sticky bottom-0 z-10">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                      className="flex-1"
                      disabled={isSending}
                    />
                    <Button 
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim() || isSending}
                      size="icon"
                    >
                      {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <div className="mb-4 flex justify-center">
                    <div className="h-20 w-20 rounded-full bg-accent flex items-center justify-center">
                      <Send className="h-10 w-10 text-muted-foreground" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No conversation selected</h3>
                  <p className="text-sm">Select a conversation from the list to start messaging</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={showComposeDialog} onOpenChange={setShowComposeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
            <DialogDescription>
              Search for a user to start a conversation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by username or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {filteredCreators.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">
                    {searchQuery ? "No users found" : "Search for users to message"}
                  </p>
                </div>
              ) : (
                filteredCreators.map((creator) => (
                  <div
                    key={creator.id}
                    onClick={() => handleStartConversation(creator.address)}
                    className="p-3 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={creator.avatar || "https://i.ibb.co/JRQCPsZK/ev122logo-1-1.png"} />
                        <AvatarFallback>
                          {creator.username?.[0]?.toUpperCase() || creator.address?.slice(2, 4).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {creator.username || `${creator.address?.slice(0, 6)}...${creator.address?.slice(-4)}`}
                        </p>
                        {creator.username && (
                          <p className="text-xs text-muted-foreground truncate">
                            {creator.address?.slice(0, 6)}...{creator.address?.slice(-4)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}