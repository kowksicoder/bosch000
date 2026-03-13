import { useState } from "react";
import URLInputForm from "@/components/url-input-form";
import ContentPreviewCard from "@/components/content-preview-card";
import Layout from "@/components/layout";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
  Loader2,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type TabType = "import" | "upload";

export default function Create() {
  const [showPreview, setShowPreview] = useState(false);
  const [scrapedData, setScrapedData] = useState<any>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string>("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadAuthor, setUploadAuthor] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("import");
  const { toast } = useToast();

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
    setUploadedFile(null);
    setUploadPreviewUrl("");
    setUploadTitle("");
    setUploadDescription("");
    setUploadAuthor("");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "audio/mpeg",
      "audio/wav",
      "audio/mp3",
      "audio/ogg",
      "audio/aac",
    ];
    const maxSize = 100 * 1024 * 1024; // 100MB

    if (!validTypes.includes(file.type)) {
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
        description: "Maximum file size is 100MB",
        variant: "destructive",
      });
      return;
    }

    setUploadedFile(file);
    const previewUrl = URL.createObjectURL(file);
    setUploadPreviewUrl(previewUrl);

    if (!uploadTitle) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setUploadTitle(nameWithoutExt);
    }
  };

  const handleUploadPreview = async () => {
    if (!uploadedFile || !uploadTitle) {
      toast({
        title: "Missing information",
        description: "Please upload a file and provide a title",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);
      formData.append("title", uploadTitle);
      formData.append("description", uploadDescription);
      formData.append("author", uploadAuthor);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload file");
      }

      const { uploadData } = await uploadRes.json();

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
        description: "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getFileIcon = () => {
    if (!uploadedFile) return <FileText className="w-6 h-6" />;
    const type = uploadedFile.type.split("/")[0];
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

  return (
    <Layout>
      <div className="p-4 sm:p-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-primary" />
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">
                Create Your Coin
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Transform any content into a tradeable digital asset
            </p>
          </div>

          {/* Compact Tab Switcher */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <button
              onClick={() => setActiveTab("import")}
              className={`
                relative flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all
                ${
                  activeTab === "import"
                    ? "bg-gradient-to-r from-primary to-secondary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                }
              `}
            >
              <LinkIcon className="w-4 h-4" />
              Import URL
            </button>
            <button
              onClick={() => setActiveTab("upload")}
              className={`
                relative flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all
                ${
                  activeTab === "upload"
                    ? "bg-gradient-to-r from-primary to-secondary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                }
              `}
            >
              <Upload className="w-4 h-4" />
              Upload File
            </button>
          </div>

          {/* Tab Content */}
          <div className="mb-6">
            {activeTab === "import" ? (
              <URLInputForm onScraped={handleScrapedData} />
            ) : (
              <div className="max-w-xl mx-auto">
                <div className="bg-card border border-border/50 rounded-3xl p-8">
                  <div className="space-y-6">
                    {/* Upload Area */}
                    <div className="border-2 border-dashed border-border/40 rounded-2xl p-10 text-center bg-muted/20 hover:border-primary/50 transition-all hover:bg-muted/30">
                      <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        accept="image/*,video/*,audio/*,.mov"
                        onChange={handleFileUpload}
                      />
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <div className="flex flex-col items-center gap-4">
                          {uploadedFile ? (
                            <>
                              <div className="p-4 rounded-2xl bg-primary/10">
                                {getFileIcon()}
                              </div>
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-foreground">
                                  {uploadedFile.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {(uploadedFile.size / (1024 * 1024)).toFixed(
                                    2,
                                  )}{" "}
                                  MB
                                </p>
                              </div>
                              {uploadPreviewUrl &&
                                uploadedFile.type.startsWith("image/") && (
                                  <img
                                    src={uploadPreviewUrl}
                                    alt="Preview"
                                    className="mt-2 max-h-48 rounded-2xl shadow-xl"
                                  />
                                )}
                              {uploadPreviewUrl &&
                                uploadedFile.type.startsWith("video/") && (
                                  <video
                                    src={uploadPreviewUrl}
                                    controls
                                    className="mt-2 max-h-48 rounded-2xl shadow-xl"
                                  />
                                )}
                            </>
                          ) : (
                            <>
                              <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 mb-2">
                                <Upload className="w-10 h-10 text-primary" />
                              </div>
                              <div className="space-y-2">
                                <p className="text-base font-semibold text-foreground">
                                  Drag & drop or click to upload
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Images, Videos, or Audio • Max 50MB
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      </label>
                    </div>

                    {/* Form Fields - Only show if file is uploaded */}
                    {uploadedFile && (
                      <div className="space-y-5 pt-2 border-t border-border/30">
                        <div className="space-y-2">
                          <Label
                            htmlFor="upload-title"
                            className="text-sm font-medium text-foreground"
                          >
                            Title <span className="text-red-500">*</span>
                          </Label>
                          <div className="bg-muted/30 dark:bg-muted/20 rounded-2xl p-1 border border-border/30">
                            <Input
                              id="upload-title"
                              value={uploadTitle}
                              onChange={(e) => setUploadTitle(e.target.value)}
                              placeholder="Enter content title"
                              className="bg-transparent border-0 h-11 px-4 focus-visible:ring-0 focus-visible:ring-offset-0"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label
                            htmlFor="upload-description"
                            className="text-sm font-medium text-foreground"
                          >
                            Description
                          </Label>
                          <div className="bg-muted/30 dark:bg-muted/20 rounded-2xl p-1 border border-border/30">
                            <Textarea
                              id="upload-description"
                              value={uploadDescription}
                              onChange={(e) =>
                                setUploadDescription(e.target.value)
                              }
                              placeholder="Describe your content (optional)"
                              className="bg-transparent border-0 resize-none px-4 focus-visible:ring-0 focus-visible:ring-offset-0"
                              rows={3}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label
                            htmlFor="upload-author"
                            className="text-sm font-medium text-foreground"
                          >
                            Creator Name
                          </Label>
                          <div className="bg-muted/30 dark:bg-muted/20 rounded-2xl p-1 border border-border/30">
                            <Input
                              id="upload-author"
                              value={uploadAuthor}
                              onChange={(e) => setUploadAuthor(e.target.value)}
                              placeholder="Your name or username (optional)"
                              className="bg-transparent border-0 h-11 px-4 focus-visible:ring-0 focus-visible:ring-offset-0"
                            />
                          </div>
                        </div>

                        <Button
                          onClick={handleUploadPreview}
                          disabled={isUploading || !uploadTitle}
                          className="w-full h-12 bg-gradient-to-r from-primary to-primary hover:from-primary/100 hover:to-primary/90 text-primary-foreground font-semibold rounded-2xl transition-all"
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

          {/* Preview Modal */}
          <Dialog open={showPreview} onOpenChange={setShowPreview}>
            <DialogContent className="max-w-lg w-[92vw] max-h-[80vh] overflow-y-auto bg-card border-border/50 rounded-3xl p-0 gap-0">
              <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/30">
                <DialogTitle className="text-lg font-bold text-foreground">
                  Preview & Create Coin
                </DialogTitle>
              </DialogHeader>
              <div className="px-5 py-4">
                {scrapedData && (
                  <ContentPreviewCard
                    scrapedData={scrapedData}
                    onCoinCreated={handleCoinCreated}
                  />
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </Layout>
  );
}
