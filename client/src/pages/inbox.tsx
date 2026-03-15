import { useState, useEffect, useRef, useMemo } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Send, Loader2, MessageSquare, ArrowLeft, Search, X, Edit } from "lucide-react";
import { socketClient, type Message, type Conversation } from "@/lib/socket-client";
import { useQuery } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Inbox() {
  const { user, authenticated, getAccessToken } = usePrivy();
  const isMobile = useIsMobile();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [isLoadingConversations, setIsLoadingConversations] = useState(true); // To replace isConnecting
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showComposeDialog, setShowComposeDialog] = useState(false);
  const [conversationSearch, setConversationSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [newMessageContent, setNewMessageContent] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "archived">("all");

  const { data: creators } = useQuery<any[]>({
    queryKey: ["/api/creators"],
  });

  const { data: users } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const { data: searchResults, isLoading: isSearching } = useQuery<any[]>({
    queryKey: ["/api/creators/search", userSearch],
    enabled: Boolean(userSearch.trim()),
    queryFn: async () => {
      const response = await fetch(`/api/creators/search?q=${encodeURIComponent(userSearch)}`);
      if (!response.ok) throw new Error("Failed to search users");
      return response.json();
    },
  });

  const creatorMap = new Map(
    [
      ...(creators?.flatMap((creator) => {
        const entries: [string, any][] = [];
        if (creator.address) entries.push([creator.address.toLowerCase(), creator]);
        if (creator.privyId) {
          entries.push([creator.privyId.toLowerCase(), creator]);
          entries.push([`email_${creator.privyId}`.toLowerCase(), creator]);
        }
        return entries;
      }) || []),
      ...(users?.flatMap((user) => {
        const entries: [string, any][] = [];
        const normalizedUser = {
          ...user,
          avatar: user.avatarUrl || user.avatar || null,
          address: user.walletAddress || user.address || null,
        };
        if (normalizedUser.address) entries.push([normalizedUser.address.toLowerCase(), normalizedUser]);
        if (user.id) entries.push([`email_${user.id}`.toLowerCase(), normalizedUser]);
        return entries;
      }) || []),
    ]
  );

  const getCurrentUserId = () => {
    const wallet = user?.wallet?.address?.toLowerCase();
    if (wallet) return wallet;
    if (user?.email) return `email_${user.id}`.toLowerCase();
    return user?.id?.toLowerCase();
  };

  const resolveRecipientId = (creator: any) => {
    if (creator?.address) return creator.address.toLowerCase();
    const rawId = creator?.privyId || creator?.id;
    if (rawId) return `email_${rawId}`.toLowerCase();
    return null;
  };

  const fetchConversationsFallback = async () => {
    if (!authenticated || !user?.id) return;
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;
      const response = await apiRequest("GET", "/api/messages/conversations", undefined, accessToken);
      const data = await response.json();
      setConversations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.warn("[Inbox] REST fallback failed:", error);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const fetchThreadFallback = async (otherId: string) => {
    if (!authenticated || !user?.id) return;
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;
      const response = await apiRequest("GET", `/api/messages/thread/${otherId}`, undefined, accessToken);
      const data = await response.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch (error) {
      console.warn("[Inbox] Thread fallback failed:", error);
    }
  };

  const sendMessageFallback = async (recipientId: string, content: string) => {
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error("Not authenticated");
    const response = await apiRequest("POST", "/api/messages/send", { recipientId, content }, accessToken);
    return response.json();
  };

  const filteredCreators = (userSearch.trim() ? searchResults : [])?.filter((creator) => {
    const currentUserId = user?.wallet?.address?.toLowerCase() || user?.id;
    const creatorAddress = creator.address?.toLowerCase() || creator.walletAddress?.toLowerCase();
    const creatorId = creator.privyId?.toLowerCase() || creator.id?.toLowerCase();
    return creatorAddress !== currentUserId && creatorId !== currentUserId;
  }) || [];

  useEffect(() => {
    if (!authenticated || !user) {
      setIsLoadingConversations(false);
      return;
    }

    // Use wallet address if available, otherwise use Privy ID
    // For email users, prefix with 'email_' to match server-side ID format
    let userId = getCurrentUserId();
    if (!userId) {
      setIsLoadingConversations(false);
      return;
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

    // REST fallback if socket isn't connected shortly after mount
    const fallbackTimer = setTimeout(() => {
      if (!socketClient.isConnected()) {
        fetchConversationsFallback();
      }
    }, 1500);

    return () => {
      clearTimeout(fallbackTimer);
      socketClient.disconnect();
    };
  }, [authenticated, user?.wallet?.address, user?.email, selectedConversation]); // Added selectedConversation to dependency array

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSelectConversation = (conversation: Conversation) => {
    if (!user) return;

    setSelectedConversation(conversation);

    // Use wallet address if available, otherwise use Privy ID with email prefix
    let currentUserId = getCurrentUserId();
    if (!currentUserId) return;

    const otherParticipantAddress = conversation.participants.find(p => p !== currentUserId);

    if (otherParticipantAddress) {
      console.log('[Inbox] Loading conversation with:', otherParticipantAddress);
      if (socketClient.isConnected()) {
        socketClient.getConversation(otherParticipantAddress);
        socketClient.markAsRead(conversation.id);
      } else {
        fetchThreadFallback(otherParticipantAddress);
      }
    }
  };

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedConversation || !user) return;

    // Use wallet address if available, otherwise use Privy ID with email prefix
    let currentUserId = getCurrentUserId();
    if (!currentUserId) return;

    const recipientId = selectedConversation.participants.find(
      p => p !== currentUserId
    );

    if (!recipientId) return;

    console.log('[Inbox] Sending message to:', recipientId);
    setIsSending(true);
    if (socketClient.isConnected()) {
      socketClient.sendMessage(recipientId, messageInput.trim());
    } else {
      sendMessageFallback(recipientId, messageInput.trim())
        .then((data) => {
          if (data?.message) {
            setMessages((prev) => [...prev, data.message]);
          }
        })
        .finally(() => {
          setIsSending(false);
          setMessageInput("");
          fetchConversationsFallback();
        });
    }
  };

  const handleStartConversation = (recipientAddress: string | null) => {
    if (!recipientAddress || !user) return;

    // Use wallet address if available, otherwise use Privy ID
    const currentUserId = getCurrentUserId() || user.id;

    // Check if conversation already exists
    const existingConversation = conversations.find(conv =>
      conv.participants.includes(recipientAddress.toLowerCase())
    );

    if (existingConversation) {
      handleSelectConversation(existingConversation);
      setShowComposeDialog(false);
      setUserSearch("");
    } else {
      // Create new conversation by requesting it
      if (socketClient.isConnected()) {
        socketClient.getConversation(recipientAddress.toLowerCase());
      } else {
        fetchThreadFallback(recipientAddress.toLowerCase());
      }

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
      setUserSearch("");
    }
  };

  const getOtherParticipant = (conversation: Conversation) => {
    if (!user) return { address: "Unknown", username: null, avatar: null };

    // Use wallet address if available, otherwise use Privy ID
    const currentUserId = getCurrentUserId() || user.id;
    const otherAddress = conversation.participants.find(p => p !== currentUserId);

    // Provide a fallback with at least an address if creator data is missing
    return creatorMap.get(otherAddress || "") || { address: otherAddress || "Unknown", username: null, avatar: null };
  };

  const getUnreadCount = (conversation: Conversation) => {
    // Return the unread count from the conversation object
    return conversation.unreadCount || 0;
  };

  const filteredConversations = useMemo(() => {
    if (activeTab === "unread") {
      return conversations.filter((conversation) => (conversation.unreadCount || 0) > 0);
    }
    if (activeTab === "archived") {
      return [];
    }
    return conversations;
  }, [activeTab, conversations]);

  const searchedConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase();
    if (!query) return filteredConversations;
    return filteredConversations.filter((conversation) => {
      const other = getOtherParticipant(conversation);
      const name = other.username?.toLowerCase() || other.name?.toLowerCase() || "";
      const address = other.address?.toLowerCase() || "";
      const lastMessage = conversation.lastMessage?.content?.toLowerCase() || "";
      return name.includes(query) || address.includes(query) || lastMessage.includes(query);
    });
  }, [filteredConversations, conversationSearch]);


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
    <div
      className={cn(
        isMobile ? "h-screen" : "h-[calc(100vh-4rem)]",
        "flex flex-col max-w-6xl mx-auto",
      )}
    >
      <div className="flex-1 flex overflow-hidden rounded-none md:rounded-3xl border-border/50 md:border bg-background">
        <aside
          className={cn(
            "flex flex-col border-r bg-card/95",
            isMobile ? (selectedConversation ? "hidden" : "w-full") : "w-80",
          )}
        >
          <div className="px-4 pt-4 pb-3 border-b space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold">Chat</h1>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowComposeDialog(true)}
                className="h-8 w-8"
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search chats"
                value={conversationSearch}
                onChange={(e) => setConversationSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <div className="flex items-center gap-1 rounded-full bg-muted/30 p-0.5">
              {[
                { id: "all", label: "All" },
                { id: "unread", label: "Unread" },
                { id: "archived", label: "Archived" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={cn(
                    "flex-1 rounded-full py-1 text-[11px] font-semibold transition",
                    activeTab === tab.id ? "bg-foreground text-background" : "text-muted-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {searchedConversations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <div className="mx-auto mb-3 h-12 w-12 overflow-hidden rounded-full bg-muted/30">
                  <img
                    src="https://i.ibb.co/JRQCPsZK/ev122logo-1-1.png"
                    alt="Every1"
                    className="h-full w-full object-cover"
                  />
                </div>
                <p className="text-sm">
                  {conversationSearch.trim()
                    ? "No matches found"
                    : activeTab === "archived"
                      ? "No archived chats"
                      : "No conversations yet"}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 text-xs"
                  onClick={() => setShowComposeDialog(true)}
                >
                  Start new chat
                </Button>
              </div>
            ) : (
              searchedConversations.map((conversation) => {
                const other = getOtherParticipant(conversation);
                const participantAvatar = other.avatar || "https://i.ibb.co/JRQCPsZK/ev122logo-1-1.png";
                const unreadCount = getUnreadCount(conversation);
                return (
                  <div
                    key={conversation.id}
                    onClick={() => handleSelectConversation(conversation)}
                    className={cn(
                      "px-4 py-3 border-b cursor-pointer hover:bg-accent/40 transition-colors",
                      selectedConversation?.id === conversation.id && "bg-accent/50",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-11 w-11">
                        <AvatarImage src={participantAvatar} />
                        <AvatarFallback>
                          {other.username?.[0]?.toUpperCase() || other.address?.slice(2, 4).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium truncate text-sm">
                            {other.username || `${other.address?.slice(0, 6)}...${other.address?.slice(-4)}`}
                          </p>
                          {unreadCount > 0 && (
                            <Badge variant="destructive" className="h-5 px-2 text-[10px]">
                              {unreadCount}
                            </Badge>
                          )}
                        </div>
                        {conversation.lastMessage && (
                          <p className="text-[11px] text-muted-foreground truncate">
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
        </aside>

        <main
          className={cn(
            "flex-1 flex flex-col bg-background",
            isMobile && !selectedConversation && "hidden",
          )}
        >
          {selectedConversation ? (
            <>
              <div className="px-4 py-3 border-b bg-card/95 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedConversation(null)}
                    className="h-8 w-8 md:hidden"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={getOtherParticipant(selectedConversation).avatar || "https://i.ibb.co/JRQCPsZK/ev122logo-1-1.png"} />
                    <AvatarFallback>
                      {getOtherParticipant(selectedConversation).username?.[0]?.toUpperCase() ||
                        getOtherParticipant(selectedConversation).address?.slice(2, 4).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {getOtherParticipant(selectedConversation).username ||
                        `${getOtherParticipant(selectedConversation).address?.slice(0, 6)}...${getOtherParticipant(selectedConversation).address?.slice(-4)}`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.map((message) => {
                  const currentUserId = user?.wallet?.address?.toLowerCase() || user?.id;
                  const isOwnMessage = message.senderId === currentUserId;
                  return (
                    <div
                      key={message.id}
                      className={cn("flex", isOwnMessage ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[72%] rounded-2xl px-3 py-2 text-sm",
                          isOwnMessage
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted",
                        )}
                      >
                        <p className="break-words">{message.content}</p>
                        <p
                          className={cn(
                            "text-[10px] mt-1",
                            isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground",
                          )}
                        >
                          {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-3 border-t bg-card/95 backdrop-blur-sm">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                    className="flex-1 h-9 text-sm"
                    disabled={isSending}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || isSending}
                    size="icon"
                    className="h-9 w-9"
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
            <div className="hidden md:flex flex-1 items-center justify-center text-muted-foreground">
              <div className="text-center">
                <div className="mb-4 flex justify-center">
                  <div className="h-20 w-20 overflow-hidden rounded-full bg-muted/30">
                    <img
                      src="https://i.ibb.co/JRQCPsZK/ev122logo-1-1.png"
                      alt="Every1"
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
                <h3 className="text-lg font-semibold mb-2">Welcome to Chat</h3>
                <p className="text-sm">Pick a conversation or start a new one.</p>
              </div>
            </div>
          )}
        </main>
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
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9"
              />
              {userSearch && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setUserSearch("")}
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
                    {userSearch ? "No users found" : "Search for users to message"}
                  </p>
                </div>
              ) : (
                filteredCreators.map((creator) => (
                  <div
                    key={creator.id}
                    onClick={() => handleStartConversation(resolveRecipientId(creator))}
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
