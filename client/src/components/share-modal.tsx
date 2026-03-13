
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Copy, Share2, Check, Facebook, Twitter, Send } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { usePrivy, getAccessToken } from "@privy-io/react-auth";

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "profile" | "coin" | "project" | "referral" | "badge";
  resourceId: string;
  title: string;
}

export function ShareModal({ open, onOpenChange, type, resourceId, title }: ShareModalProps) {
  const { toast } = useToast();
  const { authenticated } = usePrivy();
  const [copied, setCopied] = useState(false);

  const { data: ogMeta } = useQuery({
    queryKey: ["/api/og-meta", type, resourceId],
    enabled: open && !!resourceId,
  });

  const trackShareMutation = useMutation({
    mutationFn: async (platform: string) => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authenticated) {
        const accessToken = await getAccessToken();
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch("/api/share/track", {
        method: "POST",
        headers,
        body: JSON.stringify({
          shareType: type,
          resourceId,
          platform,
        }),
      });
      if (!response.ok) throw new Error("Failed to track share");
      return response.json();
    },
  });

  const shareUrl = ogMeta?.url || window.location.href;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      trackShareMutation.mutate("copy_link");
      toast({
        title: "Link copied!",
        description: "Share link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        variant: "destructive",
      });
    }
  };

  const handleShare = async (platform: string) => {
    trackShareMutation.mutate(platform);
    
    const text = ogMeta?.description || title;
    let url = "";

    switch (platform) {
      case "twitter":
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case "facebook":
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
      case "telegram":
        url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`;
        break;
      default:
        if (navigator.share) {
          try {
            await navigator.share({
              title: ogMeta?.title || title,
              text: text,
              url: shareUrl,
            });
          } catch (error) {
            console.error("Share error:", error);
          }
        }
        return;
    }

    window.open(url, "_blank", "width=600,height=400");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* OG Preview */}
          {ogMeta && (
            <div className="border rounded-lg overflow-hidden">
              {ogMeta.image && (
                <img
                  src={ogMeta.image}
                  alt={ogMeta.title}
                  className="w-full h-48 object-cover"
                />
              )}
              <div className="p-4 space-y-1">
                <h3 className="font-semibold line-clamp-1">{ogMeta.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {ogMeta.description}
                </p>
              </div>
            </div>
          )}

          {/* Share URL */}
          <div className="flex gap-2">
            <Input
              value={shareUrl}
              readOnly
              className="flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Share Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => handleShare("twitter")}
              className="gap-2"
            >
              <Twitter className="h-4 w-4" />
              Twitter
            </Button>
            <Button
              variant="outline"
              onClick={() => handleShare("facebook")}
              className="gap-2"
            >
              <Facebook className="h-4 w-4" />
              Facebook
            </Button>
            <Button
              variant="outline"
              onClick={() => handleShare("telegram")}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              Telegram
            </Button>
            <Button
              variant="outline"
              onClick={() => handleShare("native")}
              className="gap-2"
            >
              <Share2 className="h-4 w-4" />
              More
            </Button>
          </div>

          {authenticated && (
            <p className="text-xs text-center text-muted-foreground">
              Share and earn +5 E1XP points!
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
