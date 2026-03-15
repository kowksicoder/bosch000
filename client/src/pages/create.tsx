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

type CreateMode = "solo" | "collab" | "community";
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
  const [manualTitle, setManualTitle] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualAuthor, setManualAuthor] = useState("");
  const [manualImageUrl, setManualImageUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadDetails, setShowUploadDetails] = useState(false);
  const [showManualDetails, setShowManualDetails] = useState(false);
  const [showUploadReorder, setShowUploadReorder] = useState(false);
  const [showManualSection, setShowManualSection] = useState(false);
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
    setManualTitle("");
    setManualDescription("");
    setManualAuthor("");
    setManualImageUrl("");
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

  useEffect(() => {
    if (uploadedItems.length <= 1 && showUploadReorder) {
      setShowUploadReorder(false);
    }
  }, [uploadedItems.length, showUploadReorder]);

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

  const handleManualPreview = () => {
    if (!manualTitle.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide a title for your coin.",
        variant: "destructive",
      });
      return;
    }

    const manualMedia = manualImageUrl
      ? [{ url: manualImageUrl, type: "image" }]
      : [];

    setScrapedData({
      title: manualTitle,
      description: manualDescription,
      author: manualAuthor,
      platform: "Every1",
      url: "",
      image: manualImageUrl,
      type: "manual",
      metadata: manualMedia.length
        ? {
            media: manualMedia,
            isCarousel: false,
          }
        : undefined,
    });
    setShowPreview(true);
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
    <div className="px-4 py-5 sm:px-8 sm:py-8">
      <div className="max-w-xl mx-auto">
        <div className="rounded-[28px] border border-border/40 bg-card/95 p-4 sm:p-6 shadow-sm">
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h1 className="text-lg sm:text-xl font-semibold text-foreground">
                Create a coin
              </h1>
            </div>
            <p className="mt-1 text-[11px] sm:text-xs text-muted-foreground">
              Choose a type, add content, then preview before minting.
            </p>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl bg-card/70 p-3">
              <div className="text-xs font-semibold text-foreground">Coin type</div>
              <div className="mt-2 flex items-center gap-1 rounded-full bg-muted/30 p-1">
                {[
                  { id: "solo", label: "Solo" },
                  { id: "collab", label: "Collab" },
                  { id: "community", label: "Community" },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setCreateMode(option.id as CreateMode)}
                    className={`flex-1 rounded-full py-1 text-[11px] font-semibold transition ${
                      createMode === option.id
                        ? "bg-foreground text-background"
                        : "text-muted-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {createMode === "collab" && (
              <div className="rounded-2xl border border-border/50 bg-card/70 p-3">
                <div className="text-xs font-semibold text-foreground">Add collaborators</div>
                <div className="mt-2 max-w-2xl mx-auto space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Add collaborator wallets or handles. Each collaborator will see this collab in their dashboard.
                  </p>
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

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-card/70 p-2">
              <div className="text-[9px] font-semibold text-foreground">Import</div>
                <div className="mt-1">
                  <URLInputForm onScraped={handleScrapedData} />
                </div>
              </div>

              <div className="rounded-2xl bg-card/70 p-2">
              <div className="text-[9px] font-semibold text-foreground">Upload</div>
              <div className="mt-1 space-y-1.5">
                <div className="border border-dashed border-border/30 rounded-xl p-2.5 text-center bg-muted/20 hover:border-primary/50 transition-all hover:bg-muted/30">
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
                    <div className="flex flex-col items-center gap-1">
                      {uploadedItems.length ? (
                        <>
                          <div className="p-2 rounded-lg bg-primary/10">
                            {getFileIcon(uploadedItems[0]?.file)}
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[11px] font-semibold text-foreground">
                              {uploadedItems.length === 1
                                ? uploadedItems[0].file.name
                                : `${uploadedItems.length} files selected`}
                            </p>
                            <p className="text-[9px] text-muted-foreground">
                              {(uploadedItems.reduce((sum, item) => sum + item.file.size, 0) / (1024 * 1024)).toFixed(2)} MB
                            </p>
                          </div>
                          {uploadedItems.length > 0 && (
                            <div className="mt-1.5 grid w-full grid-cols-2 gap-2">
                              {uploadedItems.slice(0, 4).map((item, index) => {
                                if (!item) return null;
                                if (item.file.type.startsWith("image/")) {
                                  return (
                                    <img
                                      key={`${item.file.name}-${index}`}
                                      src={item.previewUrl}
                                      alt={`Preview ${index + 1}`}
                                      className="h-20 w-full rounded-lg object-cover shadow"
                                    />
                                  );
                                }
                                if (item.file.type.startsWith("video/")) {
                                  return (
                                    <video
                                      key={`${item.file.name}-${index}`}
                                      src={item.previewUrl}
                                      controls
                                      className="h-20 w-full rounded-lg object-cover shadow"
                                    />
                                  );
                                }
                                return (
                                  <div
                                    key={`${item.file.name}-${index}`}
                                    className="flex h-20 w-full items-center justify-center rounded-lg bg-muted/40 text-[10px] text-muted-foreground"
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
                          <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 mb-1">
                            <Upload className="w-5 h-5 text-primary" />
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[11px] font-semibold text-foreground">
                              Tap to upload
                            </p>
                            <p className="text-[9px] text-muted-foreground">
                              Images, video, audio (100MB max)
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </label>
                </div>

                {uploadedItems.length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-border/20">
                  {uploadedItems.length > 1 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-foreground">
                          Reorder media
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowUploadReorder((prev) => !prev)}
                          className="text-[10px] font-semibold text-primary hover:text-primary/80"
                        >
                          {showUploadReorder ? "Hide" : "Reorder"}
                        </button>
                      </div>
                      {showUploadReorder && (
                        <Reorder.Group
                          axis="y"
                          values={uploadedItems}
                          onReorder={setUploadedItems}
                          className="space-y-1.5"
                        >
                          {uploadedItems.map((item, index) => (
                            <Reorder.Item
                              key={item.id}
                              value={item}
                              className="flex items-center gap-2 rounded-xl border border-border/30 bg-muted/20 px-2 py-1.5"
                            >
                              <button
                                type="button"
                                className="flex h-6 w-6 items-center justify-center rounded-full border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-grab active:cursor-grabbing"
                                aria-label="Drag to reorder"
                              >
                                <GripVertical className="h-3 w-3" />
                              </button>
                              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-muted/40 flex items-center justify-center">
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
                                <p className="text-[10px] font-semibold text-foreground truncate">
                                  {item.file.name}
                                </p>
                                <p className="text-[9px] text-muted-foreground">
                                  {(item.file.size / (1024 * 1024)).toFixed(2)} MB
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeUpload(index)}
                                className="h-6 w-6 rounded-full border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                aria-label="Remove file"
                              >
                                <X className="h-3 w-3 mx-auto" />
                              </button>
                            </Reorder.Item>
                          ))}
                        </Reorder.Group>
                      )}
                    </div>
                  )}
                  <div className="grid gap-2 min-[380px]:grid-cols-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="upload-title" className="text-[10px] font-medium text-foreground">
                        Title <span className="text-red-500">*</span>
                        </Label>
                        <div className="bg-muted/30 dark:bg-muted/20 rounded-lg p-0.5 border border-border/20">
                          <Input
                            id="upload-title"
                            value={uploadTitle}
                            onChange={(e) => setUploadTitle(e.target.value)}
                            placeholder="Content title"
                            className="bg-transparent border-0 h-8 px-3 text-[11px] focus-visible:ring-0 focus-visible:ring-offset-0"
                            data-testid="input-upload-title"
                          />
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <Label htmlFor="upload-author" className="text-[10px] font-medium text-foreground">
                          Creator
                        </Label>
                        <div className="bg-muted/30 dark:bg-muted/20 rounded-lg p-0.5 border border-border/20">
                          <Input
                            id="upload-author"
                            value={uploadAuthor}
                            onChange={(e) => setUploadAuthor(e.target.value)}
                            placeholder="Name or handle"
                            className="bg-transparent border-0 h-8 px-3 text-[11px] focus-visible:ring-0 focus-visible:ring-offset-0"
                            data-testid="input-upload-author"
                          />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => setShowUploadDetails((prev) => !prev)}
                      className="text-[10px] font-semibold text-primary hover:text-primary/80"
                    >
                      {showUploadDetails ? "Hide details" : "Add details"}
                    </button>
                  </div>

                  {showUploadDetails && (
                    <div className="space-y-0.5">
                      <Label htmlFor="upload-description" className="text-[10px] font-medium text-foreground">
                        Description
                      </Label>
                      <div className="bg-muted/30 dark:bg-muted/20 rounded-lg p-0.5 border border-border/20">
                        <Textarea
                          id="upload-description"
                          value={uploadDescription}
                          onChange={(e) => setUploadDescription(e.target.value)}
                          placeholder="Short description (optional)"
                          className="bg-transparent border-0 resize-none px-3 text-[11px] focus-visible:ring-0 focus-visible:ring-offset-0"
                          rows={2}
                          data-testid="input-upload-description"
                        />
                      </div>
                    </div>
                  )}

                    <Button
                      onClick={handleUploadPreview}
                      disabled={isUploading || !uploadTitle}
                      className="w-full h-8 text-[11px] bg-gradient-to-r from-primary to-primary hover:from-primary/100 hover:to-primary/90 text-primary-foreground font-semibold rounded-lg transition-all"
                      data-testid="button-upload-preview"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Preview coin
                        </>
                      )}
                    </Button>
                  </div>
                )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-card/70 p-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-semibold text-foreground">Manual</div>
                <button
                  type="button"
                  onClick={() => setShowManualSection((prev) => !prev)}
                  className="text-[10px] font-semibold text-primary hover:text-primary/80"
                >
                  {showManualSection ? "Close" : "Open"}
                </button>
              </div>
              {showManualSection && (
                <div className="mt-1 space-y-2">
                  <div className="grid gap-2 min-[380px]:grid-cols-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="manual-title" className="text-[10px] font-medium text-foreground">
                        Title <span className="text-red-500">*</span>
                      </Label>
                      <div className="bg-muted/30 dark:bg-muted/20 rounded-lg p-0.5 border border-border/20">
                        <Input
                          id="manual-title"
                          value={manualTitle}
                          onChange={(e) => setManualTitle(e.target.value)}
                          placeholder="Coin title"
                          className="bg-transparent border-0 h-8 px-3 text-[11px] focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <Label htmlFor="manual-author" className="text-[10px] font-medium text-foreground">
                        Creator
                      </Label>
                      <div className="bg-muted/30 dark:bg-muted/20 rounded-lg p-0.5 border border-border/20">
                        <Input
                          id="manual-author"
                          value={manualAuthor}
                          onChange={(e) => setManualAuthor(e.target.value)}
                          placeholder="Name or handle"
                          className="bg-transparent border-0 h-8 px-3 text-[11px] focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => setShowManualDetails((prev) => !prev)}
                      className="text-[10px] font-semibold text-primary hover:text-primary/80"
                    >
                      {showManualDetails ? "Hide details" : "Add details"}
                    </button>
                  </div>

                  {showManualDetails && (
                    <div className="grid gap-2 min-[380px]:grid-cols-2">
                      <div className="space-y-0.5">
                        <Label htmlFor="manual-description" className="text-[10px] font-medium text-foreground">
                          Description
                        </Label>
                        <div className="bg-muted/30 dark:bg-muted/20 rounded-lg p-0.5 border border-border/20">
                          <Textarea
                            id="manual-description"
                            value={manualDescription}
                            onChange={(e) => setManualDescription(e.target.value)}
                            placeholder="Short description"
                            className="bg-transparent border-0 resize-none px-3 text-[11px] focus-visible:ring-0 focus-visible:ring-offset-0"
                            rows={2}
                          />
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <Label htmlFor="manual-image" className="text-[10px] font-medium text-foreground">
                          Cover URL
                        </Label>
                        <div className="bg-muted/30 dark:bg-muted/20 rounded-lg p-0.5 border border-border/20">
                          <Input
                            id="manual-image"
                            value={manualImageUrl}
                            onChange={(e) => setManualImageUrl(e.target.value)}
                            placeholder="https://..."
                            className="bg-transparent border-0 h-8 px-3 text-[11px] focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleManualPreview}
                    disabled={!manualTitle.trim()}
                    className="w-full h-8 text-[11px] bg-gradient-to-r from-primary to-primary hover:from-primary/100 hover:to-primary/90 text-primary-foreground font-semibold rounded-lg transition-all"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Preview coin
                  </Button>
                </div>
              )}
            </div>
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
    </div>
  );
}
