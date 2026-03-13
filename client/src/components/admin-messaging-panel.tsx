
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, Users, Loader2 } from "lucide-react";

export function AdminMessagingPanel() {
  const { toast } = useToast();
  const [recipientAddress, setRecipientAddress] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");

  const { data: creators } = useQuery({
    queryKey: ["/api/creators"],
  });

  const { data: users } = useQuery({
    queryKey: ["/api/users"],
  });

  const sendDirectMessageMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/send-direct-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          recipientAddress, 
          message: messageContent 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }
    },
    onSuccess: () => {
      toast({ title: "Message sent", description: "Your message was delivered successfully" });
      setMessageContent("");
      setRecipientAddress("");
    },
    onError: async (error: any) => {
      const errorMessage = error.message || "Failed to send message";
      const isAuthError = errorMessage.includes("Unauthorized") || errorMessage.includes("403");
      const isNotFound = errorMessage.includes("404") || errorMessage.includes("not found");
      
      toast({
        title: isAuthError ? "Authentication Required" : isNotFound ? "User Not Found" : "Send failed",
        description: isAuthError 
          ? "Please log in to the admin panel first" 
          : isNotFound
          ? "User not found. Try using their wallet address or username instead."
          : errorMessage,
        variant: "destructive",
      });
    },
  });

  const broadcastMessageMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/broadcast-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: broadcastMessage }),
      });

      if (!response.ok) {
        throw new Error('Failed to broadcast message');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "✅ Broadcast Complete", 
        description: `Successfully sent to ${data.successCount} users` 
      });
      setBroadcastMessage("");
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Failed to complete broadcast";
      const isAuthError = errorMessage.includes("Unauthorized") || errorMessage.includes("403");
      
      toast({
        title: "❌ Broadcast Failed",
        description: isAuthError 
          ? "Please log in to the admin panel first" 
          : errorMessage,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Send Direct Message
          </CardTitle>
          <CardDescription>
            Send a message to a specific user
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="recipient">Recipient (Wallet Address or Username)</Label>
            <Input
              id="recipient"
              placeholder="0x... or username"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              data-testid="input-recipient"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Enter a wallet address or username. Available creators: {creators?.slice(0, 3).map((c: any) => c.name || c.address.slice(0, 10)).join(', ')}...
            </p>
          </div>

          <div>
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Enter your message..."
              rows={4}
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              data-testid="textarea-message"
            />
          </div>

          <Button
            onClick={() => sendDirectMessageMutation.mutate()}
            disabled={!recipientAddress || !messageContent || sendDirectMessageMutation.isPending}
            className="w-full"
            data-testid="button-send-message"
          >
            {sendDirectMessageMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Message
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Broadcast to All Users
          </CardTitle>
          <CardDescription>
            Send a message to all registered users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="broadcast">Broadcast Message</Label>
            <Textarea
              id="broadcast"
              placeholder="Enter broadcast message..."
              rows={4}
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
            />
          </div>

          <Button
            onClick={() => broadcastMessageMutation.mutate()}
            disabled={!broadcastMessage || broadcastMessageMutation.isPending}
            className="w-full"
            variant="destructive"
          >
            {broadcastMessageMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Broadcasting...
              </>
            ) : (
              <>
                <Users className="h-4 w-4 mr-2" />
                Broadcast to {(creators?.length || 0) + (users?.length || 0)} Users
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
