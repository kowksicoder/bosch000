import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

type BlogPost = {
  id?: string;
  title: string;
  subtitle?: string | null;
  excerpt?: string | null;
  content?: string | null;
  cover_url?: string | null;
  coverUrl?: string | null;
  category?: string | null;
  author_name?: string | null;
  authorName?: string | null;
  published_at?: string | null;
  publishedAt?: string | null;
};

export default function ShowcaseDetail() {
  const [, params] = useRoute("/showcase/:slug");
  const slug = params?.slug;

  const { data, isLoading } = useQuery({
    queryKey: ["/api/blog/posts", slug],
    enabled: !!slug,
    queryFn: async () => {
      const res = await fetch(`/api/blog/posts/${slug}`);
      if (!res.ok) {
        throw new Error("Post not found");
      }
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-10 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-10 space-y-4">
        <p className="text-sm text-muted-foreground">Post not found.</p>
        <Link href="/showcase">
          <Button variant="outline" size="sm">
            Back to Showcase
          </Button>
        </Link>
      </div>
    );
  }

  const post = data as BlogPost;
  const cover = post.coverUrl || post.cover_url || "";
  const category = post.category || "Feature";
  const subtitle = post.subtitle || post.excerpt;
  const content = post.content || post.excerpt || "";
  const paragraphs = content
    .split("\n")
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
      <Link href="/showcase">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Showcase
        </Button>
      </Link>

      <div className="space-y-4">
        <Badge className="w-fit">{category}</Badge>
        <h1 className="text-2xl font-semibold sm:text-3xl">{post.title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground sm:text-base">
            {subtitle}
          </p>
        )}
      </div>

      {cover && (
        <div className="overflow-hidden rounded-2xl border border-border/60">
          <img src={cover} alt={post.title} className="w-full object-cover" />
        </div>
      )}

      <div className="space-y-4 text-sm text-muted-foreground sm:text-base">
        {paragraphs.map((paragraph, index) => (
          <p key={`${index}-${paragraph.slice(0, 12)}`}>{paragraph}</p>
        ))}
      </div>
    </div>
  );
}
