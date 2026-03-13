import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Send, Users, MessageSquare, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export function AdminMessageComposer() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("announcement");
  const [recipients, setRecipients] = useState("");
  const [sendToAll, setSendToAll] = useState(false);
  const [includeTelegram, setIncludeTelegram] = useState(false);
  const { toast } = useToast();

  // Fetch all users for reference
  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ["/api/creators"],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      const recipientList = sendToAll
        ? []
        : recipients
            .split(',')
            .map(r => r.trim())
            .filter(Boolean);

      const response = await apiRequest('POST', '/api/admin/send-message', {
        title,
        message,
        type: messageType,
        recipients: recipientList,
        sendToAll,
        includeTelegram,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send message");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Message Sent Successfully",
        description: data.message || `Sent to ${data.sent} user(s)`,
      });

      // Reset form
      setTitle("");
      setMessage("");
      setRecipients("");
      setSendToAll(false);
      setIncludeTelegram(false);
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Failed to Send Message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!title.trim() || !message.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both a title and message",
        variant: "destructive",
      });
      return;
    }

    if (!sendToAll && !recipients.trim()) {
      toast({
        title: "No Recipients",
        description: "Please specify recipients or enable 'Send to All Users'",
        variant: "destructive",
      });
      return;
    }

    sendMessageMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <div>
            <CardTitle>Send Message to Users</CardTitle>
            <CardDescription>
              Send custom notifications and announcements to users
              {!loadingUsers && users && ` (${users.length} total users)`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="message-title">Message Title *</Label>
          <Input
            id="message-title"
            placeholder="e.g., Important Platform Update"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            data-testid="input-message-title"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="message-content">Message Content *</Label>
          <Textarea
            id="message-content"
            placeholder="Enter your message here... Be clear and concise."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            data-testid="textarea-message-content"
          />
          <p className="text-xs text-muted-foreground">
            {message.length} characters
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="message-type">Notification Type</Label>
          <Select value={messageType} onValueChange={setMessageType}>
            <SelectTrigger id="message-type" data-testid="select-message-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="announcement">📢 Announcement</SelectItem>
              <SelectItem value="admin">👨‍💼 Admin Message</SelectItem>
              <SelectItem value="update">🔔 Platform Update</SelectItem>
              <SelectItem value="promo">🎉 Promotion</SelectItem>
              <SelectItem value="alert">⚠️ Alert</SelectItem>
              <SelectItem value="reward">🎁 Reward</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border-t pt-4 space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="send-to-all"
              checked={sendToAll}
              onCheckedChange={(checked) => setSendToAll(checked as boolean)}
              data-testid="checkbox-send-to-all"
            />
            <Label
              htmlFor="send-to-all"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Send to All Users {!loadingUsers && users && `(${users.length} users)`}
              </div>
            </Label>
          </div>

          {!sendToAll && (
            <div className="space-y-2">
              <Label htmlFor="recipients">
                Recipients (comma-separated addresses or Privy IDs)
              </Label>
              <Textarea
                id="recipients"
                placeholder="0x123..., 0xabc..., did:privy:xyz..."
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                rows={3}
                data-testid="textarea-recipients"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter wallet addresses, email addresses, or Privy IDs separated by commas
              </p>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-telegram"
              checked={includeTelegram}
              onCheckedChange={(checked) => setIncludeTelegram(checked as boolean)}
              data-testid="checkbox-include-telegram"
            />
            <Label
              htmlFor="include-telegram"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Also send via Telegram (if users have connected)
            </Label>
          </div>
        </div>

        <div className="border-t pt-4">
          <Button
            onClick={handleSend}
            disabled={sendMessageMutation.isPending || !title || !message}
            className="w-full gap-2"
            size="lg"
            data-testid="button-send-message"
          >
            {sendMessageMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending Message...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Message
              </>
            )}
          </Button>
        </div>

        {sendToAll && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
            <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
              ⚠️ You are about to send this message to ALL users. Please review carefully before sending.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}