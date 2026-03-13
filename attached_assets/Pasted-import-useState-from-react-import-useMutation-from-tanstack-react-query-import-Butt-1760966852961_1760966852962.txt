import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { uploadToIPFS } from "@/lib/pinata";
import { createZoraCoin } from "@/lib/zora";
import { Calendar, User, ExternalLink, Loader2, Plus } from "lucide-react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom } from "viem";
import { base } from "viem/chains";

interface ContentPreviewCardProps {
  scrapedData: any;
  onCoinCreated: () => void;
}

export default function ContentPreviewCard({ scrapedData, onCoinCreated }: ContentPreviewCardProps) {
  const { toast } = useToast();
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  
  const walletAddress = user?.wallet?.address as `0x${string}` | undefined;
  const privyWallet = wallets[0];

  const generateSymbol = (title: string) => {
    // Remove special characters and get clean text
    const cleanTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const words = cleanTitle.split(/\s+/).filter(word => word.length > 0);

    let symbol = '';
    if (words.length >= 2) {
      // Take first letters from multiple words
      symbol = words.slice(0, 3).map(w => w[0]).join('').toUpperCase();
    } else {
      // Take characters from the cleaned title
      symbol = cleanTitle.slice(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '');
    }

    return symbol || 'COIN';
  };

  const [coinSymbol, setCoinSymbol] = useState(() => generateSymbol(scrapedData.title));

  const createCoinMutation = useMutation({
    mutationFn: async () => {
      if (!walletAddress) {
        throw new Error("Please connect your wallet first");
      }
      if (!privyWallet) {
        throw new Error("Wallet not available");
      }

      // Get the EIP-1193 provider from Privy wallet
      const provider = await privyWallet.getEthereumProvider();
      
      // Create a viem wallet client from the provider
      const walletClient = createWalletClient({
        account: walletAddress,
        chain: base,
        transport: custom(provider),
      });

      // Upload metadata to IPFS for backup
      const metadata = {
        title: scrapedData.title,
        description: scrapedData.description,
        image: scrapedData.image,
        originalUrl: scrapedData.url,
        author: scrapedData.author,
        publishDate: scrapedData.publishDate,
        content: scrapedData.content,
      };

      const ipfsUri = await uploadToIPFS(metadata);

      // Create scraped content record first to preserve metadata (including animation_url for videos)
      let scrapedContentId = null;
      try {
        const scrapedContentData = {
          url: scrapedData.url || scrapedData.originalUrl || '',
          title: scrapedData.title,
          description: scrapedData.description,
          author: scrapedData.author,
          publishDate: scrapedData.publishDate,
          image: scrapedData.image,
          content: scrapedData.content,
          platform: scrapedData.platform || 'upload',
          metadata: {
            animation_url: scrapedData.animation_url,
            type: scrapedData.type
          }
        };

        const scrapedContentResponse = await apiRequest("POST", "/api/scraped-content", scrapedContentData);
        const scrapedContent = await scrapedContentResponse.json();
        scrapedContentId = scrapedContent.id;
      } catch (error) {
        console.warn("Failed to create scraped content, proceeding without it:", error);
      }

      // Create pending coin record in database first (decouple from Zora blockchain)
      const createdCoin = await apiRequest("POST", "/api/coins", {
        name: scrapedData.title,
        symbol: coinSymbol,
        creator_wallet: walletAddress,
        status: 'pending' as const,
        scrapedContentId: scrapedContentId,
        ipfsUri: ipfsUri, // Use the uploaded IPFS URI
        image: scrapedData.image || "",
        description: scrapedData.description || `A coin representing ${scrapedData.title}`,
      });
      const createdCoinJson = await createdCoin.json();

      // Deploy contract on-chain using Zora factory
      const { deployCreatorCoinDirect } = await import('@/lib/zora-factory');

      const deployResult = await deployCreatorCoinDirect(
        {
          name: scrapedData.title,
          symbol: coinSymbol,
          metadataUri: ipfsUri, // Use the uploaded IPFS URI
          creatorAddress: walletAddress,
          contentUrl: scrapedData.url || ipfsUri, // Use original URL or IPFS URI
          useActivityTracker: false, // Temporarily disabled to debug
        },
        walletClient,
        8453 // Base mainnet
      );

      // Update coin with deployed address and active status
      await apiRequest("PATCH", `/api/coins/${createdCoinJson.id}`, {
        address: deployResult.address,
        chainId: (walletClient.chain?.id || 8453).toString(), // Use actual chain ID or default to 8453
        status: 'active' as const,
        createdAt: deployResult.createdAt, // Use blockchain timestamp
      });

      return { coin: { ...createdCoinJson, address: deployResult.address, status: 'active', createdAt: deployResult.createdAt }, scrapedContentId };
    },
    onSuccess: (data) => {
      toast({
        title: "Coin Deployed Successfully! 🎉",
        description: `${data.coin.symbol} is now live on Base blockchain at ${data.coin.address?.slice(0, 6)}...${data.coin.address?.slice(-4)}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/coins"] });
      onCoinCreated();
    },
    onError: (error: Error) => {
      console.error("Coin creation mutation error:", error);
      toast({
        title: "Coin creation failed",
        description: error.message || "Failed to create coin",
        variant: "error",
      });
    },
  });

  const formatDate = (dateString: string) => {
    if (!dateString) return "Unknown date";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="p-1">
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          {(scrapedData.animation_url || scrapedData.image) && (
            <>
              {scrapedData.type === 'video' ? (
                <video
                  src={scrapedData.animation_url || scrapedData.image}
                  className="w-full h-32 object-cover rounded-lg"
                  controls
                  playsInline
                  poster={scrapedData.image || undefined}
                />
              ) : scrapedData.type === 'audio' ? (
                <div className="w-full bg-muted rounded-lg p-4 flex items-center justify-center">
                  <audio
                    src={scrapedData.animation_url || scrapedData.image}
                    className="w-full"
                    controls
                  />
                </div>
              ) : scrapedData.image ? (
                <img
                  src={scrapedData.image.replace('gateway.pinata.cloud', 'dweb.link')}
                  alt={scrapedData.title}
                  className="w-full h-32 object-cover rounded-lg"
                  onError={(e) => {
                    // Try alternate gateway on error
                    const currentSrc = e.currentTarget.src;
                    if (currentSrc.includes('dweb.link')) {
                      e.currentTarget.src = scrapedData.image.replace('gateway.pinata.cloud', 'ipfs.io');
                    } else if (!currentSrc.includes('ipfs.io')) {
                      e.currentTarget.src = scrapedData.image.replace('gateway.pinata.cloud', 'dweb.link');
                    } else {
                      e.currentTarget.style.display = 'none';
                    }
                  }}
                />
              ) : null}
            </>
          )}
        </div>

        <div className="md:col-span-2 space-y-3">
          <div>
            <h3 className="text-lg font-bold text-foreground mb-1" data-testid="text-preview-title">
              {scrapedData.title}
            </h3>
            {scrapedData.description && (
              <p className="text-xs text-muted-foreground line-clamp-2" data-testid="text-preview-description">
                {scrapedData.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {scrapedData.author && (
              <div className="flex items-center gap-1">
                <User className="w-4 h-4" />
                <span data-testid="text-preview-author">{scrapedData.author}</span>
              </div>
            )}
            {scrapedData.publishDate && (
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span data-testid="text-preview-date">{formatDate(scrapedData.publishDate)}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <ExternalLink className="w-4 h-4" />
              <a
                href={scrapedData.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate max-w-xs hover:text-foreground"
                data-testid="link-preview-url"
              >
                {new URL(scrapedData.url).hostname}
              </a>
            </div>
          </div>

          <div className="pt-3 border-t border-border">
            <Label htmlFor="coinSymbol" className="block text-xs font-medium mb-1.5">
              Coin Symbol
            </Label>
            <div className="flex gap-2">
              <Input
                id="coinSymbol"
                type="text"
                value={coinSymbol}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                  setCoinSymbol(val);
                }}
                className="flex-1 bg-muted border-input text-foreground font-mono h-9 text-sm"
                placeholder="Enter symbol"
                disabled={createCoinMutation.isPending}
                data-testid="input-coin-symbol"
              />
              <Button
                onClick={() => createCoinMutation.mutate()}
                disabled={createCoinMutation.isPending || !coinSymbol || !walletAddress || !privyWallet}
                className="bg-gradient-to-r from-primary to-primary text-primary-foreground h-9 px-4 text-sm rounded-2xl hover:opacity-90 cursor-pointer"
                data-testid="button-create-coin"
                title={!walletAddress ? "Connect wallet to create coins" : ""}
              >
                {createCoinMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-1" />
                    Create
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}