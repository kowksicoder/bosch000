import { useQuery } from "@tanstack/react-query";
import { CreatorCard } from "@/components/creator-card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Users } from "lucide-react";
import type { User } from "@shared/schema";

export default function Connections() {
  const { data: connections, isLoading } = useQuery<User[]>({
    queryKey: ["/api/connections"],
  });

  const { data: invitations } = useQuery<User[]>({
    queryKey: ["/api/connections/invitations"],
  });

  return (
    <div className="container max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Users className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Connections</h1>
          <p className="text-muted-foreground">
            Manage your creator network and collaborations
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search connections..."
          className="pl-10 h-12"
          data-testid="input-search-connections"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all-connections">
            All Connections
            {connections && (
              <Badge variant="secondary" className="ml-2">
                {connections.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="invitations" data-testid="tab-invitations">
            Invitations
            {invitations && invitations.length > 0 && (
              <Badge className="ml-2 bg-accent">
                {invitations.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="h-80 bg-card rounded-2xl animate-pulse"
                  data-testid="skeleton-connection-card"
                />
              ))}
            </div>
          ) : connections && connections.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {connections.map((creator) => (
                <CreatorCard
                  key={creator.id}
                  creator={creator}
                  isConnected={true}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No connections yet</h3>
              <p className="text-muted-foreground">
                Start connecting with creators to build your network
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="invitations" className="mt-6">
          {invitations && invitations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {invitations.map((creator) => (
                <CreatorCard
                  key={creator.id}
                  creator={creator}
                  onConnect={() => console.log("Accept invitation:", creator.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No pending invitations</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
