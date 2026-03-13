import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Users, Search, Plus } from "lucide-react";
import type { Group } from "@shared/schema";

export default function Groups() {
  const { data: groups, isLoading } = useQuery<Group[]>({
    queryKey: ["/api/groups"],
  });

  return (
    <div className="container max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Groups</h1>
            <p className="text-muted-foreground">
              Join creator communities and collaborate
            </p>
          </div>
        </div>
        <Button data-testid="button-create-group">
          <Plus className="h-4 w-4 mr-2" />
          Create Group
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search groups..."
          className="pl-10 h-12"
          data-testid="input-search-groups"
        />
      </div>

      {/* Groups Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-64 bg-card rounded-2xl animate-pulse"
              data-testid="skeleton-group-card"
            />
          ))}
        </div>
      ) : groups && groups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <Card
              key={group.id}
              className="overflow-hidden hover-elevate active-elevate-2 transition-all duration-200 cursor-pointer"
              data-testid={`card-group-${group.id}`}
            >
              {group.coverImageUrl && (
                <div className="h-32 overflow-hidden">
                  <img
                    src={group.coverImageUrl}
                    alt={group.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              {!group.coverImageUrl && (
                <div className="h-32 bg-gradient-to-br from-primary/20 to-accent/20" />
              )}

              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3
                      className="font-bold text-lg line-clamp-1"
                      data-testid={`text-group-name-${group.id}`}
                    >
                      {group.name}
                    </h3>
                    {group.isPrivate && (
                      <Badge variant="secondary" className="shrink-0">
                        Private
                      </Badge>
                    )}
                  </div>

                  {group.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {group.description}
                    </p>
                  )}

                  {group.category && (
                    <Badge className="bg-accent text-accent-foreground">
                      {group.category}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span data-testid={`text-member-count-${group.id}`}>
                      {group.memberCount?.toLocaleString() || 0} members
                    </span>
                  </div>
                  <Button size="sm" data-testid={`button-join-${group.id}`}>
                    Join
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No groups yet</h3>
          <p className="text-muted-foreground mb-6">
            Create the first group and start building your community
          </p>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Group
          </Button>
        </div>
      )}
    </div>
  );
}
