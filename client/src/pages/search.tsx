import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CreatorCard } from "@/components/creator-card";
import { CoinCard } from "@/components/coin-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search as SearchIcon, Filter, X, TrendingUp, Sparkles } from "lucide-react";
import type { User } from "@shared/schema";

export default function Search() {
  const [location] = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const [searchQuery, setSearchQuery] = useState(urlParams.get('q') || "");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    if (query) {
      setSearchQuery(query);
    }
  }, [location]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("connections");

  const { data: creators, isLoading } = useQuery<User[]>({
    queryKey: ["/api/creators", { search: searchQuery, category: selectedCategory, location: selectedLocation, sortBy }],
  });

  // Fetch suggested coins when there's no search query
  const showSuggestions = !searchQuery && selectedCategory === "all" && selectedLocation === "all" && sortBy === "connections";
  
  const { data: topGainersData } = useQuery<{ coins: any[] }>({
    queryKey: ["/api/zora/coins/top-gainers?count=6"],
  });

  const { data: newCoinsData } = useQuery<{ coins: any[] }>({
    queryKey: ["/api/zora/coins/new?count=6"],
  });

  const categories = [
    "All Categories",
    "Music",
    "Art",
    "Gaming",
    "Tech",
    "Fashion",
    "Fitness",
    "Education",
    "Entertainment",
  ];

  const handleClearFilters = () => {
    setSelectedCategory("all");
    setSelectedLocation("all");
    setSortBy("connections");
    setSearchQuery("");
  };

  return (
    <div className="container max-w-5xl mx-auto px-3 md:px-4 py-3 md:py-8 space-y-3 md:space-y-8">
      {/* Search Bar */}
      <div className="relative">
        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search creators, categories, locations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 md:pl-10 h-9 md:h-12 text-sm md:text-base"
          data-testid="input-search"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-2 md:gap-4 items-start md:items-center justify-between">
        <div className="flex flex-wrap gap-1.5 md:gap-3 flex-1">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[110px] md:w-[180px] h-8 md:h-9 text-xs md:text-sm" data-testid="select-category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="music">Music</SelectItem>
              <SelectItem value="art">Art</SelectItem>
              <SelectItem value="gaming">Gaming</SelectItem>
              <SelectItem value="tech">Tech</SelectItem>
              <SelectItem value="fashion">Fashion</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-[110px] md:w-[180px] h-8 md:h-9 text-xs md:text-sm" data-testid="select-location">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              <SelectItem value="us">United States</SelectItem>
              <SelectItem value="uk">United Kingdom</SelectItem>
              <SelectItem value="global">Global</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[110px] md:w-[180px] h-8 md:h-9 text-xs md:text-sm" data-testid="select-sort">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="connections">Most Connections</SelectItem>
              <SelectItem value="views">Most Views</SelectItem>
              <SelectItem value="earnings">Top Earnings</SelectItem>
              <SelectItem value="recent">Recently Joined</SelectItem>
            </SelectContent>
          </Select>

          {(selectedCategory !== "all" || selectedLocation !== "all" || sortBy !== "connections") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-8 md:h-9 text-xs md:text-sm px-2 md:px-4"
              data-testid="button-clear-filters"
            >
              <X className="h-3 w-3 md:h-4 md:w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        <Badge variant="secondary" className="text-xs md:text-sm px-2 py-0.5">
          {creators?.length || 0} found
        </Badge>
      </div>

      {/* Trending Categories */}
      <div className="space-y-1.5 md:space-y-3">
        <h3 className="text-xs md:text-sm font-medium text-muted-foreground">Trending</h3>
        <div className="flex flex-wrap gap-1.5 md:gap-2">
          {categories.slice(1, 6).map((category) => (
            <Badge
              key={category}
              variant="outline"
              className="cursor-pointer hover-elevate transition-all text-xs py-0.5 px-2"
              onClick={() => setSelectedCategory(category.toLowerCase())}
              data-testid={`badge-trending-${category.toLowerCase()}`}
            >
              {category}
            </Badge>
          ))}
        </div>
      </div>

      {/* Coin Suggestions - Only show when no search/filters active */}
      {showSuggestions && (
        <div className="space-y-3 md:space-y-4">
          {/* Top Gainers */}
          {topGainersData?.coins && topGainersData.coins.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4 text-green-500" />
                <h3 className="text-xs md:text-sm font-semibold">Top Gainers</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3">
                {topGainersData.coins.map((coin: any) => (
                  <CoinCard
                    key={coin.id || coin.address}
                    coin={{
                      id: coin.id || coin.address,
                      name: coin.name || "Unnamed Coin",
                      symbol: coin.symbol || "???",
                      address: coin.address,
                      image: coin.mediaContent?.previewImage?.medium || coin.mediaContent?.previewImage?.small,
                      marketCap: coin.marketCap ? (Math.ceil(parseFloat(coin.marketCap) * 100) / 100).toFixed(2) : "0",
                      volume24h: coin.volume24h ? (Math.ceil(parseFloat(coin.volume24h) * 100) / 100).toFixed(2) : "0",
                      holders: coin.uniqueHolders || 0,
                      creator: coin.creatorAddress,
                      createdAt: coin.createdAt,
                      category: "zora",
                      platform: "zora",
                    }}
                    onClick={() => window.location.href = `/coin/${coin.address}`}
                    data-testid={`coin-card-top-gainer-${coin.address}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recently Added */}
          {newCoinsData?.coins && newCoinsData.coins.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4 text-purple-500" />
                <h3 className="text-xs md:text-sm font-semibold">Recently Added</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3">
                {newCoinsData.coins.map((coin: any) => (
                  <CoinCard
                    key={coin.id || coin.address}
                    coin={{
                      id: coin.id || coin.address,
                      name: coin.name || "Unnamed Coin",
                      symbol: coin.symbol || "???",
                      address: coin.address,
                      image: coin.mediaContent?.previewImage?.medium || coin.mediaContent?.previewImage?.small,
                      marketCap: coin.marketCap ? (Math.ceil(parseFloat(coin.marketCap) * 100) / 100).toFixed(2) : "0",
                      volume24h: coin.volume24h ? (Math.ceil(parseFloat(coin.volume24h) * 100) / 100).toFixed(2) : "0",
                      holders: coin.uniqueHolders || 0,
                      creator: coin.creatorAddress,
                      createdAt: coin.createdAt,
                      category: "zora",
                      platform: "zora",
                    }}
                    onClick={() => window.location.href = `/coin/${coin.address}`}
                    data-testid={`coin-card-new-${coin.address}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="h-80 bg-card rounded-2xl animate-pulse"
              data-testid="skeleton-creator-card"
            />
          ))}
        </div>
      ) : creators && creators.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
          {creators.map((creator) => (
            <CreatorCard key={creator.id} creator={creator} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No creators found</h3>
          <p className="text-muted-foreground">
            Try adjusting your filters or search query
          </p>
        </div>
      )}
    </div>
  );
}
