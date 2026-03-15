import { useEffect, useRef, useState } from "react";
import URLInputForm from "@/components/url-input-form";
import ContentPreview from "@/components/content-preview";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Reorder } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Upload,
  Link as LinkIcon,
  Image,
  Film,
  Music,
  FileText,
  GripVertical,
  X,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { nanoid } from "nanoid";

type TabType = "import" | "upload";
type CreateMode = "solo" | "collab";
type CollaboratorResult = {
  id: string;
  name?: string | null;
  username?: string | null;
  address?: string | null;
  avatar?: string | null;
  source?: string;
};
type UploadItem = {
  id: string;
  file: File;
  previewUrl: string;
};

export default function Create() {
  const [showPreview, setShowPreview] = useState(false);
  const [scrapedData, setScrapedData] = useState<any>(null);
  const [uploadedItems, setUploadedItems] = useState<UploadItem[]>([]);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadAuthor, setUploadAuthor] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("import");
  const [createMode, setCreateMode] = useState<CreateMode>("solo");
  const [collaborators, setCollaborators] = useState<string[]>([""]);
  const [collabSearchIndex, setCollabSearchIndex] = useState<number | null>(null);
  const [collabSearchQuery, setCollabSearchQuery] = useState("");
  const [collabSearchResults, setCollabSearchResults] = useState<CollaboratorResult[]>([]);
  const [collabSearchLoading, setCollabSearchLoading] = useState(false);
  const collabSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();
  const collabList = collaborators.map((c) => c.trim()).filter(Boolean);

  const handleScrapedData = (data: any) => {
    setScrapedData(data);
    setShowPreview(true);
  };

  const handleCoinCreated = () => {
    setShowPreview(false);
    setScrapedData(null);
    resetUploadForm();
  };

  const resetUploadForm = () => {
    uploadedItems.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setUploadedItems([]);
    setUploadTitle("");
    setUploadDescription("");
    setUploadAuthor("");
  };

  const updateCollaborator = (index: number, value: string) => {
    setCollaborators((prev) => prev.map((item, i) => (i === index ? value : item)));
    setCollabSearchIndex(index);
    setCollabSearchQuery(value);
  };

  const selectCollaborator = (index: number, collaborator: CollaboratorResult) => {
    const handle = collaborator.username ? `@${collaborator.username}` : null;
    const value = handle || collaborator.address || collaborator.name || "";
    setCollaborators((prev) => prev.map((item, i) => (i === index ? value : item)));
    setCollabSearchResults([]);
    setCollabSearchIndex(null);
  };

  const addCollaborator = () => {
    setCollaborators((prev) => [...prev, ""]);
  };

  const removeCollaborator = (index: number) => {
    setCollaborators((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (collabSearchTimer.current) {
      clearTimeout(collabSearchTimer.current);
    }

    if (collabSearchIndex === null) {
      setCollabSearchResults([]);
      setCollabSearchLoading(false);
      return;
    }

    const query = collabSearchQuery.trim();
    const normalized = query.replace(/^@/, "");

    if (!normalized || (normalized.length < 2 && !normalized.startsWith("0x"))) {
      setCollabSearchResults([]);
      setCollabSearchLoading(false);
      return;
    }

    setCollabSearchLoading(true);
    collabSearchTimer.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/creators/search?q=${encodeURIComponent(normalized)}`,
        );
        if (!response.ok) throw new Error("Failed to search creators");
        const results = await response.json();
        setCollabSearchResults(Array.isArray(results) ? results : []);
      } catch (error) {
        console.error("Collaborator search error:", error);
        setCollabSearchResults([]);
      } finally {
        setCollabSearchLoading(false);
      }
    }, 250);

    return () => {
      if (collabSearchTimer.current) {
        clearTimeout(collabSearchTimer.current);
      }
    };
  }, [collabSearchIndex, collabSearchQuery]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    uploadedItems.forEach((item) => URL.revokeObjectURL(item.previewUrl));

    const maxSize = 100 * 1024 * 1024;
    const nextItems: UploadItem[] = [];

    files.forEach((file) => {
      const isValidType =
        file.type.startsWith("image/") ||
        file.type.startsWith("video/") ||
        file.type.startsWith("audio/");

      if (!isValidType) {
        toast({
          title: "Invalid file type",
          description: "Please upload an image, video, or audio file",
          variant: "destructive",
        });
        return;
      }

      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: "Maximum file size is 100MB per file",
          variant: "destructive",
        });
        return;
      }

      nextItems.push({
        id: nanoid(),
        file,
        previewUrl: URL.createObjectURL(file),
      });
    });

    if (!nextItems.length) return;

    setUploadedItems(nextItems);

    if (!uploadTitle) {
      const nameWithoutExt = nextItems[0].file.name.replace(/\.[^/.]+$/, "");
      setUploadTitle(nameWithoutExt);
    }
  };

  const handleUploadPreview = async () => {
    if (!uploadedItems.length || !uploadTitle) {
      toast({
        title: "Missing information",
        description: "Please upload your media and provide a title",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      uploadedItems.forEach((item) => {
        formData.append("files", item.file);
      });
      formData.append("title", uploadTitle);
      formData.append("description", uploadDescription);
      formData.append("author", uploadAuthor);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to upload file");
      }

      const { uploadData } = await uploadRes.json();

      if (!uploadData) {
        throw new Error("No data received from upload");
      }

      setScrapedData(uploadData);
      setShowPreview(true);

      toast({
        title: "Upload successful",
        description: "Review your content and create your coin",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getFileIcon = (file?: File) => {
    if (!file) return <FileText className="w-6 h-6" />;
    const type = file.type.split("/")[0];
    switch (type) {
      case "image":
        return <Image className="w-6 h-6" />;
      case "video":
        return <Film className="w-6 h-6" />;
      case "audio":
        return <Music className="w-6 h-6" />;
      default:
        return <FileText className="w-6 h-6" />;
    }
  };

  const removeUpload = (index: number) => {
    setUploadedItems((prev) => {
      const target = prev[index];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  return (
    <div className="p-3 sm:p-8 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4 sm:mb-8 text-center">
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground">
              Create Your Coin
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Transform any content into a tradeable digital asset
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mb-4 sm:mb-6">
          <button
            onClick={() => setCreateMode((prev) => (prev === "collab" ? "solo" : "collab"))}
            className={`relative flex items-center gap-1 sm:gap-2 px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
              createMode === "collab"
                ? "bg-gradient-to-r from-primary to-secondary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover-elevate active-elevate-2"
            }`}
          >
            Collab Coin
          </button>
          <button
            onClick={() => setActiveTab("import")}
            className={`
              relative flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-1.5 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all
              ${
                activeTab === "import"
                  ? "bg-gradient-to-r from-primary to-secondary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover-elevate active-elevate-2"
              }
            `}
            data-testid="button-tab-import"
          >
            <LinkIcon className="w-3 h-3 sm:w-4 sm:h-4" />
            Import URL
          </button>
          <button
            onClick={() => setActiveTab("upload")}
            className={`
              relative flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-1.5 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all
              ${
                activeTab === "upload"
                  ? "bg-gradient-to-r from-primary to-secondary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover-elevate active-elevate-2"
              }
            `}
            data-testid="button-tab-upload"
          >
            <Upload className="w-3 h-3 sm:w-4 sm:h-4" />
            Upload Files
          </button>
        </div>

        {createMode === "collab" && (
          <div className="max-w-2xl mx-auto mb-5">
            <div className="bg-card border border-border/50 rounded-3xl p-4 sm:p-6 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Collaboration setup</h3>
                <p className="text-xs text-muted-foreground">
                  Add collaborator wallets or handles. Each collaborator will see this collab in their dashboard.
                </p>
              </div>
              <div className="space-y-2">
                {collaborators.map((value, index) => (
                  <div key={`collab-${index}`} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        value={value}
                        onChange={(e) => updateCollaborator(index, e.target.value)}
                        onFocus={() => setCollabSearchIndex(index)}
                        onBlur={() => {
                          setTimeout(() => {
                            setCollabSearchIndex((current) =>
                              current === index ? null : current,
                            );
                          }, 150);
                        }}
                        placeholder="0x... or @username"
                        className="h-9 text-sm"
                      />
                      {collabSearchIndex === index &&
                        collabSearchQuery.trim() && (
                          <div className="absolute z-20 mt-1 w-full rounded-xl border border-border/60 bg-card shadow-lg">
                            {collabSearchLoading ? (
                              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Searching creators...
                              </div>
                            ) : (
                              <div className="max-h-56 overflow-y-auto py-1">
                                {collabSearchResults.map((result) => {
                                  const title =
                                    result.name || result.username || "Creator";
                                  const subtitle = result.username
                                    ? `@${result.username}`
                                    : result.address
                                      ? `${result.address.slice(0, 6)}...${result.address.slice(-4)}`
                                      : "";
                                  return (
                                    <button
                                      key={`${result.id}-${result.address || result.username}`}
                                      type="button"
                                      onClick={() => selectCollaborator(index, result)}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50"
                                    >
                                      <div className="h-8 w-8 shrink-0 rounded-full bg-muted/60 overflow-hidden flex items-center justify-center text-xs font-semibold">
                                        {result.avatar ? (
                                          <img
                                            src={result.avatar}
                                            alt={title}
                                            className="h-full w-full object-cover"
                                          />
                                        ) : (
                                          title?.slice(0, 1)?.toUpperCase()
                                        )}
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="font-medium text-foreground">
                                          {title}
                                        </span>
                                        {subtitle && (
                                          <span className="text-xs text-muted-foreground">
                                            {subtitle}
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}
                                {collabSearchResults.length === 0 && (
                                  <div className="px-3 py-2 text-xs text-muted-foreground">
                                    No creators found.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                    {collaborators.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 px-2"
                        onClick={() => removeCollaborator(index)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button variant="outline" className="h-9 text-sm" onClick={addCollaborator}>
                Add collaborator
              </Button>
            </div>
          </div>
        )}

        <div className="mb-6">
          {activeTab === "import" ? (
            <URLInputForm onScraped={handleScrapedData} />
          ) : (
            <div className="max-w-xl mx-auto">
              <div className="bg-card border border-border/50 rounded-3xl p-4 sm:p-8">
                <div className="space-y-4 sm:space-y-6">
                  <div className="border-2 border-dashed border-border/40 rounded-2xl p-6 sm:p-10 text-center bg-muted/20 hover:border-primary/50 transition-all hover:bg-muted/30">
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      accept="image/*,video/*,audio/*,.svg,.gif,.mp3,.mp4,.mov,.webm,.avi,.mkv,.flv,.wmv,.m4v,.3gp,.ogg,.wav,.aac,.flac,.m4a,.wma,.apng"
                      multiple
                      onChange={handleFileUpload}
                      data-testid="input-file-upload"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <div className="flex flex-col items-center gap-4">
                        {uploadedItems.length ? (
                          <>
                            <div className="p-4 rounded-2xl bg-primary/10">
                              {getFileIcon(uploadedItems[0]?.file)}
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-foreground">
                                {uploadedItems.length === 1
                                  ? uploadedItems[0].file.name
                                  : `${uploadedItems.length} files selected`}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {(uploadedItems.reduce((sum, item) => sum + item.file.size, 0) / (1024 * 1024)).toFixed(2)} MB
                              </p>
                            </div>
                            {uploadedItems.length > 0 && (
                              <div className="mt-2 grid w-full grid-cols-2 gap-2">
                                {uploadedItems.slice(0, 4).map((item, index) => {
                                  if (!item) return null;
                                  if (item.file.type.startsWith("image/")) {
                                    return (
                                      <img
                                        key={`${item.file.name}-${index}`}
                                        src={item.previewUrl}
                                        alt={`Preview ${index + 1}`}
                                        className="h-24 w-full rounded-xl object-cover shadow"
                                      />
                                    );
                                  }
                                  if (item.file.type.startsWith("video/")) {
                                    return (
                                      <video
                                        key={`${item.file.name}-${index}`}
                                        src={item.previewUrl}
                                        controls
                                        className="h-24 w-full rounded-xl object-cover shadow"
                                      />
                                    );
                                  }
                                  return (
                                    <div
                                      key={`${item.file.name}-${index}`}
                                      className="flex h-24 w-full items-center justify-center rounded-xl bg-muted/40 text-xs text-muted-foreground"
                                    >
                                      Audio file
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="p-3 sm:p-5 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 mb-1 sm:mb-2">
                              <Upload className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                            </div>
                            <div className="space-y-1 sm:space-y-2">
                              <p className="text-sm sm:text-base font-semibold text-foreground">
                                Drag & drop or click to upload
                              </p>
                              <p className="text-[10px] sm:text-xs text-muted-foreground">
                                Images, Videos, or Audio - Max 100MB
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </label>
                  </div>

                  {uploadedItems.length > 0 && (
                    <div className="space-y-3 sm:space-y-5 pt-2 border-t border-border/30">
                      {uploadedItems.length > 1 && (
                        <div className="space-y-2">
                          <Label className="text-xs sm:text-sm font-medium text-foreground">
                            Reorder media
                          </Label>
                          <Reorder.Group
                            axis="y"
                            values={uploadedItems}
                            onReorder={setUploadedItems}
                            className="space-y-2"
                          >
                            {uploadedItems.map((item, index) => (
                              <Reorder.Item
                                key={item.id}
                                value={item}
                                className="flex items-center gap-2 rounded-2xl border border-border/30 bg-muted/20 px-2 py-2"
                              >
                                <button
                                  type="button"
                                  className="flex h-7 w-7 items-center justify-center rounded-full border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-grab active:cursor-grabbing"
                                  aria-label="Drag to reorder"
                                >
                                  <GripVertical className="h-3.5 w-3.5" />
                                </button>
                                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-muted/40 flex items-center justify-center">
                                  {item.previewUrl && item.file.type.startsWith("image/") ? (
                                    <img
                                      src={item.previewUrl}
                                      alt={item.file.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : item.previewUrl && item.file.type.startsWith("video/") ? (
                                    <video
                                      src={item.previewUrl}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    getFileIcon(item.file)
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold text-foreground truncate">
                                    {item.file.name}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {(item.file.size / (1024 * 1024)).toFixed(2)} MB
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeUpload(index)}
                                  className="h-7 w-7 rounded-full border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                  aria-label="Remove file"
                                >
                                  <X className="h-3.5 w-3.5 mx-auto" />
                                </button>
                              </Reorder.Item>
                            ))}
                          </Reorder.Group>
                        </div>
                      )}
                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="upload-title" className="text-xs sm:text-sm font-medium text-foreground">
                          Title <span className="text-red-500">*</span>
                        </Label>
                        <div className="bg-muted/30 dark:bg-muted/20 rounded-2xl p-1 border border-border/30">
                          <Input
                            id="upload-title"
                            value={uploadTitle}
                            onChange={(e) => setUploadTitle(e.target.value)}
                            placeholder="Enter content title"
                            className="bg-transparent border-0 h-9 sm:h-11 px-3 sm:px-4 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                            data-testid="input-upload-title"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="upload-description" className="text-xs sm:text-sm font-medium text-foreground">
                          Description
                        </Label>
                        <div className="bg-muted/30 dark:bg-muted/20 rounded-2xl p-1 border border-border/30">
                          <Textarea
                            id="upload-description"
                            value={uploadDescription}
                            onChange={(e) => setUploadDescription(e.target.value)}
                            placeholder="Describe your content (optional)"
                            className="bg-transparent border-0 resize-none px-3 sm:px-4 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                            rows={3}
                            data-testid="input-upload-description"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="upload-author" className="text-xs sm:text-sm font-medium text-foreground">
                          Creator Name
                        </Label>
                        <div className="bg-muted/30 dark:bg-muted/20 rounded-2xl p-1 border border-border/30">
                          <Input
                            id="upload-author"
                            value={uploadAuthor}
                            onChange={(e) => setUploadAuthor(e.target.value)}
                            placeholder="Your name or username (optional)"
                            className="bg-transparent border-0 h-9 sm:h-11 px-3 sm:px-4 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                            data-testid="input-upload-author"
                          />
                        </div>
                      </div>

                      <Button
                        onClick={handleUploadPreview}
                        disabled={isUploading || !uploadTitle}
                        className="w-full h-10 sm:h-12 text-sm sm:text-base bg-gradient-to-r from-primary to-primary hover:from-primary/100 hover:to-primary/90 text-primary-foreground font-semibold rounded-2xl transition-all"
                        data-testid="button-upload-preview"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5 mr-2" />
                            Preview & Create Coin
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-lg w-[92vw] max-h-[80vh] overflow-y-auto bg-card border-border/50 rounded-3xl p-0 gap-0">
            <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/30">
              <DialogTitle className="text-lg font-bold text-foreground">
                Preview & Create Coin
              </DialogTitle>
            </DialogHeader>
            <div className="px-5 py-4">
              {scrapedData && (
                <ContentPreview
                  scrapedData={scrapedData}
                  collaboration={
                    createMode === "collab"
                      ? { mode: "collab", collaborators: collabList }
                      : undefined
                  }
                  onCoinCreated={handleCoinCreated}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
