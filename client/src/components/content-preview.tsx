import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { uploadToIPFS } from "@/lib/pinata";
import { Loader2, ExternalLink, Sparkles, Music } from "lucide-react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom, createPublicClient, http, type Address } from "viem";
import { base, baseSepolia } from "viem/chains";
import { createCoinOnBaseSepolia, generateCoinSymbol } from "@/lib/zora-coins";
import { deployGaslessCoin } from "@/lib/gasless-deployment";
import { useSmartAccount } from "@/contexts/SmartAccountContext";
import confetti from "canvas-confetti";
import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ContentPreviewProps {
  scrapedData: any;
  collaboration?: {
    mode: "collab";
    collaborators: string[];
  };
  onCoinCreated: () => void;
}

export default function ContentPreview({ scrapedData, collaboration, onCoinCreated }: ContentPreviewProps) {
  const { toast } = useToast();
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { smartAccountClient, smartAccountAddress, isLoading: isSmartAccountLoading, initSmartAccount } = useSmartAccount();

  // Get the actual wallet address from Privy wallets array
  const privyWallet = wallets[0];
  const walletAddress = privyWallet?.address as Address | undefined;
  const privyId = user?.id;
  const email = user?.email?.address;
  const isEmailUser = email && !walletAddress;

  // Use smart wallet address if available, otherwise use regular wallet address
  const effectiveWalletAddress = smartAccountAddress || walletAddress;

  const safeScraped = {
    title: typeof scrapedData?.title === "string" ? scrapedData.title : "",
    description: typeof scrapedData?.description === "string" ? scrapedData.description : "",
    author: typeof scrapedData?.author === "string" ? scrapedData.author : "",
    platform: typeof scrapedData?.platform === "string" ? scrapedData.platform : "",
    url: typeof scrapedData?.url === "string" ? scrapedData.url : "",
    image: typeof scrapedData?.image === "string" ? scrapedData.image : "",
    animationUrl: typeof scrapedData?.animation_url === "string" ? scrapedData.animation_url : "",
    publishDate: typeof scrapedData?.publishDate === "string" ? scrapedData.publishDate : "",
    type: typeof scrapedData?.type === "string" ? scrapedData.type : "",
  };

  const mediaItems = Array.isArray(scrapedData?.metadata?.media)
    ? scrapedData.metadata.media.filter((item: any) => Boolean(item?.url))
    : [];
  const isCarousel =
    Boolean(scrapedData?.metadata?.isCarousel) || mediaItems.length > 1;
  const primaryMediaImage =
    mediaItems.find((item: any) => {
      const type = item?.type || "";
      const mime = item?.mimeType || "";
      return type === "image" || mime.startsWith("image/");
    })?.url || "";
  const primaryMediaVideo =
    mediaItems.find((item: any) => {
      const type = item?.type || "";
      const mime = item?.mimeType || "";
      return (
        type === "video" ||
        type === "audio" ||
        mime.startsWith("video/") ||
        mime.startsWith("audio/")
      );
    })?.url || "";
  const previewImage =
    safeScraped.image ||
    primaryMediaImage ||
    mediaItems[0]?.preview ||
    mediaItems[0]?.url ||
    "";

  const carouselItems = mediaItems.length
    ? mediaItems
    : previewImage
      ? [{ url: previewImage, type: "image" }]
      : [];

  const carouselRef = useRef<HTMLDivElement | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const handleCarouselScroll = () => {
    const el = carouselRef.current;
    if (!el || !el.clientWidth) return;
    const nextIndex = Math.round(el.scrollLeft / el.clientWidth);
    setCarouselIndex(Math.min(Math.max(nextIndex, 0), carouselItems.length - 1));
  };

  // Auto-generate symbol from platform/channel/content - NON-EDITABLE
  const coinSymbol = generateCoinSymbol({
    platform: safeScraped.platform,
    author: safeScraped.author,
    title: safeScraped.title,
    url: safeScraped.url,
  });

  const createCoinMutation = useMutation({
    mutationFn: async () => {
      if (!authenticated || !user) {
        throw new Error("Please sign in to create a coin");
      }

      // Get network preference
      const networkPreference = localStorage.getItem('ADMIN_NETWORK_PREFERENCE') as 'sepolia' | 'mainnet' | null;
      const chainId = networkPreference === 'mainnet' ? base.id : baseSepolia.id;

      console.log('🚀 Creating coin on chain:', chainId === base.id ? 'Base Mainnet' : 'Base Sepolia');

      // 1. Upload metadata to IPFS
      const safeTitle = safeScraped.title.trim();
      if (!safeTitle) {
        throw new Error("Title is required to create a coin.");
      }

      const safeDescription = safeScraped.description.trim() || `A coin representing ${safeTitle}`;
      const safeAuthor = safeScraped.author.trim();
      const safeImage = previewImage.trim();
      const safeAnimation = (safeScraped.animationUrl || primaryMediaVideo).trim();
      const safeUrl = safeScraped.url.trim();
      const resolvedContentType =
        safeScraped.type ||
        mediaItems[0]?.type ||
        (safeAnimation ? "video" : safeImage ? "image" : "");

      const metadata = {
        name: safeTitle,
        symbol: coinSymbol,
        description: safeDescription,
        image: safeImage,
        ...(safeAnimation ? { animation_url: safeAnimation } : {}),
        external_url: safeUrl,
        attributes: {
          platform: safeScraped.platform,
          author: safeAuthor,
          publishDate: safeScraped.publishDate,
          contentType: resolvedContentType,
          collaboration: collaboration
            ? {
                mode: collaboration.mode,
                collaborators: collaboration.collaborators,
              }
            : undefined,
        },
        ...(mediaItems.length
          ? {
              properties: {
                media: mediaItems,
                isCarousel,
              },
            }
          : {}),
      };

      // Ensure smart account is initialized
      let accountClient = smartAccountClient;
      let accountAddress = smartAccountAddress;

      if (!accountClient || !accountAddress) {
        console.log("⏳ Smart account not ready, initializing...");
        const result = await initSmartAccount();

        if (!result) {
          throw new Error("Smart account initialization failed. Please refresh and try again.");
        }

        accountClient = result.client;
        accountAddress = result.address;
      }

      console.log("📤 Uploading metadata to IPFS...");
      const ipfsUri = await uploadToIPFS(metadata);
      console.log("✅ Metadata uploaded:", ipfsUri);

      // 2. Create coin record in database (pending status)
      console.log("💾 Creating database record...");
      
      // Determine creator wallet: prefer privy wallet, fallback to smart account
      const creatorWalletAddress = walletAddress || accountAddress;
      console.log('📍 Using creator wallet address:', creatorWalletAddress);
      
      if (!creatorWalletAddress) {
        throw new Error("No wallet address available. Please ensure you're logged in with a wallet.");
      }

      const coinData = {
        name: safeTitle,
        symbol: coinSymbol,
        description: safeDescription,
        image: safeImage,
        creatorWallet: creatorWalletAddress,
        status: 'pending' as const,
        ipfsUri,
      };

      const createdCoin = await apiRequest("POST", "/api/coins", coinData);
      const createdCoinJson = await createdCoin.json();
      console.log("✅ Database record created:", createdCoinJson.id);

      // 3. Deploy coin using gasless deployment
      console.log('💸 Using GASLESS deployment for ALL users!');
      console.log('📍 Smart wallet address:', accountAddress);
      console.log('✅ Gas fees will be sponsored by Base Paymaster (FREE)');

      const deployResult = await deployGaslessCoin(
        {
          name: scrapedData.title,
          symbol: coinSymbol,
          metadataUri: ipfsUri,
          smartAccountAddress: accountAddress,
          platformReferrer: import.meta.env.VITE_ADMIN_REFERRAL_ADDRESS as Address | undefined,
        },
        accountClient
      );

      console.log("✅ Gasless deployment successful!");
      console.log("💰 You paid ZERO gas fees!");
      console.log("📍 Contract address:", deployResult.address || "Pending...");
      console.log("🔗 Transaction hash:", deployResult.hash);

      // Determine the chain ID from the deployment result
      const deployedChainId = deployResult.chainId || baseSepolia.id;

      // Update database with deployment info
      console.log("💾 Updating database with deployment info...");
      await apiRequest("PATCH", `/api/coins/${createdCoinJson.id}`, {
        address: deployResult.address,
        chainId: deployedChainId.toString(),
        status: 'active' as const,
        createdAt: deployResult.createdAt,
      });

      console.log("🎉 Coin creation complete!");
      return {
        coin: {
          ...createdCoinJson,
          address: deployResult.address,
          status: 'active',
          chainId: deployedChainId.toString(),
        }
      };
    },
    onSuccess: (data) => {
      const isGasless = smartAccountClient && smartAccountAddress;
      toast({
        title: isGasless ? "🎉 Coin Created (Gasless)!" : "🎉 Coin Created Successfully!",
        description: isGasless
          ? `${data.coin.symbol} is now live with ZERO gas fees paid!`
          : `${data.coin.symbol} is now live on Base Sepolia testnet`
      });
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 }
      });
      queryClient.invalidateQueries({ queryKey: ["/api/coins"] });
      onCoinCreated();
    },
    onError: (error: Error) => {
      console.error("❌ Coin creation failed:", error);
      toast({
        title: "Coin creation failed",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  return (
    <div className="space-y-4">
      {carouselItems.length > 0 && (
        <div className="relative">
          <div
            ref={carouselRef}
            onScroll={handleCarouselScroll}
            className="flex w-full overflow-x-auto scroll-smooth snap-x snap-mandatory rounded-2xl border border-border/50 bg-muted/10 scrollbar-hide"
          >
            {carouselItems.map((item: any, index: number) => {
              const type = item?.type || item?.mimeType?.split("/")?.[0] || "image";
              const preview = item?.preview || previewImage;
              return (
                <div
                  key={`${item?.url || "media"}-${index}`}
                  className="min-w-full snap-center"
                >
                  {type === "video" ? (
                    <video
                      src={item.url}
                      poster={preview}
                      controls
                      playsInline
                      preload="metadata"
                      className="h-56 w-full object-cover sm:h-64"
                    />
                  ) : type === "audio" ? (
                    <div className="flex h-56 w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-muted/30 to-muted/10 sm:h-64">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <Music className="h-6 w-6" />
                      </div>
                      <audio controls className="w-5/6">
                        <source src={item.url} />
                      </audio>
                    </div>
                  ) : (
                    <img
                      src={item.url}
                      alt={`${scrapedData.title} ${index + 1}`}
                      className="h-56 w-full object-cover sm:h-64"
                    />
                  )}
                </div>
              );
            })}
          </div>
          {carouselItems.length > 1 && (
            <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
              {carouselIndex + 1} / {carouselItems.length}
            </div>
          )}
        </div>
      )}

      {/* Content info - compact */}
      <div className="space-y-1.5">
        <h3 className="font-semibold text-sm text-foreground truncate">
          {scrapedData.title}
        </h3>
        {scrapedData.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {scrapedData.description}
          </p>
        )}

        {/* Metadata row */}
        <div className="flex items-center gap-2">
          {scrapedData.platform && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              {scrapedData.platform}
            </span>
          )}
          {scrapedData.author && (
            <span className="text-xs text-muted-foreground truncate">
              by {scrapedData.author}
            </span>
          )}
          {isCarousel && (
            <span className="text-[10px] text-muted-foreground">
              Carousel · {carouselItems.length} items
            </span>
          )}
        </div>
      </div>

      {/* Auto-generated symbol display - non-editable */}
      <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Auto-Generated Symbol
            </p>
            <p className="text-lg font-bold text-foreground">
              ${coinSymbol}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Based on {scrapedData.author || scrapedData.platform || 'content name'}
            </p>
          </div>
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
      </div>

      {/* Network info & Gasless indicator */}
      <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/20 rounded-lg p-2">
        <span>Network: {localStorage.getItem('ADMIN_NETWORK_PREFERENCE') === 'mainnet' ? 'Base Mainnet' : 'Base Sepolia (Testnet)'}</span>
        <span>Currency: ETH</span>
      </div>

      {/* Gasless deployment indicator - always show for authenticated users */}
      {authenticated && (
        <div className="flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg p-2 text-xs font-medium text-green-600 dark:text-green-400">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Gasless Deployment - Zero Gas Fees!</span>
        </div>
      )}

      {/* Create button */}
      <Button
        onClick={() => {
          if (!authenticated) {
            toast({
              title: "Sign in required",
              description: "Please sign in to create a coin",
              variant: "destructive",
            });
            return;
          }
          createCoinMutation.mutate();
        }}
        disabled={createCoinMutation.isPending || !authenticated}
        className="w-full h-11 bg-gradient-to-r from-primary to-primary hover:from-primary/90 hover:to-primary/80 font-semibold"
        data-testid="button-create-coin"
      >
        {createCoinMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Creating Coin (Gasless)...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            Create ${coinSymbol} Coin (FREE)
          </>
        )}
      </Button>

      {/* Source link */}
      {scrapedData.url && (
        <a
          href={scrapedData.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          View original content
        </a>
      )}


    </div>
  );
}
