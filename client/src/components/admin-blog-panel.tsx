import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, PlusCircle } from "lucide-react";

const categories = ["Music", "Sessions", "Movies", "Games", "Fintech", "Art"];

export function AdminBlogPanel() {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [status, setStatus] = useState<"draft" | "published">("draft");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/blog-posts"],
    queryFn: async () => {
      const res = await fetch("/api/admin/blog-posts", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch blog posts");
      }
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/blog-posts", {
        title,
        subtitle,
        excerpt,
        content,
        coverUrl,
        category,
        status,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Blog post saved",
        description:
          status === "published"
            ? "Post is now live on Showcase."
            : "Post saved as draft.",
      });
      setTitle("");
      setSubtitle("");
      setExcerpt("");
      setContent("");
      setCoverUrl("");
      setCategory(categories[0]);
      setStatus("draft");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blog-posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blog/posts"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; status: "draft" | "published" }) => {
      const response = await apiRequest(
        "PUT",
        `/api/admin/blog-posts/${payload.id}`,
        {
          status: payload.status,
        }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blog-posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blog/posts"] });
    },
  });

  const posts = (data as any)?.posts || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Publish a new blog post</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="blog-title">Title</Label>
              <Input
                id="blog-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Post title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="blog-subtitle">Subtitle</Label>
              <Input
                id="blog-subtitle"
                value={subtitle}
                onChange={(event) => setSubtitle(event.target.value)}
                placeholder="Short subtitle for the tile"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="blog-category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="blog-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="blog-status">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as "draft" | "published")}>
                <SelectTrigger id="blog-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="blog-cover">Cover image URL</Label>
            <Input
              id="blog-cover"
              value={coverUrl}
              onChange={(event) => setCoverUrl(event.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="blog-excerpt">Excerpt</Label>
            <Textarea
              id="blog-excerpt"
              value={excerpt}
              onChange={(event) => setExcerpt(event.target.value)}
              placeholder="Short summary shown on the detail page"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="blog-content">Content</Label>
            <Textarea
              id="blog-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Full article text"
              rows={8}
            />
          </div>

          <Button
            onClick={() => createMutation.mutate()}
            disabled={!title || createMutation.isPending}
            className="gap-2"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving
              </>
            ) : (
              <>
                <PlusCircle className="h-4 w-4" />
                Save post
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent posts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading posts
            </div>
          )}
          {!isLoading && posts.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No blog posts yet. Publish one above.
            </p>
          )}
          <div className="space-y-3">
            {posts.map((post: any) => (
              <div
                key={post.id}
                className="flex flex-col gap-3 rounded-xl border border-border/60 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 overflow-hidden rounded-lg bg-muted">
                    {post.cover_url ? (
                      <img
                        src={post.cover_url}
                        alt={post.title}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{post.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{post.category || "Uncategorized"}</span>
                      <span>/</span>
                      <span>{post.slug}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={post.status === "published" ? "default" : "secondary"}>
                    {post.status}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      updateMutation.mutate({
                        id: post.id,
                        status: post.status === "published" ? "draft" : "published",
                      })
                    }
                  >
                    {post.status === "published" ? "Unpublish" : "Publish"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
