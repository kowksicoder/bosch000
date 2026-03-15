import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, formatSmartCurrency } from "@/lib/utils";
import type { User } from "@shared/schema";
import ProfileCardModal from "@/components/profile-card-modal";
import { useIsMobile } from "@/hooks/use-mobile";

interface TopCreatorsStoriesProps {
  creators: User[];
  limit?: number;
  className?: string;
}

export function TopCreatorsStories({
  creators,
  limit,
  className,
}: TopCreatorsStoriesProps) {
  const isMobile = useIsMobile();
  const displayLimit = limit || (isMobile ? 4 : 6);
  const topCreators = isMobile ? creators.slice(0, displayLimit) : creators.slice(0, displayLimit);
  const [selectedCreator, setSelectedCreator] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          "flex gap-2 overflow-x-auto scrollbar-hide pb-1 justify-start md:justify-center top-creators-stories -mt-2 md:mt-0",
          className,
        )}
        data-tour="top-creators"
      >
        {topCreators.map((creator, index) => {
          const earnings = formatSmartCurrency((creator.e1xpPoints || 0) * 0.001).replace('₦', '');

          return (
            <div
              key={creator.id}
              onClick={() => {
                const address =
                  creator.walletAddress || creator.address || creator.id || "";
                setSelectedCreator(address);
                setIsProfileModalOpen(true);
              }}
              className="flex flex-col items-center gap-1 flex-shrink-0 group cursor-pointer"
              data-testid={`link-story-creator-${creator.id}`}
            >
              <div className="relative">
                <div className="p-[2px] rounded-full bg-gradient-to-tr from-primary via-secondary to-accent group-hover:scale-105 transition-transform duration-200">
                  <div className="p-[2px] rounded-full bg-background">
                    <Avatar className="h-12 w-12 md:h-12 md:w-12 ring-0">
                      <AvatarImage src={creator.avatarUrl || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-secondary/20 text-foreground font-bold text-sm md:text-sm">
                        {creator.username?.charAt(0).toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>

                <div className="absolute -bottom-0.5 -right-0.5 min-w-[20px] md:min-w-[24px] h-3.5 md:h-4 px-1 md:px-1.5 rounded-full bg-white flex items-center justify-center text-[8px] md:text-[9px] font-bold text-green-600 ring-1 ring-background shadow-sm">
                  ${earnings}
                </div>
              </div>

              <span className="text-[10px] md:text-[10px] font-medium text-foreground max-w-[56px] md:max-w-[56px] truncate text-center group-hover:text-primary transition-colors">
                {creator.username || "Unknown"}
              </span>
            </div>
          );
        })}
      </div>
      
      {selectedCreator && (
        <ProfileCardModal
          creatorAddress={selectedCreator}
          open={isProfileModalOpen}
          onOpenChange={setIsProfileModalOpen}
        />
      )}
    </>
  );
}
