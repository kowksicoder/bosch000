import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface URLInputFormProps {
  onScraped: (data: any) => void;
}

export default function URLInputForm({ onScraped }: URLInputFormProps) {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      toast({
        title: "URL required",
        description: "Please enter a valid URL",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to scrape URL");
      }

      const scrapedData = await response.json();
      onScraped(scrapedData);
      setUrl("");
      
      toast({
        title: "Content imported!",
        description: "Review your content and create your coin",
      });
    } catch (error) {
      console.error("Scraping error:", error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Failed to import content from URL",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="bg-muted/10 border border-border/30 rounded-2xl p-2">
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="space-y-1">
            <div className="relative">
              <LinkIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
              <div className="bg-muted/30 dark:bg-muted/20 rounded-xl p-0.5 border border-border/20">
                <Input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste a link..."
                  className="bg-transparent border-0 h-8 pl-8 pr-2.5 focus-visible:ring-0 focus-visible:ring-offset-0 text-[11px]"
                  disabled={isLoading}
                  data-testid="input-url"
                />
              </div>
            </div>
            <p className="text-[9px] text-muted-foreground px-1">
              Supports major platforms.
            </p>
          </div>

          <Button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="w-full h-7 bg-gradient-to-r from-primary to-primary hover:from-primary/100 hover:to-primary/90 text-primary-foreground font-semibold rounded-lg text-[10px] transition-all"
            data-testid="button-import"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <LinkIcon className="w-3.5 h-3.5 mr-1.5" />
                Import
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
