import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { BookOpen, ArrowUpRight } from "lucide-react";

const showcasePosts = [
  {
    title: "Creator Coins Go Naira-First",
    subtitle: "Product update",
    date: "Mar 12, 2026",
    category: "Fintech",
    readTime: "4 min read",
    excerpt:
      "Prices now display in NGN across coins, wallet, and swap previews. Trading stays onchain, but the experience is built for Nigerians first.",
    cover:
      "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=900&q=80",
    tone: "from-slate-900/70 via-slate-900/20 to-transparent",
  },
  {
    title: "Weekly Creator Spotlight: Tems Coin",
    subtitle: "Creator story",
    date: "Mar 10, 2026",
    category: "Music",
    readTime: "3 min read",
    excerpt:
      "Meet the community behind Tems Coin, the story that sparked its first 1,000 supporters, and the perks holders unlock this week.",
    cover:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80",
    tone: "from-black/70 via-black/30 to-transparent",
  },
  {
    title: "What Is New in the Swap Experience",
    subtitle: "Design refresh",
    date: "Mar 7, 2026",
    category: "Fintech",
    readTime: "5 min read",
    excerpt:
      "A compact swap card with real-time NGN previews, creator context, and a faster path to buy or sell without crypto jargon.",
    cover:
      "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=900&q=80",
    tone: "from-emerald-900/70 via-emerald-900/30 to-transparent",
  },
  {
    title: "Referral Rewards: Invite, Earn, Repeat",
    subtitle: "Growth",
    date: "Mar 5, 2026",
    category: "Fintech",
    readTime: "2 min read",
    excerpt:
      "Referral bonuses now land instantly with in-app notifications. Share your code and stack E1XP faster.",
    cover:
      "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=900&q=80",
    tone: "from-indigo-900/70 via-indigo-900/30 to-transparent",
  },
  {
    title: "How Trending Coins Are Picked",
    subtitle: "Market insights",
    date: "Mar 2, 2026",
    category: "Sessions",
    readTime: "6 min read",
    excerpt:
      "We break down the signals behind trending coins, what matters for creators, and how fans discover new communities.",
    cover:
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=900&q=80",
    tone: "from-amber-900/70 via-amber-900/30 to-transparent",
  },
  {
    title: "Creator Payouts and Auto-Settlement",
    subtitle: "Finance",
    date: "Feb 26, 2026",
    category: "Fintech",
    readTime: "4 min read",
    excerpt:
      "Understand how onchain rewards appear in your dashboard, when NGN estimates update, and how withdrawals flow to banks.",
    cover:
      "https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=900&q=80",
    tone: "from-sky-900/70 via-sky-900/30 to-transparent",
  },
];

const categories = ["All", "Music", "Sessions", "Movies", "Games", "Fintech", "Art"];

const toneByCategory: Record<string, string> = {
  Music: "from-slate-900/70 via-slate-900/20 to-transparent",
  Sessions: "from-amber-900/70 via-amber-900/30 to-transparent",
  Movies: "from-black/70 via-black/30 to-transparent",
  Games: "from-emerald-900/70 via-emerald-900/30 to-transparent",
  Fintech: "from-indigo-900/70 via-indigo-900/30 to-transparent",
  Art: "from-sky-900/70 via-sky-900/30 to-transparent",
  Default: "from-slate-900/70 via-slate-900/20 to-transparent",
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);

export default function Showcase() {
  const [activeCategory, setActiveCategory] = useState(categories[0]);
  const { data } = useQuery({
    queryKey: ["/api/blog/posts", activeCategory],
    queryFn: async () => {
      const params =
        activeCategory === "All"
          ? ""
          : `?category=${encodeURIComponent(activeCategory)}`;
      const res = await fetch(`/api/blog/posts${params}`);
      if (!res.ok) {
        throw new Error("Failed to fetch posts");
      }
      return res.json();
    },
  });

  const apiPosts = (data as any)?.posts || [];
  const normalizedPosts = (apiPosts.length ? apiPosts : showcasePosts).map(
    (post: any) => {
      const category = post.category || "Fintech";
      return {
        title: post.title,
        subtitle: post.subtitle || category,
        category,
        cover: post.coverUrl || post.cover_url || post.cover,
        tone: post.tone || toneByCategory[category] || toneByCategory.Default,
        slug: post.slug || slugify(post.title),
      };
    }
  );

  return (
    <div className="container mx-auto max-w-6xl px-4 py-4 space-y-3">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <BookOpen className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="text-center">
          <h1 className="text-lg font-semibold sm:text-2xl">Showcase</h1>
          <p className="text-[11px] text-muted-foreground sm:text-sm">
            News, launches, and creator stories from the creat8* ecosystem.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-start gap-1 overflow-x-auto pb-0.5 px-1 flex-nowrap sm:justify-center sm:gap-2 sm:px-0 sm:flex-wrap">
        {categories.map((category, index) => (
          <Button
            key={category}
            size="sm"
            variant={category === activeCategory ? "default" : "secondary"}
            className="rounded-full px-2.5 text-[10px] h-6 shrink-0 border-0 sm:h-8 sm:px-4 sm:text-xs"
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3 mt-1">
        {normalizedPosts.map((post) => (
          <Link key={post.slug} href={`/showcase/${post.slug}`} className="block">
            <article className="group overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40">
              <div className="relative aspect-square overflow-hidden">
                <img
                  src={post.cover}
                  alt={post.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <div className={`absolute inset-0 bg-gradient-to-t ${post.tone}`} />
                <div className="absolute top-1 left-1">
                  <Badge className="bg-white/85 text-foreground text-[8px] px-1 py-0.5">
                    {post.category}
                  </Badge>
                </div>
                <div className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/80 text-foreground shadow-sm">
                  <ArrowUpRight className="h-2.5 w-2.5 stroke-[2.5]" />
                </div>
                <div className="absolute bottom-1 left-1 space-y-0.5 text-white">
                  <p className="text-[8px] uppercase tracking-wide text-white/80">
                    {post.subtitle}
                  </p>
                  <h2 className="text-[13px] font-semibold leading-tight">
                    {post.title}
                  </h2>
                </div>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </div>
  );
}
