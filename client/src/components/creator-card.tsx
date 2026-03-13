import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { User } from "@shared/schema";

interface CreatorCardProps {
  creator: User;
  onConnect?: () => void;
  isConnected?: boolean;
}

export function CreatorCard({ creator, onConnect, isConnected }: CreatorCardProps) {
  const avatarUrl = creator.avatarUrl || "https://i.ibb.co/JRQCPsZK/ev122logo-1-1.png";
  const profileIdentifier = creator.walletAddress || creator.username || creator.id;
  const profileHref = `/profile/${encodeURIComponent(profileIdentifier)}`;

  return (
    <Card
      className="p-6 hover-elevate active-elevate-2 transition-all duration-200"
      data-testid={`card-creator-${creator.id}`}
    >
      <div className="flex flex-col items-center text-center gap-4">
        <Link href={profileHref}>
          <Avatar className="h-20 w-20 ring-2 ring-primary ring-offset-2 ring-offset-background cursor-pointer">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
              {creator.displayName?.charAt(0) || creator.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>

        <div className="space-y-2 w-full">
          <Link href={profileHref}>
            <h3
              className="font-bold text-lg hover:text-primary transition-colors cursor-pointer"
              data-testid={`text-creator-name-${creator.id}`}
            >
              {creator.displayName || creator.username}
            </h3>
          </Link>

          {creator.bio && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {creator.bio}
            </p>
          )}

          {creator.categories && creator.categories.length > 0 && (
            <div className="flex flex-wrap gap-1 justify-center">
              {creator.categories.slice(0, 2).map((category) => (
                <Badge
                  key={category}
                  variant="secondary"
                  className="text-xs"
                  data-testid={`badge-category-${category}`}
                >
                  {category}
                </Badge>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-2 text-sm">
            <div>
              <div className="font-bold text-foreground" data-testid={`text-connections-${creator.id}`}>
                {creator.totalConnections?.toLocaleString() || 0}
              </div>
              <div className="text-muted-foreground text-xs">Connections</div>
            </div>
            <div>
              <div className="font-bold text-foreground" data-testid={`text-views-${creator.id}`}>
                {creator.totalProfileViews?.toLocaleString() || 0}
              </div>
              <div className="text-muted-foreground text-xs">Views</div>
            </div>
          </div>
        </div>

        {onConnect && (
          <Button
            onClick={onConnect}
            variant={isConnected ? "secondary" : "default"}
            size="sm"
            className="w-full"
            data-testid={`button-connect-${creator.id}`}
          >
            {isConnected ? "Connected" : "Connect"}
          </Button>
        )}
      </div>
    </Card>
  );
}
