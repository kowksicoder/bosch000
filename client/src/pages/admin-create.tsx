
import { useState } from "react";
import URLInputForm from "@/components/url-input-form";
import ContentPreview from "@/components/content-preview";
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
  Shield,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type TabType = "import" | "upload";

export default function AdminCreate() {
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

    const maxSize = 100 * 1024 * 1024;

    // Accept all image, video, and audio files (matches backend handling)
    const isValidType = file.type.startsWith('image/') || 
                        file.type.startsWith('video/') || 
                        file.type.startsWith('audio/');

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
    <div className="p-3 sm:p-8 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-4 sm:mb-8 text-center">
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground">
              Admin Content Creation
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Import or upload content as an admin
          </p>
        </div>

        <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-4 sm:mb-6">
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
            Upload File
          </button>
        </div>

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
                      onChange={handleFileUpload}
                      data-testid="input-file-upload"
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
                                {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB
                              </p>
                            </div>
                            {uploadPreviewUrl && uploadedFile.type.startsWith("image/") && (
                              <img
                                src={uploadPreviewUrl}
                                alt="Preview"
                                className="mt-2 max-h-48 rounded-2xl shadow-xl"
                              />
                            )}
                            {uploadPreviewUrl && uploadedFile.type.startsWith("video/") && (
                              <video
                                src={uploadPreviewUrl}
                                controls
                                className="mt-2 max-h-48 rounded-2xl shadow-xl"
                              />
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
                                Images, Videos, or Audio • Max 100MB
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </label>
                  </div>

                  {uploadedFile && (
                    <div className="space-y-3 sm:space-y-5 pt-2 border-t border-border/30">
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
